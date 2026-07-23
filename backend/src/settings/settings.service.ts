import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

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
}
