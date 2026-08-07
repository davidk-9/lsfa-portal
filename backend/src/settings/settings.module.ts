import { Module, forwardRef } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AxcelerateModule } from '../axcelerate/axcelerate.module';

@Module({
  imports: [forwardRef(() => AxcelerateModule)],
  providers: [SettingsService],
  controllers: [SettingsController],
  exports: [SettingsService],
})
export class SettingsModule {}
