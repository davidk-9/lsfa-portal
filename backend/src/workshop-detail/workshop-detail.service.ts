import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AxcelerateService } from '../axcelerate/axcelerate.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export function normalizeAttendanceValue(value: any): -1 | 0 | 1 {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'yes' || value === 'y') {
    return 1;
  }
  if (value === false || value === 0 || value === '0' || value === 'false' || value === 'no' || value === 'n') {
    return 0;
  }
  return -1;
}

export function deriveOlkaStatus(commencementDate: string | null, completionDate: string | null) {
  if (completionDate) {
    return { status: 'C' as const, tooltip: `Completed: ${completionDate}` };
  }
  if (commencementDate) {
    return { status: 'S' as const, tooltip: `Started: ${commencementDate}` };
  }
  return { status: 'NS' as const, tooltip: 'Not Started' };
}

export function isPluginChecklistPayload(data: any): boolean {
  if (!data || typeof data !== 'object') return false;
  const studentChecklist = data?.student_checklist;
  if (!studentChecklist || typeof studentChecklist !== 'object') return false;

  for (const task of Object.values(studentChecklist as Record<string, any>)) {
    const taskObj = task as Record<string, any>;
    if (!taskObj || typeof taskObj !== 'object') return false;
    if (typeof taskObj.task_name !== 'string' || taskObj.task_name.trim().length === 0) return false;

    const elements = taskObj?.elements;
    if (!elements || typeof elements !== 'object') return false;

    for (const element of Object.values(elements as Record<string, any>)) {
      const elementObj = element as Record<string, any>;
      if (!elementObj || typeof elementObj !== 'object') return false;
      if (typeof elementObj.title !== 'string' || elementObj.title.trim().length === 0) return false;

      const subElements = elementObj?.sub_elements;
      if (!subElements || typeof subElements !== 'object') return false;
      for (const subElement of Object.values(subElements as Record<string, any>)) {
        const subElementObj = subElement as Record<string, any>;
        if (!subElementObj || typeof subElementObj !== 'object') return false;
        if (typeof subElementObj.text !== 'string') return false;
        if (!('status' in subElementObj)) return false;
      }
    }
  }

  return true;
}

function normalizeChecklistPayloadToPluginShape(data: any, courseCode: string): any {
  const nextData = JSON.parse(JSON.stringify(data ?? { course_code: courseCode, student_checklist: {} }));
  const studentChecklist = nextData?.student_checklist;
  if (!studentChecklist || typeof studentChecklist !== 'object') {
    nextData.course_code = courseCode;
    nextData.student_checklist = {};
    return nextData;
  }

  for (const [ptId, task] of Object.entries(studentChecklist as Record<string, any>)) {
    const taskObj = task as Record<string, any>;
    if (!taskObj || typeof taskObj !== 'object') continue;

    const taskName = typeof taskObj.task_name === 'string' && taskObj.task_name.trim()
      ? taskObj.task_name
      : (typeof taskObj.name === 'string' && taskObj.name.trim() ? taskObj.name : ptId);
    taskObj.task_name = taskName;
    delete taskObj.name;

    const elements = taskObj.elements ?? taskObj.results ?? {};
    const normalizedElements: Record<string, any> = {};

    for (const [elementId, element] of Object.entries(elements as Record<string, any>)) {
      const elementObj = element as Record<string, any>;
      if (!elementObj || typeof elementObj !== 'object') continue;

      const title = typeof elementObj.title === 'string' && elementObj.title.trim()
        ? elementObj.title
        : (typeof elementObj.name === 'string' && elementObj.name.trim() ? elementObj.name : elementId);
      const subElements = elementObj.sub_elements ?? elementObj.subElements ?? {};
      const normalizedSubElements: Record<string, any> = {};

      for (const [subElementId, subElement] of Object.entries(subElements as Record<string, any>)) {
        const subElementObj = subElement as Record<string, any>;
        if (!subElementObj || typeof subElementObj !== 'object') {
          normalizedSubElements[subElementId] = { text: String(subElement ?? subElementId), status: null };
          continue;
        }

        const subText = typeof subElementObj.text === 'string' && subElementObj.text.trim()
          ? subElementObj.text
          : (typeof subElementObj.name === 'string' && subElementObj.name.trim() ? subElementObj.name : String(subElementId));
        normalizedSubElements[subElementId] = {
          text: subText,
          status: 'status' in subElementObj ? subElementObj.status : null,
        };
      }

      normalizedElements[elementId] = {
        title,
        overall_status: elementObj.overall_status ?? null,
        sub_elements: normalizedSubElements,
      };
    }

    taskObj.elements = normalizedElements;
    delete taskObj.results;
    delete taskObj.name;
  }

  nextData.course_code = courseCode;
  return nextData;
}

