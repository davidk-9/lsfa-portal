import { Injectable, Logger } from '@nestjs/common';
import { AxcelerateService } from '../axcelerate/axcelerate.service';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';

export type WorkshopState =
  | 'future-with-students'
  | 'future-empty'
  | 'past-incomplete'
  | 'past-complete'
  | 'past-no-students';

export interface WorkshopDetail {
  instanceId: string;
  courseCode: string;
  shortName: string;
  startTime: string;
  endTime: string;
  participants: number;
  trainerId: string;
  trainerName: string;
  venueContactName: string;
  isPast: boolean;
  isPublic: boolean;
  progressComplete: boolean;
  status: string;
}

export interface WorkshopGroup {
  location: string;
  isPrivate: boolean;
  state: WorkshopState;
  totalCount: number;
  openCount: number;
  startTime: string;
  endTime: string;
  trainerIds: string[];
  trainerNames: string[];
  workshops: WorkshopDetail[];
}

export interface CalendarDay {
  grouped: WorkshopGroup[];
  groupedPrivate: WorkshopGroup[];
}

export interface CalendarData {
  month: number;
  year: number;
  days: Record<string, CalendarDay>;
  errors: string[];
}

export interface WorkshopStateLike {
  isPast: boolean;
  participants: number;
  progressComplete: boolean;
}

export function resolveWorkshopGroupState(
  workshops: WorkshopStateLike[],
  dayKey: string,
  todayKey: string,
): WorkshopState {
  const pastWorkshops = workshops.filter((w) => w.isPast);
  const futureWorkshops = workshops.filter((w) => !w.isPast);

  if (dayKey < todayKey) {
    if (pastWorkshops.some((w) => w.participants > 0 && !w.progressComplete)) return 'past-incomplete';
    if (pastWorkshops.some((w) => w.participants > 0 && w.progressComplete)) return 'past-complete';
    return 'past-no-students';
  }

  if (dayKey > todayKey) {
    return futureWorkshops.some((w) => w.participants === 0) ? 'future-empty' : 'future-with-students';
  }

  if (pastWorkshops.some((w) => w.participants > 0 && !w.progressComplete)) return 'past-incomplete';

  if (pastWorkshops.some((w) => w.participants > 0 && w.progressComplete)) {
    if (futureWorkshops.some((w) => w.participants > 0)) return 'future-with-students';
    return 'past-complete';
  }

  if (pastWorkshops.length > 0) return 'past-no-students';

  return futureWorkshops.some((w) => w.participants === 0) ? 'future-empty' : 'future-with-students';
}

@Injectable()
export class WorkshopsService {
  private readonly logger = new Logger(WorkshopsService.name);

  constructor(
    private axcelerate: AxcelerateService,
    private settings: SettingsService,
    private prisma: PrismaService,
  ) {}

  async getCalendar(month: number, year: number): Promise<CalendarData> {
    return this.fetchCalendar(month, year, null);
  }

  async getTrainerCalendar(trainerContactId: string, month: number, year: number): Promise<CalendarData> {
    return this.fetchCalendar(month, year, trainerContactId);
  }

