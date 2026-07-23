import { Injectable, Logger } from '@nestjs/common';
import { AxcelerateService } from '../axcelerate/axcelerate.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

interface ScheduleItemInput {
  id?: number;
  scheduleId?: number;
  dayOfWeek?: number | string;
  day?: number | string;
  locationId?: string | null;
  locationName?: string | null;
  startTime: string;
  endTime: string;
  maxParticipants?: number;
  courseCode: string;
  trainerId?: string | null;
  trainerName?: string | null;
}

interface QueueRunInput {
  scheduleId: number;
  startDate: string;
  endDate: string;
  confirmValue?: string;
}

@Injectable()
export class BulkSchedulerService {
  private readonly logger = new Logger(BulkSchedulerService.name);

  constructor(
    private readonly axcelerate: AxcelerateService,
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async listSchedules() {
    return this.prisma.bulkSchedulerSchedule.findMany({
      orderBy: { name: 'asc' },
      include: { items: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } },
    });
  }

  async getSchedule(id: number) {
    return this.prisma.bulkSchedulerSchedule.findUnique({
      where: { id },
      include: { items: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] } },
    });
  }

  async createSchedule(name: string) {
    return this.prisma.bulkSchedulerSchedule.create({ data: { name } });
  }

  async renameSchedule(id: number, name: string) {
    return this.prisma.bulkSchedulerSchedule.update({ where: { id }, data: { name } });
  }

  async duplicateSchedule(id: number, name?: string) {
    const source = await this.getSchedule(id);
    if (!source) throw new Error('Schedule not found');

    const duplicateName = name?.trim() || `${source.name} Copy`;

    const created = await this.prisma.bulkSchedulerSchedule.create({
      data: { name: duplicateName },
    });

    await this.prisma.bulkSchedulerScheduleItem.createMany({
      data: source.items.map((item) => ({
        scheduleId: created.id,
        dayOfWeek: item.dayOfWeek,
        locationId: item.locationId,
        locationName: item.locationName,
        startTime: item.startTime,
        endTime: item.endTime,
        maxParticipants: item.maxParticipants,
        courseCode: item.courseCode,
        trainerId: item.trainerId,
        trainerName: item.trainerName,
      })),
    });

    return created;
  }

  async deleteSchedule(id: number) {
    await this.prisma.bulkSchedulerScheduleItem.deleteMany({ where: { scheduleId: id } });
    return this.prisma.bulkSchedulerSchedule.delete({ where: { id } });
  }

  async addItem(scheduleId: number, item: ScheduleItemInput) {
    const locations = await this.axcelerate.getLocations().catch(() => []);
    const rows = this.expandItemInput({
      scheduleId,
      dayOfWeek: item.dayOfWeek ?? item.day,
      day: item.day ?? item.dayOfWeek,
      locationId: item.locationId ?? null,
      locationName: item.locationName ?? null,
      startTime: item.startTime,
      endTime: item.endTime,
      maxParticipants: item.maxParticipants ?? 0,
      courseCode: item.courseCode,
      trainerId: item.trainerId ?? null,
      trainerName: item.trainerName ?? null,
    } as any, locations);

    if (!rows.length) {
      throw new Error('No rows to insert after expansion.');
    }

    return this.prisma.$transaction(rows.map((row) => this.prisma.bulkSchedulerScheduleItem.create({ data: row })));
  }

  async updateItem(id: number, item: ScheduleItemInput) {
    const existing = await this.prisma.bulkSchedulerScheduleItem.findUnique({ where: { id } });
    if (!existing) throw new Error('Schedule item not found');

    const locations = await this.axcelerate.getLocations().catch(() => []);

    const rows = this.expandItemInput({
      scheduleId: existing.scheduleId,
      dayOfWeek: item.dayOfWeek ?? item.day,
      day: item.day ?? item.dayOfWeek,
      locationId: item.locationId ?? null,
      locationName: item.locationName ?? null,
      startTime: item.startTime,
      endTime: item.endTime,
      maxParticipants: item.maxParticipants ?? 0,
      courseCode: item.courseCode,
      trainerId: item.trainerId ?? null,
      trainerName: item.trainerName ?? null,
    } as any, locations);

    if (!rows.length) {
      throw new Error('No rows to insert after expansion.');
    }

    await this.prisma.bulkSchedulerScheduleItem.delete({ where: { id } });

    return this.prisma.$transaction(rows.map((row) => this.prisma.bulkSchedulerScheduleItem.create({ data: row })));
  }

  async deleteItem(id: number) {
    return this.prisma.bulkSchedulerScheduleItem.delete({ where: { id } });
  }

  async queueRun(input: QueueRunInput) {
    const schedule = await this.getSchedule(input.scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    if (!input.startDate || !input.endDate) {
      throw new Error('Start date and end date are required.');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [startYear, startMonth, startDay] = input.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = input.endDate.split('-').map(Number);
    const startDate = new Date(startYear, startMonth - 1, startDay);
    const endDate = new Date(endYear, endMonth - 1, endDay);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error('Invalid date format.');
    }

    if (startDate > endDate) {
      throw new Error('Start date must be before or equal to end date.');
    }

    if (startDate < today) {
      throw new Error('You can only generate workshops in the future.');
    }

    const expected = this.countExpectedWorkshops(schedule.items as any[], input.startDate, input.endDate);
    if (expected <= 0) {
      throw new Error('No schedule rows match the selected date range.');
    }

    const run = await this.prisma.bulkSchedulerRun.create({
      data: {
        scheduleId: input.scheduleId,
        startDate: input.startDate,
        endDate: input.endDate,
        status: 'queued',
        totalExpected: expected,
        createdCount: 0,
        errorCount: 0,
        message: 'Queued',
        createdBy: 'system',
      },
    });

    setImmediate(() => {
      void this.processRun(run.id);
    });

    return { run, expected };
  }

  async processRun(runId: number) {
    const run = await this.prisma.bulkSchedulerRun.findUnique({ where: { id: runId } });
    if (!run) return;

    await this.prisma.bulkSchedulerRun.update({
      where: { id: runId },
      data: { status: 'running', startedAt: new Date(), message: 'Running' },
    });

    const schedule = await this.getSchedule(run.scheduleId);
    if (!schedule?.items.length) {
      await this.prisma.bulkSchedulerRun.update({
        where: { id: runId },
        data: { status: 'failed', finishedAt: new Date(), message: 'Schedule has no workshop rows.' },
      });
      return;
    }

    const [activityMap, courseLookup, defaultContactId] = await Promise.all([
      this.axcelerate.getActiveWorkshopActivityMap().catch((err) => {
        this.logger.warn(`Unable to load active workshop activities: ${err?.message}`);
        return null as any;
      }),
      this.settings.getCourseCodeMap(),
      this.settings.get('axcelerate_default_contact_id').then((v) => parseInt(v ?? '0', 10)),
    ]);

    if (!activityMap || typeof activityMap !== 'object') {
      await this.prisma.bulkSchedulerRun.update({
        where: { id: runId },
        data: { status: 'failed', finishedAt: new Date(), message: 'Unable to load active workshop activities.' },
      });
      return;
    }

    if (!defaultContactId || defaultContactId <= 0) {
      this.logger.warn('Default Axcelerate Contact ID (axcelerate_default_contact_id) is not set in Settings.');
    }

    const startDate = new Date(`${run.startDate}T00:00:00`);
    const endDate = new Date(`${run.endDate}T00:00:00`);
    const created: string[] = [];
    const errors: string[] = [];

    let current = new Date(startDate);
    while (current <= endDate) {
      const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
      for (const item of schedule.items) {
        if (item.dayOfWeek !== dayOfWeek) continue;
        try {
          const result = await this.createWorkshopForDate(item as any, current, activityMap, courseLookup, defaultContactId);
          if (result?.ok || result?.instanceId || result?.INSTANCEID || result?.instanceID || (result && !result.error && !result.ERROR)) {
            created.push(`${this.formatDate(current)}:${item.courseCode}`);
          } else {
            const errStr = result?.message || result?.ERROR || result?.error || JSON.stringify(result);
            errors.push(`${this.formatDate(current)}: ${errStr}`);
          }
        } catch (error: any) {
          const respData = error?.response?.data;
          let errMsg = error?.message ?? 'Unknown error';
          if (respData) {
            if (typeof respData === 'string') {
              errMsg = respData;
            } else if (respData.message || respData.details || respData.error || respData.MSG || respData.DETAILS) {
              errMsg = respData.message || respData.details || respData.MSG || respData.DETAILS || respData.error;
              if (typeof errMsg === 'object') errMsg = JSON.stringify(errMsg);
            } else {
              errMsg = JSON.stringify(respData);
            }
          }
          this.logger.error(`Axcelerate error creating workshop on ${this.formatDate(current)}: ${errMsg}`, error.stack);
          errors.push(`${this.formatDate(current)}: ${errMsg}`);
        }

        await this.prisma.bulkSchedulerRun.update({
          where: { id: runId },
          data: {
            createdCount: created.length,
            errorCount: errors.length,
            message: `Processing... (${created.length}/${run.totalExpected})`,
          },
        });
      }
      current.setDate(current.getDate() + 1);
    }

    const finalStatus = created.length === 0 && errors.length > 0 ? 'failed' : 'completed';
    await this.prisma.bulkSchedulerRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        createdCount: created.length,
        errorCount: errors.length,
        finishedAt: new Date(),
        message: errors.length
          ? `${created.length} created, ${errors.length} failed: ${errors.slice(0, 3).join('; ')}`
          : `Completed successfully. ${created.length} workshops created.`,
      },
    });
  }

  async getRunHistory() {
    return this.prisma.bulkSchedulerRun.findMany({
      orderBy: { createdAt: 'desc' },
      include: { schedule: true },
    });
  }

  async getOptions() {
    const [courseCodesList, locations, trainers] = await Promise.all([
      this.settings.getCourseCodes(),
      this.axcelerate.getLocations().catch(() => [] as { id: string; name: string }[]),
      this.axcelerate.getTrainers().catch(() => [] as { id: string; name: string }[]),
    ]);

    const courseCodes = courseCodesList
      .map((item) => ({
        value: item.code,
        label: `${item.code} - ${item.shortName || item.name || item.code}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      courseCodes,
      locations,
      trainers,
    };
  }

  countExpectedWorkshops(items: Array<{ dayOfWeek: number }>, startDate: string, endDate: string): number {
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    let total = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
      for (const item of items) {
        if (item.dayOfWeek === dayOfWeek) total += 1;
      }
      current.setDate(current.getDate() + 1);
    }
    return total;
  }

  expandItemInput(payload: any, locations: Array<{ id: string; name: string }> = []): Array<any> {
    const days = this.expandDays(payload.dayOfWeek ?? payload.day);
    const resolvedLocations = this.resolveLocations(payload, locations);
    const rows: any[] = [];

    for (const dayOfWeek of days) {
      for (const location of resolvedLocations) {
        rows.push({
          scheduleId: payload.scheduleId,
          dayOfWeek,
          locationId: location.id || null,
          locationName: location.name || null,
          startTime: payload.startTime,
          endTime: payload.endTime,
          maxParticipants: Number(payload.maxParticipants ?? 0),
          courseCode: String(payload.courseCode ?? '').trim().toUpperCase(),
          trainerId: payload.trainerId ?? null,
          trainerName: payload.trainerName ?? null,
        });
      }
    }

    return rows;
  }

  private resolveLocations(payload: any, locations: Array<{ id: string; name: string }> = []) {
    const locationId = String(payload.locationId ?? '').trim();
    if (locationId === 'all_locations' || !locationId || payload.locationName === 'All Locations') {
      if (locations.length) return locations.map((location) => ({ id: String(location.id), name: location.name }));
      return [{ id: '', name: payload.locationName || 'All Locations' }];
    }

    let locationName = payload.locationName ?? '';
    if (!locationName && locations.length) {
      const match = locations.find((loc) => String(loc.id) === locationId);
      if (match) locationName = match.name;
    }

    return [{ id: locationId, name: locationName }];
  }

  private expandDays(day: number | string | undefined): number[] {
    if (day === 'everyday') return [1, 2, 3, 4, 5, 6, 7];
    if (day === 'weekdays') return [1, 2, 3, 4, 5];
    if (day === 'weekend') return [6, 7];

    const parsed = Number(day);
    return parsed >= 1 && parsed <= 7 ? [parsed] : [];
  }

  private async createWorkshopForDate(item: any, date: Date, activityMap: Record<string, number>, courseLookup: Map<string, { name: string; shortName: string; cost: number }>, defaultContactId: number) {
    const courseCode = String(item.courseCode ?? '').toUpperCase();
    const activityId = activityMap[courseCode];
    if (!activityId) {
      throw new Error(`No active workshop activity ID found for course code ${courseCode}`);
    }

    const match = courseLookup.get(courseCode);
    const shortName = match?.shortName || match?.name || courseCode;
    const timeLabel = this.formatTimeLabel(item.startTime);
    const name = `${courseCode} - ${shortName} - ${timeLabel}`;

    const payload = {
      activity_id: activityId,
      name,
      date: this.formatDate(date),
      location_id: item.locationId ?? null,
      location_name: item.locationName ?? '',
      start_time: item.startTime,
      end_time: item.endTime,
      max_participants: parseInt(item.maxParticipants ?? '0', 10),
      course_code: courseCode,
      cost: match?.cost ?? 0,
      trainer_id: item.trainerId,
      trainer_name: item.trainerName,
      contact_id: defaultContactId,
    };

    return this.axcelerate.createWorkshopFromSchedule(payload);
  }

  private formatTimeLabel(time: string): string {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time || '');
    if (!match) return (time || '').replace(':', '').toUpperCase();
    const hour = parseInt(match[1], 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}${suffix}`;
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