export function buildChecklistTemplateFromMasterPayload(master: any, courseCode: string): any {
  const courseTasks = [] as string[];
  const rawCourseMap = master?.course_map && typeof master.course_map === 'object' ? master.course_map : {};
  const normalizedCourseCode = (courseCode ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  const candidates = [courseCode, normalizedCourseCode];

  for (const candidate of candidates) {
    const direct = rawCourseMap[candidate];
    if (Array.isArray(direct)) {
      courseTasks.push(...direct);
      break;
    }
  }

  if (!courseTasks.length) {
    for (const [key, value] of Object.entries(rawCourseMap as Record<string, any>)) {
      if (Array.isArray(value) && (key ?? '').trim().toUpperCase().replace(/\s+/g, ' ') === normalizedCourseCode) {
        courseTasks.push(...value);
        break;
      }
    }
  }

  const allTasks = master?.tasks ?? {};
  const studentChecklist: Record<string, any> = {};

  for (const ptId of courseTasks) {
    const task = allTasks[ptId];
    if (!task) continue;

    const elements: Record<string, any> = {};
    for (const [eid, el] of Object.entries<any>(task.elements ?? {})) {
      const subElements: Record<string, any> = {};
      for (const [seid, se] of Object.entries<any>((el as any)?.sub_elements ?? {})) {
        const subText = typeof se === 'string' ? se : (se?.text ?? se?.name ?? seid);
        subElements[seid] = { text: subText, status: null };
      }

      const elementName = (el as any)?.title ?? (el as any)?.name ?? eid;
      elements[eid] = {
        title: elementName,
        overall_status: null,
        sub_elements: subElements,
      };
    }

    studentChecklist[ptId] = {
      task_name: task.name ?? ptId,
      elements,
      trainer_comment: '',
    };
  }

  return {
    course_code: courseCode,
    required_tasks: courseTasks,
    student_checklist: studentChecklist,
    course_meta: {
      master_fingerprint: '',
      created_at: new Date().toISOString(),
    },
    last_modified_by: null,
  };
}

export function deriveChecklistStatus(data: any): { label: string; tone: 'pending' | 'competent' | 'not-competent' } {
  const studentChecklist = data?.student_checklist;
  if (!studentChecklist || typeof studentChecklist !== 'object') {
    return { label: '?', tone: 'pending' };
  }

  const values = Object.values(studentChecklist as Record<string, any>);
  let hasAnyStatus = false;
  let hasNotCompetent = false;

  for (const task of values) {
    const elements = task?.elements ?? {};
    for (const element of Object.values(elements as Record<string, any>)) {
      const status = element?.overall_status ?? null;
      if (status === 'N') {
        hasNotCompetent = true;
        hasAnyStatus = true;
      } else if (typeof status === 'string' && status.startsWith('S')) {
        hasAnyStatus = true;
      }

      const subElements = element?.sub_elements ?? {};
      for (const subElement of Object.values(subElements as Record<string, any>)) {
        const subStatus = subElement?.status ?? null;
        if (subStatus === 'N') {
          hasNotCompetent = true;
          hasAnyStatus = true;
        } else if (typeof subStatus === 'string' && subStatus.startsWith('S')) {
          hasAnyStatus = true;
        }
      }
    }
  }

  if (!hasAnyStatus) return { label: '?', tone: 'pending' };
  return hasNotCompetent ? { label: 'N', tone: 'not-competent' } : { label: 'C', tone: 'competent' };
}

// ── Marking wizard status logic (port of PHP) ────────────────────────────────
// Status values: null (pending), 'S' | 'S2' | 'S3' (satisfactory 1st/2nd/3rd attempt), 'N' (not satisfactory).

function isSatisfactoryStatus(status: any): boolean {
  return typeof status === 'string' && status.startsWith('S');
}

function attemptRank(status: any): number {
  if (typeof status !== 'string') return 0;
  if (status.startsWith('S3')) return 3;
  if (status.startsWith('S2')) return 2;
  if (status.startsWith('S')) return 1;
  return 0;
}

function rankToLabel(rank: number): string | null {
  return rank === 3 ? 'S3' : rank === 2 ? 'S2' : rank === 1 ? 'S' : null;
}

// Compute the course-wide result: 'N' if any task has an N, 'C' if all tasks are
// fully satisfactory, otherwise null (pending). Port of PHP compute_course_overall.
export function computeCourseOverall(data: any): 'N' | 'C' | null {
  const studentChecklist = data?.student_checklist;
  if (!studentChecklist || typeof studentChecklist !== 'object' || Object.keys(studentChecklist).length === 0) {
    return null;
  }

  let anyTaskN = false;
  let allTasksS = true;

  for (const pt of Object.values<any>(studentChecklist)) {
    const elements = pt?.results ?? pt?.elements ?? {};
    if (!elements || typeof elements !== 'object' || Object.keys(elements).length === 0) {
      allTasksS = false;
      continue;
    }

    let taskHasN = false;
    let taskAllS = true;

    for (const element of Object.values<any>(elements)) {
      const subElements = element?.sub_elements ?? {};
      if (subElements && typeof subElements === 'object' && Object.keys(subElements).length > 0) {
        let elementAllSubS = true;
        for (const sub of Object.values<any>(subElements)) {
          const status = sub?.status ?? null;
          if (status === 'N') {
            taskHasN = true;
            elementAllSubS = false;
            break;
          }
          if (!isSatisfactoryStatus(status)) elementAllSubS = false;
        }
        if (!elementAllSubS) taskAllS = false;
      } else {
        const eStatus = element?.overall_status ?? null;
        if (eStatus === 'N') taskHasN = true;
        if (!isSatisfactoryStatus(eStatus)) taskAllS = false;
      }
      if (taskHasN) break;
    }

    if (taskHasN) {
      anyTaskN = true;
      allTasksS = false;
    } else if (!taskAllS) {
      allTasksS = false;
    }
  }

  if (anyTaskN) return 'N';
  if (allTasksS) return 'C';
  return null;
}

// Enforce result-determination rules in-place: derive element overall from
// sub-elements, derive task overall from elements, fill satisfactory sub-elements,
// and set data.top_level. Port of PHP enforce_result_determination.
export function enforceResultDetermination(data: any): void {
  const studentChecklist = data?.student_checklist;
  if (!studentChecklist || typeof studentChecklist !== 'object' || Object.keys(studentChecklist).length === 0) {
    return;
  }

  // Pass 1: derive each element's overall from its sub-elements.
  for (const pt of Object.values<any>(studentChecklist)) {
    const elements = pt?.results ?? pt?.elements;
    if (!elements || typeof elements !== 'object') continue;
    for (const el of Object.values<any>(elements)) {
      const subElements = el?.sub_elements ?? {};
      if (subElements && typeof subElements === 'object' && Object.keys(subElements).length > 0) {
        let anyN = false;
        let highest = 0;
        for (const sub of Object.values<any>(subElements)) {
          const s = sub?.status ?? null;
          if (s === 'N') { anyN = true; break; }
          const r = attemptRank(s);
          if (r > highest) highest = r;
        }
        if (anyN) el.overall_status = 'N';
        else if (highest > 0) el.overall_status = rankToLabel(highest);
      }
    }
  }

  // Pass 2: derive task overall from elements and fill unset sub-elements when all satisfactory.
  for (const pt of Object.values<any>(studentChecklist)) {
    const elements = pt?.results ?? pt?.elements;
    if (!elements || typeof elements !== 'object') continue;

    let anyElementN = false;
    let allElementsS = true;
    let highestElementRank = 0;
    for (const el of Object.values<any>(elements)) {
      const estatus = el?.overall_status ?? null;
      if (estatus === 'N') { anyElementN = true; allElementsS = false; break; }
      const r = attemptRank(estatus);
      if (r > 0) { if (r > highestElementRank) highestElementRank = r; }
      else allElementsS = false;
    }

    if (allElementsS) {
      for (const el of Object.values<any>(elements)) {
        const elAttempt = el?.overall_status ?? null;
        const subElements = el?.sub_elements;
        if (subElements && typeof subElements === 'object') {
          for (const sub of Object.values<any>(subElements)) {
            if (sub.status == null) sub.status = elAttempt ?? rankToLabel(highestElementRank);
          }
        }
      }
    }

    if (anyElementN) pt.overall_status = 'N';
    else if (allElementsS) pt.overall_status = rankToLabel(highestElementRank) ?? 'S';
    else pt.overall_status = null;
  }

  const top = computeCourseOverall(data);
  if (top !== null) data.top_level = top;
  else if ('top_level' in data) delete data.top_level;
}

// Guards against concurrent wizard saves clobbering the same workshop's checklists.
const wizardSaveLocks = new Set<number>();

@Injectable()
export class WorkshopDetailService {
  private readonly logger = new Logger(WorkshopDetailService.name);

  constructor(
    private axcelerate: AxcelerateService,
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  // ── Workshop header ──────────────────────────────────────────────────────────

  async getWorkshopDetail(instanceId: number, enrolOpen: string, isPublic: string) {
    const [detail, searchData] = await Promise.all([
      this.axcelerate.getInstanceDetail(instanceId).catch(() => null),
      this.axcelerate.getInstanceSearchData(instanceId, enrolOpen, isPublic).catch(() => null),
    ]);

    const progress = await this.prisma.workshopProgress.findUnique({
      where: { instanceId },
    });

    const trainerName = await this.resolveWorkshopTrainerName(detail, searchData);

    return {
      detail,
      searchData,
      progress: progress ?? null,
      trainerName,
    };
  }

  // Resolve the workshop's trainer name from the Axcelerate instance data:
  // direct name fields first, then a contact id (top-level or nested in COMPLEXDATES)
  // looked up via the contact endpoint.
  private async resolveWorkshopTrainerName(detail: any, searchData: any): Promise<string> {
    const pickName = (o: any) => String(o?.TRAINERNAME ?? o?.TRAINER_NAME ?? o?.TRAINER ?? '').trim();

    let name = pickName(searchData) || pickName(detail);
    if (name) return name;

    let contactId = parseInt(searchData?.TRAINERCONTACTID ?? detail?.TRAINERCONTACTID ?? '0') || 0;

    if (!contactId) {
      const complexes = Array.isArray(searchData?.COMPLEXDATES)
        ? searchData.COMPLEXDATES
        : Array.isArray(detail?.COMPLEXDATES)
          ? detail.COMPLEXDATES
          : [];
      for (const complex of complexes) {
        if (complex?.TRAINERCONTACTID) {
          contactId = parseInt(complex.TRAINERCONTACTID) || 0;
        }
        if (Array.isArray(complex?.TRAINERS)) {
          for (const trainer of complex.TRAINERS) {
            const tName = String(trainer?.TRAINERNAME ?? trainer?.NAME ?? '').trim();
            if (tName) name = tName;
            if (!contactId && trainer?.TRAINERCONTACTID) contactId = parseInt(trainer.TRAINERCONTACTID) || 0;
          }
        }
        if (name || contactId) break;
      }
      if (name) return name;
    }

    if (contactId) {
      const contact = await this.axcelerate.getContactDetail(contactId).catch(() => null);
      if (contact) {
        const full =
          contact.NAME ??
          contact.CONTACT_NAME ??
          `${contact.FIRSTNAME ?? contact.GIVENNAME ?? ''} ${contact.LASTNAME ?? contact.SURNAME ?? ''}`.trim();
        if (full && String(full).trim()) return String(full).trim();
      }
    }

    return '';
  }

  // ── Student list + attendance ─────────────────────────────────────────────────
  // Port of PHP ajax_load_student_list

  async getStudentList(instanceId: number, startDate: string | null, courseCode: string) {
    const attendanceData = await this.axcelerate.getInstanceAttendance(instanceId);

    const sessionData = attendanceData[0] ?? {};
    const enrollees: any[] = sessionData.ENROLLEES ?? [];
    const complexId: number = sessionData.COMPLEXID ?? 0;

    // Sort by PREFERREDNAME then GIVENNAME (port of PHP usort)
    enrollees.sort((a, b) => {
      const aName = (a.PREFERREDNAME?.trim() || a.GIVENNAME?.trim() || '').toLowerCase();
      const bName = (b.PREFERREDNAME?.trim() || b.GIVENNAME?.trim() || '').toLowerCase();
      return aName.localeCompare(bName);
    });

    // Ensure checklist rows exist for all enrolled students
    if (courseCode && enrollees.length > 0) {
      await this.ensureChecklistsExist(instanceId, enrollees, courseCode);
    }

    // Determine attendance window (30 min before start — port of PHP get_attendance_window_info)
    const isAttendanceOpen = this.isAttendanceWindowOpen(startDate, 30);

    // Get upload status for all students in this instance. Include everything that
    // isn't deleted — checklist PDFs are stored as 'synced'/'sync_failed', not 'active'.
    const uploads = await this.prisma.workshopUpload.findMany({
      where: { instanceId, status: { not: 'deleted' } },
      select: {
        contactId: true,
        portfolioTypeId: true,
        id: true,
        blobUrl: true,
        kind: true,
        status: true,
        mimeType: true,
        filename: true,
      },
    });

    const uploadMap = new Map<string, any[]>();
    for (const u of uploads) {
      const key = String(u.contactId ?? '');
      if (!uploadMap.has(key)) uploadMap.set(key, []);
      uploadMap.get(key)!.push(u);
    }

    const workshopUpload = await this.prisma.workshopUpload.findFirst({
      where: { instanceId, contactId: null, status: { not: 'deleted' } },
    });

    const students = enrollees.map((e) => {
      const cid = String(e.CONTACTID ?? '');
      const studentUploads = uploadMap.get(cid) ?? [];
      const attended = normalizeAttendanceValue(
        e.ATTENDEDFLAG ?? e.ATTENDED ?? e.ATTENDEDSTATUS ?? e.ATTENDEDSTATUSFLAG ?? e.ATTENDANCESTATUS ?? e.ATTENDANCE ?? null,
      );
      return {
        contactId: e.CONTACTID,
        givenName: e.GIVENNAME,
        surname: e.SURNAME,
        preferredName: e.PREFERREDNAME,
        attended,
        attendanceComment: (e.COMMENT ?? e.comment ?? e.ATTENDANCECOMMENT ?? '').toString(),
        complexId,
        uploads: studentUploads,
      };
    });

    // Step instructions from settings
    const [step1, step2, step3Enabled, step3Disabled, ifCodes, evidenceBtnEnabled] = await Promise.all([
      this.settings.get('trainer_step1_instruction'),
      this.settings.get('trainer_step2_instruction'),
      this.settings.get('trainer_step3_instruction_enabled'),
      this.settings.get('trainer_step3_instruction_disabled'),
      this.settings.get('trainer_if_course_codes'),
      this.settings.get('trainer_enable_evidence_button'),
    ]);

    const ifCourseCodeList = (ifCodes ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const showIfButton = ifCourseCodeList.length === 0 || ifCourseCodeList.includes(courseCode.toUpperCase());
    const evidenceEnabled = (evidenceBtnEnabled ?? '1') !== '0';

    return {
      students,
      complexId,
      instanceId,
      isAttendanceOpen,
      workshopEvidence: workshopUpload ?? null,
      stepInstructions: {
        step1: step1 ?? 'Check each student has completed their online knowledge assessment (OLKA), then mark attendance.',
        step2: step2 ?? 'Mark all tasks satisfactory, then manually mark students who got something wrong. Once all checklists are complete, upload all checklists.',
        step3: evidenceEnabled ? (step3Enabled ?? 'Upload workshop evidence file, or SD and IF files per student.') : (step3Disabled ?? 'Workshop evidence upload is currently disabled.'),
      },
      showIfButton,
      evidenceEnabled,
    };
  }

  // ── Attendance ────────────────────────────────────────────────────────────────

  async markAttendance(
    instanceId: number,
    contactId: number,
    complexId: number,
    attended: 0 | 1,
    comment?: string,
  ) {
    return this.axcelerate.markAttendance(instanceId, contactId, complexId, attended, comment);
  }

  // ── Checklists ────────────────────────────────────────────────────────────────

  async getStudentChecklist(instanceId: number, contactId: number, courseCode: string) {
    const row = await this.prisma.studentChecklist.findUnique({
      where: { instanceId_contactId: { instanceId, contactId } },
    });

    if (row) {
      try {
        const parsed = JSON.parse(row.data);
        const normalized = normalizeChecklistPayloadToPluginShape(parsed, courseCode);
        const studentChecklist = normalized?.student_checklist;
        if (studentChecklist && typeof studentChecklist === 'object' && Object.keys(studentChecklist).length > 0) {
          if (isPluginChecklistPayload(normalized)) {
            return normalized;
          }
        }
      } catch {
        // fall through to rebuild if the stored payload is invalid
      }

      const template = await this.buildChecklistFromMaster(instanceId, courseCode);
      await this.prisma.studentChecklist.update({
        where: { id: row.id },
        data: { courseCode: courseCode || row.courseCode, data: JSON.stringify(template) },
      });
      return template;
    }

    // Create from master checklist (port of PHP get_or_create_student_checklist)
    const template = await this.buildChecklistFromMaster(instanceId, courseCode);
    await this.prisma.studentChecklist.create({
      data: { instanceId, contactId, courseCode, data: JSON.stringify(template) },
    });
    return template;
  }

  async saveStudentChecklist(instanceId: number, contactId: number, courseCode: string, data: any) {
    const normalized = normalizeChecklistPayloadToPluginShape(data, courseCode);
    const json = JSON.stringify(normalized);
    await this.prisma.studentChecklist.upsert({
      where: { instanceId_contactId: { instanceId, contactId } },
      update: { data: json },
      create: { instanceId, contactId, courseCode, data: json },
    });
    return { success: true };
  }

  async resetAllChecklists(instanceId: number, courseCode: string) {
    const [rows, uploads] = await Promise.all([
      this.prisma.studentChecklist.findMany({ where: { instanceId } }),
      this.prisma.workshopUpload.findMany({
        where: { instanceId, status: { not: 'deleted' } },
        select: { contactId: true, kind: true, portfolioTypeId: true },
      }),
    ]);

    const lockedContactIds = new Set<number>();
    for (const upload of uploads) {
      if (upload.contactId == null) continue;
      const isChecklistUpload = upload.kind === 'checklist' || upload.portfolioTypeId === null;
      if (isChecklistUpload) lockedContactIds.add(upload.contactId);
    }

    const template = await this.buildChecklistFromMaster(instanceId, courseCode, { useSnapshot: false });
    const blank = JSON.stringify(template);
    const updatedContacts: number[] = [];

    for (const row of rows) {
      if (lockedContactIds.has(row.contactId)) continue;
      await this.prisma.studentChecklist.update({
        where: { id: row.id },
        data: { data: blank },
      });
      updatedContacts.push(row.contactId);
    }

    return { success: true, reset: updatedContacts.length, updatedContacts };
  }

  async bulkMarkAllTasksSatisfactory(instanceId: number, courseCode: string) {
    const attendanceData = await this.axcelerate.getInstanceAttendance(instanceId);
    const attendedContactIds = new Set<number>();
    for (const session of attendanceData ?? []) {
      const enrollees = Array.isArray(session?.ENROLLEES) ? session.ENROLLEES : [];
      for (const enrollee of enrollees) {
        const contactId = parseInt(enrollee?.CONTACTID ?? enrollee?.contactID ?? '0');
        if (!contactId) continue;
        const attended = normalizeAttendanceValue(enrollee?.ATTENDEDFLAG ?? enrollee?.ATTENDED ?? enrollee?.ATTENDEDSTATUS ?? enrollee?.ATTENDANCESTATUS ?? null);
        if (attended === 1) attendedContactIds.add(contactId);
      }
    }

    const [existingRows, uploads] = await Promise.all([
      this.prisma.studentChecklist.findMany({ where: { instanceId } }),
      this.prisma.workshopUpload.findMany({
        where: { instanceId, status: { not: 'deleted' } },
        select: { contactId: true, kind: true, portfolioTypeId: true },
      }),
    ]);

    const lockedContactIds = new Set<number>();
    for (const upload of uploads) {
      if (upload.contactId == null) continue;
      const isChecklistUpload = upload.kind === 'checklist' || upload.portfolioTypeId === null;
      if (isChecklistUpload) lockedContactIds.add(upload.contactId);
    }

    const template = await this.buildChecklistFromMaster(instanceId, courseCode, { useSnapshot: false });
    const successPools = await this.loadSuccessCommentPools();
    const updatedContacts: number[] = [];
    const existingContactIds = new Set(existingRows.map((row) => row.contactId));

    for (const contactId of attendedContactIds) {
      if (lockedContactIds.has(contactId)) continue;

      const existingRow = existingRows.find((row) => row.contactId === contactId);
      const data = existingRow?.data ? JSON.parse(existingRow.data) : template;
      const nextData = this.markChecklistTasksSatisfactory(data, courseCode, successPools);

      if (existingRow) {
        await this.prisma.studentChecklist.update({
          where: { id: existingRow.id },
          data: { data: JSON.stringify(nextData) },
        });
      } else {
        await this.prisma.studentChecklist.create({
          data: { instanceId, contactId, courseCode, data: JSON.stringify(nextData) },
        });
      }

      updatedContacts.push(contactId);
      existingContactIds.add(contactId);
    }

    return { success: true, updatedContacts };
  }

  // ── Workshop progress ─────────────────────────────────────────────────────────

  async saveWorkshopProgress(instanceId: number, trainerContactId: string, status: any) {
    const s = status ?? {};
    const payload = {
      completedSteps: parseInt(s.completed_steps ?? '0'),
      totalSteps: parseInt(s.total_steps ?? '3'),
      isComplete: !!s.overallComplete,
      statusPayload: JSON.stringify(s),
      trainerContactId,
    };

    await this.prisma.workshopProgress.upsert({
      where: { instanceId },
      update: payload,
      create: { instanceId, ...payload },
    });
    return { success: true };
  }

  async getWorkshopProgressRecord(instanceId: number) {
    const wp = await this.prisma.workshopProgress.findUnique({
      where: { instanceId },
      include: { learningPlan: { include: { courseCode: true } } },
    });

    let courseCodeStr = '';
    try {
      courseCodeStr = await this.resolveCourseCode(instanceId);
    } catch (err) {
      // ignore
    }

    let availablePlans: any[] = [];
    if (courseCodeStr) {
      availablePlans = await this.prisma.learningPlan.findMany({
        where: {
          courseCode: {
            code: { contains: courseCodeStr, mode: 'insensitive' },
          },
        },
        include: { courseCode: true },
        orderBy: { id: 'desc' },
      });
    }

    const allPlans = await this.prisma.learningPlan.findMany({
      include: { courseCode: true },
      orderBy: { id: 'desc' },
    });

    const baseWp = wp ?? {
      id: null,
      instanceId,
      trainerContactId: '',
      completedSteps: 0,
      totalSteps: 3,
      isComplete: false,
      statusPayload: null,
      lmsEnabled: false,
      learningPlanId: null,
      createdAt: null,
      updatedAt: null,
      learningPlan: null,
    };

    return {
      ...baseWp,
      resolvedCourseCode: courseCodeStr,
      availablePlans: availablePlans.length > 0 ? availablePlans : allPlans,
      allPlans,
    };
  }

  async toggleLmsEnabled(instanceId: number, lmsEnabled: boolean, learningPlanId?: number | null) {
    const planId = learningPlanId ? Number(learningPlanId) : null;
    return this.prisma.workshopProgress.upsert({
      where: { instanceId },
      update: {
        lmsEnabled: Boolean(lmsEnabled),
        learningPlanId: planId,
      },
      create: {
        instanceId,
        lmsEnabled: Boolean(lmsEnabled),
        learningPlanId: planId,
      },
      include: {
        learningPlan: { include: { courseCode: true } },
      },
    });
  }

  // ── OLKA ──────────────────────────────────────────────────────────────────────
  // Port of PHP ajax_fetch_olka_statuses

  async getOlkaStatuses(instanceId: number, courseCode: string): Promise<Record<string, { status: string; tooltip: string }>> {
    try {
      const resolvedInstanceId = await this.resolveOlkaInstanceId(instanceId);
      const effectiveCourseCode = courseCode || (await this.resolveCourseCode(instanceId));
      const raw = await this.axcelerate.getOlkaEnrolments(resolvedInstanceId);
      return this.parseOlkaStatuses(raw, effectiveCourseCode);
    } catch (err: any) {
      this.logger.warn(`OLKA fetch failed for instance ${instanceId}: ${err?.message}`);
      return {};
    }
  }

  // Port of PHP ajax_get_success_comment
  async getSuccessComment(ptId: string): Promise<{ comment: string }> {
    const raw = await this.settings.get('success_comments');
    if (!raw) return { comment: '' };

    let pools: Record<string, string[]> = {};
    try { pools = JSON.parse(raw); } catch { return { comment: '' }; }

    const pool: string[] = pools[ptId] ?? pools['_default'] ?? [];
    if (!pool.length) return { comment: '' };

    const comment = pool[Math.floor(Math.random() * pool.length)];
    return { comment };
  }

  // ── Marking wizard ──────────────────────────────────────────────────────────

  // Return the course task structure (task -> elements) used to build the wizard UI,
  // derived from the same frozen snapshot the student checklists use so element IDs match.
  async getTaskStructure(instanceId: number, courseCode?: string) {
    const resolvedCourse = courseCode || (await this.resolveCourseCode(instanceId));
    const template = await this.buildChecklistFromMaster(instanceId, resolvedCourse);
    const source = template?.student_checklist ?? {};

    const tasks: Record<string, { name: string; elements: Record<string, { title: string }> }> = {};
    for (const [ptId, pt] of Object.entries<any>(source)) {
      const elements: Record<string, { title: string }> = {};
      for (const [eid, el] of Object.entries<any>(pt?.elements ?? {})) {
        elements[eid] = { title: el?.title ?? eid };
      }
      tasks[ptId] = { name: pt?.task_name ?? ptId, elements };
    }

    return { courseCode: resolvedCourse, tasks };
  }

  // Apply wizard results (task + element S/S2/S3/N + trainer comment) to the selected
  // students' checklists. Port of PHP ajax_wizard_save_results.
  async saveWizardResults(
    instanceId: number,
    contactIds: number[],
    ptId: string,
    taskResult: string,
    elementsResults: Record<string, string>,
    trainerComment: string,
    courseCode?: string,
  ): Promise<{ success: boolean; updatedContacts: number[]; updatedTopLevels: Record<string, 'C' | 'N' | null> }> {
    if (!instanceId || !ptId || !Array.isArray(contactIds) || contactIds.length === 0) {
      throw new ConflictException('Missing required wizard parameters.');
    }

    if (wizardSaveLocks.has(instanceId)) {
      throw new ConflictException('A bulk save is already in progress for this workshop. Please wait and retry.');
    }
    wizardSaveLocks.add(instanceId);

    try {
      const resolvedCourse = courseCode || (await this.resolveCourseCode(instanceId));

      // Students with an uploaded checklist are locked and must be skipped.
      const uploads = await this.prisma.workshopUpload.findMany({
        where: { instanceId, status: { not: 'deleted' } },
        select: { contactId: true, kind: true, portfolioTypeId: true },
      });
      const locked = new Set<number>();
      for (const u of uploads) {
        if (u.contactId == null) continue;
        if (u.kind === 'checklist' || u.portfolioTypeId === null) locked.add(u.contactId);
      }

      const template = await this.buildChecklistFromMaster(instanceId, resolvedCourse);
      const updatedContacts: number[] = [];
      const updatedTopLevels: Record<string, 'C' | 'N' | null> = {};

      for (const cid of contactIds) {
        if (!cid || locked.has(cid)) continue;

        // Load (creating if needed) the student's current checklist.
        const data = await this.getStudentChecklist(instanceId, cid, resolvedCourse);
        if (!data.student_checklist || typeof data.student_checklist !== 'object') continue;

        // Seed the task entry from the frozen template if the student doesn't have it yet.
        if (!data.student_checklist[ptId]) {
          const templatePt = template?.student_checklist?.[ptId];
          if (!templatePt) continue; // task not part of this course
          data.student_checklist[ptId] = JSON.parse(JSON.stringify(templatePt));
        }

        const pt = data.student_checklist[ptId];

        if (taskResult) pt.overall_status = taskResult;

        if (elementsResults && typeof elementsResults === 'object') {
          for (const [eid, res] of Object.entries(elementsResults)) {
            const el = pt.elements?.[eid];
            if (!el) continue;
            el.overall_status = res;
            if (el.sub_elements && typeof el.sub_elements === 'object') {
              for (const sub of Object.values<any>(el.sub_elements)) sub.status = res;
            }
          }
        }

        pt.trainer_comment = trainerComment ?? '';

        enforceResultDetermination(data);

        // Final guard against a checklist uploaded mid-operation.
        if (locked.has(cid)) continue;
        await this.saveStudentChecklist(instanceId, cid, resolvedCourse, data);

        updatedContacts.push(cid);
        updatedTopLevels[String(cid)] = computeCourseOverall(data);
      }

      return { success: true, updatedContacts, updatedTopLevels };
    } finally {
      wizardSaveLocks.delete(instanceId);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private markChecklistTasksSatisfactory(data: any, courseCode: string, successPools: Record<string, string[]> = {}) {
    const nextData = normalizeChecklistPayloadToPluginShape(data, courseCode);
    const studentChecklist = nextData?.student_checklist;
    if (!studentChecklist || typeof studentChecklist !== 'object') {
      nextData.student_checklist = {};
      return nextData;
    }

    for (const [ptId, task] of Object.entries(studentChecklist as Record<string, any>)) {
      const taskObj = task as Record<string, any>;
      const container = taskObj?.elements ?? taskObj?.results ?? {};
      for (const [elementId, element] of Object.entries(container as Record<string, any>)) {
        const elementObj = element as Record<string, any>;
        elementObj.overall_status = 'S';
        const subElements = elementObj.sub_elements ?? elementObj.subElements ?? {};
        for (const [subElementId, subElement] of Object.entries(subElements as Record<string, any>)) {
          const subElementObj = subElement as Record<string, any>;
          subElementObj.status = 'S';
          if (!('text' in subElementObj) && 'name' in subElementObj) {
            subElementObj.text = subElementObj.name;
            delete subElementObj.name;
          }
          if (!('text' in subElementObj) && typeof subElementObj === 'object') {
            subElementObj.text = subElementId;
          }
        }
      }

      const allS = Object.values(container as Record<string, any>).every((element: any) => {
        const elementStatus = element?.overall_status;
        if (elementStatus !== 'S') return false;
        const subElements = element?.sub_elements ?? {};
        return Object.values(subElements as Record<string, any>).every((subElement: any) => (subElement?.status ?? null) === 'S');
      });

      if (allS) {
        // Auto-fill a trainer comment from the pools (task-specific, else global _default)
        // when the task is fully satisfactory and no comment was set yet. Port of the
        // plugin's ajax_bulk_mark_tasks_satis comment assignment.
        const existingComment = typeof taskObj.trainer_comment === 'string' ? taskObj.trainer_comment.trim() : '';
        taskObj.trainer_comment = existingComment || this.pickSuccessComment(successPools, ptId);
      } else {
        taskObj.trainer_comment = taskObj.trainer_comment ?? '';
      }
    }

    nextData.top_level = 'C';
    return nextData;
  }

  // Load the success-comment pools setting: { "_default": [...], "PT_ID": [...] }.
  private async loadSuccessCommentPools(): Promise<Record<string, string[]>> {
    const raw = await this.settings.get('success_comments');
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  // Pick a random comment for a task: prefer the task-specific pool, fall back to _default.
  private pickSuccessComment(pools: Record<string, string[]>, ptId: string): string {
    let pool: string[] = [];
    if (Array.isArray(pools?.[ptId]) && pools[ptId].length > 0) {
      pool = pools[ptId];
    } else if (Array.isArray(pools?.['_default']) && pools['_default'].length > 0) {
      pool = pools['_default'];
    }
    if (!pool.length) return '';
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private normalizeCourseCode(courseCode: string): string {
    return (courseCode ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private resolveCourseTaskIds(master: any, courseCode: string): string[] {
    const normalizedCourseCode = this.normalizeCourseCode(courseCode);
    const rawCourseMap = master?.course_map && typeof master.course_map === 'object' ? master.course_map : {};
    const candidates = [courseCode, normalizedCourseCode];

    for (const candidate of candidates) {
      const direct = rawCourseMap[candidate];
      if (Array.isArray(direct)) return direct;
    }

    for (const [key, value] of Object.entries(rawCourseMap as Record<string, any>)) {
      if (Array.isArray(value) && this.normalizeCourseCode(String(key)) === normalizedCourseCode) {
        return value;
      }
    }

    return [];
  }

  private async ensureChecklistsExist(instanceId: number, enrollees: any[], courseCode: string) {
    const contactIds = enrollees.map((e) => parseInt(e.CONTACTID ?? '0')).filter(Boolean);
    const existing = await this.prisma.studentChecklist.findMany({
      where: { instanceId },
      select: { id: true, contactId: true, data: true, courseCode: true },
    });
    const existingMap = new Map(existing.map((r) => [r.contactId, r]));

    const template = await this.buildChecklistFromMaster(instanceId, courseCode);
    const blank = JSON.stringify(template);

    for (const contactId of contactIds) {
      const row = existingMap.get(contactId);
      if (!row) {
        await this.prisma.studentChecklist.create({
          data: { instanceId, contactId, courseCode, data: blank },
        }).catch(() => {}); // ignore unique constraint on race
        continue;
      }

      try {
        const parsed = JSON.parse(row.data);
        const studentChecklist = parsed?.student_checklist;
        const hasUsableChecklist = studentChecklist && typeof studentChecklist === 'object' && Object.keys(studentChecklist).length > 0;
        if (!hasUsableChecklist) {
          await this.prisma.studentChecklist.update({
            where: { id: row.id },
            data: { courseCode: courseCode || row.courseCode, data: blank },
          });
        }
      } catch {
        await this.prisma.studentChecklist.update({
          where: { id: row.id },
          data: { courseCode: courseCode || row.courseCode, data: blank },
        });
      }
    }
  }

  private async buildChecklistFromMaster(instanceId: number, courseCode: string, options?: { useSnapshot?: boolean }): Promise<any> {
    const useSnapshot = options?.useSnapshot !== false;

    // Read the master first so we can fingerprint it and detect mutations.
    const masterRaw = await this.settings.get('observation_checklists');
    const currentFingerprint = masterRaw ? this.computeMasterFingerprint(masterRaw) : '';

    if (useSnapshot) {
      const snapshot = await this.prisma.workshopSnapshot.findUnique({
        where: { instanceId_courseCode: { instanceId, courseCode } },
      });
      if (snapshot) {
        // Use the frozen snapshot when the master is unchanged (fingerprint match),
        // or when the master is temporarily unreadable (never serve an empty
        // checklist over a good snapshot). A fingerprint mismatch means the master
        // was edited, so we fall through and rebuild/refresh from the new master.
        const fingerprintMatches = !!currentFingerprint && snapshot.masterFingerprint === currentFingerprint;
        if (fingerprintMatches || !masterRaw) {
          try {
            const parsed = JSON.parse(snapshot.snapshotData);
            const normalized = normalizeChecklistPayloadToPluginShape(parsed, courseCode);
            if (isPluginChecklistPayload(normalized)) {
              return normalized;
            }
          } catch {
            // fall through to rebuild from master settings
          }
        }
      }
    }

    // Build from master checklist in settings
    if (!masterRaw) return { course_code: courseCode, student_checklist: {} };

    const master = JSON.parse(masterRaw);
    const template = buildChecklistTemplateFromMasterPayload(master, courseCode);
    if (template.course_meta) template.course_meta.master_fingerprint = currentFingerprint;
    const normalizedTemplate = normalizeChecklistPayloadToPluginShape(template, courseCode);

    // Save/refresh the snapshot with the current fingerprint so future calls stay
    // frozen until the master changes again.
    await this.prisma.workshopSnapshot.upsert({
      where: { instanceId_courseCode: { instanceId, courseCode } },
      update: { snapshotData: JSON.stringify(normalizedTemplate), masterFingerprint: currentFingerprint },
      create: { instanceId, courseCode, snapshotData: JSON.stringify(normalizedTemplate), masterFingerprint: currentFingerprint },
    }).catch(() => {});

    return normalizedTemplate;
  }

  // Version fingerprint of the master checklist. Port of PHP md5(wp_json_encode($master)).
  private computeMasterFingerprint(masterRaw: string): string {
    return createHash('md5').update(masterRaw).digest('hex');
  }

  private isAttendanceWindowOpen(startDate: string | null, leadMinutes: number): boolean {
    if (!startDate) return true;
    try {
      const openAt = new Date(new Date(startDate).getTime() - leadMinutes * 60 * 1000);
      return new Date() >= openAt;
    } catch {
      return true;
    }
  }

  private async resolveOlkaInstanceId(instanceId: number): Promise<number> {
    const [detail, searchData] = await Promise.all([
      this.axcelerate.getInstanceDetail(instanceId).catch(() => null),
      this.axcelerate.getInstanceSearchData(instanceId, 'false', 'false').catch(() => null),
    ]);

    const linked = detail?.LINKEDCLASSID ?? detail?.linkedClassID ?? searchData?.LINKEDCLASSID ?? searchData?.linkedClassID ?? null;
    return linked ? Number(linked) : instanceId;
  }

  private async resolveCourseCode(instanceId: number): Promise<string> {
    const [detail, searchData] = await Promise.all([
      this.axcelerate.getInstanceDetail(instanceId).catch(() => null),
      this.axcelerate.getInstanceSearchData(instanceId, 'false', 'false').catch(() => null),
    ]);

    return String(detail?.CODE ?? searchData?.CODE ?? detail?.coursename ?? searchData?.coursename ?? '').trim();
  }

  private parseOlkaStatuses(raw: any, courseCode: string): Record<string, { status: string; tooltip: string }> {
    const result: Record<string, { status: string; tooltip: string }> = {};
    const rows = Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw) ? raw : []);

    for (const row of rows) {
      const cid = String(row.CONTACTID ?? row.contactID ?? row.ContactID ?? '');
      if (!cid) continue;

      const commDate = this.findOlkaDate(row, courseCode, 'commencement');
      const compDate = this.findOlkaDate(row, courseCode, 'completion');

      const { status, tooltip } = deriveOlkaStatus(commDate, compDate);
      result[cid] = { status, tooltip };
    }
    return result;
  }

  private findOlkaDate(node: any, courseCode: string, type: 'commencement' | 'completion'): string | null {
    if (!node || typeof node !== 'object') return null;

    const subject = this.findSubjectNode(node, courseCode);
    if (subject) {
      const activity = this.findKnowledgeAssessmentActivity(subject);
      if (activity) {
        return type === 'commencement'
          ? (activity.COMMENCEMENTDATE ?? activity.commencementDate ?? activity.commencedDate ?? null)
          : (activity.COMPLETIONDATE ?? activity.completionDate ?? activity.completedDate ?? null);
      }
      return type === 'commencement'
        ? (subject.COMMENCEMENTDATE ?? subject.commencementDate ?? subject.commencedDate ?? null)
        : (subject.COMPLETIONDATE ?? subject.completionDate ?? subject.completedDate ?? null);
    }

    const fallbackActivity = this.findKnowledgeAssessmentActivity(node);
    if (fallbackActivity) {
      return type === 'commencement'
        ? (fallbackActivity.COMMENCEMENTDATE ?? fallbackActivity.commencementDate ?? fallbackActivity.commencedDate ?? null)
        : (fallbackActivity.COMPLETIONDATE ?? fallbackActivity.completionDate ?? fallbackActivity.completedDate ?? null);
    }

    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = this.findOlkaDate(item, courseCode, type);
          if (found) return found;
        }
      } else if (child && typeof child === 'object') {
        const found = this.findOlkaDate(child, courseCode, type);
        if (found) return found;
      }
    }
    return null;
  }

  private findSubjectNode(node: any, courseCode: string): any {
    if (!node || typeof node !== 'object') return null;

    const typeVal = (node.TYPE ?? node.type ?? '').toString().toLowerCase();
    if (typeVal === 's' && String(node.CODE ?? node.code ?? '').toUpperCase() === String(courseCode).toUpperCase()) {
      return node;
    }

    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = this.findSubjectNode(item, courseCode);
          if (found) return found;
        }
      } else if (child && typeof child === 'object') {
        const found = this.findSubjectNode(child, courseCode);
        if (found) return found;
      }
    }
    return null;
  }

  private findKnowledgeAssessmentActivity(node: any): any {
    if (!node || typeof node !== 'object') return null;

    const typeVal = (node.TYPE ?? node.type ?? '').toString().toLowerCase();
    const name = (node.NAME ?? node.name ?? '').toString().toLowerCase();
    if (typeVal === 'ae' && name.includes('knowledge assessment')) {
      return node;
    }

    for (const child of Object.values(node)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = this.findKnowledgeAssessmentActivity(item);
          if (found) return found;
        }
      } else if (child && typeof child === 'object') {
        const found = this.findKnowledgeAssessmentActivity(child);
        if (found) return found;
      }
    }
    return null;
  }
}
