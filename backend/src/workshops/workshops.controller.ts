import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { WorkshopsService } from './workshops.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('workshops')
export class WorkshopsController {
  constructor(private workshopsService: WorkshopsService) {}

  @Get('calendar')
  getCalendar(
    @Query('month', new DefaultValuePipe(0), ParseIntPipe) month: number,
    @Query('year', new DefaultValuePipe(0), ParseIntPipe) year: number,
  ) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    return this.workshopsService.getCalendar(m, y);
  }

  @Get('trainer-calendar')
  getTrainerCalendar(
    @Query('trainerId', new DefaultValuePipe(0), ParseIntPipe) trainerId: number,
    @Query('month', new DefaultValuePipe(0), ParseIntPipe) month: number,
    @Query('year', new DefaultValuePipe(0), ParseIntPipe) year: number,
  ) {
    const now = new Date();
    const m = month || now.getMonth() + 1;
    const y = year || now.getFullYear();
    return this.workshopsService.getTrainerCalendar(trainerId, m, y);
  }

  @Get('filters')
  getFilters() {
    return this.workshopsService.getFilters();
  }
}
