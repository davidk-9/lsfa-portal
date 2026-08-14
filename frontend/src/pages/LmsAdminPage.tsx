import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { lmsAdminApi, type KnowledgeEvidence, type Chapter, type LearningBlob, type QuestionBankItem, type QuestionBank, type LearningPlan } from '../api/lmsAdmin';
import { settingsApi } from '../api';
import { QuestionType } from '../lms/types/lms';
import { LmsVideoPlayer } from '../lms/components/media/LmsVideoPlayer';

function parseVideoInput(val: string): { azureBlobUrl: string; vimeoId: string } {
  const trimmed = val.trim();
  if (!trimmed) return { azureBlobUrl: '', vimeoId: '' };

  let target = trimmed;
  // 1. If full <iframe ... src="..."> snippet is pasted
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch) {
    target = iframeMatch[1];
  }

  // 2. Check if Vimeo URL (e.g. https://player.vimeo.com/video/918974090?h=709bcc1633 or https://vimeo.com/918974090)
  const vimeoUrlMatch = target.match(/vimeo\.com\/(?:video\/)?([a-zA-Z0-9_\-?=&]+)/i);
  if (vimeoUrlMatch) {
    return { azureBlobUrl: '', vimeoId: vimeoUrlMatch[1] };
  }

  // 3. If raw numeric Vimeo ID or ID with query string (e.g. 918974090 or 918974090?h=709bcc1633)
  if (/^\d+(\?[a-zA-Z0-9_=&-]+)?$/.test(target)) {
    return { azureBlobUrl: '', vimeoId: target };
  }

  // 4. Otherwise treat as direct Azure Blob / MP4 video URL
  return { azureBlobUrl: target, vimeoId: '' };
}

