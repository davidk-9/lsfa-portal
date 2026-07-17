import { NestFactory } from '@nestjs/core';
import { RequestMethod } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Everything is under /api except the public file proxy, which must live at
  // the site root so the URL stored in Axcelerate is a clean {domain}/proxy/{key}.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'proxy/:proxyKey', method: RequestMethod.GET }],
  });
  app.enableCors({
    origin: ['http://localhost:5173'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`LSFA Central API running on http://localhost:${port}/api`);
}

bootstrap();
