import { Module } from '@nestjs/common';
import { WorkshopsService } from './workshops.service';
import { WorkshopsController } from './workshops.controller';
import { AxcelerateModule } from '../axcelerate/axcelerate.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [AxcelerateModule, SettingsModule],
  providers: [WorkshopsService],
  controllers: [WorkshopsController],
})
export class WorkshopsModule {}
