import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AzureStorageModule } from '../azure-storage/azure-storage.module';
import { SettingsModule } from '../settings/settings.module';
import { AiModule } from '../ai/ai.module';
import { LmsController } from './lms.controller';
import { LmsService } from './lms.service';
import { LmsDiagnosticService } from './lms-diagnostic.service';
import { LmsAdminController } from './lms-admin.controller';
import { LmsAdminService } from './lms-admin.service';

@Module({
  imports: [PrismaModule, AzureStorageModule, SettingsModule, AiModule],
  controllers: [LmsController, LmsAdminController],
  providers: [LmsService, LmsDiagnosticService, LmsAdminService],
  exports: [LmsService, LmsDiagnosticService, LmsAdminService],
})
export class LmsModule {}
