import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AzureStorageService } from '../azure-storage/azure-storage.service';
import { SettingsService } from '../settings/settings.service';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { randomBytes } from 'crypto';

@Injectable()
export class LmsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly azure: AzureStorageService,
    private readonly settings: SettingsService,
  ) {}

  // ── Knowledge Evidence (KE) ──────────────────────────────────────────────────

  async getKnowledgeEvidences() {
    const publishedPlanChapters = await this.prisma.learningPlanChapter.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: { chapterId: true },
    });
    const publishedChapterIds = new Set(publishedPlanChapters.map((pc) => pc.chapterId));

    const publishedPlanQuestions = await this.prisma.learningPlanQuestion.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: { questionId: true },
    });
    const publishedQuestionIds = new Set(publishedPlanQuestions.map((pq) => pq.questionId));

    const publishedPlanBanks = await this.prisma.learningPlan.findMany({
      where: { status: 'PUBLISHED' },
      select: { questionBanks: { select: { questions: { select: { id: true } } } } },
    });
    for (const plan of publishedPlanBanks) {
      for (const bank of plan.questionBanks) {
        for (const q of bank.questions) {
          publishedQuestionIds.add(q.id);
        }
      }
    }

    const kes = await this.prisma.lmsKnowledgeEvidence.findMany({
      include: {
        courseCodes: { select: { id: true, code: true, name: true } },
        blobs: { select: { id: true, chapterId: true } },
        questions: { select: { id: true } },
        _count: { select: { blobs: true, questions: true } },
      },
      orderBy: { code: 'asc' },
    });

    return kes.map((ke) => {
      const hasPublishedBlob = ke.blobs.some((b) => b.chapterId && publishedChapterIds.has(b.chapterId));
      const hasPublishedQuestion = ke.questions.some((q) => publishedQuestionIds.has(q.id));
      const isLocked = hasPublishedBlob || hasPublishedQuestion;
      return {
        id: ke.id,
        code: ke.code,
        title: ke.title,
        description: ke.description,
        courseCodes: ke.courseCodes,
        _count: ke._count,
        isLocked,
      };
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

    const publishedPlanChapters = await this.prisma.learningPlanChapter.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: { chapterId: true },
    });
    const publishedChapterIds = new Set(publishedPlanChapters.map((pc) => pc.chapterId));

    const publishedPlanQuestions = await this.prisma.learningPlanQuestion.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: { questionId: true },
    });
    const publishedQuestionIds = new Set(publishedPlanQuestions.map((pq) => pq.questionId));

    const publishedPlanBanks = await this.prisma.learningPlan.findMany({
      where: { status: 'PUBLISHED' },
      select: { questionBanks: { select: { questions: { select: { id: true } } } } },
    });
    for (const plan of publishedPlanBanks) {
      for (const bank of plan.questionBanks) {
        for (const q of bank.questions) {
          publishedQuestionIds.add(q.id);
        }
      }
    }

    const ke = await this.prisma.lmsKnowledgeEvidence.findUnique({
      where: { id },
      include: {
        blobs: { select: { chapterId: true } },
        questions: { select: { id: true } },
      },
    });

    const hasPublishedBlob = ke?.blobs.some((b) => b.chapterId && publishedChapterIds.has(b.chapterId));
    const hasPublishedQuestion = ke?.questions.some((q) => publishedQuestionIds.has(q.id));

    if (hasPublishedBlob || hasPublishedQuestion) {
      throw new BadRequestException(`Knowledge Evidence '${existing.code}' is locked under a PUBLISHED Learning Plan and cannot be modified.`);
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
    const publishedPlanChapters = await this.prisma.learningPlanChapter.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: { chapterId: true },
    });
    const publishedChapterIds = new Set(publishedPlanChapters.map((pc) => pc.chapterId));

    const publishedPlanQuestions = await this.prisma.learningPlanQuestion.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: { questionId: true },
    });
    const publishedQuestionIds = new Set(publishedPlanQuestions.map((pq) => pq.questionId));

    const publishedPlanBanks = await this.prisma.learningPlan.findMany({
      where: { status: 'PUBLISHED' },
      select: { questionBanks: { select: { questions: { select: { id: true } } } } },
    });
    for (const plan of publishedPlanBanks) {
      for (const bank of plan.questionBanks) {
        for (const q of bank.questions) {
          publishedQuestionIds.add(q.id);
        }
      }
    }

    const ke = await this.prisma.lmsKnowledgeEvidence.findUnique({
      where: { id },
      include: {
        blobs: { select: { chapterId: true } },
        questions: { select: { id: true } },
      },
    });

    if (!ke) throw new NotFoundException(`Knowledge Evidence '${id}' not found`);

    const hasPublishedBlob = ke.blobs.some((b) => b.chapterId && publishedChapterIds.has(b.chapterId));
    const hasPublishedQuestion = ke.questions.some((q) => publishedQuestionIds.has(q.id));

    if (hasPublishedBlob || hasPublishedQuestion) {
      throw new BadRequestException(
        `Cannot delete Knowledge Evidence '${ke.code}' because it is mapped to content blocks or assessment questions in a PUBLISHED Learning Plan.`,
      );
    }

    return this.prisma.lmsKnowledgeEvidence.delete({ where: { id } });
  }

  // ── Chapters & Content Blocks (Blobs) ────────────────────────────────────────

  async getChaptersByCourseCode(courseCodeId?: number) {
    const publishedPlanChapters = await this.prisma.learningPlanChapter.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: {
        chapterId: true,
        learningPlan: { select: { version: true, courseCode: { select: { code: true } } } },
      },
    });

    const publishedMap = new Map<string, string[]>();
    for (const pc of publishedPlanChapters) {
      const planLabel = `${pc.learningPlan.courseCode?.code || 'Plan'} (${pc.learningPlan.version})`;
      const existing = publishedMap.get(pc.chapterId) || [];
      existing.push(planLabel);
      publishedMap.set(pc.chapterId, existing);
    }

    const chapters = await this.prisma.lmsChapter.findMany({
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

    return chapters.map((ch) => {
      const publishedPlans = publishedMap.get(ch.id) || [];
      return {
        ...ch,
        isLocked: publishedPlans.length > 0,
        publishedPlans,
      };
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
    const publishedCount = await this.prisma.learningPlanChapter.count({
      where: { chapterId: id, learningPlan: { status: 'PUBLISHED' } },
    });

    if (publishedCount > 0) {
      throw new BadRequestException(
        'Chapter is attached to a PUBLISHED Learning Plan and is locked. Use "Clone to New Draft Version" on the Learning Plan to make changes.',
      );
    }

    return this.prisma.lmsChapter.update({
      where: { id },
      data: dto,
    });
  }

  async deleteChapter(id: string) {
    const publishedCount = await this.prisma.learningPlanChapter.count({
      where: { chapterId: id, learningPlan: { status: 'PUBLISHED' } },
    });

    if (publishedCount > 0) {
      throw new BadRequestException(
        `Cannot delete Chapter because it is attached to a PUBLISHED Learning Plan. Create a new draft plan version or clone first.`,
      );
    }

    return this.prisma.lmsChapter.delete({ where: { id } });
  }

  async getBlobs(chapterId?: string) {
    const publishedPlanChapters = await this.prisma.learningPlanChapter.findMany({
      where: { learningPlan: { status: 'PUBLISHED' } },
      select: { chapterId: true },
    });
    const publishedChapterIds = new Set(publishedPlanChapters.map((pc) => pc.chapterId));

    const blobs = await this.prisma.lmsLearningBlob.findMany({
      where: chapterId ? { chapterId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        chapter: { select: { id: true, title: true, courseCode: { select: { code: true } } } },
        knowledgeEvidences: { select: { id: true, code: true, title: true } },
      },
    });

    return blobs.map((b) => ({
      ...b,
      isLocked: b.isLocked || (b.chapterId ? publishedChapterIds.has(b.chapterId) : false),
    }));
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
    const existing = await this.prisma.lmsLearningBlob.findUnique({
      where: { id },
      include: {
        chapter: {
          include: {
            planChapters: {
              include: { learningPlan: { select: { status: true } } },
            },
          },
        },
      },
    });

    if (!existing) throw new NotFoundException(`Learning blob '${id}' not found`);

    const isLocked = existing.isLocked || existing.chapter?.planChapters.some((pc) => pc.learningPlan.status === 'PUBLISHED');

    if (isLocked) {
      // Auto-Duplicate locked block to a new version for draft plans
      const newVersion = (existing.version || 1) + 1;
      const newBlob = await this.prisma.lmsLearningBlob.create({
        data: {
          chapterId: dto.chapterId !== undefined ? dto.chapterId : existing.chapterId,
          title: dto.title ?? existing.title,
          description: dto.description ?? existing.description,
          contentHtml: dto.contentHtml ?? existing.contentHtml,
          vimeoId: dto.vimeoId !== undefined ? dto.vimeoId : existing.vimeoId,
          azureBlobUrl: dto.azureBlobUrl !== undefined ? dto.azureBlobUrl : existing.azureBlobUrl,
          durationSeconds: dto.durationSeconds ?? existing.durationSeconds,
          sortOrder: dto.sortOrder ?? existing.sortOrder,
          version: newVersion,
          isLocked: false,
          parentBlobId: existing.id,
          knowledgeEvidences: dto.knowledgeEvidenceIds && dto.knowledgeEvidenceIds.length > 0
            ? { connect: dto.knowledgeEvidenceIds.map((kId) => ({ id: kId })) }
            : undefined,
        },
        include: {
          knowledgeEvidences: { select: { id: true, code: true, title: true } },
        },
      });

      return {
        ...newBlob,
        isNewVersion: true,
      };
    }

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
    const blob = await this.prisma.lmsLearningBlob.findUnique({
      where: { id },
      include: {
        chapter: {
          include: {
            planChapters: {
              include: { learningPlan: { select: { status: true } } },
            },
          },
        },
        coreQuestions: {
          include: {
            planQuestions: {
              include: { learningPlan: { select: { status: true } } },
            },
          },
        },
      },
    });

    if (!blob) throw new NotFoundException(`Content Block '${id}' not found`);

    const isLockedInChapter = blob.isLocked || blob.chapter?.planChapters.some((pc) => pc.learningPlan.status === 'PUBLISHED');
    const isLockedInQuestion = blob.coreQuestions.some((q) => q.planQuestions.some((pq) => pq.learningPlan.status === 'PUBLISHED'));

    if (isLockedInChapter || isLockedInQuestion) {
      throw new BadRequestException(
        `Cannot delete Content Block '${blob.title}' because it is part of a PUBLISHED Learning Plan.`,
      );
    }

    return this.prisma.lmsLearningBlob.delete({ where: { id } });
  }

  async saveChapterBlobs(
    chapterId: string,
    items: Array<{ blobId: string; sortOrder: number }>,
  ) {
    const chapter = await this.prisma.lmsChapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException(`Chapter '${chapterId}' not found`);

    const blobIdsInChapter = items.map((i) => i.blobId);

    // Update selected blobs to point to this chapter and update sortOrder
    for (const item of items) {
      await this.prisma.lmsLearningBlob.update({
        where: { id: item.blobId },
        data: { chapterId, sortOrder: item.sortOrder },
      });
    }

    // Detach blobs that were removed from this chapter
    await this.prisma.lmsLearningBlob.updateMany({
      where: {
        chapterId,
        id: { notIn: blobIdsInChapter },
      },
      data: { chapterId: null },
    });

    return this.prisma.lmsChapter.findUnique({
      where: { id: chapterId },
      include: {
        blobs: {
          orderBy: { sortOrder: 'asc' },
          include: { knowledgeEvidences: { select: { id: true, code: true, title: true } } },
        },
      },
    });
  }

  async importAxcelerateHtml(rawHtml: string) {
    if (!rawHtml || !rawHtml.trim()) {
      throw new BadRequestException('No HTML content provided for import');
    }

    const $ = cheerio.load(rawHtml, { xmlMode: false }, false);

    // 1. Title Extraction
    let extractedTitle = '';
    const h1El = $('h1').first();
    if (h1El.length > 0) {
      extractedTitle = h1El.text().trim();
    }
    if (!extractedTitle) {
      const headerBlock = $('.arc-tiny-auth-header-block').first();
      if (headerBlock.length > 0) {
        extractedTitle = headerBlock.text().trim();
      }
    }

    // Remove the Axcelerate hero header block or SVG illustration if present
    $('.arc-tiny-auth-header-block').remove();
    $('svg.arc-header-illustration').remove();
    $('.arc-header-illustration').remove();

    // 2. Extract Vimeo ID / embed
    let extractedVimeoId = '';
    const iframes = $('iframe');
    iframes.each((_, el) => {
      const src = $(el).attr('src') || '';
      if (src.includes('vimeo.com') || /player\.vimeo\.com/i.test(src)) {
        const match = src.match(/vimeo\.com\/(?:video\/)?([a-zA-Z0-9_\-?=&]+)/i);
        if (match) {
          extractedVimeoId = match[1];
        } else {
          const idMatch = src.match(/\/video\/([a-zA-Z0-9_\-?=&]+)/i);
          if (idMatch) extractedVimeoId = idMatch[1];
        }
        if ($(el).parent('.paragraph').length > 0) {
          $(el).parent('.paragraph').remove();
        } else {
          $(el).remove();
        }
      }
    });

    if (!extractedVimeoId) {
      const vimeoMatch = rawHtml.match(/player\.vimeo\.com\/video\/([a-zA-Z0-9_\-?=&]+)/i);
      if (vimeoMatch) {
        extractedVimeoId = vimeoMatch[1];
      }
    }

    // 3. Image Migration to Azure Storage
    let migratedImagesCount = 0;
    const isAzureEnabled = await this.azure.isEnabled();
    const publicBase = await this.settings.get('public_base_url');
    const base = (publicBase?.trim() || process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

    const imgs = $('img').toArray();
    for (const img of imgs) {
      const $img = $(img);
      const src = $img.attr('src') || '';

      if (src && (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//'))) {
        const fullSrc = src.startsWith('//') ? `https:${src}` : src;

        if (isAzureEnabled) {
          try {
            const resp = await axios.get(fullSrc, { responseType: 'arraybuffer', timeout: 12000 });
            const contentType = String(resp.headers['content-type'] || 'image/png');
            const buffer = Buffer.from(resp.data);

            const urlPath = new URL(fullSrc).pathname;
            const filename = urlPath.split('/').pop() || 'imported_image.png';

            const { blobPath } = await this.azure.uploadFile(
              buffer,
              filename,
              contentType,
              'lms',
              'axcelerate-imports',
            );

            const proxyKey = randomBytes(9).toString('base64url');
            const proxyUrl = `${base}/proxy/${encodeURIComponent(proxyKey)}`;

            await this.prisma.workshopUpload.create({
              data: {
                instanceId: 0,
                contactId: null,
                portfolioTypeId: null,
                blobPath,
                blobUrl: proxyUrl,
                kind: 'image',
                filename,
                mimeType: contentType,
                status: 'active',
                proxyKey,
              },
            });

            $img.attr('src', proxyUrl);
            migratedImagesCount++;
          } catch (err: any) {
            // Keep original src if download/upload fails
          }
        }
      }

      $img.removeAttr('contenteditable');
      $img.removeAttr('data-mce-fragment');
      $img.removeAttr('class');
    }

    // 4. Clean HTML
    $('*').removeAttr('contenteditable');

    $('*').each((_, el) => {
      const $el = $(el);
      const className = $el.attr('class') || '';
      if (className) {
        const cleanedClasses = className
          .split(/\s+/)
          .filter((c) => !c.startsWith('sc-') && !c.startsWith('arc-') && !c.startsWith('ax-') && !c.includes('contenteditable'))
          .join(' ');

        if (cleanedClasses.trim()) {
          $el.attr('class', cleanedClasses.trim());
        } else {
          $el.removeAttr('class');
        }
      }
    });

    $('div.paragraph').each((_, el) => {
      const $el = $(el);
      if (!$el.text().trim() && $el.find('img, iframe, svg, table').length === 0) {
        $el.remove();
      }
    });

    let cleanedHtml = $.html().trim();

    return {
      title: extractedTitle || 'Imported Axcelerate Block',
      vimeoId: extractedVimeoId,
      contentHtml: cleanedHtml,
      migratedImagesCount,
    };
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
      include: {
        planQuestions: {
          include: { learningPlan: { select: { status: true } } },
        },
        questionBanks: {
          include: { plans: { select: { status: true } } },
        },
      },
    });
    if (!existing) throw new NotFoundException(`Question '${id}' not found`);

    const isDirectlyPublished = existing.planQuestions.some((pq) => pq.learningPlan.status === 'PUBLISHED');
    const isBankPublished = existing.questionBanks.some((bank) => bank.plans.some((p) => p.status === 'PUBLISHED'));

    if (isDirectlyPublished || isBankPublished) {
      throw new BadRequestException('Cannot delete question because it is part of a PUBLISHED Learning Plan.');
    }

    return this.prisma.lmsQuestion.delete({ where: { id } });
  }

  // ── Question Banks ────────────────────────────────────────────────────────────

  async getQuestionBanks(courseCodeId?: number) {
    const banks = await this.prisma.lmsQuestionBank.findMany({
      where: courseCodeId ? { courseCodeId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
        questions: {
          select: { id: true, questionText: true, type: true, points: true },
        },
        plans: {
          select: { id: true, version: true, status: true, courseCode: { select: { code: true } } },
        },
        _count: { select: { plans: true } },
      },
    });

    return banks.map((bank) => {
      const publishedPlans = bank.plans
        .filter((p) => p.status === 'PUBLISHED')
        .map((p) => `${p.courseCode?.code || 'Plan'} (${p.version})`);

      return {
        ...bank,
        isLocked: publishedPlans.length > 0,
        publishedPlans,
      };
    });
  }

  async createQuestionBank(dto: {
    name: string;
    description?: string;
    courseCodeId?: number;
    questionIds?: string[];
  }) {
    return this.prisma.lmsQuestionBank.create({
      data: {
        name: dto.name,
        description: dto.description || '',
        courseCodeId: dto.courseCodeId || null,
        questions: dto.questionIds && dto.questionIds.length > 0
          ? { connect: dto.questionIds.map((id) => ({ id })) }
          : undefined,
      },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
        questions: { select: { id: true, questionText: true, type: true } },
      },
    });
  }

  async updateQuestionBank(
    id: string,
    dto: {
      name?: string;
      description?: string;
      courseCodeId?: number;
      questionIds?: string[];
    },
  ) {
    return this.prisma.lmsQuestionBank.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        courseCodeId: dto.courseCodeId,
        questions: dto.questionIds
          ? { set: dto.questionIds.map((qId) => ({ id: qId })) }
          : undefined,
      },
      include: {
        courseCode: { select: { id: true, code: true, name: true } },
        questions: { select: { id: true, questionText: true, type: true } },
      },
    });
  }

  async deleteQuestionBank(id: string) {
    const bank = await this.prisma.lmsQuestionBank.findUnique({
      where: { id },
      include: { plans: { select: { status: true } } },
    });
    if (!bank) throw new NotFoundException(`Question Bank '${id}' not found`);

    if (bank.plans.some((p) => p.status === 'PUBLISHED')) {
      throw new BadRequestException('Cannot delete Question Bank because it is assigned to a PUBLISHED Learning Plan.');
    }

    return this.prisma.lmsQuestionBank.delete({ where: { id } });
  }

  async setPlanQuestionBanks(planId: number, bankIds: string[]) {
    const plan = await this.prisma.learningPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Learning plan '${planId}' not found`);
    if (plan.status === 'PUBLISHED') {
      throw new BadRequestException('Published learning plans are locked and read-only. Clone to a new draft version to make modifications.');
    }

    await this.prisma.learningPlan.update({
      where: { id: planId },
      data: {
        questionBanks: { set: bankIds.map((bId) => ({ id: bId })) },
      },
    });

    return this.prisma.learningPlan.findUnique({
      where: { id: planId },
      include: {
        questionBanks: {
          include: {
            questions: { select: { id: true, questionText: true, type: true } },
          },
        },
      },
    });
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
        questionBanks: {
          include: {
            questions: {
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
      // 100% KE Coverage Validation Gate
      const plan = await this.prisma.learningPlan.findUnique({
        where: { id },
        include: {
          courseCode: {
            include: {
              knowledgeEvidences: true,
            },
          },
          planChapters: {
            include: {
              chapter: {
                include: {
                  blobs: {
                    include: { knowledgeEvidences: true },
                  },
                },
              },
            },
          },
          planQuestions: {
            include: {
              question: {
                include: { knowledgeEvidences: true },
              },
            },
          },
          questionBanks: {
            include: {
              questions: {
                include: { knowledgeEvidences: true },
              },
            },
          },
        },
      });

      if (plan && plan.courseCode) {
        const requiredKEs = plan.courseCode.knowledgeEvidences || [];

        // Collect all KEs present in attached blobs
        const blobKeIds = new Set<string>();
        for (const pc of plan.planChapters) {
          for (const b of pc.chapter?.blobs || []) {
            for (const ke of b.knowledgeEvidences || []) {
              blobKeIds.add(ke.id);
            }
          }
        }

        // Collect all KEs present in attached questions (direct + via banks)
        const questionKeIds = new Set<string>();
        for (const pq of plan.planQuestions) {
          for (const ke of pq.question?.knowledgeEvidences || []) {
            questionKeIds.add(ke.id);
          }
        }
        for (const qb of plan.questionBanks) {
          for (const q of qb.questions || []) {
            for (const ke of q.knowledgeEvidences || []) {
              questionKeIds.add(ke.id);
            }
          }
        }

        const missingKEs: Array<{ code: string; title: string; missingBlob: boolean; missingQuestion: boolean }> = [];

        for (const ke of requiredKEs) {
          const hasBlob = blobKeIds.has(ke.id);
          const hasQuestion = questionKeIds.has(ke.id);

          if (!hasBlob || !hasQuestion) {
            missingKEs.push({
              code: ke.code,
              title: ke.title,
              missingBlob: !hasBlob,
              missingQuestion: !hasQuestion,
            });
          }
        }

        if (missingKEs.length > 0) {
          const details = missingKEs
            .map((m) => {
              const gaps: string[] = [];
              if (m.missingBlob) gaps.push('Content Block');
              if (m.missingQuestion) gaps.push('Assessment Question');
              return `${m.code} (${gaps.join(' & ')} missing)`;
            })
            .join(', ');

          throw new BadRequestException(
            `100% Knowledge Evidence (KE) Coverage Gate Failed: Cannot publish Learning Plan. Missing coverage for: ${details}`,
          );
        }
      }

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
    const plan = await this.prisma.learningPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Learning plan '${planId}' not found`);
    if (plan.status === 'PUBLISHED') {
      throw new BadRequestException('Published learning plans are locked and read-only. Clone to a new draft version to make modifications.');
    }

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
    const plan = await this.prisma.learningPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException(`Learning plan '${planId}' not found`);
    if (plan.status === 'PUBLISHED') {
      throw new BadRequestException('Published learning plans are locked and read-only. Clone to a new draft version to make modifications.');
    }

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
