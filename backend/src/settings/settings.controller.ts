import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpsertManySettingsDto } from './dto/settings.dto';
import { CreateCourseCodeDto, UpdateCourseCodeDto } from './dto/course-code.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER')
@Controller('settings')
export class SettingsController {
  constructor(private settingsService: SettingsService) {}

  @Get()
  getAll() {
    return this.settingsService.getAll();
  }

  @Put()
  upsertMany(@Body() dto: UpsertManySettingsDto) {
    return this.settingsService.upsertMany(dto.settings);
  }

  // ── Course Codes ─────────────────────────────────────────────────────────────

  @Get('course-codes')
  getCourseCodes() {
    return this.settingsService.getCourseCodes();
  }

  @Post('course-codes')
  createCourseCode(@Body() dto: CreateCourseCodeDto) {
    return this.settingsService.createCourseCode(dto);
  }

  @Put('course-codes/:id')
  updateCourseCode(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseCodeDto,
  ) {
    return this.settingsService.updateCourseCode(id, dto);
  }

  @Delete('course-codes/:id')
  deleteCourseCode(@Param('id', ParseIntPipe) id: number) {
    return this.settingsService.deleteCourseCode(id);
  }
}
