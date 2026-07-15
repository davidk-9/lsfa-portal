import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { workshopDetailApi, uploadsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { ChecklistModal } from '../components/ChecklistModal';
import './WorkshopDetailPage.css';

interface Student {
  contactId: number;
  givenName: string;
  surname: string;
  preferredName: string;
  attended: -1 | 0 | 1;
  attendanceComment?: string;
  complexId: number;
  uploads: { portfolioTypeId: number | null; id: number; blobUrl: string; kind?: string; status?: string }[];
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

  const trainerContactId = user?.impersonating ?? (user as any)?.axcelerateContactId ?? 0;

  const iid = parseInt(instanceId ?? '0');

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
        alert(`Upload failed: ${err?.response?.data?.message ?? err?.message}`);
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
      alert(`Failed to mark attendance: ${err?.response?.data?.message ?? err?.message}`);
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

  const handleChecklistUpload = async (student: Student) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      fd.append('instanceId', String(iid));
      fd.append('kind', 'checklist');
      fd.append('contactId', String(student.contactId));
      try {
        await uploadsApi.upload(fd);
        loadStudents();
      } catch (err: any) {
        alert(`Checklist upload failed: ${err?.response?.data?.message ?? err?.message}`);
      }
    };
    input.click();
  };

  const handleChecklistDelete = async (student: Student, uploadId?: number) => {
    if (!uploadId) return;
    if (!confirm('Remove this checklist upload?')) return;
    try {
      await uploadsApi.delete(uploadId);
      await loadStudents();
      setChecklistStatuses((prev) => {
        const next = { ...prev };
        delete next[student.contactId];
        return next;
      });
    } catch (err: any) {
      alert(`Delete failed: ${err?.response?.data?.message ?? err?.message}`);
    }
  };

  const handleChecklistView = (student: Student, upload?: { blobUrl?: string }) => {
    if (upload?.blobUrl) {
      window.open(upload.blobUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setChecklistModal({ student, courseCode });
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
          <button className="wd-btn-secondary" onClick={() => {
            if (!confirm('Reset all checklists for this workshop? This cannot be undone.')) return;
            workshopDetailApi.resetChecklists(iid, courseCode).then(loadStudents).catch(() => {});
          }}>
            Reset All Checklists
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
                const imgUpload = getUpload(s, PT.IMAGE);

                return (
                  <tr key={s.contactId} className={s.attended === 1 ? 'row-attended' : s.attended === 0 ? 'row-absent' : ''}>
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
                          className={`wd-status-btn ${checklistStatuses[s.contactId]?.tone ?? 'pending'}`}
                          onClick={() => setChecklistModal({ student: s, courseCode })}
                          title="Open checklist editor"
                        >
                          {checklistStatuses[s.contactId]?.label ?? '?'}
                        </button>
                        <button
                          className="wd-doc-btn"
                          onClick={() => handleChecklistView(s, checklistUpload)}
                        >
                          {checklistUpload ? 'View' : 'Document'}
                        </button>
                        <button
                          className={`wd-upload-btn${checklistUpload ? ' uploaded' : ''}`}
                          onClick={() => (checklistUpload ? handleChecklistView(s, checklistUpload) : handleChecklistUpload(s))}
                        >
                          {checklistUpload ? 'Preview' : 'Upload'}
                        </button>
                        {checklistUpload && (
                          <button
                            className="wd-delete-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              void handleChecklistDelete(s, checklistUpload.id);
                            }}
                            title="Delete checklist upload"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        className={`wd-upload-btn${sdUpload ? ' uploaded' : ''}`}
                        onClick={() => handleUpload('sd', s.contactId, loadStudents)}
                      >
                        {sdUpload ? '✓ SD' : 'SD'}
                      </button>
                    </td>
                    {workshopData?.showIfButton && (
                      <td>
                        <button
                          className={`wd-upload-btn${ifUpload ? ' uploaded' : ''}`}
                          onClick={() => handleUpload('if', s.contactId, loadStudents)}
                        >
                          {ifUpload ? '✓ IF' : 'IF'}
                        </button>
                      </td>
                    )}
                    <td>
                      <button
                        className={`wd-upload-btn${imgUpload ? ' uploaded' : ''}`}
                        onClick={() => handleUpload('image', s.contactId, loadStudents)}
                      >
                        {imgUpload ? '✓ Img' : 'Img'}
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
    </div>
  );
}
