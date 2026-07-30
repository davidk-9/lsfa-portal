import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { WorkshopsService } from './workshops.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER', 'ADMIN', 'TRAINER')
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
    @Query('trainerId', new DefaultValuePipe('')) trainerId: string,
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
