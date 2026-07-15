import { useState, useEffect } from 'react';
import { workshopDetailApi } from '../api';
import './ChecklistModal.css';

interface Props {
  instanceId: number;
  student: { contactId: number; givenName: string; surname: string; preferredName: string };
  courseCode: string;
  trainerName: string;
  workshopDate: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ChecklistModal({
  instanceId, student, courseCode, trainerName, workshopDate, onClose, onSaved,
}: Props) {
  const [checklist, setChecklist] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successComments, setSuccessComments] = useState<Record<string, string>>({});

  const studentName = (student.preferredName?.trim() || student.givenName?.trim() || '') + ' ' + (student.surname?.trim() || '');

  useEffect(() => {
    workshopDetailApi.getChecklist(instanceId, student.contactId, courseCode)
      .then((res) => setChecklist(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [instanceId, student.contactId, courseCode]);

  const setSubElementStatus = (ptId: string, eid: string, seid: string, status: string | null) => {
    setChecklist((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.student_checklist[ptId].elements[eid].sub_elements[seid].status = status;
      // Derive element overall_status
      const el = next.student_checklist[ptId].elements[eid];
      const subStatuses = Object.values<any>(el.sub_elements ?? {}).map((s: any) => s.status);
      if (subStatuses.some((s) => s === 'N')) el.overall_status = 'N';
      else if (subStatuses.every((s) => s === 'S')) el.overall_status = 'S';
      else el.overall_status = null;
      return next;
    });
  };

  const setElementStatus = (ptId: string, eid: string, status: string | null) => {
    setChecklist((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      const el = next.student_checklist[ptId].elements[eid];
      el.overall_status = status;
      // If S, set all sub-elements to S; if N, leave as-is
      if (status === 'S' && el.sub_elements) {
        for (const seid of Object.keys(el.sub_elements)) {
          el.sub_elements[seid].status = 'S';
        }
      }
      return next;
    });
  };

  const markAllSatisfactory = () => {
    setChecklist((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev));
      for (const pt of Object.values<any>(next.student_checklist)) {
        for (const el of Object.values<any>(pt.elements ?? {})) {
          el.overall_status = 'S';
          for (const se of Object.values<any>(el.sub_elements ?? {})) {
            se.status = 'S';
          }
        }
      }
      return next;
    });
  };

  const fetchSuccessComment = async (ptId: string) => {
    try {
      const res = await workshopDetailApi.getSuccessComment(ptId);
      if (res.data.comment) {
        setSuccessComments((prev) => ({ ...prev, [ptId]: res.data.comment }));
      }
    } catch { /* silent */ }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await workshopDetailApi.saveChecklist({
        instanceId,
        contactId: student.contactId,
        courseCode,
        data: checklist,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      alert(`Save failed: ${err?.response?.data?.message ?? err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="checklist-overlay" onClick={onClose}>
      <div className="checklist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="checklist-modal-header">
          <div>
            <h2>Competency Checklist</h2>
            <div className="checklist-meta">
              {studentName} &middot; {courseCode} &middot; {workshopDate?.split(' ')[0]}
              {trainerName && <> &middot; Trainer: {trainerName}</>}
            </div>
          </div>
          <button className="checklist-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="checklist-loading">Loading checklist...</div>
        ) : !checklist?.student_checklist || Object.keys(checklist.student_checklist).length === 0 ? (
          <div className="checklist-empty">No checklist configured for course {courseCode}. Please set up the course checklist in Settings → Course Checklists.</div>
        ) : (
          <>
            <div className="checklist-toolbar">
              <button className="cl-btn-green" onClick={markAllSatisfactory}>
                Mark All Satisfactory
              </button>
            </div>
            <div className="checklist-body">
              {Object.entries<any>(checklist.student_checklist).map(([ptId, pt]) => (
                <div key={ptId} className="cl-task">
                  <div className="cl-task-title">
                    {pt.name} <span className="cl-task-id">({ptId})</span>
                    <button
                      className="cl-btn-comment"
                      onClick={() => fetchSuccessComment(ptId)}
                      title="Get a random success comment for this task"
                    >💬 Get Comment</button>
                  </div>
                  {successComments[ptId] && (
                    <div className="cl-comment-display">
                      {successComments[ptId]}
                      <button className="cl-comment-clear" onClick={() => setSuccessComments((p) => { const n = { ...p }; delete n[ptId]; return n; })}>✕</button>
                    </div>
                  )}

                  {Object.entries<any>(pt.elements ?? {}).map(([eid, el]) => {
                    const hasSubElements = el.sub_elements && Object.keys(el.sub_elements).length > 0;
                    return (
                      <div key={eid} className="cl-element">
                        <div className="cl-element-row">
                          <span className="cl-element-name">{el.name}</span>
                          {!hasSubElements && (
                            <div className="cl-sn-btns">
                              <button
                                className={`cl-btn-s${el.overall_status === 'S' ? ' active' : ''}`}
                                onClick={() => setElementStatus(ptId, eid, el.overall_status === 'S' ? null : 'S')}
                              >S</button>
                              <button
                                className={`cl-btn-n${el.overall_status === 'N' ? ' active' : ''}`}
                                onClick={() => setElementStatus(ptId, eid, el.overall_status === 'N' ? null : 'N')}
                              >N</button>
                            </div>
                          )}
                          {hasSubElements && (
                            <span className={`cl-overall ${el.overall_status === 'S' ? 'os-s' : el.overall_status === 'N' ? 'os-n' : 'os-pending'}`}>
                              {el.overall_status ?? '—'}
                            </span>
                          )}
                        </div>

                        {hasSubElements && (
                          <div className="cl-sub-elements">
                            {Object.entries<any>(el.sub_elements).map(([seid, se]) => (
                              <div key={seid} className="cl-sub-row">
                                <span className="cl-sub-name">{se.name}</span>
                                <div className="cl-sn-btns">
                                  <button
                                    className={`cl-btn-s${se.status === 'S' ? ' active' : ''}`}
                                    onClick={() => setSubElementStatus(ptId, eid, seid, se.status === 'S' ? null : 'S')}
                                  >S</button>
                                  <button
                                    className={`cl-btn-n${se.status === 'N' ? ' active' : ''}`}
                                    onClick={() => setSubElementStatus(ptId, eid, seid, se.status === 'N' ? null : 'N')}
                                  >N</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="checklist-footer">
              <button className="cl-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Checklist'}
              </button>
              <button className="cl-btn-cancel" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
