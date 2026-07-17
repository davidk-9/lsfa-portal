import { useCallback, useEffect, useMemo, useState } from 'react';
import { workshopDetailApi } from '../api';
import { useToast } from '../context/ToastContext';

type Mark = 'S' | 'S2' | 'S3' | 'N';

interface WizardStudent {
  contactId: number;
  name: string;
}

interface TaskStructure {
  [ptId: string]: { name: string; elements: { [eid: string]: { title: string } } };
}

interface Props {
  instanceId: number;
  courseCode: string;
  students: WizardStudent[]; // attended students only
  onClose: () => void;
  onSaved: (updatedContacts: number[]) => void;
}

const MARKS: { value: Mark; label: string }[] = [
  { value: 'S', label: 'S' },
  { value: 'S2', label: '2' },
  { value: 'S3', label: '3' },
  { value: 'N', label: 'N' },
];

function rank(m: Mark): number {
  return m === 'S3' ? 3 : m === 'S2' ? 2 : m === 'S' ? 1 : 0;
}

// Task mark derived from element marks: any N -> N, else highest attempt.
function taskFromElements(marks: Mark[]): Mark {
  if (marks.some((m) => m === 'N')) return 'N';
  let highest = 1;
  for (const m of marks) highest = Math.max(highest, rank(m));
  return highest === 3 ? 'S3' : highest === 2 ? 'S2' : 'S';
}

