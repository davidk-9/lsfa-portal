import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
    super({ adapter } as any);
  }

  async onModuleInit() {
    await this.$connect();
    try {
      await this.$executeRawUnsafe(`
        ALTER TABLE "LmsEnrollment" DROP CONSTRAINT IF EXISTS "LmsEnrollment_instanceId_fkey";
      `);
    } catch (err: any) {
      // Ignore if table/constraint does not exist on startup
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
