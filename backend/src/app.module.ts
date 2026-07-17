import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SettingsModule } from './settings/settings.module';
import { AxcelerateModule } from './axcelerate/axcelerate.module';
import { WorkshopsModule } from './workshops/workshops.module';
import { WorkshopDetailModule } from './workshop-detail/workshop-detail.module';
import { AzureStorageModule } from './azure-storage/azure-storage.module';
import { UploadsModule } from './uploads/uploads.module';
import { WpSyncModule } from './wp-sync/wp-sync.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    AxcelerateModule,
    WorkshopsModule,
    WorkshopDetailModule,
    AzureStorageModule,
    UploadsModule,
    WpSyncModule,
    AiModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({ whitelist: true, transform: true }),
    },
  ],
})
export class AppModule {}
