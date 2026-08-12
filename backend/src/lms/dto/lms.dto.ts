import { IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionType, LearningMode } from '../enums/lms-enums';

export class UpdateLearningModeDto {
  @IsEnum(LearningMode)
  learningMode!: LearningMode;
}

export class BlankResponseDto {
  @IsInt()
  blankIndex!: number;

  @IsString()
  @IsNotEmpty()
  answer!: string;
}

export class QuestionResponseDto {
  @IsString()
  @IsNotEmpty()
  questionId!: string;

  @IsOptional()
  @IsString()
  answer?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  answerArray?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BlankResponseDto)
  blankResponses?: BlankResponseDto[];

  @IsOptional()
  @IsString()
  formData?: string;
}

export class SubmitAssessmentDto {
  @IsString()
  @IsNotEmpty()
  enrollmentId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionResponseDto)
  responses!: QuestionResponseDto[];
}

export class RecordBlobViewDto {
  @IsString()
  @IsNotEmpty()
  blobId!: string;

  @IsOptional()
  @IsString()
  blobType?: string;

  @IsInt()
  viewDurationSeconds!: number;

  @IsOptional()
  completedView?: boolean;
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
  questionType: QuestionType;
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

export interface BlankResult {
  blankIndex: number;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface QuestionProgress {
  questionId: string;
  questionType: number;
  answeredAt: string;
  isCorrect: boolean;
  pointsEarned: number;
  answer?: string;
  blankResults?: BlankResult[];
  answerArray?: string[];
  attemptCount: number;
}

export interface BlobView {
  blobId: string;
  blobType: string;
  viewedAt: string;
  viewDurationSeconds: number;
  completedView: boolean;
}

export interface AssessmentAttempt {
  attemptedAt: string;
  questionsAnswered: number;
  questionsCorrect: number;
  pointsEarned: number;
  totalPoints: number;
  passedCompetency: boolean;
  failedQuestionIds: string[];
}

export interface ProgressDataModel {
  answeredQuestions: QuestionProgress[];
  viewedBlobs: BlobView[];
  requiredReview: string[];
  assessmentAttempts: AssessmentAttempt[];
  lastActivityAt: string;
  currentQuestionIndex: number;
  isCompetent: boolean;
}
