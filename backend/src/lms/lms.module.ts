import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LmsController } from './lms.controller';
import { LmsService } from './lms.service';
import { LmsDiagnosticService } from './lms-diagnostic.service';
import { LmsAdminController } from './lms-admin.controller';
import { LmsAdminService } from './lms-admin.service';

@Module({
  imports: [PrismaModule],
  controllers: [LmsController, LmsAdminController],
  providers: [LmsService, LmsDiagnosticService, LmsAdminService],
  exports: [LmsService, LmsDiagnosticService, LmsAdminService],
})
export class LmsModule {}
