import {
  Controller, Get, Post, Body, Query, UseGuards,
  ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { WorkshopDetailService } from './workshop-detail.service';
import { MarkAttendanceDto, SaveChecklistDto, SaveProgressDto } from './dto/workshop-detail.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
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

  @Post('progress')
  saveProgress(@Body() dto: SaveProgressDto) {
    return this.service.saveWorkshopProgress(dto.instanceId, dto.trainerContactId, dto.status);
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
