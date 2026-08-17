import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { lmsAdminApi, type KnowledgeEvidence, type Chapter, type LearningBlob } from '../api/lmsAdmin';
import { LmsRichTextEditor } from '../components/LmsRichTextEditor';
import { LmsVideoPlayer } from '../lms/components/media/LmsVideoPlayer';

function parseVideoInput(val: string): { azureBlobUrl: string; vimeoId: string } {
  const trimmed = val.trim();
  if (!trimmed) return { azureBlobUrl: '', vimeoId: '' };

  let target = trimmed;
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch) {
    target = iframeMatch[1];
  }

  const vimeoUrlMatch = target.match(/vimeo\.com\/(?:video\/)?([a-zA-Z0-9_\-?=&]+)/i);
  if (vimeoUrlMatch) {
    return { azureBlobUrl: '', vimeoId: vimeoUrlMatch[1] };
  }

  if (/^\d+(\?[a-zA-Z0-9_=&-]+)?$/.test(target)) {
    return { azureBlobUrl: '', vimeoId: target };
  }

  return { azureBlobUrl: target, vimeoId: '' };
}

export function LmsBlockEditorPage() {
  const { id } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const isEditing = Boolean(id && id !== 'new');

  // Form states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [vimeoId, setVimeoId] = useState('');
  const [azureBlobUrl, setAzureBlobUrl] = useState('');
  const [durationSeconds, setDurationSeconds] = useState(180);
  const [sortOrder, setSortOrder] = useState(0);
  const [chapterId, setChapterId] = useState<string>(searchParams.get('chapterId') || '');
  const [knowledgeEvidenceIds, setKnowledgeEvidenceIds] = useState<string[]>([]);

  const [existingBlob, setExistingBlob] = useState<LearningBlob | null>(null);

  // Metadata dropdowns
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [kes, setKes] = useState<KnowledgeEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Preview and Axcelerate Importer Modals
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importHtmlText, setImportHtmlText] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [chaptersRes, kesRes, blobsRes] = await Promise.all([
        lmsAdminApi.getChapters(),
        lmsAdminApi.getKEs(),
        lmsAdminApi.getBlobs(),
      ]);

      setChapters(chaptersRes.data || []);
      setKes(kesRes.data || []);

      if (isEditing) {
        const found = (blobsRes.data || []).find((b) => b.id === id);
        if (found) {
          setExistingBlob(found);
          setTitle(found.title);
          setDescription(found.description || '');
          setContentHtml(found.contentHtml || '');
          setVimeoId(found.vimeoId || '');
          setAzureBlobUrl(found.azureBlobUrl || '');
          setDurationSeconds(found.durationSeconds || 180);
          setSortOrder(found.sortOrder || 0);
          setChapterId(found.chapterId || '');
          setKnowledgeEvidenceIds(found.knowledgeEvidences?.map((k) => k.id) || []);
        } else {
          alert(`Content Block '${id}' not found`);
          navigate('/admin/lms');
        }
      } else {
        // Check if navigated from Axcelerate Import with prefilled state
        const state = location.state as any;
        if (state) {
          if (state.importedTitle) setTitle(state.importedTitle);
          if (state.importedVimeoId) setVimeoId(state.importedVimeoId);
          if (state.importedContentHtml) setContentHtml(state.importedContentHtml);
          if (state.importedCount !== undefined) {
            setMessage(`✓ Imported Axcelerate block! Migrated ${state.importedCount} image(s) to Azure Storage.`);
          }
        }

        // If creating new, preselect first KE if available
        if (kesRes.data && kesRes.data.length > 0) {
          setKnowledgeEvidenceIds([kesRes.data[0].id]);
        }
      }
    } catch (err: any) {
      console.error('Failed to load block editor data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Please enter a title for the content block');
      return;
    }

    setSaving(true);
    setMessage(null);

    const payload = {
      chapterId: chapterId || undefined,
      knowledgeEvidenceIds,
      title,
      description,
      contentHtml,
      vimeoId: vimeoId || undefined,
      azureBlobUrl: azureBlobUrl || undefined,
      durationSeconds,
      sortOrder,
    };

    try {
      if (isEditing && id) {
        const res = await lmsAdminApi.updateBlob(id, payload);
        if ((res.data as any)?.isNewVersion) {
          setMessage('🔒 Content Block was locked on a published plan. A new version was automatically created for draft plans!');
        } else {
          setMessage('Content Block updated successfully!');
        }
      } else {
        await lmsAdminApi.createBlob(payload);
        setMessage('Content Block created successfully!');
      }

      setTimeout(() => {
        navigate('/admin/lms');
      }, 1200);
    } catch (err: any) {
      alert(`Error saving Content Block: ${err?.response?.data?.message || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleImportAxcelerate = async () => {
    if (!importHtmlText.trim()) {
      alert('Please paste Axcelerate HTML code first');
      return;
    }

    setImporting(true);
    try {
      const res = await lmsAdminApi.importAxcelerateHtml(importHtmlText);
      const data = res.data;

      if (data.title && !title) {
        setTitle(data.title);
      }
      if (data.vimeoId) {
        setVimeoId(data.vimeoId);
      }
      if (data.contentHtml) {
        setContentHtml(data.contentHtml);
      }

      setImportModalOpen(false);
      setImportHtmlText('');
      setMessage(`✓ Axcelerate HTML imported & sanitized! Migrated ${data.migratedImagesCount} image(s) to Azure Storage.`);
    } catch (err: any) {
      alert(`Error importing Axcelerate HTML: ${err?.response?.data?.message || err.message}`);
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        Loading Content Block Editor...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 60 }}>
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, backgroundColor: '#ffffff', padding: '16px 20px', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={() => navigate('/admin/lms')}
            style={{ padding: '8px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}
          >
            ← Back to LMS Admin
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                {isEditing ? `Edit Content Block: ${title || 'Untitled'}` : 'Create New Content Block'}
              </h1>
              {existingBlob?.isLocked && (
                <span style={{ padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 12, fontWeight: 700, border: '1px solid #fde68a' }}>
                  🔒 Locked (v{existingBlob.version || 1})
                </span>
              )}
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Author atomic reading and video modules mapped to Knowledge Evidences (KEs).
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            style={{ padding: '8px 16px', backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            👁️ Preview Student View
          </button>
          <button
            type="button"
            onClick={() => setImportModalOpen(true)}
            style={{ padding: '8px 16px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            📥 Import Axcelerate HTML
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? 'Saving...' : 'Save Content Block'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{ padding: 14, backgroundColor: '#f0fdf4', color: '#15803d', borderRadius: 8, marginBottom: 20, border: '1px solid #bbf7d0', fontWeight: 600 }}>
          {message}
        </div>
      )}

      {/* Editor Main Centered Area */}
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Metadata Block */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
            Block Metadata & Mapping
          </h2>

          <label>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Block Title:</div>
            <input
              type="text"
              placeholder="e.g. DRSABCD & Primary Assessment Protocols"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Assign to Chapter (Optional):</div>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
              >
                <option value="">Unassigned (Standalone Block)</option>
                {chapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    📖 {ch.title}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Estimated Reading Time (seconds):</div>
              <input
                type="number"
                min={30}
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
              />
            </label>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Mapped Knowledge Evidences (KEs):</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 10, border: '1px solid #cbd5e1', borderRadius: 6, maxHeight: 140, overflowY: 'auto', backgroundColor: '#f8fafc' }}>
              {kes.map((k) => {
                const isChecked = knowledgeEvidenceIds.includes(k.id);
                return (
                  <label key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setKnowledgeEvidenceIds([...knowledgeEvidenceIds, k.id]);
                        } else {
                          setKnowledgeEvidenceIds(knowledgeEvidenceIds.filter((id) => id !== k.id));
                        }
                      }}
                    />
                    <span><strong>{k.code}</strong> &ndash; {k.title}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Azure Blob Video URL / Vimeo Embed / Vimeo ID:</div>
            <input
              type="text"
              placeholder="Paste Vimeo ID (e.g. 918974090?h=709bcc1633), iframe embed code, or Azure MP4 URL"
              value={vimeoId || azureBlobUrl}
              onChange={(e) => {
                const parsed = parseVideoInput(e.target.value);
                setAzureBlobUrl(parsed.azureBlobUrl);
                setVimeoId(parsed.vimeoId);
              }}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14 }}
            />
            {(vimeoId || azureBlobUrl) && (
              <div style={{ fontSize: 12, color: '#2563eb', marginTop: 4, fontWeight: 600 }}>
                {vimeoId ? `✓ Detected Vimeo ID: ${vimeoId}` : `✓ Detected Direct Video URL: ${azureBlobUrl}`}
              </div>
            )}
          </label>

          <label>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Block Summary / Description:</div>
            <textarea
              rows={2}
              placeholder="Brief summary shown to students in module overview..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13 }}
            />
          </label>
        </div>

        {/* TipTap Rich Text Editor */}
        <div style={{ backgroundColor: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 12px 0', color: '#1e293b' }}>
            Rich Text & Graphical HTML Content (TipTap Authoring)
          </h2>
          <LmsRichTextEditor content={contentHtml} onChange={(html) => setContentHtml(html)} />
        </div>
      </div>

      {/* ── MODAL: Preview Student View ────────────────────────────────────────── */}
      {previewModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: 10, padding: 24, maxWidth: 850, width: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                👁️ Student Portal Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Reading Module</span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    📦 {title || 'Untitled Block'}
                  </h3>
                </div>
              </div>

              {/* Mapped KE Badges */}
              {knowledgeEvidenceIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                  {knowledgeEvidenceIds.map((kId) => {
                    const kObj = kes.find((k) => k.id === kId);
                    return (
                      <span key={kId} style={{ padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid #bfdbfe' }}>
                        KE: {kObj?.code || 'KE'}
                      </span>
                    );
                  })}
                </div>
              )}

              {description && (
                <p style={{ fontSize: '0.92rem', color: '#475569', marginTop: 0, marginBottom: '1rem', fontStyle: 'italic' }}>
                  {description}
                </p>
              )}

              {/* Rendered HTML Content */}
              {contentHtml ? (
                <div
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                  style={{
                    padding: '1.25rem',
                    backgroundColor: '#ffffff',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.95rem',
                    lineHeight: 1.6,
                    marginBottom: '1rem',
                    color: '#1e293b',
                    overflowX: 'auto',
                  }}
                />
              ) : (
                <div style={{ padding: '1.5rem', border: '1px dashed #cbd5e1', borderRadius: 6, textAlign: 'center', color: '#94a3b8', fontStyle: 'italic', marginBottom: '1rem' }}>
                  No content typed yet. Close preview and start authoring.
                </div>
              )}

              {/* Video Player */}
              {(azureBlobUrl || vimeoId) && (
                <div style={{ marginBottom: '1rem' }}>
                  <LmsVideoPlayer title={title} azureBlobUrl={azureBlobUrl} vimeoId={vimeoId} />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: '#ffffff', cursor: 'pointer', fontWeight: 600 }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Import Axcelerate HTML ────────────────────────────────────────── */}
      {importModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: 10, padding: 24, maxWidth: 700, width: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #cbd5e1' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              📥 Import & Sanitize Axcelerate HTML Content Block
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 16px 0' }}>
              Paste raw HTML code copied from Axcelerate. The backend will automatically strip internal class names, remove `contenteditable` flags, extract Vimeo video embeds, download embedded images, and upload them directly to Azure Storage!
            </p>

            <textarea
              rows={12}
              placeholder="Paste raw Axcelerate HTML block code here..."
              value={importHtmlText}
              onChange={(e) => setImportHtmlText(e.target.value)}
              style={{ width: '100%', padding: 12, borderRadius: 6, border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.4 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #ccc', background: '#ffffff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportAxcelerate}
                disabled={importing || !importHtmlText.trim()}
                style={{ padding: '8px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
              >
                {importing ? 'Sanitizing & Migrating Assets...' : 'Sanitize & Migrate to Azure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
