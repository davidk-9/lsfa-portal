import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { ContactsService } from '../contacts/contacts.service';

@Controller('axcelerate/webhooks')
export class WebhooksController {
  private readonly logger = new Logger('AxcelerateWebhooks');

  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  verifyEndpoint() {
    return { status: 'Webhook receiver is active.' };
  }

  @Post()
  async handleWebhook(@Body() body: any) {
    this.logger.log('--- RECEIVED AXCELERATE WEBHOOK ---');
    this.logger.log(JSON.stringify(body, null, 2));
    this.logger.log('-----------------------------------');

    const type = body?.type;
    const contactId = body?.message?.contact?.id;

    if (contactId && (type === 'contact.contact_created' || type === 'contact.contact_updated' || type === 'contact.contact_merged')) {
      this.logger.log(`Processing ${type} for Contact ID: ${contactId}`);
      // Run the sync asynchronously so we don't hold up the webhook response
      this.contactsService.syncSingleContactById(contactId).catch(err => {
        this.logger.error(`Failed to sync contact ${contactId} from webhook: ${err.message}`);
      });
    }

    return { received: true };
  }
}
