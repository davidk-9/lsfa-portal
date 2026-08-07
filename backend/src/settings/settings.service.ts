import { Injectable, Inject, forwardRef } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AxcelerateService } from '../axcelerate/axcelerate.service';

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => AxcelerateService))
    private axcelerateService: AxcelerateService,
  ) {}

  async getAll(): Promise<Record<string, string>> {
    const rows = await this.prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  async get(key: string): Promise<string | null> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  async upsertMany(settings: { key: string; value: string }[]): Promise<void> {
    await this.prisma.$transaction(
      settings.map(({ key, value }) =>
        this.prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );
  }

  // ── Course Codes ─────────────────────────────────────────────────────────────

  async getCourseCodes() {
    const count = await this.prisma.courseCode.count();
    if (count === 0) {
      await this.migrateLegacyCourseCodeSetting();
    }
    return this.prisma.courseCode.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async getCourseCodeMap(): Promise<Map<string, { name: string; shortName: string; cost: number }>> {
    const list = await this.getCourseCodes();
    const map = new Map<string, { name: string; shortName: string; cost: number }>();
    for (const item of list) {
      map.set(item.code.toUpperCase(), {
        name: item.name || item.shortName || item.code,
        shortName: item.shortName || item.name || item.code,
        cost: item.cost,
      });
    }
    return map;
  }

  async createCourseCode(data: { code: string; name: string; shortName: string; cost: number }) {
    const code = data.code.trim().toUpperCase();
    return this.prisma.courseCode.create({
      data: {
        code,
        name: data.name.trim(),
        shortName: data.shortName.trim(),
        cost: Number(data.cost) || 0,
      },
    });
  }

  async updateCourseCode(id: number, data: { code?: string; name?: string; shortName?: string; cost?: number }) {
    const updateData: any = {};
    if (data.code !== undefined) updateData.code = data.code.trim().toUpperCase();
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.shortName !== undefined) updateData.shortName = data.shortName.trim();
    if (data.cost !== undefined) updateData.cost = Number(data.cost) || 0;

    return this.prisma.courseCode.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCourseCode(id: number) {
    return this.prisma.courseCode.delete({
      where: { id },
    });
  }

  private async migrateLegacyCourseCodeSetting() {
    const legacySetting = await this.prisma.setting.findUnique({ where: { key: 'course_code_lookup' } });
    if (!legacySetting?.value) return;

    const lines = legacySetting.value.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [rawCode, ...rest] = trimmed.split(' - ');
      if (!rawCode) continue;
      const code = rawCode.trim().toUpperCase();
      const name = rest.length ? rest.join(' - ').trim() : code;

      await this.prisma.courseCode.upsert({
        where: { code },
        update: {},
        create: {
          code,
          name,
          shortName: name,
          cost: 0,
        },
      }).catch(() => {});
    }
  }

  // ── Auto-Login / Magic Link Bulk Generation ─────────────────────────────────

  async bulkGenerateMagicLinks(options: { syncToAxcelerate?: boolean; forceRegenerate?: boolean }) {
    const syncToAxcelerate = !!options.syncToAxcelerate;
    const forceRegenerate = !!options.forceRegenerate;

    // Get public base URL from settings or config
    let baseUrl = await this.get('public_base_url');
    if (!baseUrl) {
      baseUrl = 'https://lsfa.klefen.com.au';
    }
    baseUrl = baseUrl.trim().replace(/\/+$/, '');

    // Fetch active users
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      include: { contact: true },
    });

    let tokensGenerated = 0;
    let axcelerateSynced = 0;
    let axcelerateFailed = 0;
    const errors: string[] = [];

    for (const user of users) {
      let token = user.magicToken;

      // Generate new token if missing or forced
      if (!token || forceRegenerate) {
        token = crypto.randomBytes(32).toString('hex'); // 64 hex chars
        await this.prisma.user.update({
          where: { id: user.id },
          data: { magicToken: token },
        });
        tokensGenerated++;
      }

      const fullMagicLink = `${baseUrl}/autolog?key=${token}`;

      // Sync to Axcelerate if requested
      if (syncToAxcelerate) {
        // Find contact ID (either from user.axcelerateContactId or user.contact.contactId)
        let rawContactId = user.axcelerateContactId;
        if (!rawContactId && user.contact?.contactId) {
          rawContactId = String(user.contact.contactId);
        }

        const axContactId = rawContactId ? parseInt(rawContactId, 10) : null;

        if (axContactId && axContactId > 0) {
          // Rate-limit throttle: 335ms delay enforces ~180 requests/minute max (3 req/sec)
          await new Promise((res) => setTimeout(res, 335));

          let attempts = 0;
          let success = false;

          while (!success && attempts < 3) {
            attempts++;
            try {
              await this.axcelerateService.updateContact(axContactId, {
                customField_u_lsfalink: fullMagicLink,
              });
              success = true;
              axcelerateSynced++;

              // Also update local Contact record if exists
              if (user.contact) {
                await this.prisma.contact.update({
                  where: { id: user.contact.id },
                  data: { customFieldULsfaLink: fullMagicLink },
                });
              }
            } catch (err: any) {
              const status = err?.status || err?.response?.status;
              const isRateLimited = status === 429;

              if (isRateLimited) {
                const retryAfterHeader = err?.response?.headers?.['retry-after'];
                const waitSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) + 1 : 10;
                await new Promise((res) => setTimeout(res, waitSeconds * 1000));
                continue;
              }

              const errMsg = err?.response?.data?.DETAILS || err?.message || 'Unknown error';
              errors.push(`User ID ${user.id} (Axcelerate Contact ${axContactId}): ${errMsg}`);
              axcelerateFailed++;
              break;
            }
          }
        }
      }
    }

    return {
      success: true,
      totalUsers: users.length,
      tokensGenerated,
      axcelerateSynced,
      axcelerateFailed,
      errors,
    };
  }
}