  private async fetchCalendar(month: number, year: number, trainerContactId: string | null): Promise<CalendarData> {
    const now = new Date();
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const dateMin = this.formatDate(startDate);
    const dateMax = this.formatDate(endDate);
    const dateToday = this.formatDate(today);
    const isCurrentMonth =
      now.getFullYear() === year && now.getMonth() + 1 === month;
    const isPastMonth = startDate < today && !isCurrentMonth;

    const errors: string[] = [];
    let allWorkshops: any[] = [];

    // Fetch all 4 segments (same logic as PHP)
    const segments: Array<[string, string, boolean, boolean]> = [];

    if (isCurrentMonth) {
      segments.push([dateMin, dateToday, false, true]);
      segments.push([dateToday, dateMax, true, true]);
      segments.push([dateMin, dateToday, false, false]);
      segments.push([dateToday, dateMax, true, false]);
    } else if (isPastMonth) {
      segments.push([dateMin, dateMax, false, true]);
      segments.push([dateMin, dateMax, false, false]);
    } else {
      segments.push([dateMin, dateMax, true, true]);
      segments.push([dateMin, dateMax, true, false]);
    }

    // Fetch workshops and trainer name map in parallel
    const [, trainerList] = await Promise.all([      Promise.all(
        segments.map(async ([dMin, dMax, enrolOpen, isPublic]) => {
          try {
            const raw = trainerContactId
              ? await this.axcelerate.getTrainerWorkshops(trainerContactId, dMin, dMax, enrolOpen, isPublic)
              : await this.axcelerate.getWorkshops(dMin, dMax, enrolOpen, isPublic);
            const processed = this.processWorkshops(raw, enrolOpen, isPublic, now);
            allWorkshops = allWorkshops.concat(processed);
          } catch (err: any) {
            errors.push(`API fetch error: ${err?.message ?? 'Unknown error'}`);
          }
        }),
      ),
      this.axcelerate.getTrainers().catch(() => [] as { id: string; name: string }[]),
    ]);

    // Build trainer name map from the report (reliable source)
    const trainerNameMap = new Map<number, string>(
      trainerList.map((t) => [parseInt(t.id), t.name]),
    );

    allWorkshops = this.dedupeWorkshops(allWorkshops);
    allWorkshops = await this.enrichWithTrainerNames(allWorkshops, trainerNameMap);
    allWorkshops = await this.enrichPrivateWithVenueNames(allWorkshops);
    await this.annotateWithProgress(allWorkshops);

    const courseMap = await this.settings.getCourseCodeMap();
    const todayKey = this.formatDate(today);
    const days = this.groupByDay(allWorkshops, courseMap, todayKey);

    return { month, year, days, errors };
  }

