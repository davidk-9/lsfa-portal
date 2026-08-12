import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { LmsAdminService } from './lms-admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER', 'ADMIN')
@Controller('lms-admin')
export class LmsAdminController {
  constructor(private readonly lmsAdminService: LmsAdminService) {}

  // ── Knowledge Evidence (KE) ──────────────────────────────────────────────────

  @Get('ke')
  async getKnowledgeEvidences() {
    return this.lmsAdminService.getKnowledgeEvidences();
  }

  @Post('ke')
  async createKnowledgeEvidence(
    @Body() dto: { code: string; title: string; description?: string; courseCodeIds?: number[] },
  ) {
    return this.lmsAdminService.createKnowledgeEvidence(dto);
  }

  @Put('ke/:id')
  async updateKnowledgeEvidence(
    @Param('id') id: string,
    @Body() dto: { code?: string; title?: string; description?: string; courseCodeIds?: number[] },
  ) {
    return this.lmsAdminService.updateKnowledgeEvidence(id, dto);
  }

  @Delete('ke/:id')
  async deleteKnowledgeEvidence(@Param('id') id: string) {
    return this.lmsAdminService.deleteKnowledgeEvidence(id);
  }

  // ── Chapters & Content Blocks (Blobs) ────────────────────────────────────────

  @Get('chapters')
  async getChaptersByCourseCode(@Query('courseCodeId', ParseIntPipe) courseCodeId: number) {
    return this.lmsAdminService.getChaptersByCourseCode(courseCodeId);
  }

  @Post('chapters')
  async createChapter(
    @Body() dto: { courseCodeId: number; title: string; description?: string; sortOrder?: number },
  ) {
    return this.lmsAdminService.createChapter(dto);
  }

  @Put('chapters/:id')
  async updateChapter(
    @Param('id') id: string,
    @Body() dto: { title?: string; description?: string; sortOrder?: number },
  ) {
    return this.lmsAdminService.updateChapter(id, dto);
  }

  @Delete('chapters/:id')
  async deleteChapter(@Param('id') id: string) {
    return this.lmsAdminService.deleteChapter(id);
  }

  @Post('blobs')
  async createLearningBlob(
    @Body()
    dto: {
      chapterId?: string;
      knowledgeEvidenceId?: string;
      title: string;
      description?: string;
      contentHtml?: string;
      vimeoId?: string;
      azureBlobUrl?: string;
      durationSeconds?: number;
      sortOrder?: number;
    },
  ) {
    return this.lmsAdminService.createLearningBlob(dto);
  }

  @Put('blobs/:id')
  async updateLearningBlob(
    @Param('id') id: string,
    @Body()
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
    return this.lmsAdminService.updateLearningBlob(id, dto);
  }

  @Delete('blobs/:id')
  async deleteLearningBlob(@Param('id') id: string) {
    return this.lmsAdminService.deleteLearningBlob(id);
  }

  // ── Question Bank ─────────────────────────────────────────────────────────────

  @Get('questions')
  async getQuestions() {
    return this.lmsAdminService.getQuestions();
  }

  @Post('questions')
  async createQuestion(
    @Body()
    dto: {
      type: number;
      questionText: string;
      questionData?: any;
      correctAnswer?: any;
      benchmarkAnswer?: string;
      points?: number;
      knowledgeEvidenceId?: string;
      coreLearningBlobId?: string;
    },
  ) {
    return this.lmsAdminService.createQuestion(dto);
  }

  @Put('questions/:id')
  async updateQuestion(
    @Param('id') id: string,
    @Body()
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
    return this.lmsAdminService.updateQuestion(id, dto);
  }

  @Delete('questions/:id')
  async deleteQuestion(@Param('id') id: string) {
    return this.lmsAdminService.deleteQuestion(id);
  }

  // ── Learning Plans ────────────────────────────────────────────────────────────

  @Get('plans')
  async getLearningPlans(@Query('courseCodeId') courseCodeId?: string) {
    const cId = courseCodeId ? parseInt(courseCodeId, 10) : undefined;
    return this.lmsAdminService.getLearningPlans(cId);
  }

  @Post('plans')
  async createLearningPlan(
    @Body()
    dto: {
      courseCodeId: number;
      version: string;
      title: string;
      description?: string;
      isDefault?: boolean;
    },
  ) {
    return this.lmsAdminService.createLearningPlan(dto);
  }

  @Put('plans/:id')
  async updateLearningPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      title?: string;
      description?: string;
      status?: string;
      isDefault?: boolean;
    },
  ) {
    return this.lmsAdminService.updateLearningPlan(id, dto);
  }

  @Post('plans/:id/questions')
  async setPlanQuestions(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      items: Array<{ questionId: string; sortOrder: number; points?: number }>;
    },
  ) {
    return this.lmsAdminService.setPlanQuestions(id, dto.items);
  }
}
