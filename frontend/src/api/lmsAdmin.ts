import api from './client';

export interface KnowledgeEvidence {
  id: string;
  code: string;
  title: string;
  description?: string;
  courseCodes?: Array<{ id: number; code: string; name: string }>;
  _count?: { blobs: number; questions: number };
}

export interface Chapter {
  id: string;
  courseCodeId: number;
  title: string;
  description?: string;
  sortOrder: number;
  blobs?: LearningBlob[];
}

export interface LearningBlob {
  id: string;
  chapterId?: string | null;
  knowledgeEvidenceId?: string | null;
  title: string;
  description?: string;
  contentHtml?: string;
  vimeoId?: string | null;
  azureBlobUrl?: string | null;
  durationSeconds: number;
  sortOrder: number;
  knowledgeEvidence?: { id: string; code: string; title: string };
}

export interface QuestionBankItem {
  id: string;
  type: number;
  questionText: string;
  questionData?: any;
  correctAnswer?: any;
  benchmarkAnswer?: string;
  points: number;
  knowledgeEvidenceId?: string | null;
  coreLearningBlobId?: string | null;
  knowledgeEvidence?: { id: string; code: string; title: string };
  coreLearningBlob?: { id: string; title: string };
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
  planQuestions?: Array<{
    questionId: string;
    sortOrder: number;
    points?: number;
    question: QuestionBankItem;
  }>;
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
  getChapters: (courseCodeId: number) => api.get<Chapter[]>(`/lms-admin/chapters?courseCodeId=${courseCodeId}`),
  createChapter: (data: { courseCodeId: number; title: string; description?: string; sortOrder?: number }) =>
    api.post<Chapter>('/lms-admin/chapters', data),
  updateChapter: (id: string, data: { title?: string; description?: string; sortOrder?: number }) =>
    api.put<Chapter>(`/lms-admin/chapters/${id}`, data),
  deleteChapter: (id: string) => api.delete(`/lms-admin/chapters/${id}`),

  createBlob: (data: {
    chapterId?: string;
    knowledgeEvidenceId?: string;
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
      knowledgeEvidenceId?: string;
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

  // Question Bank
  getQuestions: () => api.get<QuestionBankItem[]>('/lms-admin/questions'),
  createQuestion: (data: {
    type: number;
    questionText: string;
    questionData?: any;
    correctAnswer?: any;
    benchmarkAnswer?: string;
    points?: number;
    knowledgeEvidenceId?: string;
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
      knowledgeEvidenceId?: string;
      coreLearningBlobId?: string;
    },
  ) => api.put<QuestionBankItem>(`/lms-admin/questions/${id}`, data),
  deleteQuestion: (id: string) => api.delete(`/lms-admin/questions/${id}`),

  // Learning Plans
  getPlans: (courseCodeId?: number) => api.get<LearningPlan[]>(`/lms-admin/plans${courseCodeId ? `?courseCodeId=${courseCodeId}` : ''}`),
  createPlan: (data: { courseCodeId: number; version: string; title: string; description?: string; isDefault?: boolean }) =>
    api.post<LearningPlan>('/lms-admin/plans', data),
  updatePlan: (id: number, data: { title?: string; description?: string; status?: string; isDefault?: boolean }) =>
    api.put<LearningPlan>(`/lms-admin/plans/${id}`, data),
  setPlanQuestions: (
    planId: number,
    items: Array<{ questionId: string; sortOrder: number; points?: number }>,
  ) => api.post<LearningPlan>(`/lms-admin/plans/${planId}/questions`, { items }),
};