function MarkToggle({ value, onChange }: { value: Mark; onChange: (m: Mark) => void }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #d1d5db' }}>
      {MARKS.map((m) => {
        const active = value === m.value;
        const tone =
          m.value === 'N'
            ? { bg: '#ef4444', fg: '#fff' }
            : m.value === 'S3'
              ? { bg: '#b45309', fg: '#fff' }
              : m.value === 'S2'
                ? { bg: '#d97706', fg: '#fff' }
                : { bg: '#22c55e', fg: '#fff' };
        return (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            style={{
              border: 'none',
              padding: '4px 10px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
              background: active ? tone.bg : '#f3f4f6',
              color: active ? tone.fg : '#374151',
            }}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export default function MarkingWizardModal({ instanceId, courseCode, students, onClose, onSaved }: Props) {
  const toast = useToast();
  const [tasks, setTasks] = useState<TaskStructure>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [ptId, setPtId] = useState('');
  const [elementMarks, setElementMarks] = useState<Record<string, Mark>>({});
  const [taskMark, setTaskMark] = useState<Mark>('S');
  const [comment, setComment] = useState('');
  const [autoComment, setAutoComment] = useState(true);
  const [saving, setSaving] = useState(false);

  const taskName = useMemo(() => tasks[ptId]?.name ?? ptId, [tasks, ptId]);
  const elementIds = useMemo(() => Object.keys(tasks[ptId]?.elements ?? {}), [tasks, ptId]);

  // Load the course task structure.
  useEffect(() => {
    workshopDetailApi
      .getTaskStructure(instanceId, courseCode)
      .then((res) => {
        const t: TaskStructure = res.data?.tasks ?? {};
        setTasks(t);
        const first = Object.keys(t)[0] ?? '';
        setPtId(first);
      })
      .catch(() => toast.error('Failed to load task structure.'))
      .finally(() => setLoading(false));
  }, [instanceId, courseCode, toast]);

  const counts = useCallback(
    (marks: Record<string, Mark>) => {
      const c = { S: 0, S2: 0, S3: 0, N: 0 } as Record<Mark, number>;
      for (const eid of elementIds) c[marks[eid] ?? 'S']++;
      return c;
    },
    [elementIds],
  );

  const generateComment = useCallback(
    async (marks: Record<string, Mark>): Promise<string> => {
      const c = counts(marks);
      if (c.N > 0) {
        return `The student was found not yet satisfactory after 3 attempts at ${taskName} further training and a future re-assessment session will be organised.`;
      }
      const parts: string[] = [];
      if (c.S2 > 0 || c.S3 > 0 || c.S > 0) parts.push(`the student was found satisfactory at ${taskName}.`);
      if (c.S2 > 0) parts.push(`${c.S2} elements required a second attempt.`);
      if (c.S3 > 0) parts.push(`${c.S3} elements required a third attempt.`);
      if (parts.length > 0 && (c.S2 > 0 || c.S3 > 0 || c.S > 0)) return parts.join(' ');
      if (ptId) {
        try {
          const res = await workshopDetailApi.getSuccessComment(ptId);
          if (res.data?.comment) return res.data.comment;
        } catch {
          /* ignore */
        }
      }
      return 'All elements satisfactory.';
    },
    [counts, taskName, ptId],
  );

  const refreshAutoComment = useCallback(
    async (marks: Record<string, Mark>) => {
      if (!autoComment) return;
      setComment(await generateComment(marks));
    },
    [autoComment, generateComment],
  );

  // Reset element marks (all S) when the task changes.
  useEffect(() => {
    if (!ptId) return;
    const initial: Record<string, Mark> = {};
    for (const eid of Object.keys(tasks[ptId]?.elements ?? {})) initial[eid] = 'S';
    setElementMarks(initial);
    setTaskMark('S');
    void refreshAutoComment(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptId, tasks]);

  const setElementMark = (eid: string, mark: Mark) => {
    const next = { ...elementMarks, [eid]: mark };
    setElementMarks(next);
    setTaskMark(taskFromElements(elementIds.map((id) => next[id] ?? 'S')));
    void refreshAutoComment(next);
  };

  const setTaskMarkAndPropagate = (mark: Mark) => {
    setTaskMark(mark);
    const next: Record<string, Mark> = {};
    for (const eid of elementIds) next[eid] = mark;
    setElementMarks(next);
    void refreshAutoComment(next);
  };

  const toggleStudent = (contactId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const allSelected = students.length > 0 && selected.size === students.length;
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(students.map((s) => s.contactId)));
  };

  const handleSave = async () => {
    if (selected.size === 0) return toast.error('No students selected.');
    if (!ptId) return toast.error('No task selected.');

    let finalComment = comment;
    if (autoComment) {
      finalComment = await generateComment(elementMarks);
      setComment(finalComment);
    } else if (!finalComment.trim()) {
      return toast.error('Enter a task comment or enable Auto-generate before saving.');
    }

    setSaving(true);
    try {
      const res = await workshopDetailApi.saveWizardResults({
        instanceId,
        contactIds: Array.from(selected),
        ptId,
        taskResult: taskMark,
        elementsResults: elementMarks,
        trainerComment: finalComment,
        courseCode,
      });
      const updated: number[] = res.data?.updatedContacts ?? [];
      toast.success(`Saved results for ${updated.length} student${updated.length === 1 ? '' : 's'}.`);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      toast.error(`Save failed: ${err?.response?.data?.message ?? err?.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Mark Student Tasks Wizard</h2>
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Close
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 20, color: '#6b7280' }}>Loading tasks…</div>
        ) : (
          <div style={body}>
            {/* Students */}
            <div style={leftCol}>
              <h3 style={{ marginTop: 0 }}>Students</h3>
              {students.length === 0 ? (
                <div style={{ color: '#6b7280' }}>No attended students to mark.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    <tr style={{ background: '#f3f4f6', fontWeight: 700 }}>
                      <td style={td}>All students</td>
                      <td style={{ ...td, textAlign: 'center' }}>
                        <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                      </td>
                    </tr>
                    {students.map((s) => (
                      <tr key={s.contactId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td}>
                          {s.name} <span style={{ color: '#9ca3af' }}>({s.contactId})</span>
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={selected.has(s.contactId)}
                            onChange={() => toggleStudent(s.contactId)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Task marking */}
            <div style={rightCol}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select value={ptId} onChange={(e) => setPtId(e.target.value)} style={{ flex: 1, minWidth: 180, padding: 6 }}>
                  {Object.entries(tasks).map(([id, t]) => (
                    <option key={id} value={id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <MarkToggle value={taskMark} onChange={setTaskMarkAndPropagate} />
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                    <th style={th}>Element</th>
                    <th style={{ ...th, textAlign: 'center' }}>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {elementIds.length === 0 ? (
                    <tr>
                      <td style={td} colSpan={2}>
                        This task has no elements.
                      </td>
                    </tr>
                  ) : (
                    elementIds.map((eid) => (
                      <tr key={eid} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={td} title={tasks[ptId]?.elements[eid]?.title}>
                          {tasks[ptId]?.elements[eid]?.title ?? eid}
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <MarkToggle value={elementMarks[eid] ?? 'S'} onChange={(m) => setElementMark(eid, m)} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              <div style={{ marginTop: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>Task comment</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={autoComment}
                  style={{ width: '100%', height: 80, padding: 6, fontFamily: 'inherit' }}
                />
                <label style={{ display: 'inline-flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={autoComment}
                    onChange={(e) => {
                      setAutoComment(e.target.checked);
                      if (e.target.checked) void refreshAutoComment(elementMarks);
                    }}
                  />
                  Auto-generate comment
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save results for selected students'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline styles ─────────────────────────────────────────────────────────────
const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(17,24,39,.72)',
  zIndex: 99999,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '32px 14px',
  overflow: 'auto',
};
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  maxWidth: 1000,
  width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,.35)',
  padding: 18,
  color: '#111827',
};
const body: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '300px 1fr',
  gap: 18,
  marginTop: 12,
};
const leftCol: React.CSSProperties = { borderRight: '1px solid #e5e7eb', paddingRight: 16, maxHeight: '68vh', overflow: 'auto' };
const rightCol: React.CSSProperties = { minWidth: 0 };
const th: React.CSSProperties = { border: '1px solid #e5e7eb', padding: 6 };
const td: React.CSSProperties = { padding: '6px 8px' };