  async getFilters(): Promise<{ locations: string[]; trainers: { id: string; name: string }[] }> {
    const [locRaw, trainers] = await Promise.all([
      this.axcelerate.getLocations().catch(() => [] as { id: string; name: string }[]),
      this.axcelerate.getTrainers().catch(() => [] as { id: string; name: string }[]),
    ]);
    const locations = [...new Set(locRaw.map((l) => l.name))].sort((a, b) =>
      a.localeCompare(b),
    );
    return { locations, trainers };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private processWorkshops(
    raw: any[],
    isEnrolmentOpen: boolean,
    isPublic: boolean,
    now: Date,
  ): any[] {
    return raw
      .filter((w) => w && w.STARTDATE && w.FINISHDATE)
      .map((w) => {
        const startDt = new Date(w.STARTDATE.replace(' ', 'T'));
        const isPast = startDt < now;
        return {
          ...w,
          INSTANCEID: w.INSTANCEID ?? w.instanceId ?? null,
          CODE: w.CODE ?? w.code ?? '',
          LOCATION: w.LOCATION ?? w.location ?? '',
          COURSENAME: w.COURSENAME ?? w.courseName ?? '',
          PARTICIPANTS: parseInt(w.PARTICIPANTS ?? '0') || 0,
          STATUS: w.STATUS ?? w.status ?? 'Active',
          is_past: isPast,
          is_public: isPublic,
          is_open: isEnrolmentOpen,
        };
      });
  }

  private dedupeWorkshops(workshops: any[]): any[] {
    const seen = new Set<string>();
    return workshops.filter((w) => {
      const id = String(w.INSTANCEID ?? '');
      const key = id
        ? `i:${id}`
        : `${w.CODE}|${w.STARTDATE}|${w.FINISHDATE}|${w.LOCATION}|${w.is_public ? '1' : '0'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async enrichWithTrainerNames(workshops: any[], trainerNameMap: Map<number, string>): Promise<any[]> {
    const contactCache = new Map<number, string>();

    for (const w of workshops) {
      // Port of PHP enrich_workshops_with_trainer_names:
      // 1. Try top-level TRAINERCONTACTID
      let contactId = parseInt(w.TRAINERCONTACTID ?? '0') || 0;

      // 2. If not found, traverse COMPLEXDATES (exact PHP port)
      if (!contactId && Array.isArray(w.COMPLEXDATES)) {
        outer: for (const complex of w.COMPLEXDATES) {
          if (complex.TRAINERCONTACTID) {
            contactId = parseInt(complex.TRAINERCONTACTID);
            if (contactId) break;
          }
          if (Array.isArray(complex.TRAINERS)) {
            for (const trainer of complex.TRAINERS) {
              if (trainer.TRAINERCONTACTID) {
                contactId = parseInt(trainer.TRAINERCONTACTID);
                if (contactId) break outer;
              }
            }
          }
        }
      }

      // 3. Use name already on the workshop object from the API
      const apiName = (w.TRAINERNAME ?? w.TRAINER_NAME ?? w.TRAINER ?? '').trim();
      if (apiName) {
        w.TRAINER_NAME = apiName;
        w.TRAINERCONTACTID = contactId;
        continue;
      }

      if (!contactId) {
        w.TRAINER_NAME = '';
        continue;
      }

      w.TRAINERCONTACTID = contactId;

      // 4. Use the trainer report map (fast, no extra API call)
      if (trainerNameMap.has(contactId)) {
        w.TRAINER_NAME = trainerNameMap.get(contactId)!;
        continue;
      }

      // 5. Fall back to individual contact API lookup (cached per contactId)
      if (!contactCache.has(contactId)) {
        const detail = await this.axcelerate.getContactDetail(contactId);
        let name = detail?.NAME ?? detail?.CONTACT_NAME ?? '';
        if (!name) {
          const first = detail?.FIRSTNAME ?? detail?.GIVENNAME ?? '';
          const last = detail?.LASTNAME ?? detail?.SURNAME ?? '';
          name = `${first} ${last}`.trim();
        }
        contactCache.set(contactId, name);
      }
      w.TRAINER_NAME = contactCache.get(contactId) ?? '';
    }

    return workshops;
  }

  // Port of PHP enrich_private_workshops_with_venue_names
  private async enrichPrivateWithVenueNames(workshops: any[]): Promise<any[]> {
    const cache = new Map<number, string>();

    for (const w of workshops) {
      if (w.is_public) continue;

      const venueContactId = parseInt(w.VENUECONTACTID ?? '0') || 0;
      if (!venueContactId) {
        w.VENUE_CONTACT_NAME = '';
        continue;
      }

      if (!cache.has(venueContactId)) {
        const detail = await this.axcelerate.getContactDetail(venueContactId);
        let name = detail?.NAME ?? detail?.CONTACT_NAME ?? '';
        if (!name) {
          const first = detail?.FIRSTNAME ?? detail?.GIVENNAME ?? '';
          const last = detail?.LASTNAME ?? detail?.SURNAME ?? '';
          name = `${first} ${last}`.trim();
        }
        cache.set(venueContactId, name);
      }
      w.VENUE_CONTACT_NAME = cache.get(venueContactId) ?? '';
    }

    return workshops;
  }

  private groupByDay(
    workshops: any[],
    courseMap: Map<string, { name: string; shortName: string; cost: number }>,
    todayKey: string,
  ): Record<string, CalendarDay> {
    const publicByDay = new Map<string, Map<string, any>>();
    const privateByDay = new Map<string, Map<string, any>>();

    for (const w of workshops) {
      const dateKey = w.STARTDATE.split(' ')[0];
      const locationKey = (w.LOCATION ?? '').trim();
      const match = courseMap.get(String(w.CODE ?? '').toUpperCase());
      w.SHORTNAME = match?.shortName || match?.name || w.COURSENAME;

      const map = w.is_public ? publicByDay : privateByDay;
      if (!map.has(dateKey)) map.set(dateKey, new Map());
      const locMap = map.get(dateKey)!;

      if (!locMap.has(locationKey)) {
        locMap.set(locationKey, {
          location: locationKey,
          workshops: [],
          counts: { total: 0, open: 0 },
          timeBounds: { start: null as Date | null, end: null as Date | null },
        });
      }

      const group = locMap.get(locationKey)!;
      group.workshops.push(w);
      group.counts.total++;
      if (!w.is_past) group.counts.open++;

      const startDt = new Date(w.STARTDATE.replace(' ', 'T'));
      const endDt = new Date(w.FINISHDATE.replace(' ', 'T'));
      if (!group.timeBounds.start || startDt < group.timeBounds.start) group.timeBounds.start = startDt;
      if (!group.timeBounds.end || endDt > group.timeBounds.end) group.timeBounds.end = endDt;
    }

    const allDays = new Set([...publicByDay.keys(), ...privateByDay.keys()]);
    const result: Record<string, CalendarDay> = {};

    for (const dateKey of allDays) {
      const grouped: WorkshopGroup[] = [];
      const groupedPrivate: WorkshopGroup[] = [];

      if (publicByDay.has(dateKey)) {
        for (const group of publicByDay.get(dateKey)!.values()) {
          grouped.push(this.buildGroup(group, false, dateKey, todayKey));
        }
        grouped.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }

      if (privateByDay.has(dateKey)) {
        for (const group of privateByDay.get(dateKey)!.values()) {
          groupedPrivate.push(this.buildGroup(group, true, dateKey, todayKey));
        }
        groupedPrivate.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }

      result[dateKey] = { grouped, groupedPrivate };
    }

    return result;
  }

  private buildGroup(group: any, isPrivate: boolean, dayKey: string, todayKey: string): WorkshopGroup {
    const state = resolveWorkshopGroupState(
      group.workshops.map((w: any) => ({
        isPast: !!w.is_past,
        participants: w.PARTICIPANTS ?? 0,
        progressComplete: !!w.progress_complete,
      })),
      dayKey,
      todayKey,
    );

    const trainerIds = [...new Set(group.workshops.map((w: any) => String(w.TRAINERCONTACTID ?? '')).filter(Boolean))];
    const trainerNames = [...new Set(group.workshops.map((w: any) => (w.TRAINER_NAME ?? '').trim()).filter(Boolean))];

    const fmt = (d: Date | null) =>
      d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '';

    const workshops: WorkshopDetail[] = group.workshops
      .sort((a: any, b: any) => a.STARTDATE.localeCompare(b.STARTDATE))
      .map((w: any) => ({
        instanceId: String(w.INSTANCEID),
        courseCode: w.CODE,
        shortName: w.SHORTNAME ?? w.COURSENAME,
        startTime: w.STARTDATE.split(' ')[1]?.slice(0, 5) ?? '',
        endTime: w.FINISHDATE.split(' ')[1]?.slice(0, 5) ?? '',
        participants: w.PARTICIPANTS,
        trainerId: String(w.TRAINERCONTACTID ?? ''),
        trainerName: w.TRAINER_NAME ?? '',
        venueContactName: w.VENUE_CONTACT_NAME ?? '',
        isPast: w.is_past,
        isPublic: w.is_public,
        progressComplete: w.progress_complete ?? false,
        status: String(w.STATUS ?? w.status ?? 'Active').trim(),
      }));

    return {
      location: group.location,
      isPrivate,
      state,
      totalCount: group.counts.total,
      openCount: group.counts.open,
      startTime: fmt(group.timeBounds.start),
      endTime: fmt(group.timeBounds.end),
      trainerIds: trainerIds as string[],
      trainerNames: trainerNames as string[],
      workshops,
    };
  }

  // Port of PHP annotate_workshops_with_progress — uses our own WorkshopProgress table
  private async annotateWithProgress(workshops: any[]): Promise<void> {
    const instanceIds = [
      ...new Set(
        workshops
          .filter((w) => w.is_past)
          .map((w) => parseInt(w.INSTANCEID ?? '0'))
          .filter(Boolean),
      ),
    ];
    if (instanceIds.length === 0) {
      workshops.forEach((w) => (w.progress_complete = false));
      return;
    }

    const progressRows = await this.prisma.workshopProgress.findMany({
      where: { instanceId: { in: instanceIds } },
      select: { instanceId: true, isComplete: true },
    });
    const progressMap = new Map(progressRows.map((r) => [r.instanceId, r.isComplete]));

    for (const w of workshops) {
      const instanceId = parseInt(w.INSTANCEID ?? '0');
      w.progress_complete = progressMap.get(instanceId) ?? false;
    }
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
