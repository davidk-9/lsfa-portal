import { Module } from '@nestjs/common';
import { WpSyncService } from './wp-sync.service';
import { WpSyncController } from './wp-sync.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [WpSyncService],
  controllers: [WpSyncController],
})
export class WpSyncModule {}
