import { Module } from '@nestjs/common';
import { AzureStorageService } from './azure-storage.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [SettingsModule],
  providers: [AzureStorageService],
  exports: [AzureStorageService],
})
export class AzureStorageModule {}
