import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { LmsService } from './lms.service';
import { SubmitAssessmentDto, UpdateLearningModeDto, RecordBlobViewDto } from './dto/lms.dto';

@Controller('lms')
export class LmsController {
  constructor(private readonly lmsService: LmsService) {}

  @Get('enrollment/:id')
  async getEnrollment(@Param('id') id: string) {
    return this.lmsService.getEnrollment(id);
  }

  @Get('enrollment/:id/content')
  async getEnrollmentContent(@Param('id') id: string) {
    return this.lmsService.getEnrollmentContent(id);
  }

  @Patch('enrollment/:id/mode')
  async updateLearningMode(
    @Param('id') id: string,
    @Body() dto: UpdateLearningModeDto,
  ) {
    return this.lmsService.updateLearningMode(id, dto);
  }

  @Post('enrollment/:id/blob-viewed')
  async recordBlobView(
    @Param('id') id: string,
    @Body() dto: RecordBlobViewDto,
  ) {
    return this.lmsService.recordBlobView(id, dto);
  }

  @Get('units/:unitCode/questions')
  async getQuestionsForUnit(@Param('unitCode') unitCode: string) {
    return this.lmsService.getQuestionsForUnit(unitCode);
  }

  @Post('enrollment/submit-assessment')
  async submitAssessment(@Body() dto: SubmitAssessmentDto) {
    return this.lmsService.submitAssessment(dto);
  }

  @Post('seed')
  async seedSampleData() {
    return this.lmsService.seedSampleData();
  }
}
