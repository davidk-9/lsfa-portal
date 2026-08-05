import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { ContactsService } from '../contacts/contacts.service';
import { SettingsService } from '../settings/settings.service';

@Controller('axcelerate/webhooks')
export class WebhooksController {
  private readonly logger = new Logger('AxcelerateWebhooks');

  constructor(
    private readonly contactsService: ContactsService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get()
  verifyEndpoint() {
    return { status: 'Webhook receiver is active.' };
  }

  @Post()
  async handleWebhook(@Body() body: any) {
    const logWebhooksVal = await this.settingsService.get('log_webhooks');
    const shouldLog = logWebhooksVal === 'true' || logWebhooksVal === '1';

    if (shouldLog) {
      this.logger.log('--- RECEIVED AXCELERATE WEBHOOK ---');
      this.logger.log(JSON.stringify(body, null, 2));
      this.logger.log('-----------------------------------');
    }

    const type = body?.type;
    const contactId = body?.message?.contact?.id;
    const mergedContactIds: number[] = Array.isArray(body?.message?.mergedContactIds)
      ? body.message.mergedContactIds.map(Number).filter(Boolean)
      : [];

    if (type === 'contact.contact_merged') {
      if (shouldLog) {
        this.logger.warn('=== MERGED CONTACT WEBHOOK RECEIVED ===');
        this.logger.warn(JSON.stringify(body, null, 2));
        this.logger.warn('========================================');
      }

      if (contactId && mergedContactIds.length > 0) {
        this.contactsService.handleMergedContacts(contactId, mergedContactIds).catch(err => {
          this.logger.error(`Failed to handle merged contacts for target ${contactId}: ${err.message}`);
        });
      }
    }

    if (contactId && (type === 'contact.contact_created' || type === 'contact.contact_updated' || type === 'contact.contact_merged' || type === 'contact.contact_deleted')) {
      this.logger.log(`Processing ${type} for Contact ID: ${contactId}`);
      // Run the sync asynchronously so we don't hold up the webhook response
      this.contactsService.syncSingleContactById(contactId).catch(err => {
        this.logger.error(`Failed to sync contact ${contactId} from webhook: ${err.message}`);
      });
    }

    return { received: true };
  }
}
