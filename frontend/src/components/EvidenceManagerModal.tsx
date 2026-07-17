import { useState } from 'react';
import { uploadsApi } from '../api';
import { compressImage } from '../utils/imageUtils';

export interface EvidenceFile {
  id: number;
  blobUrl: string;
  kind?: string;
  mimeType?: string;
  filename?: string;
  portfolioTypeId: number | null;
}

interface Props {
  instanceId: number;
  contactId: number;
  studentName: string;
  kind: 'sd' | 'if' | 'image';
  title: string;
  multiple: boolean; // true for the [+] additional-evidence manager
  files: EvidenceFile[];
  onChanged: () => void;
  onClose: () => void;
}

function isImage(f: EvidenceFile): boolean {
  if (f.mimeType) return f.mimeType.startsWith('image/');
  const name = (f.filename ?? '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp)$/.test(name);
}

export default function EvidenceManagerModal({
  instanceId,
  contactId,
  studentName,
  kind,
  title,
  multiple,
  files: initialFiles,
  onChanged,
  onClose,
}: Props) {
  const [files, setFiles] = useState<EvidenceFile[]>(initialFiles);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const portfolioTypeId = kind === 'sd' ? 51767 : kind === 'if' ? 51768 : 51766;
  const accept = kind === 'image' ? 'image/*' : 'image/*,.pdf';

  const uploadOne = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('instanceId', String(instanceId));
    fd.append('kind', kind);
    fd.append('contactId', String(contactId));
    const res = await uploadsApi.upload(fd);
    const data = res.data ?? {};
    return {
      id: data.uploadId as number,
      blobUrl: data.url as string,
      kind,
      mimeType: file.type,
      filename: file.name,
      portfolioTypeId,
    } as EvidenceFile;
  };

  const handleAdd = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = async () => {
      const chosen = Array.from(input.files ?? []);
      if (chosen.length === 0) return;
      setBusy(true);
      setError('');
      try {
        // Single-file managers (SD/IF) replace the existing file.
        if (!multiple && files.length > 0) {
          for (const existing of files) {
            await uploadsApi.delete(existing.id).catch(() => {});
          }
          setFiles([]);
        }
        const toUpload = multiple ? chosen : chosen.slice(0, 1);
        const added: EvidenceFile[] = [];
        for (const file of toUpload) {
          // Compress images client-side before upload (keeps them light but readable).
          const prepared = file.type.startsWith('image/') ? await compressImage(file) : file;
          added.push(await uploadOne(prepared));
        }
        setFiles((prev) => (multiple ? [...prev, ...added] : added));
        onChanged();
      } catch (err: any) {
        setError(err?.response?.data?.message ?? err?.message ?? 'Upload failed.');
      } finally {
        setBusy(false);
      }
    };
    input.click();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this evidence file?')) return;
    setBusy(true);
    setError('');
    try {
      await uploadsApi.delete(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Delete failed.');
    } finally {
      setBusy(false);
    }
  };

  const addLabel = multiple ? 'Add Images' : files.length > 0 ? 'Replace File' : 'Upload File';
  const single = !multiple;
  const first = files[0];

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={single ? modalWide : modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
            <div style={{ fontSize: 13, color: '#6b7280' }}>{studentName}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button type="button" style={primaryBtn} onClick={handleAdd} disabled={busy}>
              {busy ? 'Working…' : addLabel}
            </button>
            {single && first && (
              <button type="button" style={deleteBtn} onClick={() => void handleDelete(first.id)} disabled={busy}>
                Delete
              </button>
            )}
            <button type="button" style={closeBtn} onClick={onClose} disabled={busy}>
              ✕
            </button>
          </div>
        </div>

        {error && <div style={errorBox}>{error}</div>}

        {single ? (
          !first ? (
            <div style={emptyBox}>No file uploaded yet. Use “{addLabel}”.</div>
          ) : isImage(first) ? (
            <img src={first.blobUrl} alt={first.filename ?? title} style={singleImg} />
          ) : (
            <iframe src={first.blobUrl} title={title} style={singleFrame} />
          )
        ) : files.length === 0 ? (
          <div style={emptyBox}>No evidence uploaded yet. Use “Add Images”.</div>
        ) : (
          <div style={grid}>
            {files.map((f) => (
              <div key={f.id} style={card}>
                <a href={f.blobUrl} target="_blank" rel="noreferrer" title="Open in new tab">
                  {isImage(f) ? (
                    <img src={f.blobUrl} alt={f.filename ?? 'evidence'} style={thumb} />
                  ) : (
                    <div style={docThumb}>PDF</div>
                  )}
                </a>
                <div style={fileName} title={f.filename ?? ''}>
                  {f.filename ?? `File #${f.id}`}
                </div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <a href={f.blobUrl} target="_blank" rel="noreferrer" style={linkBtn}>
                    Open
                  </a>
                  <button type="button" style={deleteBtn} onClick={() => void handleDelete(f.id)} disabled={busy}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
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
  padding: '40px 14px',
  overflow: 'auto',
};
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 10,
  maxWidth: 720,
  width: '100%',
  boxShadow: '0 20px 60px rgba(0,0,0,.35)',
  padding: 18,
  color: '#111827',
};
const modalWide: React.CSSProperties = { ...modal, maxWidth: 980 };
const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  paddingBottom: 12,
  marginBottom: 14,
  borderBottom: '1px solid #e5e7eb',
};
const primaryBtn: React.CSSProperties = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 14px',
  fontWeight: 600,
  cursor: 'pointer',
};
const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 18,
  cursor: 'pointer',
  color: '#64748b',
  lineHeight: 1,
};
const singleImg: React.CSSProperties = {
  display: 'block',
  maxWidth: '100%',
  maxHeight: '72vh',
  margin: '0 auto',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
};
const singleFrame: React.CSSProperties = {
  width: '100%',
  height: '72vh',
  border: '1px solid #e5e7eb',
  borderRadius: 6,
};
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 12,
  marginTop: 14,
};
const card: React.CSSProperties = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  padding: 8,
  textAlign: 'center',
};
const thumb: React.CSSProperties = {
  width: '100%',
  height: 120,
  objectFit: 'cover',
  borderRadius: 4,
  background: '#f3f4f6',
};
const docThumb: React.CSSProperties = {
  width: '100%',
  height: 120,
  borderRadius: 4,
  background: '#eef2ff',
  color: '#4338ca',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const fileName: React.CSSProperties = {
  fontSize: 11,
  color: '#4b5563',
  margin: '6px 0',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const linkBtn: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  textDecoration: 'none',
  color: '#374151',
};
const deleteBtn: React.CSSProperties = {
  fontSize: 12,
  padding: '3px 8px',
  border: '1px solid #fecaca',
  borderRadius: 4,
  background: '#fef2f2',
  color: '#b91c1c',
  cursor: 'pointer',
};
const emptyBox: React.CSSProperties = {
  padding: '18px',
  textAlign: 'center',
  color: '#6b7280',
  background: '#f9fafb',
  borderRadius: 8,
  marginTop: 12,
};
const errorBox: React.CSSProperties = {
  padding: '10px 12px',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#b91c1c',
  borderRadius: 8,
  margin: '10px 0',
};
