import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { aiApi, uploadsApi, settingsApi } from '../api';
import { useToast } from '../context/ToastContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// ── Document types (mirrors the WordPress plugin) ─────────────────────────────
type DocTypeValue = 'student_declaration' | 'incident_report' | 'additional_evidence' | 'skip';

const DOC_TYPES: { value: DocTypeValue; label: string; portfolioTypeId: number }[] = [
  { value: 'student_declaration', label: 'Student Declaration (SD)', portfolioTypeId: 51767 },
  { value: 'incident_report', label: 'Incident Form (IF)', portfolioTypeId: 51768 },
  { value: 'additional_evidence', label: 'Additional Evidence (+)', portfolioTypeId: 51766 },
  { value: 'skip', label: 'Skip / do not upload', portfolioTypeId: 0 },
];

function portfolioTypeId(docType: string): number {
  return DOC_TYPES.find((t) => t.value === docType)?.portfolioTypeId ?? 0;
}

function uploadKind(pfId: number): 'sd' | 'if' | 'image' | '' {
  if (pfId === 51767) return 'sd';
  if (pfId === 51768) return 'if';
  if (pfId === 51766) return 'image';
  return '';
}

function shortDocLabel(value: string): string {
  if (value === 'student_declaration') return 'Student Declaration';
  if (value === 'incident_report') return 'Incident Form';
  if (value === 'additional_evidence') return 'Additional Evidence';
  if (value === 'skip') return 'Skip';
  return 'Unknown';
}

function sanitizeFilename(value: string): string {
  return (
    String(value || 'paperwork')
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 90) || 'paperwork'
  );
}

interface Roster {
  contact_id: number;
  name: string;
}

interface AiResult {
  student_name_read?: string;
  matched_contact_id?: number;
  matched_student_name?: string;
  student_confidence?: number;
  document_type?: string;
  document_type_confidence?: number;
  manual_review_required?: boolean;
  notes?: string;
}

interface AiPage {
  pageNumber: number;
  imageDataUrl: string;
  ai: AiResult | null;
  error: string;
  contactId: number; // user selection
  docType: DocTypeValue; // user selection
}

interface Props {
  instanceId: number;
  file: File;
  roster: Roster[];
  onClose: () => void;
  onUploaded: () => void;
}

type Stage = 'processing' | 'review' | 'uploading';

// ── PDF rendering ─────────────────────────────────────────────────────────────
async function renderPages(
  bytes: ArrayBuffer,
  targetWidth: number,
  targetQuality: number,
  onProgress: (msg: string) => void,
): Promise<{ pageNumber: number; imageDataUrl: string }[]> {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
  const out: { pageNumber: number; imageDataUrl: string }[] = [];
  const width = Math.max(600, Math.min(3000, targetWidth || 1200));
  const quality = Math.max(0.5, Math.min(0.95, targetQuality || 0.75));

  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress(`Rendering page ${n} of ${pdf.numPages}...`);
    const page = await pdf.getPage(n);
    const v1 = page.getViewport({ scale: 1 });
    const scale = Math.min(2.5, Math.max(0.6, width / v1.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false })!;
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    out.push({ pageNumber: n, imageDataUrl: canvas.toDataURL('image/jpeg', quality) });
    canvas.width = 1;
    canvas.height = 1;
  }
  return out;
}

function reviewNeedsReview(page: AiPage): boolean {
  if (page.error) return true;
  const ai = page.ai;
  return (
    !ai ||
    !!ai.manual_review_required ||
    !ai.matched_contact_id ||
    ai.document_type === 'unknown' ||
    ai.document_type === 'blank_page' ||
    Number(ai.student_confidence ?? 0) < 0.9 ||
    Number(ai.document_type_confidence ?? 0) < 0.85
  );
}

function initialDocType(ai: AiResult | null): DocTypeValue {
  const dt = ai?.document_type;
  if (dt === 'student_declaration' || dt === 'incident_report' || dt === 'additional_evidence') return dt;
  return 'skip';
}

