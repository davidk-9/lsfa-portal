import { Module } from '@nestjs/common';
import { AxcelerateService } from './axcelerate.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [AxcelerateService],
  exports: [AxcelerateService],
})
export class AxcelerateModule {}
