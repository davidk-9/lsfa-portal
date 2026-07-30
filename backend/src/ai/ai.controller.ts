import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AiService } from './ai.service';
import { ClassifyPageDto } from './dto/classify-page.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER', 'ADMIN', 'TRAINER')
@Controller('ai')
export class AiController {
  constructor(private ai: AiService) {}

  // Classify one scanned paperwork page: which student + which paperwork type.
  // Port of PHP ajax_ai_classify_paperwork_page.
  @Post('classify-page')
  classifyPage(@Body() dto: ClassifyPageDto) {
    return this.ai.classifyPage(dto.instanceId, dto.pageNumber, dto.pageImage, dto.roster);
  }
}
