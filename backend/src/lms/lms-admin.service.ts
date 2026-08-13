import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LmsAdminService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Knowledge Evidence (KE) ──────────────────────────────────────────────────

  async getKnowledgeEvidences() {
    return this.prisma.lmsKnowledgeEvidence.findMany({
      include: {
        courseCodes: {
          select: { id: true, code: true, name: true },
        },
        _count: {
          select: { blobs: true, questions: true },
        },
      },
      orderBy: { code: 'asc' },
    });
  }

  async createKnowledgeEvidence(dto: {
    code: string;
    title: string;
    description?: string;
    courseCodeIds?: number[];
  }) {
    return this.prisma.lmsKnowledgeEvidence.create({
      data: {
        code: dto.code,
        title: dto.title,
        description: dto.description || '',
        courseCodes: dto.courseCodeIds && dto.courseCodeIds.length > 0
          ? { connect: dto.courseCodeIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        courseCodes: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateKnowledgeEvidence(
    id: string,
    dto: {
      code?: string;
      title?: string;
      description?: string;
      courseCodeIds?: number[];
    },
  ) {
    const existing = await this.prisma.lmsKnowledgeEvidence.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Knowledge Evidence '${id}' not found`);
    }

    return this.prisma.lmsKnowledgeEvidence.update({
      where: { id },
      data: {
        code: dto.code,
        title: dto.title,
        description: dto.description,
        courseCodes: dto.courseCodeIds
          ? { set: dto.courseCodeIds.map((cId) => ({ id: cId })) }
          : undefined,
      },
      include: {
        courseCodes: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async deleteKnowledgeEvidence(id: string) {
    return this.prisma.lmsKnowledgeEvidence.delete({ where: { id } });
  }

  // ── Chapters & Content Blocks (Blobs) ────────────────────────────────────────

  async getChaptersByCourseCode(courseCodeId?: number) {
    return this.prisma.lmsChapter.findMany({
      where: courseCodeId ? { courseCodeId } : undefined,
      orderBy: { sortOrder: 'asc' },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
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

  async createChapter(dto: {
    courseCodeId?: number;
    title: string;
    description?: string;
    sortOrder?: number;
  }) {
    return this.prisma.lmsChapter.create({
      data: {
        courseCodeId: dto.courseCodeId || null,
        title: dto.title,
        description: dto.description || '',
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateChapter(
    id: string,
    dto: { title?: string; description?: string; sortOrder?: number },
  ) {
    return this.prisma.lmsChapter.update({
      where: { id },
      data: dto,
    });
  }

  async deleteChapter(id: string) {
    return this.prisma.lmsChapter.delete({ where: { id } });
  }

  async createLearningBlob(dto: {
    chapterId?: string;
    knowledgeEvidenceIds?: string[];
    title: string;
    description?: string;
    contentHtml?: string;
    vimeoId?: string;
    azureBlobUrl?: string;
    durationSeconds?: number;
    sortOrder?: number;
  }) {
    return this.prisma.lmsLearningBlob.create({
      data: {
        chapterId: dto.chapterId || null,
        knowledgeEvidences: dto.knowledgeEvidenceIds && dto.knowledgeEvidenceIds.length > 0
          ? { connect: dto.knowledgeEvidenceIds.map((id) => ({ id })) }
          : undefined,
        title: dto.title,
        description: dto.description || '',
        contentHtml: dto.contentHtml || '',
        vimeoId: dto.vimeoId || null,
        azureBlobUrl: dto.azureBlobUrl || null,
        durationSeconds: dto.durationSeconds || 0,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        knowledgeEvidences: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async updateLearningBlob(
    id: string,
    dto: {
      chapterId?: string;
      knowledgeEvidenceIds?: string[];
      title?: string;
      description?: string;
      contentHtml?: string;
      vimeoId?: string;
      azureBlobUrl?: string;
      durationSeconds?: number;
      sortOrder?: number;
    },
  ) {
    return this.prisma.lmsLearningBlob.update({
      where: { id },
      data: {
        chapterId: dto.chapterId,
        knowledgeEvidences: dto.knowledgeEvidenceIds
          ? { set: dto.knowledgeEvidenceIds.map((kId) => ({ id: kId })) }
          : undefined,
        title: dto.title,
        description: dto.description,
        contentHtml: dto.contentHtml,
        vimeoId: dto.vimeoId,
        azureBlobUrl: dto.azureBlobUrl,
        durationSeconds: dto.durationSeconds,
        sortOrder: dto.sortOrder,
      },
      include: {
        knowledgeEvidences: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async deleteLearningBlob(id: string) {
    return this.prisma.lmsLearningBlob.delete({ where: { id } });
  }

  // ── Question Bank ─────────────────────────────────────────────────────────────

  async getQuestions() {
    const questions = await this.prisma.lmsQuestion.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        knowledgeEvidences: {
          select: { id: true, code: true, title: true },
        },
        coreLearningBlob: {
          select: { id: true, title: true, vimeoId: true, azureBlobUrl: true },
        },
        planQuestions: {
          include: {
            learningPlan: {
              select: { id: true, version: true, status: true, courseCode: { select: { code: true } } },
            },
          },
        },
      },
    });

    return questions.map((q) => {
      const publishedPlans = q.planQuestions
        .filter((pq) => pq.learningPlan.status === 'PUBLISHED')
        .map((pq) => `${pq.learningPlan.courseCode?.code || 'Plan'} (${pq.learningPlan.version})`);

      return {
        ...q,
        isLocked: publishedPlans.length > 0,
        publishedPlans,
      };
    });
  }

  async createQuestion(dto: {
    type: number;
    questionText: string;
    questionData?: any;
    correctAnswer?: any;
    benchmarkAnswer?: string;
    points?: number;
    knowledgeEvidenceIds?: string[];
    coreLearningBlobId?: string;
  }) {
    return this.prisma.lmsQuestion.create({
      data: {
        type: dto.type,
        questionText: dto.questionText,
        questionData: dto.questionData || null,
        correctAnswer: dto.correctAnswer || null,
        benchmarkAnswer: dto.benchmarkAnswer || null,
        points: dto.points ?? 1,
        knowledgeEvidences: dto.knowledgeEvidenceIds && dto.knowledgeEvidenceIds.length > 0
          ? { connect: dto.knowledgeEvidenceIds.map((id) => ({ id })) }
          : undefined,
        coreLearningBlobId: dto.coreLearningBlobId || null,
      },
      include: {
        knowledgeEvidences: { select: { id: true, code: true, title: true } },
        coreLearningBlob: { select: { id: true, title: true } },
      },
    });
  }

  async updateQuestion(
    id: string,
    dto: {
      type?: number;
      questionText?: string;
      questionData?: any;
      correctAnswer?: any;
      benchmarkAnswer?: string;
      points?: number;
      knowledgeEvidenceIds?: string[];
      coreLearningBlobId?: string;
    },
  ) {
    const existing = await this.prisma.lmsQuestion.findUnique({
      where: { id },
      include: {
        planQuestions: {
          include: {
            learningPlan: { select: { id: true, status: true } },
          },
        },
      },
    });

    if (!existing) throw new NotFoundException(`Question '${id}' not found`);

    const isLocked = existing.planQuestions.some((pq) => pq.learningPlan.status === 'PUBLISHED');

    if (isLocked) {
      // Question is on a published plan — create a new question version to preserve historical student assessment responses
      const newQuestion = await this.prisma.lmsQuestion.create({
        data: {
          type: dto.type ?? existing.type,
          questionText: dto.questionText ?? existing.questionText,
          questionData: dto.questionData !== undefined ? dto.questionData : (existing.questionData as any),
          correctAnswer: dto.correctAnswer !== undefined ? dto.correctAnswer : (existing.correctAnswer as any),
          benchmarkAnswer: dto.benchmarkAnswer !== undefined ? dto.benchmarkAnswer : existing.benchmarkAnswer,
          points: dto.points ?? existing.points,
          knowledgeEvidences: dto.knowledgeEvidenceIds && dto.knowledgeEvidenceIds.length > 0
            ? { connect: dto.knowledgeEvidenceIds.map((kId) => ({ id: kId })) }
            : undefined,
          coreLearningBlobId: dto.coreLearningBlobId !== undefined ? dto.coreLearningBlobId : existing.coreLearningBlobId,
        },
        include: {
          knowledgeEvidences: { select: { id: true, code: true, title: true } },
          coreLearningBlob: { select: { id: true, title: true } },
        },
      });

      // Update any DRAFT plan references to point to the new question version
      const draftPlanIds = existing.planQuestions
        .filter((pq) => pq.learningPlan.status === 'DRAFT')
        .map((pq) => pq.learningPlan.id);

      for (const planId of draftPlanIds) {
        const pq = existing.planQuestions.find((p) => p.learningPlan.id === planId);
        await this.prisma.learningPlanQuestion.delete({
          where: { learningPlanId_questionId: { learningPlanId: planId, questionId: id } },
        });
        await this.prisma.learningPlanQuestion.create({
          data: {
            learningPlanId: planId,
            questionId: newQuestion.id,
            sortOrder: pq?.sortOrder ?? 1,
            points: pq?.points ?? newQuestion.points,
          },
        });
      }

      return {
        ...newQuestion,
        isNewVersion: true,
      };
    }

    return this.prisma.lmsQuestion.update({
      where: { id },
      data: {
        type: dto.type,
        questionText: dto.questionText,
        questionData: dto.questionData,
        correctAnswer: dto.correctAnswer,
        benchmarkAnswer: dto.benchmarkAnswer,
        points: dto.points,
        knowledgeEvidences: dto.knowledgeEvidenceIds
          ? { set: dto.knowledgeEvidenceIds.map((kId) => ({ id: kId })) }
          : undefined,
        coreLearningBlobId: dto.coreLearningBlobId,
      },
      include: {
        knowledgeEvidences: { select: { id: true, code: true, title: true } },
        coreLearningBlob: { select: { id: true, title: true } },
      },
    });
  }

  async deleteQuestion(id: string) {
    const existing = await this.prisma.lmsQuestion.findUnique({
      where: { id },
      include: { planQuestions: true },
    });
    if (!existing) throw new NotFoundException(`Question '${id}' not found`);

    if (existing.planQuestions.length > 0) {
      throw new BadRequestException('Cannot delete question because it is assigned to one or more Learning Plans. Remove it from the plan(s) first.');
    }

    return this.prisma.lmsQuestion.delete({ where: { id } });
  }

  // ── Learning Plans ────────────────────────────────────────────────────────────

  async getLearningPlans(courseCodeId?: number) {
    return this.prisma.learningPlan.findMany({
      where: courseCodeId ? { courseCodeId } : undefined,
      orderBy: { id: 'desc' },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
        planChapters: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapter: {
              include: {
                blobs: {
                  orderBy: { sortOrder: 'asc' },
                  include: {
                    knowledgeEvidences: { select: { id: true, code: true, title: true } },
                  },
                },
              },
            },
          },
        },
        planQuestions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: {
                knowledgeEvidences: { select: { id: true, code: true } },
              },
            },
          },
        },
        _count: { select: { lmsEnrollments: true } },
      },
    });
  }

  async createLearningPlan(dto: {
    courseCodeId: number;
    version: string;
    title: string;
    description?: string;
    isDefault?: boolean;
    status?: string;
  }) {
    // If set to default, unset existing default for this course code
    if (dto.isDefault) {
      await this.prisma.learningPlan.updateMany({
        where: { courseCodeId: dto.courseCodeId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.learningPlan.create({
      data: {
        courseCodeId: dto.courseCodeId,
        version: dto.version,
        title: dto.title,
        description: dto.description || '',
        status: dto.status || 'DRAFT',
        isDefault: dto.isDefault ?? false,
        effectiveFrom: dto.status === 'PUBLISHED' ? new Date() : null,
      },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async updateLearningPlan(
    id: number,
    dto: {
      title?: string;
      description?: string;
      status?: string;
      isDefault?: boolean;
    },
  ) {
    const existing = await this.prisma.learningPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Learning plan '${id}' not found`);
    }

    // Check if plan is PUBLISHED/ARCHIVED and trying to modify content fields
    if (existing.status === 'PUBLISHED' && dto.status !== 'ARCHIVED' && (dto.title !== undefined || dto.description !== undefined)) {
      // Published plans are read-only / locked
      throw new BadRequestException('Published learning plans are locked and read-only. Use "Clone to New Draft Version" to make modifications.');
    }

    if (dto.isDefault) {
      await this.prisma.learningPlan.updateMany({
        where: { courseCodeId: existing.courseCodeId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updatePayload: any = { ...dto };
    if (dto.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      updatePayload.effectiveFrom = new Date();
    }

    return this.prisma.learningPlan.update({
      where: { id },
      data: updatePayload,
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
      },
    });
  }

  async clonePlanToDraft(id: number, incrementType: 'minor' | 'major') {
    const source = await this.prisma.learningPlan.findUnique({
      where: { id },
      include: {
        planChapters: true,
        planQuestions: true,
      },
    });

    if (!source) throw new NotFoundException(`Learning plan '${id}' not found`);

    // Calculate new version string e.g. v1.0 -> v1.1 (minor) or v2.0 (major)
    const currentVersionStr = source.version.replace(/^v/i, '');
    const parts = currentVersionStr.split('.').map((p) => parseInt(p, 10) || 0);
    let major = parts[0] ?? 1;
    let minor = parts[1] ?? 0;

    if (incrementType === 'major') {
      major += 1;
      minor = 0;
    } else {
      minor += 1;
    }

    const newVersion = `v${major}.${minor}`;

    // Create new DRAFT plan
    const newPlan = await this.prisma.learningPlan.create({
      data: {
        courseCodeId: source.courseCodeId,
        version: newVersion,
        title: `${source.title} (${newVersion} Draft)`,
        description: source.description,
        status: 'DRAFT',
        isDefault: false,
      },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
      },
    });

    // Copy planChapters
    for (const pc of source.planChapters) {
      await this.prisma.learningPlanChapter.create({
        data: {
          learningPlanId: newPlan.id,
          chapterId: pc.chapterId,
          sortOrder: pc.sortOrder,
        },
      });
    }

    // Copy planQuestions
    for (const pq of source.planQuestions) {
      await this.prisma.learningPlanQuestion.create({
        data: {
          learningPlanId: newPlan.id,
          questionId: pq.questionId,
          sortOrder: pq.sortOrder,
          points: pq.points,
        },
      });
    }

    return this.prisma.learningPlan.findUnique({
      where: { id: newPlan.id },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
        planChapters: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapter: {
              include: { blobs: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        planQuestions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: true },
        },
      },
    });
  }

  async setPlanQuestions(
    planId: number,
    questionItems: Array<{ questionId: string; sortOrder: number; points?: number }>,
  ) {
    // Clear existing questions for this plan and rebuild
    await this.prisma.learningPlanQuestion.deleteMany({
      where: { learningPlanId: planId },
    });

    for (const item of questionItems) {
      await this.prisma.learningPlanQuestion.create({
        data: {
          learningPlanId: planId,
          questionId: item.questionId,
          sortOrder: item.sortOrder,
          points: item.points,
        },
      });
    }

    return this.prisma.learningPlan.findUnique({
      where: { id: planId },
      include: {
        planQuestions: {
          orderBy: { sortOrder: 'asc' },
          include: { question: true },
        },
      },
    });
  }

  async setPlanChapters(
    planId: number,
    chapterItems: Array<{ chapterId: string; sortOrder: number }>,
  ) {
    // Clear existing chapters for this plan and rebuild
    await this.prisma.learningPlanChapter.deleteMany({
      where: { learningPlanId: planId },
    });

    for (const item of chapterItems) {
      await this.prisma.learningPlanChapter.create({
        data: {
          learningPlanId: planId,
          chapterId: item.chapterId,
          sortOrder: item.sortOrder,
        },
      });
    }

    return this.prisma.learningPlan.findUnique({
      where: { id: planId },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
        planChapters: {
          orderBy: { sortOrder: 'asc' },
          include: {
            chapter: {
              include: {
                blobs: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });
  }
}
