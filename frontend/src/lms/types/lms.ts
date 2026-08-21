export const QuestionType = {
  MultipleChoiceSingle: 1,
  MultipleChoiceMultiple: 2,
  OrderItems: 3,
  MatchDefinitions: 4,
  FillInBlanks: 5,
  FreeText: 6,
  Forms: 7,
} as const;

export type QuestionType = typeof QuestionType[keyof typeof QuestionType];

export const LearningMode = {
  FastTrack: 1,
  Refresher: 2,
  DeepDive: 3,
  Offline: 4,
} as const;

export type LearningMode = typeof LearningMode[keyof typeof LearningMode];

export interface Student {
  id: number | string;
  contactId?: number;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Unit {
  id: number | string;
  unitCode: string;
  title: string;
  description?: string | null;
}

export interface Enrollment {
  id: string;
  contactId: number;
  instanceId?: number | null;
  learningPlanId: number;
  learningMode: LearningMode;
  enrolledAt: string;
  completedAt?: string | null;
  isActive: boolean;
  currentScore: number;
  possibleScore: number;
  isCompetent: boolean;
  student: Student;
  unit: Unit;
}

export interface LearningBlob {
  id: string;
  title: string;
  description?: string | null;
  vimeoId?: string | null;
  azureBlobUrl?: string | null;
  durationSeconds: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  questionText: string;
  questionData?: any;
  correctAnswer?: any;
  points: number;
  coreLearningBlobId?: string | null;
  supportLearningBlobId?: string | null;
  coreLearningBlob?: LearningBlob | null;
  supportLearningBlob?: LearningBlob | null;
  knowledgeEvidences?: Array<{ id: string; code: string; title: string }>;
}

export interface QuestionAnswer {
  questionId: string;
  questionType: QuestionType;
  answer?: string;
  answerArray?: string[];
  blankResponses?: Array<{ blankIndex: number; answer: string }>;
  formData?: string;
}

export interface BlankResultDto {
  blankIndex: number;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface QuestionResultDto {
  questionId: string;
  questionText: string;
  questionType: number;
  isCorrect: boolean;
  pointsEarned: number;
  possiblePoints: number;
  blankResults?: BlankResultDto[];
}

export interface LearningGapDto {
  blobId: string;
  title: string;
  description?: string | null;
  vimeoId?: string | null;
  azureBlobUrl?: string | null;
  durationSeconds: number;
  failedQuestions: string[];
}

export interface AssessmentSummaryDto {
  enrollmentId: string;
  isCompetent: boolean;
  totalQuestions: number;
  correctAnswers: number;
  totalPoints: number;
  pointsEarned: number;
  submittedAt: string;
  gaps: LearningGapDto[];
  questionResults: QuestionResultDto[];
}
