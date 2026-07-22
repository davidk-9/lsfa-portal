import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BulkSchedulerService } from './bulk-scheduler.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER')
@Controller('bulk-scheduler')
export class BulkSchedulerController {
  constructor(private readonly service: BulkSchedulerService) {}

  @Get('schedules')
  listSchedules() {
    return this.service.listSchedules();
  }

  @Post('schedules')
  createSchedule(@Body() body: { name: string }) {
    return this.service.createSchedule(body.name);
  }

  @Put('schedules/:id')
  renameSchedule(@Param('id', ParseIntPipe) id: number, @Body() body: { name: string }) {
    return this.service.renameSchedule(id, body.name);
  }

  @Post('schedules/:id/duplicate')
  duplicateSchedule(@Param('id', ParseIntPipe) id: number, @Body() body?: { name?: string }) {
    return this.service.duplicateSchedule(id, body?.name);
  }

  @Delete('schedules/:id')
  deleteSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteSchedule(id);
  }

  @Post('schedules/:id/items')
  addItem(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.addItem(id, body);
  }

  @Put('items/:id')
  updateItem(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.service.updateItem(id, body);
  }

  @Delete('items/:id')
  deleteItem(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteItem(id);
  }

  @Post('runs')
  queueRun(@Body() body: { scheduleId: number; startDate: string; endDate: string; confirmValue?: string }) {
    return this.service.queueRun(body);
  }

  @Get('runs')
  getRuns() {
    return this.service.getRunHistory();
  }

  @Get('options')
  getOptions() {
    return this.service.getOptions();
  }

  @Post('runs/:id/process')
  processRun(@Param('id', ParseIntPipe) id: number) {
    return this.service.processRun(id);
  }
}
