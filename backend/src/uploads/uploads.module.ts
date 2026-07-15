import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadsController } from './uploads.controller';
import { AzureStorageModule } from '../azure-storage/azure-storage.module';
import { AxcelerateModule } from '../axcelerate/axcelerate.module';

@Module({
  imports: [
    AzureStorageModule,
    AxcelerateModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [UploadsController],
})
export class UploadsModule {}
