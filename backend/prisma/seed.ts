/**
 * Seed script — creates the initial Super User account.
 * Run once after the first migration:
 *   npx ts-node prisma/seed.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const email = process.env.SEED_EMAIL ?? 'admin@lsfa.com.au';
  const password = process.env.SEED_PASSWORD ?? 'changeme123';
  const name = process.env.SEED_NAME ?? 'Super Admin';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super User already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: 'SUPER_USER' },
  });

  console.log(`✅ Super User created: ${user.email} (id: ${user.id})`);
  console.log(`   Password: ${password} — change this immediately after first login!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