export function LmsAdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'ke' | 'content' | 'questions' | 'plans'>('ke');
  const [contentSubTab, setContentSubTab] = useState<'blobs' | 'chapters'>('blobs');
  const [questionSubTab, setQuestionSubTab] = useState<'banks' | 'questions'>('banks');

  const [courseCodes, setCourseCodes] = useState<Array<{ id: number; code: string; name: string }>>([]);
  const [, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publishingError, setPublishingError] = useState<string | null>(null);

  // Axcelerate Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importHtmlText, setImportHtmlText] = useState('');
  const [importing, setImporting] = useState(false);

  // Data states
  const [kes, setKes] = useState<KnowledgeEvidence[]>([]);
  const [selectedCourseCodeId, setSelectedCourseCodeId] = useState<number | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [blobs, setBlobs] = useState<LearningBlob[]>([]);
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [questionBanks, setQuestionBanks] = useState<QuestionBank[]>([]);
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
  const [chapterSequencer, setChapterBlobsSequencer] = useState<string[]>([]);

  const [bankModal, setBankModal] = useState<{ open: boolean; item?: QuestionBank | null }>({ open: false });
  const [bankForm, setBankForm] = useState<{ name: string; description: string; courseCodeId: number | null; questionIds: string[] }>({
    name: '',
    description: '',
    courseCodeId: null,
    questionIds: [],
  });

  const [previewModal, setPreviewModal] = useState<{ open: boolean; blob?: LearningBlob | null }>({ open: false });

  const [blobModal, setBlobModal] = useState<{ open: boolean; chapterId?: string; item?: LearningBlob | null }>({ open: false });
  const [blobForm, setBlobForm] = useState<{
    chapterId: string;
    knowledgeEvidenceIds: string[];
    title: string;
    description: string;
    contentHtml: string;
    vimeoId: string;
    azureBlobUrl: string;
    durationSeconds: number;
    sortOrder: number;
  }>({
    chapterId: '',
    knowledgeEvidenceIds: [],
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
    knowledgeEvidenceIds: string[];
    coreLearningBlobId: string;

    // Type 1 & 2: Multiple Choice
    mcOptions: string[];
    mcSingleCorrect: string;
    mcMultipleCorrect: string[];

    // Type 3: Order Items
    orderItems: string[];

    // Type 4: Match Definitions
    matchPairs: Array<{ term: string; definition: string }>;

    // Type 5: Fill in Blanks
    blankTemplate: string;
    blanksList: Array<{ index: number; hint: string; options: string[]; correctAnswer: string }>;

    // Type 6: Free Text
    freeTextMinWords: number;
    freeTextKeywords: string;

    // Type 7: Forms
    formFields: Array<{ name: string; label: string; type: string; required: boolean }>;
  }>({
    type: QuestionType.MultipleChoiceSingle,
    questionText: '',
    benchmarkAnswer: '',
    points: 1,
    knowledgeEvidenceIds: [],
    coreLearningBlobId: '',

    mcOptions: ['Option A', 'Option B', 'Option C', 'Option D'],
    mcSingleCorrect: 'Option A',
    mcMultipleCorrect: ['Option A'],

    orderItems: ['Step 1: Danger & Response', 'Step 2: Airway & Breathing', 'Step 3: CPR & Defibrillation'],

    matchPairs: [
      { term: 'CPR', definition: 'Cardiopulmonary resuscitation to restore breathing and circulation' },
      { term: 'AED', definition: 'Automated External Defibrillator used to reset heart rhythm' },
      { term: 'Recovery Position', definition: 'Side-lying position to maintain an open airway' },
    ],

    blankTemplate: 'During CPR, perform {0} compressions at a depth of {1}, followed by {2} rescue breaths.',
    blanksList: [
      { index: 0, hint: 'compressions', options: ['30', '15', '50'], correctAnswer: '30' },
      { index: 1, hint: 'depth', options: ['5-6 cm', '2 cm', '10 cm'], correctAnswer: '5-6 cm' },
      { index: 2, hint: 'rescue breaths', options: ['2', '1', '5'], correctAnswer: '2' },
    ],

    freeTextMinWords: 30,
    freeTextKeywords: 'danger, response, airway, breathing, CPR, defibrillator',

    formFields: [
      { name: 'incidentDate', label: 'Date of Incident', type: 'date', required: true },
      { name: 'location', label: 'Location', type: 'text', required: true },
      { name: 'description', label: 'Incident Description', type: 'textarea', required: true },
    ],
  });

  const [planModal, setPlanModal] = useState<{ open: boolean; item?: LearningPlan | null }>({ open: false });
  const [planForm, setPlanForm] = useState<{
    courseCodeId: number;
    version: string;
    title: string;
    description: string;
    isDefault: boolean;
    selectedChapterIds: string[];
    selectedBankIds: string[];
    selectedQuestionIds: string[];
  }>({
    courseCodeId: 0,
    version: 'v1.0',
    title: '',
    description: '',
    isDefault: true,
    selectedChapterIds: [],
    selectedBankIds: [],
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
      }

      await Promise.all([
        loadKEs(),
        loadBlobs(),
        loadChapters(),
        loadQuestions(),
        loadQuestionBanks(),
        loadPlans(),
      ]);
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

  const loadBlobs = async () => {
    const res = await lmsAdminApi.getBlobs();
    setBlobs(res.data || []);
  };

  const loadChapters = async (courseCodeId?: number) => {
    const res = await lmsAdminApi.getChapters(courseCodeId && courseCodeId > 0 ? courseCodeId : undefined);
    setChapters(res.data || []);
  };

  const loadQuestions = async () => {
    const res = await lmsAdminApi.getQuestions();
    setQuestions(res.data || []);
  };

  const loadQuestionBanks = async () => {
    const res = await lmsAdminApi.getQuestionBanks();
    setQuestionBanks(res.data || []);
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
      setMessage('Knowledge Evidence deleted');
    } catch (err: any) {
      alert(`Error deleting KE: ${err.response?.data?.message || err.message}`);
    }
  };

  // ── Chapter Actions ───────────────────────────────────────────────────────────
  const handleOpenChapterModal = (chapter?: Chapter) => {
    if (chapter) {
      setChapterForm({ title: chapter.title, description: chapter.description || '', sortOrder: chapter.sortOrder });
      setChapterBlobsSequencer(chapter.blobs?.map((b) => b.id) || []);
      setChapterModal({ open: true, item: chapter });
    } else {
      setChapterForm({ title: '', description: '', sortOrder: chapters.length + 1 });
      setChapterBlobsSequencer([]);
      setChapterModal({ open: true, item: null });
    }
  };

  const handleSaveChapter = async () => {
    try {
      let chId: string;
      if (chapterModal.item) {
        await lmsAdminApi.updateChapter(chapterModal.item.id, chapterForm);
        chId = chapterModal.item.id;
      } else {
        const created = await lmsAdminApi.createChapter({
          ...chapterForm,
          courseCodeId: selectedCourseCodeId && selectedCourseCodeId > 0 ? selectedCourseCodeId : undefined,
        });
        chId = created.data.id;
      }

      if (chId && chapterSequencer.length >= 0) {
        const items = chapterSequencer.map((bId, idx) => ({ blobId: bId, sortOrder: idx + 1 }));
        await lmsAdminApi.saveChapterBlobs(chId, items);
      }

      setChapterModal({ open: false });
      await loadChapters();
      await loadBlobs();
      setMessage('Chapter and Content Block sequence saved successfully!');
    } catch (err: any) {
      alert(`Error saving Chapter: ${err.message}`);
    }
  };

  const handleDeleteChapter = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Chapter?')) return;
    try {
      await lmsAdminApi.deleteChapter(id);
      await loadChapters();
      await loadBlobs();
      setMessage('Chapter deleted');
    } catch (err: any) {
      alert(`Error deleting Chapter: ${err.response?.data?.message || err.message}`);
    }
  };

  // ── Blob (Content Block) Actions ─────────────────────────────────────────────
  const handleOpenPreviewModal = (blob: LearningBlob) => {
    setPreviewModal({ open: true, blob });
  };

  const handleOpenBlobModal = (chapterId: string, blob?: LearningBlob) => {
    if (blob) {
      navigate(`/lms-admin/blocks/${blob.id}/edit`);
    } else {
      navigate(`/lms-admin/blocks/new${chapterId ? `?chapterId=${chapterId}` : ''}`);
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

      setImportModalOpen(false);
      setImportHtmlText('');

      navigate('/lms-admin/blocks/new', {
        state: {
          importedTitle: data.title,
          importedVimeoId: data.vimeoId,
          importedContentHtml: data.contentHtml,
          importedCount: data.migratedImagesCount,
        },
      });
    } catch (err: any) {
      alert(`Error importing Axcelerate HTML: ${err?.response?.data?.message || err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const handleSaveBlob = async () => {
    try {
      if (blobModal.item) {
        const res = await lmsAdminApi.updateBlob(blobModal.item.id, blobForm);
        if ((res.data as any)?.isNewVersion) {
          setMessage('🔒 Content Block was locked. A new version was automatically created for draft plans!');
        } else {
          setMessage('Content Block updated successfully!');
        }
      } else {
        await lmsAdminApi.createBlob(blobForm);
        setMessage('Content Block created successfully!');
      }
      setBlobModal({ open: false });
      await loadBlobs();
      await loadChapters();
    } catch (err: any) {
      alert(`Error saving Content Block: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDeleteBlob = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Content Block?')) return;
    try {
      await lmsAdminApi.deleteBlob(id);
      await loadBlobs();
      await loadChapters();
      setMessage('Content Block deleted');
    } catch (err: any) {
      alert(`Error deleting Content Block: ${err.response?.data?.message || err.message}`);
    }
  };

  // ── Question Bank Container Actions ─────────────────────────────────────────
  const handleOpenBankModal = (bank?: QuestionBank) => {
    if (bank) {
      setBankForm({
        name: bank.name,
        description: bank.description || '',
        courseCodeId: bank.courseCodeId || null,
        questionIds: bank.questions?.map((q) => q.id) || [],
      });
      setBankModal({ open: true, item: bank });
    } else {
      setBankForm({
        name: '',
        description: '',
        courseCodeId: selectedCourseCodeId || (courseCodes[0]?.id ?? null),
        questionIds: [],
      });
      setBankModal({ open: true, item: null });
    }
  };

  const handleSaveBank = async () => {
    try {
      const payload = {
        ...bankForm,
        courseCodeId: bankForm.courseCodeId || undefined,
      };
      if (bankModal.item) {
        await lmsAdminApi.updateQuestionBank(bankModal.item.id, payload);
        setMessage('Question Bank updated successfully!');
      } else {
        await lmsAdminApi.createQuestionBank(payload);
        setMessage('Question Bank created successfully!');
      }
      setBankModal({ open: false });
      await loadQuestionBanks();
    } catch (err: any) {
      alert(`Error saving Question Bank: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Question Bank? (Questions inside will remain intact)')) return;
    try {
      await lmsAdminApi.deleteQuestionBank(id);
      await loadQuestionBanks();
      setMessage('Question Bank deleted');
    } catch (err: any) {
      alert(`Error deleting Question Bank: ${err.response?.data?.message || err.message}`);
    }
  };

  // ── Question Actions ─────────────────────────────────────────────────────────
  const handleOpenQuestionModal = (q?: QuestionBankItem) => {
    if (q) {
      const qData = q.questionData || {};
      const cAns = q.correctAnswer || {};

      const mcOptions = Array.isArray(qData.options) && qData.options.length > 0
        ? qData.options
        : ['Option A', 'Option B', 'Option C', 'Option D'];

      const mcSingleCorrect = cAns.answer || mcOptions[0] || '';
      const mcMultipleCorrect = Array.isArray(cAns.answers) ? cAns.answers : [mcOptions[0]];

      const orderItems = Array.isArray(qData.items) && qData.items.length > 0
        ? qData.items
        : ['Step 1', 'Step 2', 'Step 3'];

      const matchPairs = Array.isArray(qData.pairs) && qData.pairs.length > 0
        ? qData.pairs
        : [{ term: 'CPR', definition: 'Cardiopulmonary resuscitation...' }];

      const blankTemplate = qData.template || q.questionText || 'During CPR, perform {0} compressions at a depth of {1}, followed by {2} rescue breaths.';
      const blanksList = Array.isArray(qData.blanks) && qData.blanks.length > 0
        ? qData.blanks.map((b: any, idx: number) => ({
            index: b.index ?? idx,
            hint: b.hint || '',
            options: Array.isArray(b.options) ? b.options : ['30', '15', '50'],
            correctAnswer: cAns.blanks?.[idx] || b.options?.[0] || '30',
          }))
        : [
            { index: 0, hint: 'compressions', options: ['30', '15', '50'], correctAnswer: '30' },
            { index: 1, hint: 'depth', options: ['5-6 cm', '2 cm', '10 cm'], correctAnswer: '5-6 cm' },
            { index: 2, hint: 'rescue breaths', options: ['2', '1', '5'], correctAnswer: '2' },
          ];

      const freeTextMinWords = qData.minWords || 30;
      const freeTextKeywords = Array.isArray(cAns.keywords) ? cAns.keywords.join(', ') : '';

      const formFields = Array.isArray(qData.fields) && qData.fields.length > 0
        ? qData.fields
        : [{ name: 'incidentDate', label: 'Date of Incident', type: 'date', required: true }];

      setQuestionForm({
        type: q.type,
        questionText: q.questionText,
        benchmarkAnswer: q.benchmarkAnswer || '',
        points: q.points ?? 1,
        knowledgeEvidenceIds: q.knowledgeEvidences?.map((k) => k.id) || [],
        coreLearningBlobId: q.coreLearningBlobId || '',
        mcOptions,
        mcSingleCorrect,
        mcMultipleCorrect,
        orderItems,
        matchPairs,
        blankTemplate,
        blanksList,
        freeTextMinWords,
        freeTextKeywords,
        formFields,
      });
      setQuestionModal({ open: true, item: q });
    } else {
      setQuestionForm({
        type: QuestionType.MultipleChoiceSingle,
        questionText: '',
        benchmarkAnswer: '',
        points: 1,
        knowledgeEvidenceIds: kes[0] ? [kes[0].id] : [],
        coreLearningBlobId: '',
        mcOptions: ['Option A', 'Option B', 'Option C', 'Option D'],
        mcSingleCorrect: 'Option A',
        mcMultipleCorrect: ['Option A'],
        orderItems: ['Step 1: Danger & Response', 'Step 2: Airway & Breathing', 'Step 3: CPR & Defibrillation'],
        matchPairs: [
          { term: 'CPR', definition: 'Cardiopulmonary resuscitation to restore breathing and circulation' },
          { term: 'AED', definition: 'Automated External Defibrillator used to reset heart rhythm' },
          { term: 'Recovery Position', definition: 'Side-lying position to maintain an open airway' },
        ],
        blankTemplate: 'During CPR, perform {0} compressions at a depth of {1}, followed by {2} rescue breaths.',
        blanksList: [
          { index: 0, hint: 'compressions', options: ['30', '15', '50'], correctAnswer: '30' },
          { index: 1, hint: 'depth', options: ['5-6 cm', '2 cm', '10 cm'], correctAnswer: '5-6 cm' },
          { index: 2, hint: 'rescue breaths', options: ['2', '1', '5'], correctAnswer: '2' },
        ],
        freeTextMinWords: 30,
        freeTextKeywords: 'danger, response, airway, breathing, CPR, defibrillator',
        formFields: [
          { name: 'incidentDate', label: 'Date of Incident', type: 'date', required: true },
          { name: 'location', label: 'Location', type: 'text', required: true },
          { name: 'description', label: 'Incident Description', type: 'textarea', required: true },
        ],
      });
      setQuestionModal({ open: true, item: null });
    }
  };

  const handleSaveQuestion = async () => {
    try {
      let questionData: any = {};
      let correctAnswer: any = {};

      if (questionForm.type === QuestionType.MultipleChoiceSingle) {
        const cleanOpts = questionForm.mcOptions.map((s) => s.trim()).filter(Boolean);
        questionData = { options: cleanOpts };
        correctAnswer = { answer: questionForm.mcSingleCorrect || cleanOpts[0] || '' };
      } else if (questionForm.type === QuestionType.MultipleChoiceMultiple) {
        const cleanOpts = questionForm.mcOptions.map((s) => s.trim()).filter(Boolean);
        questionData = { options: cleanOpts };
        correctAnswer = { answers: questionForm.mcMultipleCorrect };
      } else if (questionForm.type === QuestionType.OrderItems) {
        const cleanItems = questionForm.orderItems.map((s) => s.trim()).filter(Boolean);
        questionData = { items: cleanItems };
        correctAnswer = { order: cleanItems.map((_, idx) => idx) };
      } else if (questionForm.type === QuestionType.MatchDefinitions) {
        const cleanPairs = questionForm.matchPairs.filter((p) => p.term.trim() && p.definition.trim());
        questionData = { pairs: cleanPairs };
        correctAnswer = { matches: cleanPairs.map((_, idx) => `${idx}-${idx}`) };
      } else if (questionForm.type === QuestionType.FillInBlanks) {
        questionData = {
          template: questionForm.blankTemplate,
          blanks: questionForm.blanksList.map((b, idx) => ({
            index: idx,
            hint: b.hint,
            options: Array.isArray(b.options) ? b.options : String(b.options).split(',').map((s) => s.trim()).filter(Boolean),
          })),
        };
        correctAnswer = {
          blanks: questionForm.blanksList.map((b) => b.correctAnswer || (Array.isArray(b.options) ? b.options[0] : String(b.options).split(',')[0]?.trim()) || ''),
        };
      } else if (questionForm.type === QuestionType.FreeText) {
        questionData = { minWords: questionForm.freeTextMinWords || 1 };
        correctAnswer = {
          keywords: questionForm.freeTextKeywords.split(',').map((s) => s.trim()).filter(Boolean),
          minScore: 0.6,
        };
      } else if (questionForm.type === QuestionType.Forms) {
        const cleanFields = questionForm.formFields.filter((f) => f.name.trim());
        questionData = { fields: cleanFields };
        correctAnswer = { required: cleanFields.filter((f) => f.required).map((f) => f.name) };
      }

      const payload = {
        type: questionForm.type,
        questionText: questionForm.type === QuestionType.FillInBlanks ? questionForm.blankTemplate : questionForm.questionText,
        questionData,
        correctAnswer,
        benchmarkAnswer: questionForm.benchmarkAnswer,
        points: questionForm.points,
        knowledgeEvidenceIds: questionForm.knowledgeEvidenceIds,
        coreLearningBlobId: questionForm.coreLearningBlobId || undefined,
      };

      if (questionModal.item) {
        const res = await lmsAdminApi.updateQuestion(questionModal.item.id, payload);
        if ((res.data as any)?.isNewVersion) {
          setMessage('Saved changes as a new question version to protect historical student attempts on published learning plans.');
        } else {
          setMessage('Question updated successfully!');
        }
      } else {
        await lmsAdminApi.createQuestion(payload);
        setMessage('Question created successfully!');
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
      setMessage('Question deleted');
    } catch (err: any) {
      alert(`Error deleting question: ${err.response?.data?.message || err.message}`);
    }
  };

  // ── Plan Actions ─────────────────────────────────────────────────────────────
  const handleOpenPlanModal = (plan?: LearningPlan) => {
    setPublishingError(null);
    if (plan) {
      setPlanForm({
        courseCodeId: plan.courseCodeId,
        version: plan.version,
        title: plan.title,
        description: plan.description || '',
        isDefault: plan.isDefault,
        selectedChapterIds: plan.planChapters?.map((pc) => pc.chapterId) || [],
        selectedBankIds: plan.questionBanks?.map((qb) => qb.id) || [],
        selectedQuestionIds: plan.planQuestions?.map((pq) => pq.questionId) || [],
      });
      setPlanModal({ open: true, item: plan });
    } else {
      setPlanForm({
        courseCodeId: courseCodes[0]?.id || 0,
        version: 'v1.0',
        title: `${courseCodes[0]?.code || 'HLTAID011'} Standard Plan v1.0`,
        description: 'Default theory learning and assessment plan',
        isDefault: true,
        selectedChapterIds: chapters.map((ch) => ch.id),
        selectedBankIds: questionBanks.map((qb) => qb.id),
        selectedQuestionIds: questions.map((q) => q.id),
      });
      setPlanModal({ open: true, item: null });
    }
  };

  const handleClonePlanToDraft = async (plan: LearningPlan, incrementType: 'minor' | 'major') => {
    try {
      await lmsAdminApi.clonePlanToDraft(plan.id, incrementType);
      setMessage(`Cloned plan ${plan.version} into a new DRAFT version!`);
      await loadPlans();
    } catch (err: any) {
      alert(`Error cloning plan: ${err?.response?.data?.message || err.message}`);
    }
  };

  const handleTogglePublishPlan = async (plan: LearningPlan) => {
    setPublishingError(null);
    const newStatus = plan.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
    if (newStatus === 'DRAFT' && plan.status === 'PUBLISHED') {
      if (!confirm('Warning: Putting a published plan back into Draft will lock it from new enrolments. Continue?')) {
        return;
      }
    }
    try {
      await lmsAdminApi.updatePlan(plan.id, { status: newStatus });
      setMessage(`Plan status updated to ${newStatus}`);
      await loadPlans();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err.message;
      if (errMsg.includes('Coverage Gate Failed') || errMsg.includes('100% Knowledge Evidence')) {
        setPublishingError(errMsg);
      } else {
        alert(`Error updating plan status: ${errMsg}`);
      }
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

      // Link selected chapters
      const chapterItems = planForm.selectedChapterIds.map((chId, idx) => ({
        chapterId: chId,
        sortOrder: idx + 1,
      }));
      await lmsAdminApi.setPlanChapters(planId, chapterItems);

      // Link selected question banks
      if (planForm.selectedBankIds) {
        await lmsAdminApi.setPlanQuestionBanks(planId, planForm.selectedBankIds);
      }

      // Link selected questions
      const questionItems = planForm.selectedQuestionIds.map((qId, idx) => ({
        questionId: qId,
        sortOrder: idx + 1,
        points: questions.find((q) => q.id === qId)?.points || 1,
      }));

      await lmsAdminApi.setPlanQuestions(planId, questionItems);
      setPlanModal({ open: false });
      await loadPlans();
      setMessage('Learning Plan version saved successfully!');
    } catch (err: any) {
      alert(`Error saving Learning Plan: ${err.response?.data?.message || err.message}`);
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

      {publishingError && (
        <div style={{ padding: 14, backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: 8, marginBottom: 20, border: '1px solid #fecaca', fontWeight: 600, fontSize: 14 }}>
          🚨 {publishingError}
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
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#1e3a8a' }}>
                      {ke.code}
                      {ke.isLocked && (
                        <span style={{ marginLeft: 6, padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid #fde68a' }} title="Mapped to published content/questions">
                          🔒 Published
                        </span>
                      )}
                    </td>
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
          {/* Sub-tabs A & B */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setContentSubTab('blobs')}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: contentSubTab === 'blobs' ? '#1e40af' : '#f8fafc',
                color: contentSubTab === 'blobs' ? '#ffffff' : '#334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📦 Sub-Tab A: Content Blocks (Blobs) ({blobs.length})
            </button>
            <button
              type="button"
              onClick={() => setContentSubTab('chapters')}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: contentSubTab === 'chapters' ? '#1e40af' : '#f8fafc',
                color: contentSubTab === 'chapters' ? '#ffffff' : '#334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              📚 Sub-Tab B: Chapters ({chapters.length})
            </button>
          </div>

          {/* Sub-Tab A: Content Blocks */}
          {contentSubTab === 'blobs' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Atomic Content Blocks (Blobs)</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(true)}
                    style={{ padding: '8px 16px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                  >
                    📥 Import Axcelerate HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/lms-admin/blocks/new')}
                    style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                  >
                    + Create Content Block
                  </button>
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '12px 16px' }}>Title & Description</th>
                      <th style={{ padding: '12px 16px' }}>Chapter / Unit</th>
                      <th style={{ padding: '12px 16px' }}>Knowledge Evidence</th>
                      <th style={{ padding: '12px 16px' }}>Status & Version</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blobs.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>📦 {b.title}</div>
                          {b.description && <div style={{ fontSize: 13, color: '#64748b' }}>{b.description}</div>}
                          {(b.vimeoId || b.azureBlobUrl) && (
                            <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
                              🎥 {b.azureBlobUrl || `Vimeo: ${b.vimeoId}`}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13 }}>
                          {b.chapter ? (
                            <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#334155', borderRadius: 4, fontWeight: 600 }}>
                              📖 {b.chapter.title}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Unassigned Block</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {b.knowledgeEvidences && b.knowledgeEvidences.length > 0 ? (
                            b.knowledgeEvidences.map((k) => (
                              <span key={k.id} style={{ padding: '2px 6px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: 4, fontSize: 12, marginRight: 4, display: 'inline-block' }}>
                                {k.code}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8' }}>None</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {b.isLocked ? (
                            <span style={{ padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 11, fontWeight: 700, border: '1px solid #fde68a' }}>
                              🔒 Locked (v{b.version || 1})
                            </span>
                          ) : (
                            <span style={{ padding: '2px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: 4, fontSize: 11 }}>
                              v{b.version || 1} Draft
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button type="button" onClick={() => handleOpenPreviewModal(b)} style={{ padding: '4px 8px', marginRight: 6, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>👁️ Preview Block</button>
                          <button type="button" onClick={() => handleOpenBlobModal(b.chapterId || '', b)} style={{ padding: '4px 8px', marginRight: 6, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                          <button type="button" onClick={() => handleDeleteBlob(b.id)} style={{ padding: '4px 8px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sub-Tab B: Chapters */}
          {contentSubTab === 'chapters' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <label style={{ fontWeight: 600, fontSize: 14 }}>Filter Course:</label>
                  <select
                    value={selectedCourseCodeId || ''}
                    onChange={(e) => {
                      const id = Number(e.target.value);
                      setSelectedCourseCodeId(id || null);
                      loadChapters(id || undefined);
                    }}
                    style={{ padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600 }}
                  >
                    <option value="">All Courses</option>
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
                        {ch.isLocked && (
                          <span style={{ marginLeft: 8, padding: '2px 8px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 11, fontWeight: 700, border: '1px solid #fde68a' }} title={`Published plans: ${ch.publishedPlans?.join(', ')}`}>
                            🔒 Published ({ch.publishedPlans?.length})
                          </span>
                        )}
                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '2px 0 0 0', color: '#0f172a' }}>{ch.title}</h3>
                        {ch.description && <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{ch.description}</p>}
                      </div>
                      <div>
                        <button type="button" onClick={() => handleOpenBlobModal(ch.id)} style={{ padding: '6px 12px', backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 6, fontWeight: 600, cursor: 'pointer', marginRight: 8 }}>+ Add Content Block</button>
                        <button type="button" onClick={() => handleOpenChapterModal(ch)} style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer', marginRight: 8 }}>Edit / Sequence Blocks</button>
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
                              {b.isLocked && <span style={{ marginLeft: 6, padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 11 }}>🔒 Locked</span>}
                              {b.knowledgeEvidences && b.knowledgeEvidences.length > 0 && b.knowledgeEvidences.map((k) => (
                                <span key={k.id} style={{ marginLeft: 6, padding: '2px 6px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 11 }}>
                                  KE: {k.code}
                                </span>
                              ))}
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>{b.description}</div>
                          </div>
                          <div>
                            <button type="button" onClick={() => handleOpenPreviewModal(b)} style={{ padding: '4px 8px', marginRight: 6, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>👁️ Preview Block</button>
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
        </div>
      )}

      {/* ── TAB 3: Question Bank ───────────────────────────────────────────────────── */}
      {activeTab === 'questions' && (
        <div>
          {/* Sub-tabs A & B */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <button
              type="button"
              onClick={() => setQuestionSubTab('banks')}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: questionSubTab === 'banks' ? '#1e40af' : '#f8fafc',
                color: questionSubTab === 'banks' ? '#ffffff' : '#334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              🏦 Sub-Tab A: Question Banks ({questionBanks.length})
            </button>
            <button
              type="button"
              onClick={() => setQuestionSubTab('questions')}
              style={{
                padding: '8px 16px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                backgroundColor: questionSubTab === 'questions' ? '#1e40af' : '#f8fafc',
                color: questionSubTab === 'questions' ? '#ffffff' : '#334155',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ❓ Sub-Tab B: All Questions ({questions.length})
            </button>
          </div>

          {/* Sub-Tab A: Question Banks */}
          {questionSubTab === 'banks' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Assessment Question Banks</h2>
                <button
                  type="button"
                  onClick={() => handleOpenBankModal()}
                  style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
                >
                  + Add Question Bank
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {questionBanks.map((bank) => (
                  <div key={bank.id} style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#0f172a' }}>
                          🏦 {bank.name}
                          {bank.isLocked && (
                            <span style={{ marginLeft: 6, padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 11, fontWeight: 700, border: '1px solid #fde68a' }} title={`Published plans: ${bank.publishedPlans?.join(', ')}`}>
                              🔒 Published
                            </span>
                          )}
                        </h3>
                        {bank.courseCode && (
                          <span style={{ padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 12, fontWeight: 700 }}>
                            {bank.courseCode.code}
                          </span>
                        )}
                      </div>
                      {bank.description && <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px 0' }}>{bank.description}</p>}
                      <div style={{ fontSize: 13, color: '#334155', marginBottom: 12 }}>
                        ❓ <strong>{bank.questions?.length || 0}</strong> questions included
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
                      <button type="button" onClick={() => handleOpenBankModal(bank)} style={{ flex: 1, padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Edit Bank</button>
                      <button type="button" onClick={() => handleDeleteBank(bank.id)} style={{ padding: '6px 12px', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sub-Tab B: All Questions */}
          {questionSubTab === 'questions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>All Individual Questions</h2>
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
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {questions.map((q) => (
                      <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
                            {q.type === QuestionType.MultipleChoiceSingle ? '1. MC Single'
                              : q.type === QuestionType.MultipleChoiceMultiple ? '2. MC Multiple'
                              : q.type === QuestionType.OrderItems ? '3. Order Items'
                              : q.type === QuestionType.MatchDefinitions ? '4. Match Definitions'
                              : q.type === QuestionType.FillInBlanks ? '5. Fill Blanks'
                              : q.type === QuestionType.FreeText ? '6. AI Free Text'
                              : q.type === QuestionType.Forms ? '7. Form'
                              : `Type #${q.type}`}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600, maxWidth: 300 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {q.questionText}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {q.knowledgeEvidences && q.knowledgeEvidences.length > 0 ? (
                            q.knowledgeEvidences.map((k) => (
                              <span key={k.id} style={{ padding: '2px 6px', backgroundColor: '#f0fdf4', color: '#166534', borderRadius: 4, fontSize: 12, marginRight: 4, display: 'inline-block' }}>
                                {k.code}
                              </span>
                            ))
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700 }}>{q.points} pt</td>
                        <td style={{ padding: '12px 16px' }}>
                          {q.isLocked ? (
                            <span
                              style={{ padding: '2px 6px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: 4, fontSize: 11, fontWeight: 600, border: '1px solid #fde68a' }}
                              title={`Used in published plans: ${q.publishedPlans?.join(', ')}`}
                            >
                              🔒 Published ({q.publishedPlans?.length})
                            </span>
                          ) : (
                            <span style={{ padding: '2px 6px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: 4, fontSize: 11 }}>
                              Editable
                            </span>
                          )}
                        </td>
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
                      <button
                        type="button"
                        onClick={() => handleTogglePublishPlan(p)}
                        style={{
                          padding: '3px 10px',
                          backgroundColor: p.status === 'PUBLISHED' ? '#dcfce7' : '#fef3c7',
                          color: p.status === 'PUBLISHED' ? '#166534' : '#92400e',
                          border: `1px solid ${p.status === 'PUBLISHED' ? '#bbf7d0' : '#fde68a'}`,
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title={p.status === 'PUBLISHED' ? 'Click to revert status to Draft' : 'Click to publish plan'}
                      >
                        {p.status === 'PUBLISHED' ? '✓ PUBLISHED' : '📝 DRAFT'}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#334155' }}>
                      📖 {p.planChapters?.length || 0} chapters | ❓ {p.planQuestions?.length || 0} questions
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      {p.status === 'PUBLISHED' ? (
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => handleClonePlanToDraft(p, 'minor')}
                            style={{ padding: '4px 8px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            title="Clone to new minor draft version (e.g. v1.0 -> v1.1)"
                          >
                            + Minor Draft (v+0.1)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleClonePlanToDraft(p, 'major')}
                            style={{ padding: '4px 8px', backgroundColor: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                            title="Clone to new major draft version (e.g. v1.0 -> v2.0)"
                          >
                            + Major Draft (v+1.0)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenPlanModal(p)}
                            style={{ padding: '4px 8px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                            title="View Plan Details (Read-Only)"
                          >
                            View
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenPlanModal(p)}
                          style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
                        >
                          Edit Draft
                        </button>
                      )}
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
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Mapped Course Codes:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 8, border: '1px solid #ccc', borderRadius: 4, maxHeight: 120, overflowY: 'auto' }}>
                  {courseCodes.map((c) => {
                    const isChecked = keForm.courseCodeIds.includes(c.id);
                    return (
                      <label key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...keForm.courseCodeIds, c.id]
                              : keForm.courseCodeIds.filter((id) => id !== c.id);
                            setKeForm({ ...keForm, courseCodeIds: updated });
                          }}
                        />
                        {c.code}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setKeModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSaveKe} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save KE</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Chapter & Block Sequencer ───────────────────────────────────────── */}
      {chapterModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 650, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{chapterModal.item ? 'Edit Chapter & Sequencer' : 'Add Chapter'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Chapter Title:</div>
                <input type="text" value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Description:</div>
                <textarea rows={2} value={chapterForm.description} onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>

              {/* Block Sequencer */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
                  🎯 Content Block Sequencer (Select & Order Reading Sequence)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {chapterSequencer.map((bId, idx) => {
                    const blobObj = blobs.find((b) => b.id === bId);
                    if (!blobObj) return null;
                    return (
                      <div key={bId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '6px 12px', border: '1px solid #cbd5e1', borderRadius: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
                          <span style={{ color: '#2563eb', marginRight: 6 }}>#{idx + 1}</span> 📦 {blobObj.title}
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const updated = [...chapterSequencer];
                              const temp = updated[idx];
                              updated[idx] = updated[idx - 1];
                              updated[idx - 1] = temp;
                              setChapterBlobsSequencer(updated);
                            }}
                            style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #ccc', background: idx === 0 ? '#f1f5f9' : '#ffffff', cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                          >
                            ▲ Up
                          </button>
                          <button
                            type="button"
                            disabled={idx === chapterSequencer.length - 1}
                            onClick={() => {
                              const updated = [...chapterSequencer];
                              const temp = updated[idx];
                              updated[idx] = updated[idx + 1];
                              updated[idx + 1] = temp;
                              setChapterBlobsSequencer(updated);
                            }}
                            style={{ padding: '2px 8px', fontSize: 12, borderRadius: 4, border: '1px solid #ccc', background: idx === chapterSequencer.length - 1 ? '#f1f5f9' : '#ffffff', cursor: idx === chapterSequencer.length - 1 ? 'not-allowed' : 'pointer' }}
                          >
                            ▼ Down
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Attach / Detach Available Content Blocks:</div>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #cbd5e1', padding: 8, borderRadius: 6, background: '#ffffff', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {blobs.map((b) => {
                    const isSelected = chapterSequencer.includes(b.id);
                    return (
                      <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setChapterBlobsSequencer([...chapterSequencer, b.id]);
                            } else {
                              setChapterBlobsSequencer(chapterSequencer.filter((id) => id !== b.id));
                            }
                          }}
                        />
                        <span>📦 {b.title} {b.chapter && b.chapter.id !== chapterModal.item?.id ? `(In: ${b.chapter.title})` : ''}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setChapterModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSaveChapter} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save Chapter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Learning Blob (Content Block) ─────────────────────────────────── */}
      {blobModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 600, width: '100%' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{blobModal.item ? 'Edit Content Block' : 'Add Content Block'}</h3>

            {blobModal.item?.isLocked && (
              <div style={{ padding: '10px 12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                🔒 Note: This Content Block belongs to a published Learning Plan. Saving changes will automatically duplicate it into a new version (v{(blobModal.item.version || 1) + 1}) for draft plans.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Title:</div>
                <input type="text" value={blobForm.title} onChange={(e) => setBlobForm({ ...blobForm, title: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Mapped Knowledge Evidence (KEs):</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid #ccc', borderRadius: 4, maxHeight: 140, overflowY: 'auto' }}>
                  {kes.map((k) => {
                    const isChecked = blobForm.knowledgeEvidenceIds.includes(k.id);
                    return (
                      <label key={k.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...blobForm.knowledgeEvidenceIds, k.id]
                              : blobForm.knowledgeEvidenceIds.filter((id) => id !== k.id);
                            setBlobForm({ ...blobForm, knowledgeEvidenceIds: updated });
                          }}
                        />
                        <strong>{k.code}</strong> &ndash; {k.title}
                      </label>
                    );
                  })}
                </div>
              </div>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Azure Blob Video URL / Vimeo Embed / Vimeo ID:</div>
                <input
                  type="text"
                  placeholder="Paste Vimeo ID (e.g. 918974090?h=709bcc1633), iframe embed code, or Azure MP4 URL"
                  value={blobForm.vimeoId || blobForm.azureBlobUrl}
                  onChange={(e) => {
                    const parsed = parseVideoInput(e.target.value);
                    setBlobForm({ ...blobForm, azureBlobUrl: parsed.azureBlobUrl, vimeoId: parsed.vimeoId });
                  }}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                />
                {(blobForm.vimeoId || blobForm.azureBlobUrl) && (
                  <div style={{ fontSize: 11, color: '#2563eb', marginTop: 4, fontWeight: 600 }}>
                    {blobForm.vimeoId ? `✓ Detected Vimeo ID: ${blobForm.vimeoId}` : `✓ Detected Direct Video URL: ${blobForm.azureBlobUrl}`}
                  </div>
                )}
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

      {/* ── MODAL: Question Bank Container ───────────────────────────────────────── */}
      {bankModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 600, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ margin: '0 0 16px 0' }}>{bankModal.item ? 'Edit Question Bank' : 'Add Question Bank'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Question Bank Name:</div>
                <input type="text" placeholder="e.g. CPR Assessment Bank" value={bankForm.name} onChange={(e) => setBankForm({ ...bankForm, name: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Course Code Association:</div>
                <select
                  value={bankForm.courseCodeId || ''}
                  onChange={(e) => setBankForm({ ...bankForm, courseCodeId: Number(e.target.value) || null })}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                >
                  <option value="">General (All Courses)</option>
                  {courseCodes.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Description:</div>
                <textarea rows={2} value={bankForm.description} onChange={(e) => setBankForm({ ...bankForm, description: e.target.value })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
              </label>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Select Questions to include in this Bank:</div>
                <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #cbd5e1', padding: 8, borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {questions.map((q) => {
                    const isChecked = bankForm.questionIds.includes(q.id);
                    return (
                      <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBankForm({ ...bankForm, questionIds: [...bankForm.questionIds, q.id] });
                            } else {
                              setBankForm({ ...bankForm, questionIds: bankForm.questionIds.filter((id) => id !== q.id) });
                            }
                          }}
                        />
                        <span>❓ <strong>{q.questionText}</strong></span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setBankModal({ open: false })} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid #ccc' }}>Cancel</button>
              <button type="button" onClick={handleSaveBank} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600 }}>Save Question Bank</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Question ──────────────────────────────────────────────────────── */}
      {questionModal.open && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#fff', borderRadius: 8, padding: 24, maxWidth: 700, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
                {questionModal.item ? 'Edit Question' : 'Create Question'}
              </h3>
              <button type="button" onClick={() => setQuestionModal({ open: false })} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>

            {questionModal.item?.isLocked && (
              <div style={{ padding: '10px 12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                🔒 Note: This question is attached to published learning plan(s) ({questionModal.item.publishedPlans?.join(', ')}). Saving changes will automatically create a new question version to protect historical student assessment responses.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                <label>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Question Type:</div>
                  <select value={questionForm.type} onChange={(e) => setQuestionForm({ ...questionForm, type: Number(e.target.value) })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}>
                    <option value={QuestionType.MultipleChoiceSingle}>1. Multiple Choice (Single Answer)</option>
                    <option value={QuestionType.MultipleChoiceMultiple}>2. Multiple Choice (Multiple Answers)</option>
                    <option value={QuestionType.OrderItems}>3. Sequence / Order Items</option>
                    <option value={QuestionType.MatchDefinitions}>4. Term & Definition Matching</option>
                    <option value={QuestionType.FillInBlanks}>5. Fill in Blanks (Inline Dropdowns)</option>
                    <option value={QuestionType.FreeText}>6. Short Answer (AI Vector Evaluation)</option>
                    <option value={QuestionType.Forms}>7. Forms / Observation Checklist</option>
                  </select>
                </label>

                <label>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Points Weighting:</div>
                  <input type="number" min={1} value={questionForm.points} onChange={(e) => setQuestionForm({ ...questionForm, points: Number(e.target.value) })} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                </label>
              </div>

              {/* Question Text / Prompt */}
              {questionForm.type !== QuestionType.FillInBlanks && (
                <label>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Question Text / Prompt:</div>
                  <textarea rows={3} value={questionForm.questionText} onChange={(e) => setQuestionForm({ ...questionForm, questionText: e.target.value })} placeholder="Enter question text or prompt here..." style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                </label>
              )}

              {/* ── TYPE 1: Multiple Choice Single ───────────────────────────── */}
              {questionForm.type === QuestionType.MultipleChoiceSingle && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Multiple Choice Options (Select Radio Button for Correct Answer)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {questionForm.mcOptions.map((opt, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="radio"
                          name="mcSingleCorrect"
                          checked={questionForm.mcSingleCorrect === opt}
                          onChange={() => setQuestionForm({ ...questionForm, mcSingleCorrect: opt })}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                          title="Mark as correct answer"
                        />
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...questionForm.mcOptions];
                            newOpts[idx] = e.target.value;
                            setQuestionForm({ ...questionForm, mcOptions: newOpts });
                          }}
                          placeholder={`Option ${idx + 1}`}
                          style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newOpts = questionForm.mcOptions.filter((_, i) => i !== idx);
                            setQuestionForm({ ...questionForm, mcOptions: newOpts });
                          }}
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, mcOptions: [...questionForm.mcOptions, `Option ${questionForm.mcOptions.length + 1}`] })}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      + Add Option
                    </button>
                  </div>
                </div>
              )}

              {/* ── TYPE 2: Multiple Choice Multiple ─────────────────────────── */}
              {questionForm.type === QuestionType.MultipleChoiceMultiple && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Multiple Choice Options (Check All Correct Answers)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {questionForm.mcOptions.map((opt, idx) => {
                      const isChecked = questionForm.mcMultipleCorrect.includes(opt);
                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...questionForm.mcMultipleCorrect, opt]
                                : questionForm.mcMultipleCorrect.filter((o) => o !== opt);
                              setQuestionForm({ ...questionForm, mcMultipleCorrect: updated });
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                            title="Mark as correct answer"
                          />
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => {
                              const newOpts = [...questionForm.mcOptions];
                              newOpts[idx] = e.target.value;
                              setQuestionForm({ ...questionForm, mcOptions: newOpts });
                            }}
                            placeholder={`Option ${idx + 1}`}
                            style={{ flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newOpts = questionForm.mcOptions.filter((_, i) => i !== idx);
                              setQuestionForm({ ...questionForm, mcOptions: newOpts });
                            }}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, mcOptions: [...questionForm.mcOptions, `Option ${questionForm.mcOptions.length + 1}`] })}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      + Add Option
                    </button>
                  </div>
                </div>
              )}

              {/* ── TYPE 3: Sequence / Order Items ──────────────────────────── */}
              {questionForm.type === QuestionType.OrderItems && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Sequence Items (Arrange in Target Correct Order using ▲ ▼)
                  </div>
                  <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#64748b' }}>
                    The list below defines the correct sequence. On assessment load, student choices are shuffled automatically.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {questionForm.orderItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af', width: 50 }}>Step #{idx + 1}</span>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newItems = [...questionForm.orderItems];
                            newItems[idx] = e.target.value;
                            setQuestionForm({ ...questionForm, orderItems: newItems });
                          }}
                          style={{ flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                        />
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            if (idx === 0) return;
                            const newItems = [...questionForm.orderItems];
                            const tmp = newItems[idx];
                            newItems[idx] = newItems[idx - 1];
                            newItems[idx - 1] = tmp;
                            setQuestionForm({ ...questionForm, orderItems: newItems });
                          }}
                          style={{ padding: '2px 6px', fontSize: 12, cursor: idx === 0 ? 'not-allowed' : 'pointer' }}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={idx === questionForm.orderItems.length - 1}
                          onClick={() => {
                            if (idx === questionForm.orderItems.length - 1) return;
                            const newItems = [...questionForm.orderItems];
                            const tmp = newItems[idx];
                            newItems[idx] = newItems[idx + 1];
                            newItems[idx + 1] = tmp;
                            setQuestionForm({ ...questionForm, orderItems: newItems });
                          }}
                          style={{ padding: '2px 6px', fontSize: 12, cursor: idx === questionForm.orderItems.length - 1 ? 'not-allowed' : 'pointer' }}
                        >
                          ▼
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = questionForm.orderItems.filter((_, i) => i !== idx);
                            setQuestionForm({ ...questionForm, orderItems: newItems });
                          }}
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, orderItems: [...questionForm.orderItems, `Step ${questionForm.orderItems.length + 1}`] })}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      + Add Step
                    </button>
                  </div>
                </div>
              )}

              {/* ── TYPE 4: Match Definitions ─────────────────────────────────── */}
              {questionForm.type === QuestionType.MatchDefinitions && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                    Matching Term & Definition Pairs
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {questionForm.matchPairs.map((pair, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Term (e.g. CPR)"
                          value={pair.term}
                          onChange={(e) => {
                            const newPairs = [...questionForm.matchPairs];
                            newPairs[idx] = { ...newPairs[idx], term: e.target.value };
                            setQuestionForm({ ...questionForm, matchPairs: newPairs });
                          }}
                          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, fontWeight: 600 }}
                        />
                        <input
                          type="text"
                          placeholder="Definition"
                          value={pair.definition}
                          onChange={(e) => {
                            const newPairs = [...questionForm.matchPairs];
                            newPairs[idx] = { ...newPairs[idx], definition: e.target.value };
                            setQuestionForm({ ...questionForm, matchPairs: newPairs });
                          }}
                          style={{ padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newPairs = questionForm.matchPairs.filter((_, i) => i !== idx);
                            setQuestionForm({ ...questionForm, matchPairs: newPairs });
                          }}
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, matchPairs: [...questionForm.matchPairs, { term: '', definition: '' }] })}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      + Add Pair
                    </button>
                  </div>
                </div>
              )}

              {/* ── TYPE 5: Fill in Blanks ────────────────────────────────────── */}
              {questionForm.type === QuestionType.FillInBlanks && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      Sentence Template (use &#123;0&#125;, &#123;1&#125;, &#123;2&#125; for inline dropdown placeholders):
                    </div>
                    <textarea
                      rows={2}
                      value={questionForm.blankTemplate}
                      onChange={(e) => setQuestionForm({ ...questionForm, blankTemplate: e.target.value })}
                      style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                    />
                  </label>

                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    Interactive Dropdown Blanks Configuration
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {questionForm.blanksList.map((blank, idx) => (
                      <div key={idx} style={{ background: '#fff', border: '1px solid #cbd5e1', borderRadius: 6, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: 13, color: '#1e40af' }}>Blank &#123;{idx}&#125; Config</strong>
                          <button
                            type="button"
                            onClick={() => {
                              const newBlanks = questionForm.blanksList.filter((_, i) => i !== idx);
                              setQuestionForm({ ...questionForm, blanksList: newBlanks });
                            }}
                            style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                          >
                            Remove Blank
                          </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr', gap: 8, alignItems: 'center' }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block' }}>Hint Label:</label>
                            <input
                              type="text"
                              value={blank.hint}
                              onChange={(e) => {
                                const newBlanks = [...questionForm.blanksList];
                                newBlanks[idx] = { ...newBlanks[idx], hint: e.target.value };
                                setQuestionForm({ ...questionForm, blanksList: newBlanks });
                              }}
                              placeholder="e.g. compressions"
                              style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block' }}>Choices (comma-separated):</label>
                            <input
                              type="text"
                              value={Array.isArray(blank.options) ? blank.options.join(', ') : blank.options}
                              onChange={(e) => {
                                const opts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                                const newBlanks = [...questionForm.blanksList];
                                newBlanks[idx] = { ...newBlanks[idx], options: opts, correctAnswer: opts.includes(blank.correctAnswer) ? blank.correctAnswer : opts[0] || '' };
                                setQuestionForm({ ...questionForm, blanksList: newBlanks });
                              }}
                              placeholder="30, 15, 50"
                              style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }}
                            />
                          </div>

                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#15803d', display: 'block' }}>Correct Choice:</label>
                            <select
                              value={blank.correctAnswer}
                              onChange={(e) => {
                                const newBlanks = [...questionForm.blanksList];
                                newBlanks[idx] = { ...newBlanks[idx], correctAnswer: e.target.value };
                                setQuestionForm({ ...questionForm, blanksList: newBlanks });
                              }}
                              style={{ width: '100%', padding: '4px 6px', borderRadius: 4, border: '1px solid #86efac', background: '#f0fdf4', fontSize: 12, fontWeight: 600 }}
                            >
                              {(blank.options || []).map((opt, oIdx) => (
                                <option key={oIdx} value={opt}>{opt}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newIdx = questionForm.blanksList.length;
                        setQuestionForm({
                          ...questionForm,
                          blankTemplate: questionForm.blankTemplate + ` {${newIdx}}`,
                          blanksList: [...questionForm.blanksList, { index: newIdx, hint: '', options: ['Choice A', 'Choice B'], correctAnswer: 'Choice A' }],
                        });
                      }}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      + Add Blank
                    </button>
                  </div>
                </div>
              )}

              {/* ── TYPE 6: Free Text / AI Vector Evaluated ───────────────────── */}
              {questionForm.type === QuestionType.FreeText && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    Short Answer & AI Vector Evaluation
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block' }}>Minimum Required Words:</label>
                      <input
                        type="number"
                        min={1}
                        value={questionForm.freeTextMinWords}
                        onChange={(e) => setQuestionForm({ ...questionForm, freeTextMinWords: Number(e.target.value) })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block' }}>Required Evaluation Keywords (comma-separated):</label>
                      <input
                        type="text"
                        placeholder="e.g. danger, response, airway, breathing, CPR"
                        value={questionForm.freeTextKeywords}
                        onChange={(e) => setQuestionForm({ ...questionForm, freeTextKeywords: e.target.value })}
                        style={{ width: '100%', padding: '6px 8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Benchmark Model Answer (for AI Semantic Vector Matching):
                    </label>
                    <textarea
                      rows={3}
                      value={questionForm.benchmarkAnswer}
                      onChange={(e) => setQuestionForm({ ...questionForm, benchmarkAnswer: e.target.value })}
                      placeholder="Enter the benchmark ideal model answer used by AI vector grading to evaluate student responses..."
                      style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', fontSize: 13 }}
                    />
                  </div>
                </div>
              )}

              {/* ── TYPE 7: Forms / Observation Checklist ────────────────────── */}
              {questionForm.type === QuestionType.Forms && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
                    Form Field Definitions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {questionForm.formFields.map((field, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: 8, alignItems: 'center', background: '#fff', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6 }}>
                        <input
                          type="text"
                          placeholder="Field Key (e.g. location)"
                          value={field.name}
                          onChange={(e) => {
                            const newFields = [...questionForm.formFields];
                            newFields[idx] = { ...newFields[idx], name: e.target.value };
                            setQuestionForm({ ...questionForm, formFields: newFields });
                          }}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }}
                        />
                        <input
                          type="text"
                          placeholder="Field Label (e.g. Incident Location)"
                          value={field.label}
                          onChange={(e) => {
                            const newFields = [...questionForm.formFields];
                            newFields[idx] = { ...newFields[idx], label: e.target.value };
                            setQuestionForm({ ...questionForm, formFields: newFields });
                          }}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }}
                        />
                        <select
                          value={field.type}
                          onChange={(e) => {
                            const newFields = [...questionForm.formFields];
                            newFields[idx] = { ...newFields[idx], type: e.target.value };
                            setQuestionForm({ ...questionForm, formFields: newFields });
                          }}
                          style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid #ccc', fontSize: 12 }}
                        >
                          <option value="text">Short Text</option>
                          <option value="textarea">Paragraph Text</option>
                          <option value="date">Date</option>
                          <option value="checkbox">Checkbox (Pass/Fail)</option>
                        </select>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => {
                              const newFields = [...questionForm.formFields];
                              newFields[idx] = { ...newFields[idx], required: e.target.checked };
                              setQuestionForm({ ...questionForm, formFields: newFields });
                            }}
                          />
                          Req
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const newFields = questionForm.formFields.filter((_, i) => i !== idx);
                            setQuestionForm({ ...questionForm, formFields: newFields });
                          }}
                          style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setQuestionForm({ ...questionForm, formFields: [...questionForm.formFields, { name: '', label: '', type: 'text', required: true }] })}
                      style={{ marginTop: 4, alignSelf: 'flex-start', padding: '4px 12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                    >
                      + Add Field
                    </button>
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Mapped Knowledge Evidence (KEs):</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, border: '1px solid #ccc', borderRadius: 4, maxHeight: 140, overflowY: 'auto' }}>
                  {kes.map((k) => {
                    const isChecked = questionForm.knowledgeEvidenceIds.includes(k.id);
                    return (
                      <label key={k.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...questionForm.knowledgeEvidenceIds, k.id]
                              : questionForm.knowledgeEvidenceIds.filter((id) => id !== k.id);
                            setQuestionForm({ ...questionForm, knowledgeEvidenceIds: updated });
                          }}
                        />
                        <strong>{k.code}</strong> &ndash; {k.title}
                      </label>
                    );
                  })}
                </div>
              </div>
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
            <h3 style={{ margin: '0 0 16px 0' }}>{planModal.item ? `Edit Learning Plan (${planModal.item.version})` : 'Create Learning Plan Version'}</h3>
            
            {planModal.item?.status === 'PUBLISHED' && (
              <div style={{ padding: '10px 12px', backgroundColor: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
                🔒 Locked: Published plans are read-only to guarantee assessment integrity for active students. To make content or assessment changes, close this modal and click "+ Minor Draft" or "+ Major Draft" to create a new draft version.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Course Code:</div>
                <select
                  value={planForm.courseCodeId}
                  disabled={Boolean(planModal.item?.status === 'PUBLISHED')}
                  onChange={(e) => setPlanForm({ ...planForm, courseCodeId: Number(e.target.value) })}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', opacity: planModal.item?.status === 'PUBLISHED' ? 0.7 : 1 }}
                >
                  {courseCodes.map((c) => (
                    <option key={c.id} value={c.id}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </label>

              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Version Identifier (e.g. v1.0, v1.1):</div>
                <input
                  type="text"
                  value={planForm.version}
                  readOnly={Boolean(planModal.item)}
                  onChange={(e) => setPlanForm({ ...planForm, version: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: planModal.item ? '#f8fafc' : '#ffffff' }}
                />
              </label>

              <label>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Plan Title:</div>
                <input
                  type="text"
                  value={planForm.title}
                  readOnly={Boolean(planModal.item?.status === 'PUBLISHED')}
                  onChange={(e) => setPlanForm({ ...planForm, title: e.target.value })}
                  style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: planModal.item?.status === 'PUBLISHED' ? '#f8fafc' : '#ffffff' }}
                />
              </label>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Select Chapters / Content Modules for this Plan:</div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #ccc', padding: 8, borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 6, opacity: planModal.item?.status === 'PUBLISHED' ? 0.7 : 1 }}>
                  {chapters.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>No chapters available. Create chapters in the Chapters tab.</div>
                  ) : (
                    chapters.map((ch) => {
                      const isChecked = planForm.selectedChapterIds.includes(ch.id);
                      return (
                        <label key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: planModal.item?.status === 'PUBLISHED' ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={Boolean(planModal.item?.status === 'PUBLISHED')}
                            onChange={() => {
                              if (isChecked) {
                                setPlanForm({ ...planForm, selectedChapterIds: planForm.selectedChapterIds.filter((id) => id !== ch.id) });
                              } else {
                                setPlanForm({ ...planForm, selectedChapterIds: [...planForm.selectedChapterIds, ch.id] });
                              }
                            }}
                          />
                          <span><strong>{ch.title}</strong> ({ch.blobs?.length || 0} content blocks)</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Select Question Banks (Containers) for this Plan:</div>
                <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #ccc', padding: 8, borderRadius: 4, display: 'flex', flexDirection: 'column', gap: 6, opacity: planModal.item?.status === 'PUBLISHED' ? 0.7 : 1 }}>
                  {questionBanks.length === 0 ? (
                    <div style={{ color: '#94a3b8', fontSize: 13 }}>No question banks created yet.</div>
                  ) : (
                    questionBanks.map((qb) => {
                      const isChecked = planForm.selectedBankIds.includes(qb.id);
                      return (
                        <label key={qb.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: planModal.item?.status === 'PUBLISHED' ? 'not-allowed' : 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={Boolean(planModal.item?.status === 'PUBLISHED')}
                            onChange={() => {
                              if (isChecked) {
                                setPlanForm({ ...planForm, selectedBankIds: planForm.selectedBankIds.filter((id) => id !== qb.id) });
                              } else {
                                setPlanForm({ ...planForm, selectedBankIds: [...planForm.selectedBankIds, qb.id] });
                              }
                            }}
                          />
                          <span>🏦 <strong>{qb.name}</strong> ({qb.questions?.length || 0} questions)</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Select Additional Individual Questions:</div>
                <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #ccc', padding: 8, borderRadius: 4, opacity: planModal.item?.status === 'PUBLISHED' ? 0.7 : 1 }}>
                  {questions.map((q) => {
                    const isChecked = planForm.selectedQuestionIds.includes(q.id);
                    return (
                      <label key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: planModal.item?.status === 'PUBLISHED' ? 'not-allowed' : 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={Boolean(planModal.item?.status === 'PUBLISHED')}
                          onChange={() => {
                            if (isChecked) {
                              setPlanForm({ ...planForm, selectedQuestionIds: planForm.selectedQuestionIds.filter((id) => id !== q.id) });
                            } else {
                              setPlanForm({ ...planForm, selectedQuestionIds: [...planForm.selectedQuestionIds, q.id] });
                            }
                          }}
                        />
                        <span>❓ {q.questionText}</span>
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

      {/* ── MODAL: Preview Content Block ─────────────────────────────────────── */}
      {previewModal.open && previewModal.blob && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: 24, maxWidth: 800, width: '90%', maxHeight: '90vh', overflowY: 'auto', border: '1px solid #cbd5e1', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  👁️ Student View Preview
                </span>
                <h2 style={{ margin: '4px 0 0 0', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>
                  📦 {previewModal.blob.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModal({ open: false })}
                style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#64748b', lineHeight: 1 }}
              >
                &times;
              </button>
            </div>

            {/* Mapped Knowledge Evidences */}
            {previewModal.blob.knowledgeEvidences && previewModal.blob.knowledgeEvidences.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {previewModal.blob.knowledgeEvidences.map((k) => (
                  <span key={k.id} style={{ padding: '2px 8px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: 4, fontSize: 12, fontWeight: 600, border: '1px solid #bfdbfe' }}>
                    KE: {k.code} &ndash; {k.title}
                  </span>
                ))}
              </div>
            )}

            {/* Block Content Render (Exact Replica of LmsLearnDashboard student view) */}
            <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: 8, backgroundColor: '#fafafa', marginBottom: 20 }}>
              {previewModal.blob.description && (
                <p style={{ fontSize: '0.95rem', color: '#475569', marginTop: 0, marginBottom: '1rem', fontStyle: 'italic' }}>
                  {previewModal.blob.description}
                </p>
              )}

              {previewModal.blob.contentHtml && (
                <div
                  dangerouslySetInnerHTML={{ __html: previewModal.blob.contentHtml }}
                  style={{
                    padding: '1.25rem',
                    backgroundColor: '#ffffff',
                    borderRadius: '0.5rem',
                    border: '1px solid #e2e8f0',
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    marginBottom: '1rem',
                    color: '#1e293b',
                  }}
                />
              )}

              {(previewModal.blob.azureBlobUrl || previewModal.blob.vimeoId) && (
                <div style={{ marginBottom: '1rem' }}>
                  <LmsVideoPlayer
                    title={previewModal.blob.title}
                    azureBlobUrl={previewModal.blob.azureBlobUrl}
                    vimeoId={previewModal.blob.vimeoId}
                  />
                </div>
              )}

              {!previewModal.blob.contentHtml && !previewModal.blob.azureBlobUrl && !previewModal.blob.vimeoId && (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                  No HTML text or video configured for this content block.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPreviewModal({ open: false })}
                style={{ padding: '8px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}
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
