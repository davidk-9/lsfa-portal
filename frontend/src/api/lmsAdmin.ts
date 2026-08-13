import api from './client';

export interface KnowledgeEvidence {
  id: string;
  code: string;
  title: string;
  description?: string;
  courseCodes?: Array<{ id: number; code: string; name: string }>;
  isLocked?: boolean;
  publishedPlans?: string[];
  _count?: { blobs: number; questions: number };
}

export interface Chapter {
  id: string;
  courseCodeId?: number | null;
  title: string;
  description?: string;
  sortOrder: number;
  courseCode?: { id: number; code: string; name: string };
  blobs?: LearningBlob[];
  isLocked?: boolean;
  publishedPlans?: string[];
}

export interface LearningBlob {
  id: string;
  chapterId?: string | null;
  knowledgeEvidenceIds?: string[];
  title: string;
  description?: string;
  contentHtml?: string;
  vimeoId?: string | null;
  azureBlobUrl?: string | null;
  durationSeconds: number;
  sortOrder: number;
  version?: number;
  isLocked?: boolean;
  parentBlobId?: string | null;
  knowledgeEvidences?: Array<{ id: string; code: string; title: string }>;
  chapter?: { id: string; title: string; courseCode?: { code: string } };
}

export interface QuestionBankItem {
  id: string;
  type: number;
  questionText: string;
  questionData?: any;
  correctAnswer?: any;
  benchmarkAnswer?: string;
  points: number;
  knowledgeEvidenceIds?: string[];
  coreLearningBlobId?: string | null;
  knowledgeEvidences?: Array<{ id: string; code: string; title: string }>;
  coreLearningBlob?: { id: string; title: string };
  isLocked?: boolean;
  publishedPlans?: string[];
}

export interface QuestionBank {
  id: string;
  name: string;
  description?: string;
  courseCodeId?: number | null;
  courseCode?: { id: number; code: string; name: string };
  questions?: Array<{ id: string; questionText: string; type: number; points?: number }>;
  isLocked?: boolean;
  publishedPlans?: string[];
  _count?: { plans: number };
}

export interface LearningPlan {
  id: number;
  courseCodeId: number;
  version: string;
  title: string;
  description?: string;
  status: string;
  isDefault: boolean;
  effectiveFrom?: string;
  courseCode?: { id: number; code: string; name: string };
  planChapters?: Array<{
    chapterId: string;
    sortOrder: number;
    chapter: Chapter;
  }>;
  planQuestions?: Array<{
    questionId: string;
    sortOrder: number;
    points?: number;
    question: QuestionBankItem;
  }>;
  questionBanks?: QuestionBank[];
  _count?: { lmsEnrollments: number };
}

