import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LmsDiagnosticService } from './lms-diagnostic.service';
import { SubmitAssessmentDto, AssessmentSummaryDto, UpdateLearningModeDto, RecordBlobViewDto, ProgressDataModel } from './dto/lms.dto';
import { LearningMode, QuestionType } from './enums/lms-enums';

@Injectable()
export class LmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosticService: LmsDiagnosticService,
  ) {}

  async getEnrollment(id: string) {
    const enrollment = await this.prisma.lmsEnrollment.findUnique({
      where: { id },
      include: {
        contact: {
          select: {
            id: true,
            contactId: true,
            givenName: true,
            surname: true,
            emailAddress: true,
          },
        },
        learningPlan: {
          include: {
            courseCode: true,
          },
        },
        workshopProgress: true,
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`LMS Enrollment with ID '${id}' not found`);
    }

    return {
      id: enrollment.id,
      contactId: enrollment.contactId,
      instanceId: enrollment.instanceId,
      learningPlanId: enrollment.learningPlanId,
      learningMode: enrollment.learningMode,
      enrolledAt: enrollment.enrolledAt,
      completedAt: enrollment.completedAt,
      isActive: enrollment.isActive,
      currentScore: enrollment.currentScore,
      possibleScore: enrollment.possibleScore,
      isCompetent: enrollment.isCompetent,
      student: {
        id: enrollment.contact.id,
        contactId: enrollment.contact.contactId,
        firstName: enrollment.contact.givenName || 'Student',
        lastName: enrollment.contact.surname || '',
        email: enrollment.contact.emailAddress || '',
      },
      unit: {
        id: enrollment.learningPlan?.courseCode?.id ?? 0,
        unitCode: enrollment.learningPlan?.courseCode?.code ?? enrollment.courseCodeStr ?? 'HLTAID',
        title: enrollment.learningPlan?.courseCode?.name || enrollment.learningPlan?.courseCode?.code || enrollment.courseCodeStr || 'HLTAID Course',
        description: enrollment.learningPlan?.description || enrollment.learningPlan?.courseCode?.shortName || '',
      },
    };
  }

  async updateLearningMode(id: string, dto: UpdateLearningModeDto) {
    const enrollment = await this.prisma.lmsEnrollment.findUnique({ where: { id } });
    if (!enrollment) {
      throw new NotFoundException(`LMS Enrollment with ID '${id}' not found`);
    }

    return this.prisma.lmsEnrollment.update({
      where: { id },
      data: { learningMode: dto.learningMode },
    });
  }

  async getEnrollmentContent(id: string) {
    const enrollment = await this.prisma.lmsEnrollment.findUnique({
      where: { id },
      include: {
        learningPlan: {
          include: {
            planChapters: {
              orderBy: { sortOrder: 'asc' },
              include: {
                chapter: {
                  include: {
                    blobs: {
                      orderBy: { sortOrder: 'asc' },
                      include: {
                        knowledgeEvidences: {
                          select: { id: true, code: true, title: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment || !enrollment.learningPlan) {
      throw new NotFoundException(`Enrollment '${id}' or its learning plan not found`);
    }

    let chapters: any[] = [];
    if (enrollment.learningPlan.planChapters && enrollment.learningPlan.planChapters.length > 0) {
      chapters = enrollment.learningPlan.planChapters.map((pc) => pc.chapter);
    } else {
      const courseCodeId = enrollment.learningPlan.courseCodeId;
      chapters = await this.prisma.lmsChapter.findMany({
        where: courseCodeId ? { courseCodeId } : undefined,
        orderBy: { sortOrder: 'asc' },
        include: {
          blobs: {
            orderBy: { sortOrder: 'asc' },
            include: {
              knowledgeEvidences: {
                select: { id: true, code: true, title: true },
              },
            },
          },
        },
      });
    }

    const progressData: ProgressDataModel = enrollment.progressData && typeof enrollment.progressData === 'object'
      ? (enrollment.progressData as any)
      : {
          answeredQuestions: [],
          viewedBlobs: [],
          requiredReview: [],
          assessmentAttempts: [],
          lastActivityAt: new Date().toISOString(),
          currentQuestionIndex: 0,
          isCompetent: false,
        };

    const viewedBlobIds = new Set((progressData.viewedBlobs || []).map((v) => v.blobId));
    const requiredReviewBlobIds = new Set(progressData.requiredReview || []);
    const isOverallCompetent = enrollment.isCompetent;

    const formattedChapters = chapters.map((ch) => ({
      ...ch,
      blobs: ch.blobs.map((b) => {
        let status: 'unread' | 'viewed' | 'competent' | 'needs_review' = 'unread';

        if (requiredReviewBlobIds.has(b.id)) {
          status = 'needs_review';
        } else if (isOverallCompetent) {
          status = 'competent';
        } else if (viewedBlobIds.has(b.id)) {
          status = 'viewed';
        }

        return {
          ...b,
          contentHtml: b.contentHtml ? b.contentHtml.replace(/(?:https?:\/\/[^\/]+)?(?:\/api)?\/proxy\//g, '/api/proxy/') : b.contentHtml,
          status,
        };
      }),
    }));

    return {
      enrollmentId: enrollment.id,
      chapters: formattedChapters,
      isOverallCompetent,
      requiredReviewCount: requiredReviewBlobIds.size,
    };
  }

  async getQuestionsForUnit(unitCode: string, enrollmentId?: string) {
    let plan: any = null;

    if (enrollmentId) {
      const enrollment = await this.prisma.lmsEnrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          learningPlan: {
            include: {
              planQuestions: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  question: {
                    include: {
                      coreLearningBlob: true,
                      supportLearningBlob: true,
                    },
                  },
                },
              },
              planQuestionBanks: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  questionBank: {
                    include: {
                      questions: {
                        include: {
                          coreLearningBlob: true,
                          supportLearningBlob: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (enrollment?.learningPlan) {
        plan = enrollment.learningPlan;
      }
    }

    if (!plan) {
      const cleanCode = unitCode ? unitCode.trim() : '';
      const courseCode = await this.prisma.courseCode.findFirst({
        where: {
          OR: [
            { code: { equals: cleanCode, mode: 'insensitive' } },
            { name: { contains: cleanCode, mode: 'insensitive' } },
          ],
        },
        include: {
          learningPlans: {
            where: { status: 'PUBLISHED' },
            orderBy: [{ isDefault: 'desc' }, { id: 'desc' }],
            take: 1,
            include: {
              planQuestions: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  question: {
                    include: {
                      coreLearningBlob: true,
                      supportLearningBlob: true,
                    },
                  },
                },
              },
              planQuestionBanks: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  questionBank: {
                    include: {
                      questions: {
                        include: {
                          coreLearningBlob: true,
                          supportLearningBlob: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      plan = courseCode?.learningPlans[0];

      if (!plan && courseCode) {
        plan = (await this.prisma.learningPlan.findFirst({
          where: { courseCodeId: courseCode.id },
          orderBy: { id: 'desc' },
          include: {
            planQuestions: {
              orderBy: { sortOrder: 'asc' },
              include: {
                question: {
                  include: {
                    coreLearningBlob: true,
                    supportLearningBlob: true,
                  },
                },
              },
            },
            planQuestionBanks: {
              orderBy: { sortOrder: 'asc' },
              include: {
                questionBank: {
                  include: {
                    questions: {
                      include: {
                        coreLearningBlob: true,
                        supportLearningBlob: true,
                      },
                    },
                  },
                },
              },
            },
          },
        })) as any;
      }
    }

    if (!plan) {
      throw new NotFoundException(`Learning plan for unit '${unitCode}' not found`);
    }

    const assessmentItems: Array<{ sortOrder: number; questions: any[] }> = [];

    for (const pq of plan.planQuestions || []) {
      if (!pq.question) continue;
      assessmentItems.push({
        sortOrder: pq.sortOrder ?? 0,
        questions: [{ ...pq.question, points: pq.points ?? pq.question.points }],
      });
    }

    for (const pqb of plan.planQuestionBanks || []) {
      const bank = pqb.questionBank;
      if (!bank || !bank.questions || bank.questions.length === 0) continue;

      const orderList = Array.isArray(bank.questionOrder) ? (bank.questionOrder as string[]) : [];
      const sortedBankQuestions = orderList.length > 0
        ? [...bank.questions].sort((a, b) => {
            const idxA = orderList.indexOf(a.id);
            const idxB = orderList.indexOf(b.id);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return 0;
          })
        : bank.questions;

      assessmentItems.push({
        sortOrder: pqb.sortOrder ?? 0,
        questions: sortedBankQuestions,
      });
    }

    assessmentItems.sort((a, b) => a.sortOrder - b.sortOrder);

    const allQuestions = assessmentItems.flatMap((item) => item.questions);

    if (allQuestions.length === 0) {
      throw new NotFoundException(`No active questions found for unit '${unitCode}'`);
    }

    return allQuestions.map((q) => {
      const parsedData = typeof q.questionData === 'string'
        ? JSON.parse(q.questionData)
        : q.questionData;

      return {
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        questionData: parsedData,
        points: q.points ?? 1,
        coreLearningBlobId: q.coreLearningBlobId,
        supportLearningBlobId: q.supportLearningBlobId,
        coreLearningBlob: q.coreLearningBlob,
        supportLearningBlob: q.supportLearningBlob,
      };
    });
  }

  async submitAssessment(dto: SubmitAssessmentDto): Promise<AssessmentSummaryDto> {
    return this.diagnosticService.submitAssessment(dto);
  }

  async recordBlobView(enrollmentId: string, dto: RecordBlobViewDto) {
    const enrollment = await this.prisma.lmsEnrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment '${enrollmentId}' not found`);
    }

    const progressData: ProgressDataModel = enrollment.progressData && typeof enrollment.progressData === 'object'
      ? (enrollment.progressData as any)
      : {
          answeredQuestions: [],
          viewedBlobs: [],
          requiredReview: [],
          assessmentAttempts: [],
          lastActivityAt: new Date().toISOString(),
          currentQuestionIndex: 0,
          isCompetent: false,
        };

    progressData.viewedBlobs = progressData.viewedBlobs || [];

    if (dto.completedView === false) {
      // Unmark: remove from viewedBlobs & requiredReview
      progressData.viewedBlobs = progressData.viewedBlobs.filter((v) => v.blobId !== dto.blobId);
      if (progressData.requiredReview) {
        progressData.requiredReview = progressData.requiredReview.filter((id) => id !== dto.blobId);
      }
    } else {
      const existingView = progressData.viewedBlobs.find((v) => v.blobId === dto.blobId);
      if (existingView) {
        existingView.viewedAt = new Date().toISOString();
        existingView.viewDurationSeconds = Math.max(existingView.viewDurationSeconds, dto.viewDurationSeconds);
        existingView.completedView = true;
      } else {
        progressData.viewedBlobs.push({
          blobId: dto.blobId,
          blobType: dto.blobType || 'Core',
          viewedAt: new Date().toISOString(),
          viewDurationSeconds: dto.viewDurationSeconds,
          completedView: true,
        });
      }
    }

    progressData.lastActivityAt = new Date().toISOString();

    return this.prisma.lmsEnrollment.update({
      where: { id: enrollmentId },
      data: { progressData: progressData as any },
    });
  }

  async getAssessmentLogs(enrollmentId: string) {
    return this.prisma.lmsAssessmentLog.findMany({
      where: { enrollmentId },
      orderBy: { createdAt: 'desc' },
      include: {
        question: { select: { id: true, questionText: true, type: true } },
      },
    });
  }

  async transferEnrollment(dto: {
    enrollmentId: string;
    newInstanceId?: number;
    targetCourseCodeId?: number;
    targetLearningPlanId?: number;
  }) {
    const enrollment = await this.prisma.lmsEnrollment.findUnique({
      where: { id: dto.enrollmentId },
      include: {
        learningPlan: {
          include: {
            courseCode: true,
            planChapters: {
              include: { chapter: { include: { blobs: { include: { knowledgeEvidences: true } } } } },
            },
            planQuestions: {
              include: { question: { include: { knowledgeEvidences: true } } },
            },
          },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundException(`Enrollment '${dto.enrollmentId}' not found`);
    }

    const currentCourseCodeId = enrollment.learningPlan?.courseCodeId;
    const isSameCourseCode =
      !dto.targetCourseCodeId ||
      dto.targetCourseCodeId === currentCourseCodeId;

    if (isSameCourseCode && (!dto.targetLearningPlanId || dto.targetLearningPlanId === enrollment.learningPlanId)) {
      // Same-Unit Transfer: update instanceId only, preserve active LmsEnrollment & learningPlanId & progressData
      return this.prisma.lmsEnrollment.update({
        where: { id: dto.enrollmentId },
        data: { instanceId: dto.newInstanceId ?? enrollment.instanceId },
      });
    }

    // Cross-Course Transfer or Plan Migration
    const targetPlanId = dto.targetLearningPlanId || (dto.targetCourseCodeId
      ? (await this.prisma.learningPlan.findFirst({
          where: { courseCodeId: dto.targetCourseCodeId, isDefault: true, status: 'PUBLISHED' },
        }))?.id || (await this.prisma.learningPlan.findFirst({
          where: { courseCodeId: dto.targetCourseCodeId },
          orderBy: { id: 'desc' },
        }))?.id
      : enrollment.learningPlanId);

    if (!targetPlanId) {
      throw new BadRequestException(`No suitable target Learning Plan found for course code ID ${dto.targetCourseCodeId}`);
    }

    const targetPlan = await this.prisma.learningPlan.findUnique({
      where: { id: targetPlanId },
      include: {
        courseCode: true,
        planChapters: {
          include: { chapter: { include: { blobs: { include: { knowledgeEvidences: true } } } } },
        },
        planQuestions: {
          include: { question: { include: { knowledgeEvidences: true } } },
        },
        planQuestionBanks: {
          include: { questionBank: { include: { questions: { include: { knowledgeEvidences: true } } } } },
        },
      },
    });

    if (!targetPlan) {
      throw new NotFoundException(`Target learning plan '${targetPlanId}' not found`);
    }

    // Find satisfied KEs from source enrollment
    const sourceProgress: ProgressDataModel = enrollment.progressData && typeof enrollment.progressData === 'object'
      ? (enrollment.progressData as any)
      : { answeredQuestions: [], viewedBlobs: [], requiredReview: [], assessmentAttempts: [], lastActivityAt: new Date().toISOString(), currentQuestionIndex: 0, isCompetent: false };

    const satisfiedKeIds = new Set<string>();

    // Check source answered questions that were correct
    for (const aq of sourceProgress.answeredQuestions || []) {
      if (aq.isCorrect) {
        const sourceQ = enrollment.learningPlan?.planQuestions.find((pq) => pq.questionId === aq.questionId)?.question;
        for (const ke of sourceQ?.knowledgeEvidences || []) {
          satisfiedKeIds.add(ke.id);
        }
      }
    }

    // Check source viewed blobs
    for (const vb of sourceProgress.viewedBlobs || []) {
      if (vb.completedView) {
        for (const pc of enrollment.learningPlan?.planChapters || []) {
          const blob = pc.chapter?.blobs.find((b) => b.id === vb.blobId);
          for (const ke of blob?.knowledgeEvidences || []) {
            satisfiedKeIds.add(ke.id);
          }
        }
      }
    }

    // Auto-credit target blocks & questions that share satisfied KEs
    const newProgressData: ProgressDataModel = { ...sourceProgress };
    newProgressData.viewedBlobs = [...(newProgressData.viewedBlobs || [])];
    newProgressData.answeredQuestions = [...(newProgressData.answeredQuestions || [])];

    // Credit target blobs
    for (const pc of targetPlan.planChapters) {
      for (const blob of pc.chapter?.blobs || []) {
        const hasSharedKe = blob.knowledgeEvidences.some((ke) => satisfiedKeIds.has(ke.id));
        if (hasSharedKe && !newProgressData.viewedBlobs.some((v) => v.blobId === blob.id)) {
          newProgressData.viewedBlobs.push({
            blobId: blob.id,
            blobType: 'Core',
            viewedAt: new Date().toISOString(),
            viewDurationSeconds: blob.durationSeconds || 60,
            completedView: true,
          });
        }
      }
    }

    // Credit target questions
    const allTargetQuestions = [
      ...targetPlan.planQuestions.map((pq) => pq.question),
      ...targetPlan.planQuestionBanks.flatMap((pqb) => pqb.questionBank.questions),
    ];

    for (const q of allTargetQuestions) {
      const hasSharedKe = q.knowledgeEvidences.some((ke) => satisfiedKeIds.has(ke.id));
      if (hasSharedKe && !newProgressData.answeredQuestions.some((a) => a.questionId === q.id)) {
        newProgressData.answeredQuestions.push({
          questionId: q.id,
          questionType: q.type,
          answeredAt: new Date().toISOString(),
          isCorrect: true,
          pointsEarned: q.points || 1,
          answer: 'Credit Recognized from Previous Enrollment',
          attemptCount: 1,
        });
      }
    }

    newProgressData.lastActivityAt = new Date().toISOString();

    return this.prisma.lmsEnrollment.update({
      where: { id: dto.enrollmentId },
      data: {
        instanceId: dto.newInstanceId ?? enrollment.instanceId,
        learningPlanId: targetPlan.id,
        courseCodeStr: targetPlan.courseCode?.code || enrollment.courseCodeStr,
        progressData: newProgressData as any,
      },
      include: {
        learningPlan: { include: { courseCode: true } },
      },
    });
  }
}
