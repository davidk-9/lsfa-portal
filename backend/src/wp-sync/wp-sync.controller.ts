import { Controller, Post, Sse, MessageEvent, UseGuards } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { WpSyncService } from './wp-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER')
@Controller('wp-sync')
export class WpSyncController {
  constructor(private wpSyncService: WpSyncService) {}

  @Post('run')
  runSync() {
    return this.wpSyncService.runSync();
  }

  @Sse('stream')
  streamSync(): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();
    this.wpSyncService
      .runSyncStream((event) => subject.next({ data: event }))
      .finally(() => subject.complete());
    return subject.asObservable();
  }
}
