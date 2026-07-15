import { Module } from '@nestjs/common';
import { WorkshopDetailService } from './workshop-detail.service';
import { WorkshopDetailController } from './workshop-detail.controller';
import { AxcelerateModule } from '../axcelerate/axcelerate.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AxcelerateModule, SettingsModule],
  providers: [WorkshopDetailService],
  controllers: [WorkshopDetailController],
})
export class WorkshopDetailModule {}
