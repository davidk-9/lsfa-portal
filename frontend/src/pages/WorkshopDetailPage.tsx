import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { workshopDetailApi, uploadsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ChecklistModal } from '../components/ChecklistModal';
import AiPaperworkModal from '../components/AiPaperworkModal';
import EvidenceManagerModal from '../components/EvidenceManagerModal';
import MarkingWizardModal from '../components/MarkingWizardModal';
import { compressImage } from '../utils/imageUtils';
import { buildChecklistDocumentHtml, buildChecklistPdfBlob, isDebugChecklistMode } from './checklistDocumentUtils';
import './WorkshopDetailPage.css';

interface Student {
  contactId: number;
  givenName: string;
  surname: string;
  preferredName: string;
  attended: -1 | 0 | 1;
  attendanceComment?: string;
  complexId: number;
  uploads: { portfolioTypeId: number | null; id: number; blobUrl: string; kind?: string; status?: string; mimeType?: string; filename?: string }[];
}

interface WorkshopData {
  students: Student[];
  complexId: number;
  instanceId: number;
  isAttendanceOpen: boolean;
  workshopEvidence: any;
  stepInstructions: { step1: string; step2: string; step3: string };
  showIfButton: boolean;
  evidenceEnabled: boolean;
}

interface OlkaMap { [contactId: string]: { status: string; tooltip: string } }

// Portfolio type IDs matching WordPress plugin
const PT = { IMAGE: 51766, SD: 51767, IF: 51768 };

