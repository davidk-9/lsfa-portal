import { Controller, Get, Patch, Post, Body, Request, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get('me')
  getMyContact(@Request() req) {
    return this.contactsService.getContactForUser(req.user.id);
  }

  @Patch('me')
  updateMyContact(@Request() req, @Body() body: any) {
    return this.contactsService.updateContactForUser(req.user.id, body);
  }

  @Post('sync-axcelerate')
  syncAxcelerate(@Request() req, @Body('axcelerateContactId') targetId?: number) {
    return this.contactsService.syncAxcelerateForUser(req.user.id, targetId);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER')
  @Post('bulk-sync')
  async bulkSyncContacts() {
    // Start background sync job and return immediately so UI doesn't timeout
    this.contactsService.runBulkSyncJob().catch(e => console.error('Bulk sync failed:', e));
    return { success: true, message: 'Bulk sync started' };
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER')
  @Get('bulk-sync/status')
  async getBulkSyncStatus() {
    return this.contactsService.getBulkSyncStatus();
  }
}