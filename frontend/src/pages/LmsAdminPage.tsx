import { useState, useEffect } from 'react';
import { lmsAdminApi, type KnowledgeEvidence, type Chapter, type LearningBlob, type QuestionBankItem, type LearningPlan } from '../api/lmsAdmin';
import { settingsApi } from '../api';
import { QuestionType } from '../lms/types/lms';

export function LmsAdminPage() {
  const [activeTab, setActiveTab] = useState<'ke' | 'content' | 'questions' | 'plans'>('ke');
  const [courseCodes, setCourseCodes] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Data states
  const [kes, setKes] = useState<KnowledgeEvidence[]>([]);
  const [selectedCourseCodeId, setSelectedCourseCodeId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [plans, setPlans] = useState<LearningPlan[]>([]);

  // Modals & Form states
  const [keModal, setKeModal] = useState<{ open: boolean; item?: KnowledgeEvidence | null }>({ open: false });
  const [keForm, setKeForm] = useState<{ code: string; title: string; description: string; courseCodeIds: number[] }>({
    code: '',
    title: '',
    description: '',
    courseCodeIds: [],
  });

  const [chapterModal, setChapterModal] = useState<{ open: boolean; item?: Chapter | null }>({ open: false });
  const [chapterForm, setChapterForm] = useState<{ title: string; description: string; sortOrder: number }>({
    title: '',
    description: '',
    sortOrder: 0,
  });

  const [blobModal, setBlobModal] = useState<{ open: boolean; chapterId?: string; item?: LearningBlob | null }>({ open: false });
  const [blobForm, setBlobForm] = useState<{
    chapterId: string;
    knowledgeEvidenceId: string;
    title: string;
    description: string;
    contentHtml: string;
    vimeoId: string;
    azureBlobUrl: string;
    durationSeconds: number;
    sortOrder: number;
  }>({
    chapterId: '',
    knowledgeEvidenceId: '',
    title: '',
    description: '',
    contentHtml: '',
    vimeoId: '',
    azureBlobUrl: '',
    durationSeconds: 0,
    sortOrder: 0,
  });

  const [questionModal, setQuestionModal] = useState<{ open: boolean; item?: QuestionBankItem | null }>({ open: false });
  const [questionForm, setQuestionForm] = useState<{
    type: number;
    questionText: string;
    benchmarkAnswer: string;
    points: number;
    knowledgeEvidenceId: string;
    coreLearningBlobId: string;
    // Fill in blanks builder fields
    template: string;
    blanksJson: string; // JSON string of blanks with distractors
    // Multiple choice builder
    optionsText: string; // comma separated
    correctOption: string;
  }>({
    type: QuestionType.MultipleChoiceSingle,
    questionText: '',
    benchmarkAnswer: '',
    points: 1,
    knowledgeEvidenceId: '',
    coreLearningBlobId: '',
    template: 'During CPR, perform {0} compressions at a depth of {1}, followed by {2} rescue breaths.',
    blanksJson: JSON.stringify([
      { index: 0, hint: 'compressions', options: ['15', '30', '50'] },
      { index: 1, hint: 'depth', options: ['2 cm', '5-6 cm', '10 cm'] },
      { index: 2, hint: 'rescue breaths', options: ['1', '2', '5'] },
    ], null, 2),
    optionsText: 'Option A, Option B, Option C, Option D',
    correctOption: 'Option B',
  });

  const [planModal, setPlanModal] = useState<{ open: boolean; item?: LearningPlan | null }>({ open: false });
  const [planForm, setPlanForm] = useState<{
    courseCodeId: number;
    version: string;
    title: string;
    description: string;
    isDefault: boolean;
    selectedQuestionIds: string[];
  }>({
    courseCodeId: 0,
    version: 'v1.0',
    title: '',
    description: '',
    isDefault: true,
    selectedQuestionIds: [],
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const courseCodesRes = await settingsApi.getCourseCodes();
      const codes = courseCodesRes.data || [];
      setCourseCodes(codes);
      if (codes.length > 0) {
        setSelectedCourseCodeId(codes[0].id);
        loadChapters(codes[0].id);
      }

      await Promise.all([loadKEs(), loadQuestions(), loadPlans()]);
    } catch (err: any) {
      console.error('Failed to load LMS admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadKEs = async () => {
    const res = await lmsAdminApi.getKEs();
    setKes(res.data || []);
  };

  const loadChapters = async (courseCodeId: number) => {
    const res = await lmsAdminApi.getChapters(courseCodeId);
    setChapters(res.data || []);
  };

  const loadQuestions = async () => {
    const res = await lmsAdminApi.getQuestions();
    setQuestions(res.data || []);
  };

  const loadPlans = async () => {
    const res = await lmsAdminApi.getPlans();
    setPlans(res.data || []);
  };

  // ── KE Actions ────────────────────────────────────────────────────────────────
  const handleOpenKeModal = (ke?: KnowledgeEvidence) => {
    if (ke) {
      setKeForm({
        code: ke.code,
        title: ke.title,
        description: ke.description || '',
        courseCodeIds: ke.courseCodes?.map((c) => c.id) || [],
      });
      setKeModal({ open: true, item: ke });
    } else {
      setKeForm({ code: '', title: '', description: '', courseCodeIds: courseCodes.map((c) => c.id) });
      setKeModal({ open: true, item: null });
    }
  };

  const handleSaveKe = async () => {
    try {
      if (keModal.item) {
        await lmsAdminApi.updateKE(keModal.item.id, keForm);
      } else {
        await lmsAdminApi.createKE(keForm);
      }
      setKeModal({ open: false });
      await loadKEs();
      setMessage('Knowledge Evidence saved successfully!');
    } catch (err: any) {
      alert(`Error saving KE: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDeleteKe = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Knowledge Evidence item?')) return;
    try {
      await lmsAdminApi.deleteKE(id);
      await loadKEs();
    } catch (err: any) {
      alert(`Error deleting KE: ${err.message}`);
    }
  };

  // ── Chapter Actions ───────────────────────────────────────────────────────────
  const handleOpenChapterModal = (chapter?: Chapter) => {
    if (chapter) {
      setChapterForm({ title: chapter.title, description: chapter.description || '', sortOrder: chapter.sortOrder });
      setChapterModal({ open: true, item: chapter });
    } else {
      setChapterForm({ title: '', description: '', sortOrder: chapters.length + 1 });
      setChapterModal({ open: true, item: null });
    }
  };

  const handleSaveChapter = async () => {
    if (!selectedCourseCodeId) return;
    try {
      if (chapterModal.item) {
        await lmsAdminApi.updateChapter(chapterModal.item.id, chapterForm);
      } else {
        await lmsAdminApi.createChapter({ ...chapterForm, courseCodeId: selectedCourseCodeId });
      }
      setChapterModal({ open: false });
      await loadChapters(selectedCourseCodeId);
    } catch (err: any) {
      alert(`Error saving Chapter: ${err.message}`);
    }
  };

  const handleDeleteChapter = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Chapter and its content blocks?')) return;
    try {
      await lmsAdminApi.deleteChapter(id);
      if (selectedCourseCodeId) loadChapters(selectedCourseCodeId);
    } catch (err: any) {
      alert(`Error deleting Chapter: ${err.message}`);
    }
  };

  // ── Blob (Content Block) Actions ─────────────────────────────────────────────
  const handleOpenBlobModal = (chapterId: string, blob?: LearningBlob) => {
    if (blob) {
      setBlobForm({
        chapterId,
        knowledgeEvidenceId: blob.knowledgeEvidenceId || '',
        title: blob.title,
        description: blob.description || '',
        contentHtml: blob.contentHtml || '',
        vimeoId: blob.vimeoId || '',
        azureBlobUrl: blob.azureBlobUrl || '',
        durationSeconds: blob.durationSeconds || 0,
        sortOrder: blob.sortOrder || 0,
      });
      setBlobModal({ open: true, chapterId, item: blob });
    } else {
      setBlobForm({
        chapterId,
        knowledgeEvidenceId: '',
        title: '',
        description: '',
        contentHtml: '',
        vimeoId: '',
        azureBlobUrl: '',
        durationSeconds: 180,
        sortOrder: 1,
      });
      setBlobModal({ open: true, chapterId, item: null });
    }
  };

  const handleSaveBlob = async () => {
    try {
      if (blobModal.item) {
        await lmsAdminApi.updateBlob(blobModal.item.id, blobForm);
      } else {
        await lmsAdminApi.createBlob(blobForm);
      }
      setBlobModal({ open: false });
      if (selectedCourseCodeId) loadChapters(selectedCourseCodeId);
    } catch (err: any) {
      alert(`Error saving Content Block: ${err.message}`);
    }
  };

  const handleDeleteBlob = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Content Block?')) return;
    try {
      await lmsAdminApi.deleteBlob(id);
      if (selectedCourseCodeId) loadChapters(selectedCourseCodeId);
    } catch (err: any) {
      alert(`Error deleting Content Block: ${err.message}`);
    }
  };

  // ── Question Actions ─────────────────────────────────────────────────────────
  const handleOpenQuestionModal = (q?: QuestionBankItem) => {
    if (q) {
      setQuestionForm({
        type: q.type,
        questionText: q.questionText,
        benchmarkAnswer: q.benchmarkAnswer || '',
        points: q.points,
        knowledgeEvidenceId: q.knowledgeEvidenceId || '',
        coreLearningBlobId: q.coreLearningBlobId || '',
        template: q.questionData?.template || q.questionText,
        blanksJson: JSON.stringify(q.questionData?.blanks || [], null, 2),
        optionsText: q.questionData?.options?.join(', ') || '',
        correctOption: q.correctAnswer?.answer || '',
      });
      setQuestionModal({ open: true, item: q });
    } else {
      setQuestionForm({
        type: QuestionType.MultipleChoiceSingle,
        questionText: '',
        benchmarkAnswer: '',
        points: 1,
        knowledgeEvidenceId: kes[0]?.id || '',
        coreLearningBlobId: '',
        template: 'During CPR, perform {0} compressions at a depth of {1}, followed by {2} rescue breaths.',
        blanksJson: JSON.stringify([
          { index: 0, hint: 'compressions', options: ['15', '30', '50'] },
          { index: 1, hint: 'depth', options: ['2 cm', '5-6 cm', '10 cm'] },
          { index: 2, hint: 'rescue breaths', options: ['1', '2', '5'] },
        ], null, 2),
        optionsText: 'Option A, Option B, Option C, Option D',
        correctOption: 'Option B',
      });
      setQuestionModal({ open: true, item: null });
    }
  };

  const handleSaveQuestion = async () => {
    try {
      let questionData: any = {};
      let correctAnswer: any = {};

      if (questionForm.type === QuestionType.FillInBlanks) {
        let blanks = [];
        try {
          blanks = JSON.parse(questionForm.blanksJson);
        } catch {
          alert('Invalid JSON in Blanks configuration');
          return;
        }
        questionData = { template: questionForm.template, blanks };
        // Extract correct answers from first option of each blank or specified answer
        correctAnswer = { blanks: blanks.map((b: any) => b.options?.[0] || '30') };
      } else if (questionForm.type === QuestionType.MultipleChoiceSingle) {
        const options = questionForm.optionsText.split(',').map((s) => s.trim()).filter(Boolean);
        questionData = { options };
        correctAnswer = { answer: questionForm.correctOption || options[0] };
      } else {
        questionData = { info: 'Standard Question' };
        correctAnswer = { answer: 'A' };
      }

      const payload = {
        type: questionForm.type,
        questionText: questionForm.questionText || questionForm.template,
        questionData,
        correctAnswer,
        benchmarkAnswer: questionForm.benchmarkAnswer,
        points: questionForm.points,
        knowledgeEvidenceId: questionForm.knowledgeEvidenceId || undefined,
        coreLearningBlobId: questionForm.coreLearningBlobId || undefined,
      };

      if (questionModal.item) {
        await lmsAdminApi.updateQuestion(questionModal.item.id, payload);
      } else {
        await lmsAdminApi.createQuestion(payload);
      }

      setQuestionModal({ open: false });
      await loadQuestions();
    } catch (err: any) {
      alert(`Error saving Question: ${err.message}`);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await lmsAdminApi.deleteQuestion(id);
      await loadQuestions();
    } catch (err: any) {
      alert(`Error deleting question: ${err.message}`);
    }
  };

  // ── Plan Actions ─────────────────────────────────────────────────────────────
  const handleOpenPlanModal = (plan?: LearningPlan) => {
    if (plan) {
      setPlanForm({
        courseCodeId: plan.courseCodeId,
        version: plan.version,
        title: plan.title,
        description: plan.description || '',
        isDefault: plan.isDefault,
        selectedQuestionIds: plan.planQuestions?.map((pq) => pq.questionId) || [],
      });
      setPlanModal({ open: true, item: plan });
    } else {
      setPlanForm({
        courseCodeId: courseCodes[0]?.id || 0,
        version: 'v1.0',
        title: `${courseCodes[0]?.code || 'HLTAID011'} Standard Plan v1.0`,
        description: 'Default theory assessment plan',
        isDefault: true,
        selectedQuestionIds: questions.map((q) => q.id),
      });
      setPlanModal({ open: true, item: null });
    }
  };

  const handleSavePlan = async () => {
    try {
      let planId: number;
      if (planModal.item) {
        await lmsAdminApi.updatePlan(planModal.item.id, {
          title: planForm.title,
          description: planForm.description,
          isDefault: planForm.isDefault,
        });
        planId = planModal.item.id;
      } else {
        const created = await lmsAdminApi.createPlan({
          courseCodeId: planForm.courseCodeId,
          version: planForm.version,
          title: planForm.title,
          description: planForm.description,
          isDefault: planForm.isDefault,
        });
        planId = created.data.id;
      }

      // Link selected questions
      const items = planForm.selectedQuestionIds.map((qId, idx) => ({
        questionId: qId,
        sortOrder: idx + 1,
        points: questions.find((q) => q.id === qId)?.points || 1,
      }));

      await lmsAdminApi.setPlanQuestions(planId, items);
      setPlanModal({ open: false });
      await loadPlans();
    } catch (err: any) {
      alert(`Error saving Learning Plan: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#0f172a' }}>LMS Management</h1>
          <p style={{ color: '#64748b', marginTop: 4 }}>
            Manage Knowledge Evidence (KEs), Course Chapters, Content Blocks, Question Bank, and Learning Plans.
          </p>
        </div>
      </div>

      {message && (
        <div style={{ padding: 12, backgroundColor: '#f0fdf4', color: '#15803d', borderRadius: 8, marginBottom: 20, border: '1px solid #bbf7d0' }}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 12, borderBottom: '2px solid #e2e8f0', marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setActiveTab('ke')}
          style={{
            padding: '10px 20px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'ke' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'ke' ? '#2563eb' : '#64748b',
            background: 'none',
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          📜 Knowledge Evidence ({kes.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('content')}
          style={{
            padding: '10px 20px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'content' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'content' ? '#2563eb' : '#64748b',
            background: 'none',
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          📚 Chapters & Content Blocks
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          style={{
            padding: '10px 20px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'questions' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'questions' ? '#2563eb' : '#64748b',
            background: 'none',
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          ❓ Question Bank ({questions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('plans')}
          style={{
            padding: '10px 20px',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'plans' ? '3px solid #2563eb' : '3px solid transparent',
            color: activeTab === 'plans' ? '#2563eb' : '#64748b',
            background: 'none',
            cursor: 'pointer',
            fontSize: 15,
          }}
        >
          📋 Learning Plans ({plans.length})
        </button>
      </div>

      {/* ── TAB 1: Knowledge Evidence (KE) ────────────────────────────────────────── */}
      {activeTab === 'ke' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Knowledge Evidence Items</h2>
            <button
              type="button"
              onClick={() => handleOpenKeModal()}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Knowledge Evidence
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Code</th>
                  <th style={{ padding: '12px 16px' }}>Title & Description</th>
                  <th style={{ padding: '12px 16px' }}>Course Codes</th>
                  <th style={{ padding: '12px 16px' }}>Mapped Items</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {kes.map((ke) => (
                  <tr key={ke.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e3a8a' }}>{ke.code}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600 }}>{ke.title}</div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>{ke.description}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {ke.courseCodes?.map((c) => (
                        <span key={c.id} style={{ display: 'inline-block', padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 12, marginRight: 4 }}>
                          {c.code}
                        </span>
                      ))}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>
                      📦 {ke._count?.blobs || 0} blocks | ❓ {ke._count?.questions || 0} questions
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button type="button" onClick={() => handleOpenKeModal(ke)} style={{ padding: '4px 8px', marginRight: 6, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                      <button type="button" onClick={() => handleDeleteKe(ke.id)} style={{ padding: '4px 8px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: Chapters & Content Blocks ───────────────────────────────────────── */}
      {activeTab === 'content' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ fontWeight: 600, fontSize: 14 }}>Select Course:</label>
              <select
                value={selectedCourseCodeId || ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedCourseCodeId(id);
                  loadChapters(id);
                }}
                style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600 }}
              >
                {courseCodes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleOpenChapterModal()}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Chapter
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {chapters.map((ch, idx) => (
              <div key={ch.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>Chapter {idx + 1}</span>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0 0', color: '#0f172a' }}>{ch.title}</h3>
                    {ch.description && <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{ch.description}</p>}
                  </div>
                  <div>
                    <button type="button" onClick={() => handleOpenBlobModal(ch.id)} style={{ padding: '6px 12px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 6, fontWeight: 600, cursor: 'pointer', marginRight: 8 }}>+ Add Content Block</button>
                    <button type="button" onClick={() => handleOpenChapterModal(ch)} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', marginRight: 8 }}>Edit</button>
                    <button type="button" onClick={() => handleDeleteChapter(ch.id)} style={{ padding: '6px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
                  </div>
                </div>

                {/* Blocks inside Chapter */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {ch.blobs?.map((b) => (
                    <div key={b.id} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>
                          📦 {b.title}
                          {b.knowledgeEvidence && (
                            <span style={{ marginLeft: 8, padding: '2px 6px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 11 }}>
                              KE: {b.knowledgeEvidence.code}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{b.description}</div>
                      </div>
                      <div>
                        <button type="button" onClick={() => handleOpenBlobModal(ch.id, b)} style={{ padding: '4px 8px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', marginRight: 6 }}>Edit Block</button>
                        <button type="button" onClick={() => handleDeleteBlob(b.id)} style={{ padding: '4px 8px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: Question Bank ───────────────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Question Bank</h2>
            <button
              type="button"
              onClick={() => handleOpenQuestionModal()}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              + Create Question
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Type</th>
                  <th style={{ padding: '12px 16px' }}>Question Text / Template</th>
                  <th style={{ padding: '12px 16px' }}>Knowledge Evidence</th>
                  <th style={{ padding: '12px 16px' }}>Points</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                        Type #{q.type}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{q.questionText}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {q.knowledgeEvidence ? (
                        <span style={{ padding: '2px 6px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: 4, fontSize: 12 }}>
                          {q.knowledgeEvidence.code}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 700 }}>{q.points} pt</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button type="button" onClick={() => handleOpenQuestionModal(q)} style={{ padding: '4px 8px', marginRight: 6, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                      <button type="button" onClick={() => handleDeleteQuestion(q.id)} style={{ padding: '4px 8px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 4: Learning Plans ─────────────────────────────────────────────────── */}
      {activeTab === 'plans' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Versioned Learning Plans</h2>
            <button
              type="button"
              onClick={() => handleOpenPlanModal()}
              style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
            >
              + Create Learning Plan Version
            </button>
          </div>

          <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Course</th>
                  <th style={{ padding: '12px 16px' }}>Version & Title</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Questions</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e3a8a' }}>{p.courseCode?.code}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 700 }}>
                        {p.version} {p.isDefault && <span style={{ padding: '2px 6px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: 4, fontSize: 11 }}>DEFAULT</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>{p.title}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', backgroundColor: p.status === 'PUBLISHED' ? '#f0fdf4' : '#fffbe2', color: p.status === 'PUBLISHED' ? '#15803d' : '#a16207', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>
                      ❓ {p.planQuestions?.length || 0} questions assigned
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button type="button" onClick={() => handleOpenPlanModal(p)} style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>Edit Plan</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL: KE ────────────────────────────────────────────────────────────── */}
      {keModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 500, width: '100%' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{keModal.item ? 'Edit Knowledge Evidence' : 'Add Knowledge Evidence'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Code (e.g. KE01):</div>
                <input type="text" value={keForm.code} onChange={(e) => setKeForm({ ...keForm, code: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Title:</div>
                <input type="text" value={keForm.title} onChange={(e) => setKeForm({ ...keForm, title: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Description:</div>
                <textarea rows={3} value={keForm.description} onChange={(e) => setKeForm({ ...keForm, description: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setKeModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSaveKe} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save KE</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Chapter ───────────────────────────────────────────────────────── */}
      {chapterModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 500, width: '100%' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{chapterModal.item ? 'Edit Chapter' : 'Add Chapter'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Chapter Title:</div>
                <input type="text" value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Description:</div>
                <textarea rows={3} value={chapterForm.description} onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setChapterModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSaveChapter} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save Chapter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Learning Blob ─────────────────────────────────────────────────── */}
      {blobModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 600, width: '100%' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{blobModal.item ? 'Edit Content Block' : 'Add Content Block'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Title:</div>
                <input type="text" value={blobForm.title} onChange={(e) => setBlobForm({ ...blobForm, title: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Mapped Knowledge Evidence (KE):</div>
                <select value={blobForm.knowledgeEvidenceId} onChange={(e) => setBlobForm({ ...blobForm, knowledgeEvidenceId: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="">-- Unassigned --</option>
                  {kes.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.code} - {k.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Azure Blob Video URL / Vimeo ID:</div>
                <input type="text" placeholder="https://myazureblob.net/video.mp4 or Vimeo ID" value={blobForm.azureBlobUrl || blobForm.vimeoId} onChange={(e) => setBlobForm({ ...blobForm, azureBlobUrl: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Text / Graphic Content (HTML):</div>
                <textarea rows={4} value={blobForm.contentHtml} onChange={(e) => setBlobForm({ ...blobForm, contentHtml: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setBlobModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSaveBlob} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save Block</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Question ──────────────────────────────────────────────────────── */}
      {questionModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 650, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{questionModal.item ? 'Edit Question' : 'Create Question'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Question Type:</div>
                <select value={questionForm.type} onChange={(e) => setQuestionForm({ ...questionForm, type: Number(e.target.value) })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value={QuestionType.MultipleChoiceSingle}>1. Multiple Choice (Single)</option>
                  <option value={QuestionType.MultipleChoiceMultiple}>2. Multiple Choice (Multiple)</option>
                  <option value={QuestionType.OrderItems}>3. Order Items</option>
                  <option value={QuestionType.MatchDefinitions}>4. Match Definitions</option>
                  <option value={QuestionType.FillInBlanks}>5. Fill in Blanks (Inline Dropdowns)</option>
                  <option value={QuestionType.FreeText}>6. Free Text (AI Vector Evaluated)</option>
                  <option value={QuestionType.Forms}>7. Forms</option>
                </select>
              </label>

              {questionForm.type === QuestionType.FillInBlanks ? (
                <>
                  <label>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Sentence Template (use &#123;0&#125;, &#123;1&#125; for inline dropdowns):</div>
                    <textarea rows={3} value={questionForm.template} onChange={(e) => setQuestionForm({ ...questionForm, template: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                  </label>
                  <label>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Dropdown Blanks & Distractors Configuration (JSON):</div>
                    <textarea rows={6} value={questionForm.blanksJson} onChange={(e) => setQuestionForm({ ...questionForm, blanksJson: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', fontFamily: 'monospace' }} />
                  </label>
                </>
              ) : (
                <label>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Question Text:</div>
                  <textarea rows={3} value={questionForm.questionText} onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                </label>
              )}

              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Mapped Knowledge Evidence (KE):</div>
                <select value={questionForm.knowledgeEvidenceId} onChange={(e) => setQuestionForm({ ...questionForm, knowledgeEvidenceId: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="">-- Unassigned --</option>
                  {kes.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.code} - {k.title}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Benchmark Model Answer (for AI Vector Matching):</div>
                <textarea rows={2} value={questionForm.benchmarkAnswer} onChange={(e) => setQuestionForm({ ...questionForm, benchmarkAnswer: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setQuestionModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSaveQuestion} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save Question</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Plan ──────────────────────────────────────────────────────────── */}
      {planModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 650, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{planModal.item ? 'Edit Learning Plan' : 'Create Learning Plan Version'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Course Code:</div>
                <select value={planForm.courseCodeId} onChange={(e) => setPlanForm({ ...planForm, courseCodeId: Number(e.target.value) })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}>
                  {courseCodes.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Version Identifier (e.g. v1.0, v1.1):</div>
                <input type="text" value={planForm.version} onChange={(e) => setPlanForm({ ...planForm, version: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Plan Title:</div>
                <input type="text" value={planForm.title} onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Select Questions for this Plan Version:</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ccc', padding: 8, borderRadius: 4 }}>
                  {questions.map((q) => {
                    const isChecked = planForm.selectedQuestionIds.includes(q.id);
                    return (
                      <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setPlanForm({ ...planForm, selectedQuestionIds: planForm.selectedQuestionIds.filter((id) => id !== q.id) });
                            } else {
                              setPlanForm({ ...planForm, selectedQuestionIds: [...planForm.selectedQuestionIds, q.id] });
                            }
                          }}
                        />
                        <span>{q.questionText}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setPlanModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSavePlan} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save Plan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
