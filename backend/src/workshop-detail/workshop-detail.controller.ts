import {
  Controller, Get, Post, Body, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { WorkshopDetailService } from './workshop-detail.service';
import { MarkAttendanceDto, SaveChecklistDto, SaveProgressDto, WizardSaveDto } from './dto/workshop-detail.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER', 'ADMIN', 'TRAINER')
@Controller('workshop-detail')
export class WorkshopDetailController {
  constructor(private service: WorkshopDetailService) {}

  @Get('header')
  getHeader(
    @Query('instanceId', ParseIntPipe) instanceId: number,
    @Query('enrolOpen', new DefaultValuePipe('false')) enrolOpen: string,
    @Query('isPublic', new DefaultValuePipe('false')) isPublic: string,
  ) {
    return this.service.getWorkshopDetail(instanceId, enrolOpen, isPublic);
  }

  @Get('students')
  getStudents(
    @Query('instanceId', ParseIntPipe) instanceId: number,
    @Query('startDate', new DefaultValuePipe('')) startDate: string,
    @Query('courseCode', new DefaultValuePipe('')) courseCode: string,
  ) {
    return this.service.getStudentList(instanceId, startDate || null, courseCode);
  }

  @Post('attendance')
  markAttendance(@Body() dto: MarkAttendanceDto) {
    return this.service.markAttendance(
      dto.instanceId, dto.contactId, dto.complexId, dto.attended, dto.comment,
    );
  }

  @Get('checklist')
  getChecklist(
    @Query('instanceId', ParseIntPipe) instanceId: number,
    @Query('contactId', ParseIntPipe) contactId: number,
    @Query('courseCode', new DefaultValuePipe('')) courseCode: string,
  ) {
    return this.service.getStudentChecklist(instanceId, contactId, courseCode);
  }

  @Post('checklist')
  saveChecklist(@Body() dto: SaveChecklistDto) {
    return this.service.saveStudentChecklist(dto.instanceId, dto.contactId, dto.courseCode, dto.data);
  }

  @Post('checklist/reset')
  resetChecklists(
    @Body('instanceId', ParseIntPipe) instanceId: number,
    @Body('courseCode') courseCode: string,
  ) {
    return this.service.resetAllChecklists(instanceId, courseCode);
  }

  @Post('checklist/bulk-mark-satisfactory')
  bulkMarkAllTasksSatisfactory(
    @Body('instanceId', ParseIntPipe) instanceId: number,
    @Body('courseCode') courseCode: string,
  ) {
    return this.service.bulkMarkAllTasksSatisfactory(instanceId, courseCode || '');
  }

  @Post('progress')
  saveProgress(@Body() dto: SaveProgressDto) {
    return this.service.saveWorkshopProgress(dto.instanceId, dto.trainerContactId, dto.status);
  }

  @Get('progress-record')
  getProgressRecord(@Query('instanceId', ParseIntPipe) instanceId: number) {
    return this.service.getWorkshopProgressRecord(instanceId);
  }

  @Post('toggle-lms')
  toggleLmsEnabled(
    @Body('instanceId', ParseIntPipe) instanceId: number,
    @Body('lmsEnabled') lmsEnabled: boolean,
  ) {
    return this.service.toggleLmsEnabled(instanceId, lmsEnabled);
  }

  @Get('task-structure')
  getTaskStructure(
    @Query('instanceId', ParseIntPipe) instanceId: number,
    @Query('courseCode', new DefaultValuePipe('')) courseCode: string,
  ) {
    return this.service.getTaskStructure(instanceId, courseCode);
  }

  @Post('wizard-save')
  saveWizardResults(@Body() dto: WizardSaveDto) {
    return this.service.saveWizardResults(
      dto.instanceId,
      dto.contactIds,
      dto.ptId,
      dto.taskResult,
      dto.elementsResults,
      dto.trainerComment ?? '',
      dto.courseCode,
    );
  }

  @Get('olka')
  getOlka(
    @Query('instanceId', ParseIntPipe) instanceId: number,
    @Query('courseCode', new DefaultValuePipe('')) courseCode: string,
  ) {
    return this.service.getOlkaStatuses(instanceId, courseCode);
  }

  // Port of PHP ajax_get_success_comment — returns a random comment from the pool for a practical task
  @Get('success-comment')
  getSuccessComment(@Query('ptId', new DefaultValuePipe('')) ptId: string) {
    return this.service.getSuccessComment(ptId);
  }
}