export function WorkshopDetailPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const enrolOpen = searchParams.get('enrolOpen') ?? 'false';
  const isPublic = searchParams.get('isPublic') ?? 'false';

  const [header, setHeader] = useState<any>(null);
  const [workshopData, setWorkshopData] = useState<WorkshopData | null>(null);
  const [olka, setOlka] = useState<OlkaMap>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(1);
  const [checklistModal, setChecklistModal] = useState<{ student: Student; courseCode: string } | null>(null);
  const [progress, setProgress] = useState({ rule1: false, rule2: false, rule3: false, completedSteps: 0 });
  const [students, setStudents] = useState<Student[]>([]);
  const [checklistStatuses, setChecklistStatuses] = useState<Record<number, { label: string; tone: string }>>({});
  const [attendanceModal, setAttendanceModal] = useState<{ student: Student; status: 0 | 1 | null; comment: string } | null>(null);
  const [checklistDocument, setChecklistDocument] = useState<{ student: Student; html: string } | null>(null);
  const [checklistEvidence, setChecklistEvidence] = useState<{ url: string; mimeType: string; uploadId: number; student: Student } | null>(null);
  const [checklistDebugData, setChecklistDebugData] = useState<{ student: Student; json: string } | null>(null);
  const [checklistDebugSaving, setChecklistDebugSaving] = useState(false);
  const [step2Busy, setStep2Busy] = useState<string | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [evidenceManager, setEvidenceManager] = useState<
    { student: Student; kind: 'sd' | 'if' | 'image'; title: string; multiple: boolean } | null
  >(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const trainerContactId = user?.impersonating
    ? (user.impersonatingAxcelerateContactId ?? '')
    : (user?.axcelerateContactId ?? '');

  const iid = parseInt(instanceId ?? '0');
  const currentCourseCode = header?.searchData?.CODE ?? header?.detail?.CODE ?? '';

  const deriveChecklistStatus = (data: any): { label: string; tone: string } => {
    const studentChecklist = data?.student_checklist;
    if (!studentChecklist || typeof studentChecklist !== 'object') {
      return { label: '?', tone: 'pending' };
    }

    let hasAnyStatus = false;
    let hasNotCompetent = false;
    for (const task of Object.values(studentChecklist as Record<string, any>)) {
      const elements = (task as any)?.elements ?? {};
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
  };

  const handleUpload = async (kind: string, contactId: number | null, onDone: () => void) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'image' ? 'image/*' : '.pdf,.jpg,.jpeg,.png';
    if (kind === 'image') input.capture = 'environment';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('instanceId', String(iid));
      fd.append('kind', kind);
      if (contactId) fd.append('contactId', String(contactId));
      try {
        await uploadsApi.upload(fd);
        onDone();
      } catch (err: any) {
        toast.error(`Upload failed: ${err?.response?.data?.message ?? err?.message}`);
      }
    };
    input.click();
  };

  // Load header
  useEffect(() => {
    if (!iid) return;
    workshopDetailApi.getHeader(iid, enrolOpen, isPublic)
      .then((res) => setHeader(res.data))
      .catch(() => {});
  }, [iid, enrolOpen, isPublic]);

  const loadStudents = useCallback(() => {
    if (!iid) return;
    const startDate = header?.searchData?.STARTDATE ?? header?.detail?.STARTDATE ?? '';
    const courseCode = header?.searchData?.CODE ?? header?.detail?.CODE ?? '';
    workshopDetailApi.getStudents(iid, startDate, courseCode)
      .then((res) => {
        setWorkshopData(res.data);
        setStudents(res.data.students);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [iid, header]);

  const loadChecklistStatuses = useCallback(async (studentList: Student[], currentCourseCode: string) => {
    if (!iid || !studentList.length || !currentCourseCode) return;
    const entries = await Promise.all(studentList.map(async (student) => {
      try {
        const res = await workshopDetailApi.getChecklist(iid, student.contactId, currentCourseCode);
        return [student.contactId, deriveChecklistStatus(res.data)] as const;
      } catch {
        return [student.contactId, { label: '?', tone: 'pending' }] as const;
      }
    }));
    setChecklistStatuses(Object.fromEntries(entries));
  }, [iid]);

  const loadOlka = useCallback(() => {
    if (!iid || !header) return;
    const courseCode = header?.searchData?.CODE ?? header?.detail?.CODE ?? '';
    if (!courseCode) return;
    workshopDetailApi.getOlka(iid, courseCode)
      .then((res) => setOlka(res.data))
      .catch(() => {});
  }, [iid, header]);

  useEffect(() => {
    if (header) {
      loadStudents();
      loadOlka();
    }
  }, [header, loadStudents, loadOlka]);

  useEffect(() => {
    if (!header || !students.length) return;
    const currentCourseCode = header?.searchData?.CODE ?? header?.detail?.CODE ?? '';
    void loadChecklistStatuses(students, currentCourseCode);
  }, [header, students, loadChecklistStatuses]);

  // Compute progress
  useEffect(() => {
    if (!students.length) return;
    const allMarked = students.every((s) => s.attended !== -1);
    const attended = students.filter((s) => s.attended === 1);
    const allHaveChecklist = attended.every((s) =>
      s.uploads.some((u) => !u.portfolioTypeId),
    );
    const allHaveSD = attended.every((s) =>
      s.uploads.some((u) => u.portfolioTypeId === PT.SD),
    );
    const workshopEv = !!workshopData?.workshopEvidence;
    const rule1 = allMarked;
    const rule2 = rule1 && allHaveChecklist;
    const rule3 = rule1 && (workshopEv || allHaveSD);
    const completedSteps = (rule1 ? 1 : 0) + (rule2 ? 1 : 0) + (rule3 ? 1 : 0);
    setProgress({ rule1, rule2, rule3, completedSteps });

    // Auto-save progress
    if (trainerContactId && iid) {
      workshopDetailApi.saveProgress({
        instanceId: iid,
        trainerContactId,
        status: {
          rule1, rule2, rule3,
          overallComplete: rule1 && rule2 && rule3,
          completed_steps: completedSteps,
          total_steps: 3,
        },
      }).catch(() => {});
    }
  }, [students, workshopData, trainerContactId, iid]);

  const handleAttendance = async (student: Student, attended: 0 | 1, comment?: string) => {
    try {
      const attendanceComment = comment ?? student.attendanceComment ?? '';
      await workshopDetailApi.markAttendance({
        instanceId: iid,
        contactId: student.contactId,
        complexId: student.complexId,
        attended,
        comment: attendanceComment,
      });
      setStudents((prev) =>
        prev.map((s) => s.contactId === student.contactId ? { ...s, attended, attendanceComment: attendanceComment } : s),
      );
    } catch (err: any) {
      toast.error(`Failed to mark attendance: ${err?.response?.data?.message ?? err?.message}`);
    }
  };

  const handleBulkAttendance = async (attended: 0 | 1) => {
    for (const s of students) {
      await handleAttendance(s, attended, s.attendanceComment ?? '').catch(() => {});
    }
  };

  const handleAttendanceNote = (student: Student) => {
    setAttendanceModal({
      student,
      status: student.attended === 1 ? 1 : student.attended === 0 ? 0 : null,
      comment: student.attendanceComment ?? '',
    });
  };

  const saveAttendanceNote = async () => {
    if (!attendanceModal || attendanceModal.status === null) return;
    await handleAttendance(attendanceModal.student, attendanceModal.status, attendanceModal.comment);
    setAttendanceModal(null);
  };

  // Third checklist button (when no PDF exists yet): generate the printable checklist
  // PDF from the student's marked checklist data and upload it to Axcelerate.
  // Port of the WordPress plugin's .dktp-upload-checklist (auto-populate + upload).
  // Uses the same server-side renderer as the bulk "Upload All Checklists" action.
  const handleChecklistUpload = async (student: Student) => {
    try {
      const res = await workshopDetailApi.getChecklist(iid, student.contactId, currentCourseCode);
      const payload = res.data;
      const hasData =
        payload && typeof payload.student_checklist === 'object' && Object.keys(payload.student_checklist ?? {}).length > 0;
      if (!hasData) {
        toast.error('This checklist has no marked data yet. Mark the checklist before generating the PDF.');
        return;
      }

      const nameRaw = displayName(student).trim() || 'checklist';
      const nameFile = nameRaw.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
      const fileName = `Checklist_Document__${nameFile}__${student.contactId}.pdf`;

      const pdfBlob = buildChecklistPdfBlobFor(student, payload);

      const fd = new FormData();
      fd.append('file', new File([pdfBlob], fileName, { type: 'application/pdf' }));
      fd.append('instanceId', String(iid));
      fd.append('kind', 'checklist');
      fd.append('contactId', String(student.contactId));
      await uploadsApi.upload(fd);

      toast.success('Checklist PDF generated and uploaded.');
      await loadStudents();
    } catch (err: any) {
      toast.error(`Checklist upload failed: ${err?.response?.data?.message ?? err?.message}`);
    }
  };

  const handleChecklistDelete = async (student: Student, uploadId?: number) => {
    if (!uploadId) return;
    if (!confirm('Remove this checklist upload?')) return;
    try {
      await uploadsApi.delete(uploadId);
      setChecklistEvidence(null);
      setChecklistDocument(null);
      await loadStudents();
      setChecklistStatuses((prev) => {
        const next = { ...prev };
        delete next[student.contactId];
        return next;
      });
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.response?.data?.message ?? err?.message}`);
    }
  };

  const handleResetAllChecklists = async () => {
    if (!confirm('Reset all checklists for this workshop? This cannot be undone.')) return;
    setStep2Busy('reset');
    try {
      await workshopDetailApi.resetChecklists(iid, currentCourseCode);
      await loadStudents();
    } catch (err: any) {
      toast.error(`Reset failed: ${err?.response?.data?.message ?? err?.message}`);
    } finally {
      setStep2Busy(null);
    }
  };

  const handleBulkMarkAllSatisfactory = async () => {
    if (!confirm('Mark all checklist tasks as satisfactory for every attended student?')) return;
    setStep2Busy('bulk-mark');
    try {
      await workshopDetailApi.bulkMarkAllTasksSatisfactory(iid, currentCourseCode);
      await loadStudents();
    } catch (err: any) {
      toast.error(`Bulk checklist update failed: ${err?.response?.data?.message ?? err?.message}`);
    } finally {
      setStep2Busy(null);
    }
  };

  const handleWizardPlaceholder = () => {
    if (!students.some((s) => s.attended === 1)) {
      toast.error('No attended students to mark. Mark attendance first.');
      return;
    }
    setWizardOpen(true);
  };

  // Bulk Upload (AI Assisted): pick one combined PDF scan, then hand off to the
  // AI paperwork modal which reads, classifies, groups and uploads each page.
  const handleAiBulkUpload = () => {
    if (!students.length) {
      toast.error('No students found. Load the student list first.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) setAiFile(file);
    };
    input.click();
  };

  // Evidence buttons (SD / IF / [+]): if nothing is uploaded yet, go straight to the
  // file picker (camera on mobile); otherwise open the manager to view/replace/add.
  const directEvidenceUpload = (student: Student, kind: 'sd' | 'if' | 'image', multiple: boolean) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'image' ? 'image/*' : 'image/*,.pdf';
    input.multiple = multiple;
    input.onchange = async () => {
      const chosen = Array.from(input.files ?? []);
      if (!chosen.length) return;
      const toUpload = multiple ? chosen : chosen.slice(0, 1);
      try {
        for (const file of toUpload) {
          const prepared = file.type.startsWith('image/') ? await compressImage(file) : file;
          const fd = new FormData();
          fd.append('file', prepared);
          fd.append('instanceId', String(iid));
          fd.append('kind', kind);
          fd.append('contactId', String(student.contactId));
          await uploadsApi.upload(fd);
        }
        toast.success('Evidence uploaded.');
        await loadStudents();
      } catch (err: any) {
        toast.error(`Upload failed: ${err?.response?.data?.message ?? err?.message}`);
      }
    };
    input.click();
  };

  const openEvidence = (student: Student, kind: 'sd' | 'if' | 'image', title: string, multiple: boolean) => {
    const pfId = kind === 'sd' ? PT.SD : kind === 'if' ? PT.IF : PT.IMAGE;
    const existing = student.uploads.filter((u) => u.portfolioTypeId === pfId);
    if (existing.length === 0) {
      directEvidenceUpload(student, kind, multiple);
    } else {
      setEvidenceManager({ student, kind, title, multiple });
    }
  };

  // The trainer for this checklist is whoever's portal we're in: prefer the workshop's
  // resolved trainer, else the impersonated trainer, else the logged-in trainer. This
  // mirrors the plugin — you only reach this view from a trainer's calendar or by impersonating.
  const trainerDisplayName =
    header?.trainerName ||
    header?.searchData?.TRAINER_NAME ||
    (user?.impersonating ? user?.impersonatingName : user?.name) ||
    '';

  const buildChecklistHtml = (student: Student, checklistData: any) => buildChecklistDocumentHtml(
    student,
    checklistData,
    currentCourseCode,
    trainerDisplayName,
    startDate,
    iid,
    location,
  );

  // Fast, client-side checklist PDF (jsPDF) — no browser, no server round-trip.
  const buildChecklistPdfBlobFor = (student: Student, checklistData: any) =>
    buildChecklistPdfBlob(student, checklistData, currentCourseCode, trainerDisplayName, startDate, iid, location);

  const handleUploadAllChecklists = async () => {
    if (!confirm('This will generate and upload checklists for all attended students who do not yet have an uploaded checklist. Continue?')) return;

    const pendingStudents = students.filter((student) => {
      if (student.attended !== 1) return false;
      return !student.uploads.some((upload) => upload.kind === 'checklist' || (upload.portfolioTypeId === null && upload.kind !== 'image' && upload.kind !== 'sd' && upload.kind !== 'if'));
    });

    if (!pendingStudents.length) {
      toast.info('No eligible students found for bulk upload.');
      return;
    }

    setStep2Busy('uploading');
    try {
      for (let index = 0; index < pendingStudents.length; index += 1) {
        const student = pendingStudents[index];
        const res = await workshopDetailApi.getChecklist(iid, student.contactId, currentCourseCode);
        const checklistData = res.data;

        const studentNameRaw = `${student.preferredName ?? student.givenName ?? ''} ${student.surname ?? ''}`.trim() || 'checklist';
        const studentNameFile = studentNameRaw.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
        const fileName = `Checklist_Document__${studentNameFile}__${student.contactId}.pdf`;

        const pdfBlob = buildChecklistPdfBlobFor(student, checklistData);
        const formData = new FormData();
        formData.append('file', new File([pdfBlob], fileName, { type: 'application/pdf' }));
        formData.append('instanceId', String(iid));
        formData.append('kind', 'checklist');
        formData.append('contactId', String(student.contactId));
        await uploadsApi.upload(formData);

        await loadStudents();
      }
      toast.success('Bulk upload complete.');
    } catch (err: any) {
      toast.error(`Bulk upload failed: ${err?.response?.data?.message ?? err?.message}`);
    } finally {
      setStep2Busy(null);
    }
  };

  const handleChecklistView = async (student: Student, upload?: { blobUrl?: string; id?: number; mimeType?: string; kind?: string }) => {
    if (upload?.blobUrl) {
      // The proxy URL has no file extension, so trust the stored mimeType/kind first.
      const isPdf =
        (upload.mimeType ? upload.mimeType.includes('pdf') : false) ||
        upload.kind === 'checklist' ||
        /\.pdf($|[?#])/i.test(upload.blobUrl);
      setChecklistEvidence({
        url: upload.blobUrl,
        mimeType: isPdf ? 'application/pdf' : (upload.mimeType || 'image/*'),
        uploadId: upload.id ?? 0,
        student,
      });
      return;
    }

    try {
      const res = await workshopDetailApi.getChecklist(iid, student.contactId, currentCourseCode);
      const html = buildChecklistHtml(student, res.data);
      setChecklistDocument({ student, html });
    } catch (err: any) {
      toast.error(`Failed to load checklist document: ${err?.response?.data?.message ?? err?.message}`);
    }
  };

  const handleChecklistJsonView = async (student: Student) => {
    if (!isDebugChecklistMode(searchParams.toString())) {
      return;
    }

    try {
      const res = await workshopDetailApi.getChecklist(iid, student.contactId, currentCourseCode);
      const payload = res?.data;
      const json = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
      setChecklistDebugData({ student, json });
    } catch (err: any) {
      toast.error(`Failed to load checklist JSON: ${err?.response?.data?.message ?? err?.message}`);
    }
  };

  const saveChecklistJson = async () => {
    if (!checklistDebugData) return;
    setChecklistDebugSaving(true);
    try {
      const parsed = JSON.parse(checklistDebugData.json);
      await workshopDetailApi.saveChecklist({
        instanceId: iid,
        contactId: checklistDebugData.student.contactId,
        courseCode: currentCourseCode,
        data: parsed,
      });
      setChecklistDebugData(null);
      await loadStudents();
    } catch (err: any) {
      toast.error(`Failed to save checklist JSON: ${err?.response?.data?.message ?? err?.message}`);
    } finally {
      setChecklistDebugSaving(false);
    }
  };

  const exportChecklistPdf = async () => {
    if (!checklistDocument) return;
    try {
      const student = checklistDocument.student;
      const res = await workshopDetailApi.getChecklist(iid, student.contactId, currentCourseCode);
      const studentNameRaw = `${student.preferredName ?? student.givenName ?? ''} ${student.surname ?? ''}`.trim() || 'checklist';
      const studentNameFile = studentNameRaw.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '');
      const filename = `Checklist_Document__${studentNameFile}__${student.contactId ?? ''}.pdf`;
      const blob = buildChecklistPdfBlobFor(student, res.data);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(`Failed to generate PDF: ${err?.message ?? err}`);
    }
  };

  if (loading || !header) {
    return <div className="wd-loading">Loading workshop...</div>;
  }

  const searchData = header.searchData ?? {};
  const detail = header.detail ?? {};
  const courseCode = searchData.CODE ?? detail.CODE ?? '';
  const courseName = searchData.COURSENAME ?? detail.COURSENAME ?? '';
  const startDate = searchData.STARTDATE ?? detail.STARTDATE ?? '';
  const location = searchData.LOCATION ?? detail.LOCATION ?? '';
  const participants = parseInt(searchData.PARTICIPANTS ?? detail.PARTICIPANTS ?? '0') || 0;
  const isAttendanceOpen = workshopData?.isAttendanceOpen ?? true;

  const displayName = (s: Student) =>
    (s.preferredName?.trim() || s.givenName?.trim() || '') + ' ' + (s.surname?.trim() || '');

  const getUpload = (s: Student, typeId: number | null) =>
    s.uploads.find((u) => u.portfolioTypeId === typeId);

  return (
    <div className="workshop-detail-page">
      {/* Header */}
      <div className="wd-header">
        <button className="wd-back-btn" onClick={() => navigate(-1)}>← Back to Calendar</button>
        <div className="wd-title">
          <h1>{courseCode} — {courseName}</h1>
          <div className="wd-meta">
            <span>{startDate ? new Date(startDate.replace(' ', 'T')).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span>
            <span>{startDate?.split(' ')[1]?.slice(0, 5)} – {(searchData.FINISHDATE ?? detail.FINISHDATE ?? '').split(' ')[1]?.slice(0, 5)}</span>
            <span>{location}</span>
            <span>{participants} participant{participants !== 1 ? 's' : ''}</span>
            <span className="wd-instance">Instance #{iid}</span>
          </div>
        </div>
        <div className={`wd-progress-badge ${progress.completedSteps === 3 ? 'complete' : ''}`}>
          {progress.completedSteps} of 3 Complete
        </div>
      </div>

      {/* Workflow Tabs */}
      <div className="wd-tabs">
        {[1, 2, 3].map((t) => (
          <button
            key={t}
            className={`wd-tab${activeTab === t ? ' active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            Step {t} {t === 1 ? '— Mark Attendance' : t === 2 ? '— Mark Checklists' : '— Upload Evidence'}
            {progress[`rule${t}` as 'rule1' | 'rule2' | 'rule3'] && <span className="wd-tab-tick"> ✓</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="wd-tab-instruction">
        {workshopData?.stepInstructions[`step${activeTab}` as 'step1' | 'step2' | 'step3']}
      </div>

      {activeTab === 1 && (
        <div className="wd-bulk-btns">
          <button
            className={`wd-btn-green${!isAttendanceOpen ? ' disabled' : ''}`}
            disabled={!isAttendanceOpen}
            onClick={() => handleBulkAttendance(1)}
          >
            Mark ALL Attended
          </button>
          <button
            className={`wd-btn-red${!isAttendanceOpen ? ' disabled' : ''}`}
            disabled={!isAttendanceOpen}
            onClick={() => handleBulkAttendance(0)}
          >
            Mark ALL Absent
          </button>
          {!isAttendanceOpen && (
            <span className="wd-att-warning">Attendance opens 30 minutes before start time.</span>
          )}
        </div>
      )}

      {activeTab === 2 && (
        <div className="wd-bulk-btns">
          <button className="wd-btn-secondary" disabled={!!step2Busy} onClick={() => void handleResetAllChecklists()}>
            {step2Busy === 'reset' ? 'Resetting...' : 'Reset All Student Checklists'}
          </button>
          <button className="wd-btn-green" disabled={!!step2Busy} onClick={() => void handleBulkMarkAllSatisfactory()}>
            {step2Busy === 'bulk-mark' ? 'Processing...' : 'Mark All Student Tasks Satisfactory'}
          </button>
          <button className="wd-btn-secondary" disabled={!!step2Busy} onClick={handleWizardPlaceholder}>
            Mark Student Tasks Wizard
          </button>
          <button className="wd-btn-secondary" disabled={!!step2Busy} onClick={() => void handleUploadAllChecklists()}>
            {step2Busy === 'uploading' ? 'Uploading...' : 'Upload All Checklists'}
          </button>
        </div>
      )}

      {activeTab === 3 && workshopData?.evidenceEnabled && (
        <div className="wd-bulk-btns">
          <button
            className={`wd-btn-secondary${workshopData?.workshopEvidence ? ' wd-btn-uploaded' : ''}`}
            onClick={() => handleUpload('workshop', null, loadStudents)}
          >
            {workshopData?.workshopEvidence ? '✓ Workshop Evidence Uploaded' : 'Upload Workshop Evidence File'}
          </button>
        </div>
      )}

      {activeTab === 3 && students.length > 0 && (
        <div className="wd-bulk-btns">
          <button className="wd-btn-secondary" onClick={handleAiBulkUpload}>
            Bulk Upload (AI Assisted)
          </button>
        </div>
      )}

      {/* Workshop Progress Rules modal trigger */}
      <div className="wd-rules">
        {[
          { n: 1, ok: progress.rule1, text: 'All students are marked either attended or absent' },
          { n: 2, ok: progress.rule2, text: 'All attending students have an uploaded checklist' },
          { n: 3, ok: progress.rule3, text: 'Workshop evidence uploaded OR all attended students have SD files' },
        ].map(({ n, ok, text }) => (
          <div key={n} className={`wd-rule${ok ? ' ok' : ''}`}>
            <span className="wd-rule-icon">{ok ? '✓' : '✗'}</span>
            <span>Rule {n}: {text}</span>
          </div>
        ))}
      </div>

      {/* Student table */}
      {students.length === 0 ? (
        <div className="wd-no-students">No students enrolled in this workshop.</div>
      ) : (
        <div className="wd-student-table-wrap">
          <table className="wd-student-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Attendance</th>
                <th>OLKA</th>
                <th>Checklist</th>
                <th>SD</th>
                {workshopData?.showIfButton && <th>IF</th>}
                <th>Image</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const olkaStatus = olka[String(s.contactId)];
                const checklistUpload = s.uploads.find((u) => u.kind === 'checklist' || (u.portfolioTypeId === null && u.kind !== 'image' && u.kind !== 'sd' && u.kind !== 'if'));
                const sdUpload = getUpload(s, PT.SD);
                const ifUpload = getUpload(s, PT.IF);
                const imgUploads = s.uploads.filter((u) => u.portfolioTypeId === PT.IMAGE);
                const checklistStatus = checklistStatuses[s.contactId];
                const canUseChecklistTools = s.attended === 1 || !!checklistUpload;
                const canEditChecklist = s.attended === 1 && !checklistUpload;

                return (
                  <tr key={s.contactId} className={`${s.attended === 1 ? 'row-attended' : s.attended === 0 ? 'row-absent' : ''} ${checklistUpload ? 'row-checklist-locked' : ''}`}>
                    <td className="wd-student-name">{displayName(s)}</td>
                    <td className="wd-att-cell">
                      <button
                        className={`wd-att-btn${s.attended === 1 ? ' active-attended' : ''}`}
                        disabled={!isAttendanceOpen}
                        onClick={() => handleAttendance(s, 1, s.attendanceComment ?? '')}
                      >Attended</button>
                      <button
                        className={`wd-att-btn${s.attended === 0 ? ' active-absent' : ''}`}
                        disabled={!isAttendanceOpen}
                        onClick={() => handleAttendance(s, 0, s.attendanceComment ?? '')}
                      >Absent</button>
                      <button
                        className={`wd-att-note-btn${(s.attendanceComment ?? '').trim() ? ' has-note' : ''}`}
                        disabled={!isAttendanceOpen}
                        onClick={() => handleAttendanceNote(s)}
                        title={s.attendanceComment?.trim() ? 'Edit attendance note' : 'Add attendance note'}
                      >{s.attendanceComment?.trim() ? 'Edit' : '...'}</button>
                    </td>
                    <td className="wd-olka-cell">
                      {olkaStatus ? (
                        <span
                          className={`olka-badge olka-${olkaStatus.status.toLowerCase()}`}
                          title={olkaStatus.tooltip}
                        >
                          {olkaStatus.status}
                        </span>
                      ) : <span className="olka-badge olka-ns" title="Not Started">NS</span>}
                    </td>
                    <td>
                      <div className="wd-checklist-actions">
                        <button
                          className={`wd-status-btn ${checklistStatus?.tone ?? 'pending'}${canEditChecklist ? '' : ' locked'}`}
                          onClick={() => {
                            if (!canEditChecklist) return;
                            if (!isDebugChecklistMode(searchParams.toString())) return;
                            void handleChecklistJsonView(s);
                          }}
                          title={canEditChecklist ? 'Open checklist JSON in debug mode' : 'Checklist is locked after upload'}
                          disabled={!canEditChecklist}
                        >
                          {checklistStatus?.label ?? '?'}
                        </button>
                        <button
                          className="wd-doc-btn"
                          onClick={() => void handleChecklistView(s)}
                          disabled={!canUseChecklistTools}
                          title="View printable checklist"
                        >
                          📄
                        </button>
                        <button
                          className={`wd-upload-btn${checklistUpload ? ' uploaded' : ''}`}
                          onClick={() => (checklistUpload ? void handleChecklistView(s, checklistUpload) : void handleChecklistUpload(s))}
                          disabled={!canUseChecklistTools}
                          title={checklistUpload ? 'View / delete uploaded checklist' : 'Generate & upload checklist PDF'}
                        >
                          ⬆️
                        </button>
                      </div>
                    </td>
                    <td>
                      <button
                        className={`wd-upload-btn${sdUpload ? ' uploaded' : ''}`}
                        onClick={() => openEvidence(s, 'sd', 'Student Declaration (SD)', false)}
                        title={sdUpload ? 'View / replace student declaration' : 'Upload student declaration'}
                      >
                        {sdUpload ? '✓ SD' : 'SD'}
                      </button>
                    </td>
                    {workshopData?.showIfButton && (
                      <td>
                        <button
                          className={`wd-upload-btn${ifUpload ? ' uploaded' : ''}`}
                          onClick={() => openEvidence(s, 'if', 'Incident Form (IF)', false)}
                          title={ifUpload ? 'View / replace incident form' : 'Upload incident form'}
                        >
                          {ifUpload ? '✓ IF' : 'IF'}
                        </button>
                      </td>
                    )}
                    <td>
                      <button
                        className={`wd-upload-btn${imgUploads.length ? ' uploaded' : ''}`}
                        onClick={() => openEvidence(s, 'image', 'Additional Evidence', true)}
                        title="Manage additional evidence images"
                      >
                        {imgUploads.length ? `✓ + (${imgUploads.length})` : '+'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {attendanceModal && (
        <div className="wd-att-note-modal-backdrop" onClick={() => setAttendanceModal(null)}>
          <div className="wd-att-note-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Attendance Note</h3>
            <div className="wd-att-note-status-row">
              <label>
                <input
                  type="radio"
                  name={`attendance-status-${attendanceModal.student.contactId}`}
                  checked={attendanceModal.status === 1}
                  onChange={() => setAttendanceModal({ ...attendanceModal, status: 1 })}
                />
                Attended
              </label>
              <label>
                <input
                  type="radio"
                  name={`attendance-status-${attendanceModal.student.contactId}`}
                  checked={attendanceModal.status === 0}
                  onChange={() => setAttendanceModal({ ...attendanceModal, status: 0 })}
                />
                Absent
              </label>
            </div>
            <label className="wd-att-note-label" htmlFor="attendance-note-text">Attendance comment</label>
            <textarea
              id="attendance-note-text"
              rows={5}
              value={attendanceModal.comment}
              onChange={(event) => setAttendanceModal({ ...attendanceModal, comment: event.target.value })}
            />
            <div className="wd-att-note-actions">
              <button className="wd-btn-secondary" onClick={() => setAttendanceModal(null)}>Cancel</button>
              <button className="wd-btn-green" disabled={attendanceModal.status === null} onClick={() => void saveAttendanceNote()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {checklistDocument && (
        <div className="wd-modal-backdrop" onClick={() => setChecklistDocument(null)}>
          <div className="wd-modal-panel wd-doc-modal" onClick={(event) => event.stopPropagation()}>
            <div className="wd-modal-header">
              <div>
                <h3>Checklist Document</h3>
                <div className="wd-modal-subtitle">Printable checklist preview for {displayName(checklistDocument.student)}</div>
              </div>
              <div className="wd-modal-actions">
                <button className="wd-btn-secondary" onClick={() => void exportChecklistPdf()}>Download PDF</button>
                <button className="wd-modal-close" onClick={() => setChecklistDocument(null)}>✕</button>
              </div>
            </div>
            <div id="wd-checklist-export-root" className="wd-doc-modal-content" dangerouslySetInnerHTML={{ __html: checklistDocument.html }} />
          </div>
        </div>
      )}

      {checklistDebugData && (
        <div className="wd-modal-backdrop" onClick={() => setChecklistDebugData(null)}>
          <div className="wd-modal-panel wd-json-modal" onClick={(event) => event.stopPropagation()}>
            <div className="wd-modal-header">
              <div>
                <h3>Checklist JSON</h3>
                <div className="wd-modal-subtitle">Debug view for {displayName(checklistDebugData.student)}</div>
              </div>
              <div className="wd-modal-actions">
                <button className="wd-btn-secondary" disabled={checklistDebugSaving} onClick={() => void saveChecklistJson()}>{checklistDebugSaving ? 'Saving...' : 'Save JSON'}</button>
                <button className="wd-modal-close" onClick={() => setChecklistDebugData(null)}>✕</button>
              </div>
            </div>
            <textarea
              className="wd-json-content"
              value={checklistDebugData.json}
              onChange={(event) => setChecklistDebugData({ ...checklistDebugData, json: event.target.value })}
              spellCheck={false}
            />
          </div>
        </div>
      )}

      {checklistEvidence && (
        <div className="wd-modal-backdrop" onClick={() => setChecklistEvidence(null)}>
          <div className="wd-modal-panel wd-evidence-modal" onClick={(event) => event.stopPropagation()}>
            <div className="wd-modal-header">
              <h3>Uploaded Checklist PDF</h3>
              <div className="wd-modal-actions">
                <button
                  style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => void handleChecklistDelete(checklistEvidence.student, checklistEvidence.uploadId)}
                >
                  Delete File
                </button>
                <button className="wd-modal-close" onClick={() => setChecklistEvidence(null)}>✕</button>
              </div>
            </div>
            <div className="wd-evidence-modal-content">
              {checklistEvidence.mimeType?.includes('pdf') || /\.pdf($|[?#])/i.test(checklistEvidence.url) ? (
                <iframe src={checklistEvidence.url} title="Checklist PDF" className="wd-evidence-embed" />
              ) : (
                <img src={checklistEvidence.url} alt="Checklist upload" className="wd-evidence-image" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checklist Modal */}
      {checklistModal && (
        <ChecklistModal
          instanceId={iid}
          student={checklistModal.student}
          courseCode={checklistModal.courseCode}
          trainerName={header?.searchData?.TRAINER_NAME ?? ''}
          workshopDate={startDate}
          onClose={() => setChecklistModal(null)}
          onSaved={loadStudents}
        />
      )}

      {aiFile && (
        <AiPaperworkModal
          instanceId={iid}
          file={aiFile}
          roster={students.map((s) => ({
            contact_id: s.contactId,
            name: (s.preferredName?.trim() || `${s.givenName} ${s.surname}`).trim(),
          }))}
          onClose={() => setAiFile(null)}
          onUploaded={loadStudents}
        />
      )}

      {evidenceManager && (
        <EvidenceManagerModal
          instanceId={iid}
          contactId={evidenceManager.student.contactId}
          studentName={displayName(evidenceManager.student)}
          kind={evidenceManager.kind}
          title={evidenceManager.title}
          multiple={evidenceManager.multiple}
          files={evidenceManager.student.uploads.filter((u) =>
            evidenceManager.kind === 'image'
              ? u.portfolioTypeId === PT.IMAGE
              : evidenceManager.kind === 'sd'
                ? u.portfolioTypeId === PT.SD
                : u.portfolioTypeId === PT.IF,
          )}
          onChanged={loadStudents}
          onClose={() => setEvidenceManager(null)}
        />
      )}

      {wizardOpen && (
        <MarkingWizardModal
          instanceId={iid}
          courseCode={currentCourseCode}
          students={students
            .filter((s) => s.attended === 1)
            .map((s) => ({ contactId: s.contactId, name: displayName(s) }))}
          onClose={() => setWizardOpen(false)}
          onSaved={() => loadStudents()}
        />
      )}
    </div>
  );
}
