import { Module, forwardRef } from '@nestjs/common';
import { AxcelerateService } from './axcelerate.service';
import { SettingsModule } from '../settings/settings.module';
import { WebhooksController } from './webhooks.controller';
import { ContactsModule } from '../contacts/contacts.module';

@Module({
  imports: [SettingsModule, forwardRef(() => ContactsModule)],
  controllers: [WebhooksController],
  providers: [AxcelerateService],
  exports: [AxcelerateService],
})
export class AxcelerateModule {}
