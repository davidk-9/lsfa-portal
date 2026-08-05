import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AxcelerateService } from './src/axcelerate/axcelerate.service';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const ax = app.get(AxcelerateService);
  try {
    console.log('--- CALLING AXCELERATE FOR DELETED CONTACT 15195833 ---');
    const res = await ax.getContactDetail(15195833);
    console.log('RESPONSE:', JSON.stringify(res, null, 2));
  } catch (err: any) {
    console.log('ERROR MESSAGE:', err.message);
    if (err.response) {
      console.log('HTTP STATUS:', err.response.status, err.response.statusText);
      console.log('RESPONSE DATA:', JSON.stringify(err.response.data, null, 2));
    }
  }
  await app.close();
}

test();
