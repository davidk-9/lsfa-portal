import axios from 'axios';
import type { Enrollment, Question, QuestionAnswer, AssessmentSummaryDto, LearningMode } from '../types/lms';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const API_BASE_URL = `${BASE_URL}/lms`;

export const lmsApi = {
  async getEnrollment(id: string): Promise<Enrollment> {
    const response = await axios.get<Enrollment>(`${API_BASE_URL}/enrollment/${id}`);
    return response.data;
  },

  async getEnrollmentContent(id: string): Promise<{
    enrollmentId: string;
    chapters: Array<{
      id: string;
      title: string;
      description?: string;
      sortOrder: number;
      blobs: Array<{
        id: string;
        title: string;
        description?: string;
        contentHtml?: string;
        vimeoId?: string | null;
        azureBlobUrl?: string | null;
        durationSeconds: number;
        status: 'unread' | 'viewed' | 'competent' | 'needs_review';
        knowledgeEvidence?: { id: string; code: string; title: string };
      }>;
    }>;
    isOverallCompetent: boolean;
    requiredReviewCount: number;
  }> {
    const response = await axios.get(`${API_BASE_URL}/enrollment/${id}/content`);
    return response.data;
  },

  async updateLearningMode(id: string, learningMode: LearningMode): Promise<Enrollment> {
    const response = await axios.patch<Enrollment>(`${API_BASE_URL}/enrollment/${id}/mode`, { learningMode });
    return response.data;
  },

  async getQuestionsForUnit(unitCode: string): Promise<Question[]> {
    const response = await axios.get<Question[]>(`${API_BASE_URL}/units/${unitCode}/questions`);
    return response.data;
  },

  async submitAssessment(enrollmentId: string, responses: QuestionAnswer[]): Promise<AssessmentSummaryDto> {
    const response = await axios.post<AssessmentSummaryDto>(`${API_BASE_URL}/enrollment/submit-assessment`, {
      enrollmentId,
      responses,
    });
    return response.data;
  },

  async recordBlobView(
    enrollmentId: string,
    blobId: string,
    viewDurationSeconds: number,
    completedView: boolean = true,
  ): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/enrollment/${enrollmentId}/blob-viewed`, {
      blobId,
      viewDurationSeconds,
      completedView,
    });
    return response.data;
  },

  async seedDatabase(): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/seed`);
    return response.data;
  },
};
