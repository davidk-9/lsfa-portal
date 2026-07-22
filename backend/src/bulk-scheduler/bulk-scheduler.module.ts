import { Module } from '@nestjs/common';
import { BulkSchedulerService } from './bulk-scheduler.service';
import { BulkSchedulerController } from './bulk-scheduler.controller';
import { AxcelerateModule } from '../axcelerate/axcelerate.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AxcelerateModule, SettingsModule],
  providers: [BulkSchedulerService],
  controllers: [BulkSchedulerController],
})
export class BulkSchedulerModule {}
