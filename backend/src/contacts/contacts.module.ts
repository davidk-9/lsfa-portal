import { Module, forwardRef } from '@nestjs/common';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { AxcelerateModule } from '../axcelerate/axcelerate.module';

@Module({
  imports: [forwardRef(() => AxcelerateModule)],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}