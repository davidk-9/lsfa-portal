import { Controller, Get, Patch, Post, Body, Request, UseGuards, Sse, MessageEvent, BadRequestException } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
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

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Get('search')
  searchContacts(@Request() req) {
    const q = req.query.q as string || '';
    const limit = parseInt(req.query.limit as string || '10', 10);
    return this.contactsService.searchContactsQuick(q, limit);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Get()
  getContactsPaginated(@Request() req) {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const search = req.query.search as string || '';
    return this.contactsService.getContactsPaginated(page, limit, search);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER')
  @Sse('sync-users-usi-stream')
  streamSyncUsersWithVerifiedUsi(): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.contactsService
      .syncUsersWithVerifiedUsiStream((event) => subject.next({ data: event }))
      .finally(() => subject.complete());
    return subject.asObservable();
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Get(':id')
  getContactById(@Request() req) {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      throw new BadRequestException('Invalid contact ID parameter');
    }
    return this.contactsService.getContactById(id);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Patch(':id')
  updateContactById(@Request() req, @Body() body: any) {
    const id = parseInt(req.params.id, 10);
    return this.contactsService.updateContactById(id, body);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Post(':id/sync-axcelerate')
  syncContactAxcelerate(@Request() req) {
    const id = parseInt(req.params.id, 10);
    return this.contactsService.syncAxcelerateForContact(id);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Post(':id/link-user')
  linkUserToContact(@Request() req, @Body() body: { userId: number }) {
    const contactId = parseInt(req.params.id, 10);
    return this.contactsService.linkUserToContact(contactId, body.userId);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Post(':id/unlink-user')
  unlinkUserFromContact(@Request() req) {
    const contactId = parseInt(req.params.id, 10);
    return this.contactsService.unlinkUserFromContact(contactId);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Post(':id/create-user')
  createUserForContact(@Request() req, @Body() body: { password?: string }) {
    const contactId = parseInt(req.params.id, 10);
    return this.contactsService.createUserForContact(contactId, body.password);
  }

  @Post('sync-axcelerate')
  syncAxcelerate(@Request() req, @Body('axcelerateContactId') targetId?: number) {
    return this.contactsService.syncAxcelerateForUser(req.user.id, targetId);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER', 'ADMIN')
  @Post(':id/test-axcelerate-lookup')
  async testAxcelerateLookup(@Request() req) {
    const contactId = parseInt(req.params.id, 10);
    return this.contactsService.testAxcelerateLookup(contactId);
  }

  @UseGuards(RolesGuard)
  @Roles('SUPER_USER')
  @Post('sync-users-usi')
  async syncUsersWithVerifiedUsi() {
    return this.contactsService.syncUsersWithVerifiedUsi();
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