import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { useSession } from '../contexts/SessionContext';
import { lmsApi } from '../services/lmsApi';
import { LmsVideoPlayer } from '../components/media/LmsVideoPlayer';
import { AssessmentContainer } from '../components/assessment/AssessmentContainer';

interface ContentBlock {
  id: string;
  title: string;
  description?: string;
  contentHtml?: string;
  vimeoId?: string | null;
  azureBlobUrl?: string | null;
  durationSeconds: number;
  status: 'unread' | 'viewed' | 'competent' | 'needs_review';
  knowledgeEvidences?: Array<{ id: string; code: string; title: string }>;
}

interface Chapter {
  id: string;
  title: string;
  description?: string;
  sortOrder: number;
  blobs: ContentBlock[];
}

export function LmsLearnDashboard() {
  const { enrollment, unit } = useSession();
  const navigate = useNavigate();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAssessmentMode, setIsAssessmentMode] = useState(false);
  const [expandedChapters, setChaptersExpanded] = useState<Record<string, boolean>>({});
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  useEffect(() => {
    if (!enrollment) {
      navigate('/lms');
      return;
    }

    loadContent();
  }, [enrollment, navigate]);

  const loadContent = async () => {
    if (!enrollment) return;
    try {
      setLoading(true);
      const data = await lmsApi.getEnrollmentContent(enrollment.id);
      setChapters(data.chapters);

      // Default expand all chapters
      const map: Record<string, boolean> = {};
      data.chapters.forEach((ch) => {
        map[ch.id] = true;
      });
      setChaptersExpanded(map);
    } catch (err) {
      console.error('Failed to load course content:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChapter = (chapterId: string) => {
    setChaptersExpanded((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const handleToggleBlockReviewed = async (blockId: string, durationSeconds: number, markCompleted: boolean) => {
    if (!enrollment) return;
    try {
      await lmsApi.recordBlobView(enrollment.id, blockId, durationSeconds, markCompleted);
      await loadContent(); // Reload updated statuses
    } catch (err) {
      console.error('Failed to toggle block reviewed status:', err);
    }
  };

  const handleDownloadPdf = () => {
    if (!unit) return;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(20);
    doc.setTextColor(30, 58, 138); // #1e3a8a
    doc.text(`${unit.unitCode} - Learner Study Guide`, 14, y);
    y += 10;

    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text(unit.title, 14, y);
    y += 15;

    chapters.forEach((ch, chIdx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(`Chapter ${chIdx + 1}: ${ch.title}`, 14, y);
      y += 8;

      ch.blobs.forEach((b) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(37, 99, 235);
        doc.text(`• ${b.title}`, 18, y);
        y += 6;

        if (b.description) {
          doc.setFontSize(10);
          doc.setTextColor(71, 85, 105);
          const lines = doc.splitTextToSize(b.description, 170);
          doc.text(lines, 22, y);
          y += lines.length * 5 + 4;
        }
      });

      y += 6;
    });

    doc.save(`${unit.unitCode}_Learner_Guide.pdf`);
  };

  const renderReviewedCheckbox = (b: ContentBlock) => {
    const isReviewed = b.status === 'viewed' || b.status === 'competent';
    return (
      <label
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          backgroundColor: isReviewed ? '#f0fdf4' : '#ffffff',
          border: `1.5px solid ${isReviewed ? '#86efac' : '#cbd5e1'}`,
          borderRadius: 8,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 14,
          color: isReviewed ? '#166534' : '#334155',
          userSelect: 'none',
          transition: 'all 0.15s ease-in-out',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <input
          type="checkbox"
          checked={isReviewed}
          onChange={(e) => handleToggleBlockReviewed(b.id, b.durationSeconds, e.target.checked)}
          style={{
            width: 18,
            height: 18,
            accentColor: '#16a34a',
            cursor: 'pointer',
          }}
        />
        <span>{isReviewed ? '✓ Reviewed & Completed' : 'Mark as Reviewed'}</span>
      </label>
    );
  };

  if (!enrollment || !unit) return null;

  if (isAssessmentMode) {
    return (
      <div>
        <div style={{ padding: '1rem', backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => setIsAssessmentMode(false)}
            style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
          >
            ← Back to Learning Dashboard
          </button>
          <span style={{ fontWeight: 700, color: '#1e3a8a' }}>Fast-Track Assessment Mode</span>
        </div>
        <AssessmentContainer />
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e3a8a' }}>Loading course learning tree...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '60rem', margin: '2rem auto', padding: '0 1rem' }}>
      {/* Top Back to Main Dashboard Navigation */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 16px',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            border: '1px solid #cbd5e1',
            borderRadius: '0.375rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
        >
          ← Back to Main Dashboard
        </button>
      </div>

      {/* Header */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '1rem', padding: '2rem', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
              Enrolled Unit
            </span>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1e3a8a', margin: '4px 0' }}>
              {unit.unitCode} - {unit.title}
            </h1>
            <p style={{ fontSize: '1rem', color: '#4b5563', margin: 0 }}>
              Read modules sequentially or launch Fast-Track assessment anytime.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsAssessmentMode(true)}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(37,99,235,0.2)',
              }}
            >
              ⚡ Fast-Track Assessment
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              style={{
                padding: '0.75rem 1.25rem',
                backgroundColor: '#ffffff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📥 Download Learner Guide (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* 2-Layer Tree View: Chapters -> Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {chapters.map((ch, chIdx) => {
          const isExpanded = expandedChapters[ch.id];
          const filteredBlobs = ch.blobs;

          return (
            <div
              key={ch.id}
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '0.75rem',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              }}
            >
              {/* Chapter Header */}
              <div
                onClick={() => handleToggleChapter(ch.id)}
                style={{
                  padding: '1.25rem 1.5rem',
                  backgroundColor: '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>
                    Chapter {chIdx + 1}
                  </span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#0f172a', margin: '2px 0 0 0' }}>
                    {ch.title}
                  </h3>
                  {ch.description && <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '2px 0 0 0' }}>{ch.description}</p>}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                    {filteredBlobs.length} modules
                  </span>
                  <span style={{ fontSize: '1.25rem', color: '#64748b' }}>{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Content Blocks */}
              {isExpanded && (
                <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {filteredBlobs.map((b) => {
                    const isBlockExpanded = expandedBlockId === b.id;

                    let badgeColor = '#6b7280';
                    let badgeBg = '#f3f4f6';
                    let badgeText = '⚪ Unread';

                    if (b.status === 'competent') {
                      badgeColor = '#15803d';
                      badgeBg = '#f0fdf4';
                      badgeText = '🟢 Competent';
                    } else if (b.status === 'needs_review') {
                      badgeColor = '#dc2626';
                      badgeBg = '#fef2f2';
                      badgeText = '🔴 Needs Review';
                    } else if (b.status === 'viewed') {
                      badgeColor = '#1d4ed8';
                      badgeBg = '#eff6ff';
                      badgeText = '🔵 Viewed';
                    }

                    return (
                      <div
                        key={b.id}
                        style={{
                          borderRadius: '0.5rem',
                          border: `1px solid ${b.status === 'needs_review' ? '#fca5a5' : '#e2e8f0'}`,
                          backgroundColor: b.status === 'needs_review' ? '#fff5f5' : '#ffffff',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Block Header */}
                        <div
                          onClick={() => setExpandedBlockId(isBlockExpanded ? null : b.id)}
                          style={{
                            padding: '1rem 1.25rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>
                              📦 {b.title}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ padding: '4px 10px', borderRadius: 20, backgroundColor: badgeBg, color: badgeColor, fontSize: '0.8rem', fontWeight: 'bold' }}>
                              {badgeText}
                            </span>
                            <span style={{ fontSize: '1rem', color: '#94a3b8' }}>{isBlockExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {/* Block Expanded View (Rich Text + Video) */}
                        {isBlockExpanded && (
                          <div style={{ padding: '1.25rem', borderTop: '1px solid #f1f5f9', backgroundColor: '#fafafa' }}>
                            {/* Top Mark as Reviewed Checkbox */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                              {renderReviewedCheckbox(b)}
                            </div>

                            {b.description && <p style={{ fontSize: '0.95rem', color: '#475569', marginBottom: '1rem' }}>{b.description}</p>}

                            {(b.azureBlobUrl || b.vimeoId) && (
                              <div style={{ marginBottom: '1rem' }}>
                                <LmsVideoPlayer
                                  title={b.title}
                                  azureBlobUrl={b.azureBlobUrl}
                                  vimeoId={b.vimeoId}
                                  onCompleted={() => handleToggleBlockReviewed(b.id, b.durationSeconds, true)}
                                />
                              </div>
                            )}

                            {b.contentHtml && (
                              <div
                                dangerouslySetInnerHTML={{ __html: b.contentHtml }}
                                style={{
                                  padding: '1rem',
                                  backgroundColor: '#ffffff',
                                  borderRadius: '0.5rem',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '1rem',
                                  lineHeight: 1.6,
                                  marginBottom: '1rem',
                                }}
                              />
                            )}

                            {/* Bottom Mark as Reviewed Checkbox */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                              {renderReviewedCheckbox(b)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