export const lmsAdminApi = {
  // Knowledge Evidence
  getKEs: () => api.get<KnowledgeEvidence[]>('/lms-admin/ke'),
  createKE: (data: { code: string; title: string; description?: string; courseCodeIds?: number[] }) =>
    api.post<KnowledgeEvidence>('/lms-admin/ke', data),
  updateKE: (id: string, data: { code?: string; title?: string; description?: string; courseCodeIds?: number[] }) =>
    api.put<KnowledgeEvidence>(`/lms-admin/ke/${id}`, data),
  deleteKE: (id: string) => api.delete(`/lms-admin/ke/${id}`),

  // Chapters & Blobs
  getChapters: (courseCodeId?: number) => api.get<Chapter[]>(`/lms-admin/chapters${courseCodeId ? `?courseCodeId=${courseCodeId}` : ''}`),
  createChapter: (data: { courseCodeId?: number; title: string; description?: string; sortOrder?: number }) =>
    api.post<Chapter>('/lms-admin/chapters', data),
  updateChapter: (id: string, data: { title?: string; description?: string; sortOrder?: number }) =>
    api.put<Chapter>(`/lms-admin/chapters/${id}`, data),
  deleteChapter: (id: string) => api.delete(`/lms-admin/chapters/${id}`),
  saveChapterBlobs: (chapterId: string, items: Array<{ blobId: string; sortOrder: number }>) =>
    api.post<Chapter>(`/lms-admin/chapters/${chapterId}/blobs`, { items }),

  getBlobs: (chapterId?: string) => api.get<LearningBlob[]>(`/lms-admin/blobs${chapterId ? `?chapterId=${chapterId}` : ''}`),
  createBlob: (data: {
    chapterId?: string;
    knowledgeEvidenceIds?: string[];
    title: string;
    description?: string;
    contentHtml?: string;
    vimeoId?: string;
    azureBlobUrl?: string;
    durationSeconds?: number;
    sortOrder?: number;
  }) => api.post<LearningBlob>('/lms-admin/blobs', data),
  updateBlob: (
    id: string,
    data: {
      chapterId?: string;
      knowledgeEvidenceIds?: string[];
      title?: string;
      description?: string;
      contentHtml?: string;
      vimeoId?: string;
      azureBlobUrl?: string;
      durationSeconds?: number;
      sortOrder?: number;
    },
  ) => api.put<LearningBlob>(`/lms-admin/blobs/${id}`, data),
  deleteBlob: (id: string) => api.delete(`/lms-admin/blobs/${id}`),

  // Question Banks
  getQuestionBanks: (courseCodeId?: number) =>
    api.get<QuestionBank[]>(`/lms-admin/question-banks${courseCodeId ? `?courseCodeId=${courseCodeId}` : ''}`),
  createQuestionBank: (data: { name: string; description?: string; courseCodeId?: number; questionIds?: string[] }) =>
    api.post<QuestionBank>('/lms-admin/question-banks', data),
  updateQuestionBank: (id: string, data: { name?: string; description?: string; courseCodeId?: number; questionIds?: string[] }) =>
    api.put<QuestionBank>(`/lms-admin/question-banks/${id}`, data),
  deleteQuestionBank: (id: string) => api.delete(`/lms-admin/question-banks/${id}`),

  // Question Bank Items
  getQuestions: () => api.get<QuestionBankItem[]>('/lms-admin/questions'),
  createQuestion: (data: {
    type: number;
    questionText: string;
    questionData?: any;
    correctAnswer?: any;
    benchmarkAnswer?: string;
    points?: number;
    knowledgeEvidenceIds?: string[];
    coreLearningBlobId?: string;
  }) => api.post<QuestionBankItem>('/lms-admin/questions', data),
  updateQuestion: (
    id: string,
    data: {
      type?: number;
      questionText?: string;
      questionData?: any;
      correctAnswer?: any;
      benchmarkAnswer?: string;
      points?: number;
      knowledgeEvidenceIds?: string[];
      coreLearningBlobId?: string;
    },
  ) => api.put<QuestionBankItem>(`/lms-admin/questions/${id}`, data),
  deleteQuestion: (id: string) => api.delete(`/lms-admin/questions/${id}`),

  // Learning Plans
  getPlans: (courseCodeId?: number) => api.get<LearningPlan[]>(`/lms-admin/plans${courseCodeId ? `?courseCodeId=${courseCodeId}` : ''}`),
  createPlan: (data: { courseCodeId: number; version: string; title: string; description?: string; isDefault?: boolean; status?: string }) =>
    api.post<LearningPlan>('/lms-admin/plans', data),
  updatePlan: (id: number, data: { title?: string; description?: string; status?: string; isDefault?: boolean }) =>
    api.put<LearningPlan>(`/lms-admin/plans/${id}`, data),
  clonePlanToDraft: (id: number, incrementType: 'minor' | 'major') =>
    api.post<LearningPlan>(`/lms-admin/plans/${id}/clone-draft`, { incrementType }),
  setPlanQuestions: (
    planId: number,
    items: Array<{ questionId: string; sortOrder: number; points?: number }>,
  ) => api.post<LearningPlan>(`/lms-admin/plans/${planId}/questions`, { items }),
  setPlanChapters: (
    planId: number,
    items: Array<{ chapterId: string; sortOrder: number }>,
  ) => api.post<LearningPlan>(`/lms-admin/plans/${planId}/chapters`, { items }),
  setPlanQuestionBanks: (planId: number, bankIds: string[]) =>
    api.post<LearningPlan>(`/lms-admin/plans/${planId}/question-banks`, { bankIds }),
};
