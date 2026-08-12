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

  async getChaptersByCourseCode(courseCodeId: number) {
    return this.prisma.lmsChapter.findMany({
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
  }

  async createChapter(dto: {
    courseCodeId: number;
    title: string;
    description?: string;
    sortOrder?: number;
  }) {
    return this.prisma.lmsChapter.create({
      data: {
        courseCodeId: dto.courseCodeId,
        title: dto.title,
        description: dto.description || '',
        sortOrder: dto.sortOrder ?? 0,
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
    knowledgeEvidenceId?: string;
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
        knowledgeEvidenceId: dto.knowledgeEvidenceId || null,
        title: dto.title,
        description: dto.description || '',
        contentHtml: dto.contentHtml || '',
        vimeoId: dto.vimeoId || null,
        azureBlobUrl: dto.azureBlobUrl || null,
        durationSeconds: dto.durationSeconds || 0,
        sortOrder: dto.sortOrder ?? 0,
      },
      include: {
        knowledgeEvidence: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async updateLearningBlob(
    id: string,
    dto: {
      chapterId?: string;
      knowledgeEvidenceId?: string;
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
        knowledgeEvidenceId: dto.knowledgeEvidenceId,
        title: dto.title,
        description: dto.description,
        contentHtml: dto.contentHtml,
        vimeoId: dto.vimeoId,
        azureBlobUrl: dto.azureBlobUrl,
        durationSeconds: dto.durationSeconds,
        sortOrder: dto.sortOrder,
      },
      include: {
        knowledgeEvidence: { select: { id: true, code: true, title: true } },
      },
    });
  }

  async deleteLearningBlob(id: string) {
    return this.prisma.lmsLearningBlob.delete({ where: { id } });
  }

  // ── Question Bank ─────────────────────────────────────────────────────────────

  async getQuestions() {
    return this.prisma.lmsQuestion.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        knowledgeEvidence: {
          select: { id: true, code: true, title: true },
        },
        coreLearningBlob: {
          select: { id: true, title: true, vimeoId: true, azureBlobUrl: true },
        },
      },
    });
  }

  async createQuestion(dto: {
    type: number;
    questionText: string;
    questionData?: any;
    correctAnswer?: any;
    benchmarkAnswer?: string;
    points?: number;
    knowledgeEvidenceId?: string;
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
        knowledgeEvidenceId: dto.knowledgeEvidenceId || null,
        coreLearningBlobId: dto.coreLearningBlobId || null,
      },
      include: {
        knowledgeEvidence: { select: { id: true, code: true, title: true } },
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
      knowledgeEvidenceId?: string;
      coreLearningBlobId?: string;
    },
  ) {
    return this.prisma.lmsQuestion.update({
      where: { id },
      data: {
        type: dto.type,
        questionText: dto.questionText,
        questionData: dto.questionData,
        correctAnswer: dto.correctAnswer,
        benchmarkAnswer: dto.benchmarkAnswer,
        points: dto.points,
        knowledgeEvidenceId: dto.knowledgeEvidenceId,
        coreLearningBlobId: dto.coreLearningBlobId,
      },
      include: {
        knowledgeEvidence: { select: { id: true, code: true, title: true } },
        coreLearningBlob: { select: { id: true, title: true } },
      },
    });
  }

  async deleteQuestion(id: string) {
    return this.prisma.lmsQuestion.delete({ where: { id } });
  }

  // ── Learning Plans ────────────────────────────────────────────────────────────

  async getLearningPlans(courseCodeId?: number) {
    return this.prisma.learningPlan.findMany({
      where: courseCodeId ? { courseCodeId } : undefined,
      orderBy: { id: 'desc' },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
        planQuestions: {
          orderBy: { sortOrder: 'asc' },
          include: {
            question: {
              include: {
                knowledgeEvidence: { select: { id: true, code: true } },
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
        status: 'PUBLISHED',
        isDefault: dto.isDefault ?? false,
        effectiveFrom: new Date(),
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

    if (dto.isDefault) {
      await this.prisma.learningPlan.updateMany({
        where: { courseCodeId: existing.courseCodeId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return this.prisma.learningPlan.update({
      where: { id },
      data: dto,
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
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
}
