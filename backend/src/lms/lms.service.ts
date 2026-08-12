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
        learningPlan: true,
      },
    });

    if (!enrollment || !enrollment.learningPlan) {
      throw new NotFoundException(`Enrollment '${id}' or its learning plan not found`);
    }

    const courseCodeId = enrollment.learningPlan.courseCodeId;
    const chapters = await this.prisma.lmsChapter.findMany({
      where: { courseCodeId },
      orderBy: { sortOrder: 'asc' },
      include: {
        blobs: {
          orderBy: { sortOrder: 'asc' },
          include: {
            knowledgeEvidence: {
              select: { id: true, code: true, title: true },
            },
          },
        },
      },
    });

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

  async getQuestionsForUnit(unitCode: string) {
    const courseCode = await this.prisma.courseCode.findUnique({
      where: { code: unitCode },
      include: {
        learningPlans: {
          where: { isDefault: true, status: 'PUBLISHED' },
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
          },
        },
      },
    });

    // Fallback: If no PUBLISHED default plan, pick the latest plan for that course code
    let plan = courseCode?.learningPlans[0];
    if (!plan && courseCode) {
      plan = await this.prisma.learningPlan.findFirst({
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
        },
      }) as any;
    }

    if (!plan || !plan.planQuestions.length) {
      throw new NotFoundException(`Unit '${unitCode}' not found or has no active questions`);
    }

    return plan.planQuestions.map((pq) => {
      const q = pq.question;
      const parsedData = typeof q.questionData === 'string'
        ? JSON.parse(q.questionData)
        : q.questionData;

      return {
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        questionData: parsedData,
        points: pq.points ?? q.points,
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
    const existingView = progressData.viewedBlobs.find((v) => v.blobId === dto.blobId);

    if (existingView) {
      existingView.viewedAt = new Date().toISOString();
      existingView.viewDurationSeconds = Math.max(existingView.viewDurationSeconds, dto.viewDurationSeconds);
      if (dto.completedView) existingView.completedView = true;
    } else {
      progressData.viewedBlobs.push({
        blobId: dto.blobId,
        blobType: dto.blobType || 'Core',
        viewedAt: new Date().toISOString(),
        viewDurationSeconds: dto.viewDurationSeconds,
        completedView: dto.completedView ?? true,
      });
    }

    progressData.lastActivityAt = new Date().toISOString();

    return this.prisma.lmsEnrollment.update({
      where: { id: enrollmentId },
      data: { progressData: progressData as any },
    });
  }

  async seedSampleData() {
    // 1. CourseCodes
    const cprCode = await this.prisma.courseCode.upsert({
      where: { code: 'HLTAID009' },
      update: { name: 'Provide Cardiopulmonary Resuscitation', shortName: 'CPR' },
      create: { code: 'HLTAID009', name: 'Provide Cardiopulmonary Resuscitation', shortName: 'CPR' },
    });

    const faCode = await this.prisma.courseCode.upsert({
      where: { code: 'HLTAID011' },
      update: { name: 'Provide First Aid', shortName: 'First Aid' },
      create: { code: 'HLTAID011', name: 'Provide First Aid', shortName: 'First Aid' },
    });

    // 2. Knowledge Evidences
    let ke1 = await this.prisma.lmsKnowledgeEvidence.findFirst({ where: { code: 'KE01' } });
    if (!ke1) {
      ke1 = await this.prisma.lmsKnowledgeEvidence.create({
        data: {
          code: 'KE01',
          title: 'DRSABCD & Adult CPR Protocols',
          description: 'Knowledge of danger, response, airway, breathing, CPR and defibrillation',
          courseCodes: { connect: [{ id: faCode.id }, { id: cprCode.id }] },
        },
      });
    }

    let ke2 = await this.prisma.lmsKnowledgeEvidence.findFirst({ where: { code: 'KE02' } });
    if (!ke2) {
      ke2 = await this.prisma.lmsKnowledgeEvidence.create({
        data: {
          code: 'KE02',
          title: 'Automated External Defibrillator (AED) Operation',
          description: 'Safe operation and placement of AED pads during cardiac emergencies',
          courseCodes: { connect: [{ id: faCode.id }] },
        },
      });
    }

    // 3. Chapters
    let ch1 = await this.prisma.lmsChapter.findFirst({ where: { courseCodeId: faCode.id, title: 'Chapter 1: Initial Assessment & CPR' } });
    if (!ch1) {
      ch1 = await this.prisma.lmsChapter.create({
        data: {
          courseCodeId: faCode.id,
          title: 'Chapter 1: Initial Assessment & CPR',
          description: 'Understanding DRSABCD and executing effective CPR compressions',
          sortOrder: 1,
        },
      });
    }

    let ch2 = await this.prisma.lmsChapter.findFirst({ where: { courseCodeId: faCode.id, title: 'Chapter 2: Defibrillation & AED Usage' } });
    if (!ch2) {
      ch2 = await this.prisma.lmsChapter.create({
        data: {
          courseCodeId: faCode.id,
          title: 'Chapter 2: Defibrillation & AED Usage',
          description: 'Applying AED pads safely and obeying voice prompts',
          sortOrder: 2,
        },
      });
    }

    // 4. LearningBlobs (Blocks)
    let coreBlob = await this.prisma.lmsLearningBlob.findFirst({ where: { title: 'CPR Fundamentals' } });
    if (!coreBlob) {
      coreBlob = await this.prisma.lmsLearningBlob.create({
        data: {
          chapterId: ch1.id,
          knowledgeEvidenceId: ke1.id,
          title: 'CPR Fundamentals',
          description: 'Core CPR technique demonstration and 30:2 compression guidelines',
          contentHtml: '<p>When performing CPR on an adult, compress the chest at a rate of 100-120 compressions per minute to a depth of 5-6 cm. Maintain a ratio of 30 compressions followed by 2 rescue breaths.</p>',
          vimeoId: '123456789',
          durationSeconds: 300,
          sortOrder: 1,
        },
      });
    } else {
      await this.prisma.lmsLearningBlob.update({
        where: { id: coreBlob.id },
        data: { chapterId: ch1.id, knowledgeEvidenceId: ke1.id, contentHtml: '<p>When performing CPR on an adult, compress the chest at a rate of 100-120 compressions per minute to a depth of 5-6 cm. Maintain a ratio of 30 compressions followed by 2 rescue breaths.</p>' },
      });
    }

    let supportBlob = await this.prisma.lmsLearningBlob.findFirst({ where: { title: 'CPR Common Mistakes' } });
    if (!supportBlob) {
      supportBlob = await this.prisma.lmsLearningBlob.create({
        data: {
          chapterId: ch1.id,
          knowledgeEvidenceId: ke1.id,
          title: 'CPR Common Mistakes',
          description: 'What to avoid during CPR compressions and rescue breaths',
          contentHtml: '<p>Ensure compressions allow complete chest recoil between pumps. Avoid leaning on the chest or interrupting compressions for more than 10 seconds.</p>',
          vimeoId: '987654321',
          durationSeconds: 180,
          sortOrder: 2,
        },
      });
    } else {
      await this.prisma.lmsLearningBlob.update({
        where: { id: supportBlob.id },
        data: { chapterId: ch1.id, knowledgeEvidenceId: ke1.id, contentHtml: '<p>Ensure compressions allow complete chest recoil between pumps. Avoid leaning on the chest or interrupting compressions for more than 10 seconds.</p>' },
      });
    }

    // 3. LearningPlan for HLTAID011
    let plan = await this.prisma.learningPlan.findUnique({
      where: { courseCodeId_version: { courseCodeId: faCode.id, version: 'v1.0' } },
    });

    if (!plan) {
      plan = await this.prisma.learningPlan.create({
        data: {
          courseCodeId: faCode.id,
          version: 'v1.0',
          title: 'HLTAID011 Standard Assessment Plan v1.0',
          description: 'Comprehensive First Aid theory assessment',
          status: 'PUBLISHED',
          isDefault: true,
          effectiveFrom: new Date(),
        },
      });
    }

    // 4. Questions
    const existingPlanQuestions = await this.prisma.learningPlanQuestion.count({
      where: { learningPlanId: plan.id },
    });

    if (existingPlanQuestions === 0) {
      const q1 = await this.prisma.lmsQuestion.create({
        data: {
          type: QuestionType.MultipleChoiceSingle,
          questionText: 'What is the correct compression-to-breath ratio for adult CPR?',
          questionData: { options: ['A. 15:2', 'B. 30:2', 'C. 5:1', 'D. 100:2'] },
          correctAnswer: { answer: 'B' },
          points: 1,
          coreLearningBlobId: coreBlob.id,
          supportLearningBlobId: supportBlob.id,
        },
      });

      const q2 = await this.prisma.lmsQuestion.create({
        data: {
          type: QuestionType.FillInBlanks,
          questionText: 'During CPR, perform _____ compressions at a depth of _____ cm, followed by _____ rescue breaths.',
          questionData: { blanks: [{ index: 0, hint: 'number' }, { index: 1, hint: 'depth' }, { index: 2, hint: 'number' }] },
          correctAnswer: { blanks: ['30', '5-6', '2'] },
          points: 3,
          coreLearningBlobId: coreBlob.id,
        },
      });

      const q3 = await this.prisma.lmsQuestion.create({
        data: {
          type: QuestionType.MultipleChoiceMultiple,
          questionText: 'Which of the following are signs of effective CPR? (Select all that apply)',
          questionData: { options: ['A. Chest rises with breaths', 'B. Patient starts breathing', 'C. Color improves', 'D. Pulse returns'] },
          correctAnswer: { answers: ['A', 'C', 'D'] },
          points: 2,
          coreLearningBlobId: coreBlob.id,
        },
      });

      const q4 = await this.prisma.lmsQuestion.create({
        data: {
          type: QuestionType.OrderItems,
          questionText: 'Place the following steps in the correct order for using an AED:',
          questionData: { items: ['Turn on AED', 'Attach pads', 'Clear area and analyze', 'Deliver shock if advised', 'Resume CPR'] },
          correctAnswer: { order: [0, 1, 2, 3, 4] },
          points: 2,
        },
      });

      const q5 = await this.prisma.lmsQuestion.create({
        data: {
          type: QuestionType.MatchDefinitions,
          questionText: 'Match each first aid term with its correct definition:',
          questionData: {
            pairs: [
              { term: 'CPR', definition: 'Cardiopulmonary resuscitation to restore breathing and circulation' },
              { term: 'AED', definition: 'Automated External Defibrillator used to reset heart rhythm' },
              { term: 'Recovery Position', definition: 'Side-lying position to maintain open airway' },
            ],
          },
          correctAnswer: { matches: ['0-0', '1-1', '2-2'] },
          points: 3,
        },
      });

      const q6 = await this.prisma.lmsQuestion.create({
        data: {
          type: QuestionType.FreeText,
          questionText: "Describe the DRSABCD action plan and explain why it's important in first aid situations.",
          questionData: { minWords: 30, maxWords: 150 },
          correctAnswer: { keywords: ['danger', 'response', 'send for help', 'airway', 'breathing', 'CPR', 'defibrillator'], minScore: 0.6 },
          points: 4,
        },
      });

      const q7 = await this.prisma.lmsQuestion.create({
        data: {
          type: QuestionType.Forms,
          questionText: 'Complete the incident report form:',
          questionData: {
            fields: [
              { name: 'incidentDate', type: 'text', required: true, label: 'Date of Incident' },
              { name: 'location', type: 'text', required: true, label: 'Location' },
              { name: 'witnessName', type: 'text', required: false, label: 'Witness Name' },
              { name: 'description', type: 'text', required: true, label: 'Incident Description' },
            ],
          },
          correctAnswer: { required: ['incidentDate', 'location', 'description'] },
          points: 2,
        },
      });

      const questionsToLink = [q1, q2, q3, q4, q5, q6, q7];
      for (let i = 0; i < questionsToLink.length; i++) {
        await this.prisma.learningPlanQuestion.create({
          data: {
            learningPlanId: plan.id,
            questionId: questionsToLink[i].id,
            sortOrder: i + 1,
            points: questionsToLink[i].points,
          },
        });
      }
    }

    // 5. Test Student Contact
    let testContact = await this.prisma.contact.findFirst({ where: { emailAddress: 'john.doe@example.com' } });
    if (!testContact) {
      testContact = await this.prisma.contact.create({
        data: {
          contactId: 900009991,
          emailAddress: 'john.doe@example.com',
          givenName: 'John',
          surname: 'Doe',
        },
      });
    } else if (testContact.contactId < 900000000) {
      testContact = await this.prisma.contact.update({
        where: { id: testContact.id },
        data: { contactId: 900009991 },
      });
    }

    // 6. Test Enrollment
    let enrollment = await this.prisma.lmsEnrollment.findFirst({
      where: { contactId: testContact.id, learningPlanId: plan.id },
    });

    if (!enrollment) {
      enrollment = await this.prisma.lmsEnrollment.create({
        data: {
          contactId: testContact.id,
          learningPlanId: plan.id,
          learningMode: LearningMode.DeepDive,
          isActive: true,
        },
      });
    }

    return {
      message: 'LMS Database seeded successfully',
      enrollmentId: enrollment.id,
      student: testContact.givenName,
      unitCode: faCode.code,
      magicLink: `/lms/start/${enrollment.id}`,
    };
  }
}
