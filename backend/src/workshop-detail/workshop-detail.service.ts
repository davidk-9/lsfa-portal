import { Injectable, Logger } from '@nestjs/common';
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
      } else if (status === 'S') {
        hasAnyStatus = true;
      }

      const subElements = element?.sub_elements ?? {};
      for (const subElement of Object.values(subElements as Record<string, any>)) {
        const subStatus = subElement?.status ?? null;
        if (subStatus === 'N') {
          hasNotCompetent = true;
          hasAnyStatus = true;
        } else if (subStatus === 'S') {
          hasAnyStatus = true;
        }
      }
    }
  }

  if (!hasAnyStatus) return { label: '?', tone: 'pending' };
  return hasNotCompetent ? { label: 'N', tone: 'not-competent' } : { label: 'C', tone: 'competent' };
}

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

    return {
      detail,
      searchData,
      progress: progress ?? null,
    };
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

    // Get upload status for all students in this instance
    const uploads = await this.prisma.workshopUpload.findMany({
      where: { instanceId, status: 'active' },
      select: { contactId: true, portfolioTypeId: true, id: true, blobUrl: true, kind: true, status: true },
    });

    const uploadMap = new Map<string, any[]>();
    for (const u of uploads) {
      const key = String(u.contactId ?? '');
      if (!uploadMap.has(key)) uploadMap.set(key, []);
      uploadMap.get(key)!.push(u);
    }

    const workshopUpload = await this.prisma.workshopUpload.findFirst({
      where: { instanceId, contactId: null, status: 'active' },
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

    if (row) return JSON.parse(row.data);

    // Create from master checklist (port of PHP get_or_create_student_checklist)
    const template = await this.buildChecklistFromMaster(instanceId, courseCode);
    await this.prisma.studentChecklist.create({
      data: { instanceId, contactId, courseCode, data: JSON.stringify(template) },
    });
    return template;
  }

  async saveStudentChecklist(instanceId: number, contactId: number, courseCode: string, data: any) {
    const json = JSON.stringify(data);
    await this.prisma.studentChecklist.upsert({
      where: { instanceId_contactId: { instanceId, contactId } },
      update: { data: json },
      create: { instanceId, contactId, courseCode, data: json },
    });
    return { success: true };
  }

  async resetAllChecklists(instanceId: number, courseCode: string) {
    // Re-create all checklists from master template (clears all results)
    const rows = await this.prisma.studentChecklist.findMany({ where: { instanceId } });
    const template = await this.buildChecklistFromMaster(instanceId, courseCode);
    const blank = JSON.stringify(template);

    for (const row of rows) {
      await this.prisma.studentChecklist.update({
        where: { id: row.id },
        data: { data: blank },
      });
    }
    return { success: true, reset: rows.length };
  }

  // ── Workshop progress ─────────────────────────────────────────────────────────

  async saveWorkshopProgress(instanceId: number, trainerContactId: number, status: any) {
    const payload = {
      completedSteps: parseInt(status.completed_steps ?? '0'),
      totalSteps: parseInt(status.total_steps ?? '3'),
      isComplete: !!status.overallComplete,
      statusPayload: JSON.stringify(status),
      trainerContactId,
    };

    await this.prisma.workshopProgress.upsert({
      where: { instanceId },
      update: payload,
      create: { instanceId, ...payload },
    });
    return { success: true };
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

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async ensureChecklistsExist(instanceId: number, enrollees: any[], courseCode: string) {
    const contactIds = enrollees.map((e) => parseInt(e.CONTACTID ?? '0')).filter(Boolean);
    const existing = await this.prisma.studentChecklist.findMany({
      where: { instanceId },
      select: { contactId: true },
    });
    const existingSet = new Set(existing.map((r) => r.contactId));
    const missing = contactIds.filter((id) => !existingSet.has(id));

    if (missing.length === 0) return;

    const template = await this.buildChecklistFromMaster(instanceId, courseCode);
    const blank = JSON.stringify(template);

    for (const contactId of missing) {
      await this.prisma.studentChecklist.create({
        data: { instanceId, contactId, courseCode, data: blank },
      }).catch(() => {}); // ignore unique constraint on race
    }
  }

  private async buildChecklistFromMaster(instanceId: number, courseCode: string): Promise<any> {
    // Check for a frozen snapshot first (port of PHP workshop_snapshots)
    const snapshot = await this.prisma.workshopSnapshot.findUnique({
      where: { instanceId_courseCode: { instanceId, courseCode } },
    });
    if (snapshot) return JSON.parse(snapshot.snapshotData);

    // Build from master checklist in settings
    const masterRaw = await this.settings.get('observation_checklists');
    if (!masterRaw) return { course_code: courseCode, student_checklist: {} };

    const master = JSON.parse(masterRaw);
    const courseTasks = master.course_map?.[courseCode] ?? [];
    const allTasks = master.tasks ?? {};

    const student_checklist: Record<string, any> = {};
    for (const ptId of courseTasks) {
      const task = allTasks[ptId];
      if (!task) continue;
      const elements: Record<string, any> = {};
      for (const [eid, el] of Object.entries<any>(task.elements ?? {})) {
        const sub_elements: Record<string, any> = {};
        for (const [seid, se] of Object.entries<any>(el.sub_elements ?? {})) {
          sub_elements[seid] = { name: se.name, status: null };
        }
        elements[eid] = {
          name: el.name,
          overall_status: null,
          sub_elements,
        };
      }
      student_checklist[ptId] = { name: task.name, elements };
    }

    const template = { course_code: courseCode, student_checklist };

    // Save as snapshot so future calls use this frozen version
    await this.prisma.workshopSnapshot.create({
      data: { instanceId, courseCode, snapshotData: JSON.stringify(template) },
    }).catch(() => {});

    return template;
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
