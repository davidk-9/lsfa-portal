import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsController } from './uploads.controller';
import { ProxyController } from './proxy.controller';
import { AzureStorageModule } from '../azure-storage/azure-storage.module';
import { AxcelerateModule } from '../axcelerate/axcelerate.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [
    AzureStorageModule,
    AxcelerateModule,
    SettingsModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [UploadsController, ProxyController],
})
export class UploadsModule {}