export default function AiPaperworkModal({ instanceId, file, roster, onClose, onUploaded }: Props) {
  const toast = useToast();
  const [stage, setStage] = useState<Stage>('processing');
  const [statusText, setStatusText] = useState('Loading AI paperwork tools...');
  const [pages, setPages] = useState<AiPage[]>([]);
  const [uploadProgress, setUploadProgress] = useState('');
  const [fatalError, setFatalError] = useState('');
  const [preview, setPreview] = useState<AiPage | null>(null);
  const originalBytesRef = useRef<ArrayBuffer | null>(null);

  const studentName = useCallback(
    (contactId: number) => roster.find((r) => r.contact_id === contactId)?.name ?? '',
    [roster],
  );

  // Pipeline: render → classify (parallel, limit 4) → review
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        originalBytesRef.current = arrayBuffer.slice(0);

        let renderWidth = 1200;
        let renderQuality = 0.75;
        try {
          const settingsRes = await settingsApi.getAll();
          const s = settingsRes.data ?? {};
          if (s.ai_render_width) renderWidth = parseInt(s.ai_render_width, 10) || 1200;
          if (s.ai_render_quality) renderQuality = parseFloat(s.ai_render_quality) || 0.75;
        } catch {
          /* use defaults on settings load error */
        }

        const rendered = await renderPages(
          arrayBuffer.slice(0),
          renderWidth,
          renderQuality,
          (msg) => {
            if (!cancelled) setStatusText(msg);
          },
        );
        if (cancelled) return;

        const built: AiPage[] = rendered.map((p) => ({
          ...p,
          ai: null,
          error: '',
          contactId: 0,
          docType: 'skip',
        }));

        const total = built.length;
        let next = 0;
        const limit = Math.max(1, Math.min(4, total));

        const classifyOne = async (page: AiPage, attempt = 1): Promise<void> => {
          try {
            const res = await aiApi.classifyPage({
              instanceId,
              pageNumber: page.pageNumber,
              pageImage: page.imageDataUrl,
              roster,
            });
            page.ai = res.data;
            page.error = '';
            page.contactId = Number(res.data?.matched_contact_id ?? 0) || 0;
            page.docType = initialDocType(res.data);
          } catch (err: any) {
            if (attempt < 2) {
              await new Promise((r) => setTimeout(r, 650));
              return classifyOne(page, attempt + 1);
            }
            page.error = err?.response?.data?.message ?? err?.message ?? 'AI classification failed';
            page.ai = null;
          }
        };

        const worker = async () => {
          while (next < total && !cancelled) {
            const idx = next++;
            setStatusText(`AI reading page ${idx + 1} of ${total}...`);
            await classifyOne(built[idx]);
          }
        };

        await Promise.all(Array.from({ length: limit }, () => worker()));
        if (cancelled) return;

        setPages(built);
        setStage('review');
      } catch (err: any) {
        if (!cancelled) setFatalError(err?.message ?? 'AI paperwork processing failed.');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePage = (pageNumber: number, patch: Partial<AiPage>) => {
    setPages((prev) => prev.map((p) => (p.pageNumber === pageNumber ? { ...p, ...patch } : p)));
  };

  // Duplicate assignment detection: SD/IF must be one page per student.
  const duplicateKeys = useMemo(() => {
    const seen: Record<string, number> = {};
    for (const p of pages) {
      if (!p.contactId || p.docType === 'skip' || p.docType === 'additional_evidence') continue;
      const key = `${p.contactId}|${p.docType}`;
      seen[key] = (seen[key] ?? 0) + 1;
    }
    return new Set(Object.keys(seen).filter((k) => seen[k] > 1));
  }, [pages]);

  const isDuplicate = (p: AiPage) =>
    p.contactId && p.docType !== 'skip' && p.docType !== 'additional_evidence'
      ? duplicateKeys.has(`${p.contactId}|${p.docType}`)
      : false;

  const counts = useMemo(() => {
    let ok = 0;
    let review = 0;
    let error = 0;
    for (const p of pages) {
      if (p.error) error++;
      else if (reviewNeedsReview(p)) review++;
      else ok++;
    }
    return { ok, review, error };
  }, [pages]);

  const handleConfirmUpload = async () => {
    if (duplicateKeys.size > 0) {
      toast.error(
        'Duplicate assignment found. Student Declaration and Incident Form allow only one page per student. Fix the highlighted rows before uploading.',
      );
      return;
    }

    // Group by student + doc type; additional evidence for one student groups into a single PDF.
    const groups = new Map<
      string,
      { contactId: number; docType: DocTypeValue; portfolioTypeId: number; pageIndexes: number[]; studentName: string }
    >();
    for (const p of pages) {
      const pfId = portfolioTypeId(p.docType);
      if (!p.contactId || !pfId || p.docType === 'skip') continue;
      const key = `${p.contactId}|${p.docType}`;
      if (!groups.has(key)) {
        groups.set(key, {
          contactId: p.contactId,
          docType: p.docType,
          portfolioTypeId: pfId,
          pageIndexes: [],
          studentName: studentName(p.contactId) || `student_${p.contactId}`,
        });
      }
      groups.get(key)!.pageIndexes.push(p.pageNumber - 1); // pdf-lib is 0-based
    }

    const groupList = Array.from(groups.values());
    if (groupList.length === 0) {
      toast.error('No pages have been assigned for upload. Select at least one student and paperwork type.');
      return;
    }

    const unassigned = pages.filter((p) => !p.contactId || p.docType === 'skip').length;
    let msg = `This will upload ${groupList.length} grouped PDF file(s).`;
    if (unassigned) msg += `\n\n${unassigned} page(s) are set to skip/not assigned and will not be uploaded.`;
    if (!confirm(`${msg}\n\nContinue?`)) return;

    setStage('uploading');
    try {
      const src = await PDFDocument.load(originalBytesRef.current!.slice(0));
      let success = 0;
      let failed = 0;

      for (let i = 0; i < groupList.length; i++) {
        const group = groupList[i];
        setUploadProgress(
          `Uploading ${i + 1} of ${groupList.length}: ${group.studentName} — ${shortDocLabel(group.docType)}`,
        );
        try {
          const outDoc = await PDFDocument.create();
          const copied = await outDoc.copyPages(src, group.pageIndexes);
          copied.forEach((pg) => outDoc.addPage(pg));
          const bytes = await outDoc.save();
          const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });

          const fd = new FormData();
          fd.append('file', blob, `${sanitizeFilename(`${group.studentName}_${group.docType}_${instanceId}`)}.pdf`);
          fd.append('instanceId', String(instanceId));
          fd.append('kind', uploadKind(group.portfolioTypeId));
          fd.append('contactId', String(group.contactId));
          await uploadsApi.upload(fd);
          success++;
        } catch (err) {
          failed++;
          // eslint-disable-next-line no-console
          console.error('AI paperwork upload failed', group, err);
        }
      }

      setUploadProgress(`Upload complete. Uploaded: ${success}. Failed: ${failed}.`);
      onUploaded();
      window.setTimeout(() => {
        toast.success(`AI paperwork upload complete. Uploaded: ${success}. Failed: ${failed}.`);
        onClose();
      }, 500);
    } catch (err: any) {
      setStage('review');
      toast.error(`Upload failed: ${err?.message ?? err}`);
    }
  };

  return (
    <div style={backdrop}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Bulk Upload (AI Assisted)</h2>
          <button type="button" className="btn" onClick={onClose} disabled={stage === 'uploading'}>
            Close
          </button>
        </div>

        {fatalError && <div style={warnBox}>{fatalError}</div>}

        {stage === 'processing' && !fatalError && (
          <div style={infoBox}>
            <div style={{ fontWeight: 600 }}>Reading your scanned paperwork…</div>
            <div style={{ marginTop: 6, color: '#374151' }}>{statusText}</div>
          </div>
        )}

        {stage === 'review' && (
          <>
            <p style={{ margin: '10px 0' }}>
              Review the AI’s suggestions. Fix any highlighted rows, then upload. Student Declaration and
              Incident Form allow one page per student; Additional Evidence can span multiple pages.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
              <span style={{ ...badge, ...badgeOk }}>Likely OK: {counts.ok}</span>
              <span style={{ ...badge, ...badgeReview }}>Needs review: {counts.review}</span>
              {counts.error > 0 && <span style={{ ...badge, ...badgeError }}>Errors: {counts.error}</span>}
            </div>
            {duplicateKeys.size > 0 && (
              <div style={warnBox}>
                Duplicate assignment found (highlighted below). SD/IF allow only one page per student — change
                the duplicates to the correct student, Additional Evidence, or Skip.
              </div>
            )}

            <div style={tableWrap}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Page</th>
                    <th style={th}>Preview</th>
                    <th style={th}>AI</th>
                    <th style={th}>Student</th>
                    <th style={th}>Paperwork Type</th>
                    <th style={th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.map((p) => {
                    const dup = isDuplicate(p);
                    const needs = reviewNeedsReview(p);
                    const rowBg = p.error ? '#fef2f2' : dup ? '#fff1f2' : needs ? '#fffbeb' : undefined;
                    return (
                      <tr key={p.pageNumber} style={{ background: rowBg }}>
                        <td style={td}>{p.pageNumber}</td>
                        <td style={td}>
                          <img
                            src={p.imageDataUrl}
                            alt={`Page ${p.pageNumber}`}
                            style={{ width: 70, height: 'auto', cursor: 'pointer', border: '1px solid #e5e7eb' }}
                            onClick={() => setPreview(p)}
                          />
                        </td>
                        <td style={td}>
                          <span
                            style={{
                              ...badge,
                              ...(p.error ? badgeError : needs ? badgeReview : badgeOk),
                            }}
                          >
                            {p.error ? 'Error' : needs ? 'Review' : 'Likely OK'}
                          </span>
                          {p.ai && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                              conf {Math.round(Number(p.ai.student_confidence ?? 0) * 100)}% /{' '}
                              {Math.round(Number(p.ai.document_type_confidence ?? 0) * 100)}%
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          <select
                            value={String(p.contactId)}
                            onChange={(e) => updatePage(p.pageNumber, { contactId: parseInt(e.target.value, 10) || 0 })}
                            style={select}
                          >
                            <option value="0">-- Select student --</option>
                            {roster.map((r) => (
                              <option key={r.contact_id} value={r.contact_id}>
                                {r.name} ({r.contact_id})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={td}>
                          <select
                            value={p.docType}
                            onChange={(e) => updatePage(p.pageNumber, { docType: e.target.value as DocTypeValue })}
                            style={select}
                          >
                            {DOC_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ ...td, fontSize: 12, color: '#4b5563', maxWidth: 220 }}>
                          {p.error || p.ai?.notes || ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
              <button type="button" className="btn" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmUpload}>
                Confirm and Upload Assigned Paperwork
              </button>
            </div>
          </>
        )}

        {stage === 'uploading' && (
          <div style={infoBox}>
            <div style={{ fontWeight: 600 }}>Uploading…</div>
            <div style={{ marginTop: 6, color: '#374151' }}>{uploadProgress}</div>
          </div>
        )}
      </div>

      {preview && (
        <div style={{ ...backdrop, zIndex: 100001 }} onClick={() => setPreview(null)}>
          <div style={{ ...modal, maxWidth: 1000 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Page {preview.pageNumber} preview</h3>
              <button type="button" className="btn" onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <img src={preview.imageDataUrl} alt={`Page ${preview.pageNumber}`} style={{ maxWidth: '100%', marginTop: 12 }} />
          </div>
        </div>
      )}
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
  padding: '28px 14px',
  overflow: 'auto',
};
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  maxWidth: 1260,
  width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,.35)',
  padding: 18,
  color: '#111827',
};
const infoBox: React.CSSProperties = {
  padding: '12px 14px',
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: 8,
  margin: '12px 0',
};
const warnBox: React.CSSProperties = {
  padding: '10px 12px',
  background: '#fff1f2',
  border: '1px solid #fecdd3',
  color: '#9f1239',
  borderRadius: 8,
  margin: '10px 0',
  lineHeight: 1.45,
};
const tableWrap: React.CSSProperties = {
  maxHeight: '62vh',
  overflow: 'auto',
  border: '1px solid #e5e7eb',
  marginTop: 12,
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  padding: 8,
  background: '#f9fafb',
  textAlign: 'left',
  position: 'sticky',
  top: 0,
};
const td: React.CSSProperties = { border: '1px solid #e5e7eb', padding: 8, verticalAlign: 'middle' };
const select: React.CSSProperties = { width: '100%', maxWidth: 260, padding: 4 };
const badge: React.CSSProperties = { display: 'inline-block', borderRadius: 999, padding: '2px 8px', fontWeight: 700, fontSize: 12 };
const badgeOk: React.CSSProperties = { background: '#dcfce7', color: '#166534' };
const badgeReview: React.CSSProperties = { background: '#fef3c7', color: '#92400e' };
const badgeError: React.CSSProperties = { background: '#fee2e2', color: '#991b1b' };
