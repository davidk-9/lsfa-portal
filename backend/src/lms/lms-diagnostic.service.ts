import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  SubmitAssessmentDto,
  QuestionResponseDto,
  AssessmentSummaryDto,
  QuestionResultDto,
  LearningGapDto,
  BlankResultDto,
  ProgressDataModel,
  QuestionProgress,
  BlankResult,
  AssessmentAttempt,
} from './dto/lms.dto';
import { QuestionType } from './enums/lms-enums';

@Injectable()
export class LmsDiagnosticService {
  constructor(private readonly prisma: PrismaService) {}

  async submitAssessment(request: SubmitAssessmentDto): Promise<AssessmentSummaryDto> {
    const enrollment = await this.prisma.lmsEnrollment.findUnique({
      where: { id: request.enrollmentId },
      include: {
        learningPlan: {
          include: {
            planQuestions: {
              orderBy: { sortOrder: 'asc' },
              include: {
                question: {
                  include: {
                    coreLearningBlob: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!enrollment || !enrollment.learningPlan) {
      throw new NotFoundException(`Enrollment with ID ${request.enrollmentId} or its learning plan not found`);
    }

    const planQuestions = enrollment.learningPlan.planQuestions;
    const questions = planQuestions.map((pq) => ({
      ...pq.question,
      points: pq.points ?? pq.question.points,
    }));

    const results: QuestionResultDto[] = [];
    const gapsMap = new Map<string, LearningGapDto>();
    const failedQuestionIds: string[] = [];

    let totalPoints = 0;
    let earnedPoints = 0;

    for (const response of request.responses) {
      const question = questions.find((q) => q.id === response.questionId);
      if (!question) {
        throw new BadRequestException(`Question ${response.questionId} not found in learning plan`);
      }

      totalPoints += question.points;

      const result = this.gradeQuestion(question, response);
      results.push(result);

      if (result.isCorrect) {
        earnedPoints += result.pointsEarned;
      } else {
        failedQuestionIds.push(question.id);

        if (question.coreLearningBlobId && question.coreLearningBlob) {
          const blob = question.coreLearningBlob;
          const existingGap = gapsMap.get(blob.id);
          if (existingGap) {
            existingGap.failedQuestions.push(question.questionText);
          } else {
            gapsMap.set(blob.id, {
              blobId: blob.id,
              title: blob.title,
              description: blob.description,
              vimeoId: blob.vimeoId,
              azureBlobUrl: blob.azureBlobUrl,
              durationSeconds: blob.durationSeconds,
              failedQuestions: [question.questionText],
            });
          }
        }
      }
    }

    const isCompetent = failedQuestionIds.length === 0;

    await this.updateProgressData(
      enrollment.id,
      enrollment.progressData,
      request.responses,
      results,
      isCompetent,
      failedQuestionIds,
      earnedPoints,
      totalPoints,
      questions,
    );

    return {
      enrollmentId: enrollment.id,
      isCompetent,
      totalQuestions: request.responses.length,
      correctAnswers: results.filter((r) => r.isCorrect).length,
      totalPoints,
      pointsEarned: earnedPoints,
      submittedAt: new Date().toISOString(),
      gaps: Array.from(gapsMap.values()),
      questionResults: results,
    };
  }

  private gradeQuestion(question: any, response: QuestionResponseDto): QuestionResultDto {
    if (!question.correctAnswer) {
      throw new BadRequestException(`Question ${question.id} has no correct answer defined`);
    }

    const correctAnswerObj = typeof question.correctAnswer === 'string'
      ? JSON.parse(question.correctAnswer)
      : question.correctAnswer;

    switch (question.type) {
      case QuestionType.MultipleChoiceSingle:
        return this.gradeMultipleChoiceSingle(question, response, correctAnswerObj);
      case QuestionType.MultipleChoiceMultiple:
        return this.gradeMultipleChoiceMultiple(question, response, correctAnswerObj);
      case QuestionType.OrderItems:
        return this.gradeOrderItems(question, response, correctAnswerObj);
      case QuestionType.MatchDefinitions:
        return this.gradeMatchDefinitions(question, response, correctAnswerObj);
      case QuestionType.FillInBlanks:
        return this.gradeFillInBlanks(question, response, correctAnswerObj);
      case QuestionType.FreeText:
        return this.gradeFreeText(question, response, correctAnswerObj);
      case QuestionType.Forms:
        return this.gradeForms(question, response, correctAnswerObj);
      default:
        throw new BadRequestException(`Unknown question type: ${question.type}`);
    }
  }

  private gradeMultipleChoiceSingle(
    question: any,
    response: QuestionResponseDto,
    correctAnswerObj: any,
  ): QuestionResultDto {
    const expected = (correctAnswerObj?.answer || '').trim().toUpperCase();
    const student = (response.answer || '').trim().toUpperCase();
    const isCorrect = student === expected && student !== '';

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
      possiblePoints: question.points,
    };
  }

  private gradeMultipleChoiceMultiple(
    question: any,
    response: QuestionResponseDto,
    correctAnswerObj: any,
  ): QuestionResultDto {
    const expected = (correctAnswerObj?.answers || []).map((a: string) => a.trim().toUpperCase()).sort();
    const student = (response.answerArray || []).map((a: string) => a.trim().toUpperCase()).sort();

    const isCorrect = expected.length > 0 &&
      expected.length === student.length &&
      expected.every((val: string, idx: number) => val === student[idx]);

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
      possiblePoints: question.points,
    };
  }

  private gradeOrderItems(
    question: any,
    response: QuestionResponseDto,
    correctAnswerObj: any,
  ): QuestionResultDto {
    const expected = (correctAnswerObj?.order || []).map(String);
    const student = (response.answerArray || []).map(String);

    const isCorrect = expected.length > 0 &&
      expected.length === student.length &&
      expected.every((val: string, idx: number) => val === student[idx]);

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
      possiblePoints: question.points,
    };
  }

  private gradeMatchDefinitions(
    question: any,
    response: QuestionResponseDto,
    correctAnswerObj: any,
  ): QuestionResultDto {
    const expected = (correctAnswerObj?.matches || []).map(String);
    const student = (response.answerArray || []).map(String);

    const isCorrect = expected.length > 0 &&
      expected.length === student.length &&
      expected.every((val: string, idx: number) => val === student[idx]);

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      isCorrect,
      pointsEarned: isCorrect ? question.points : 0,
      possiblePoints: question.points,
    };
  }

  private gradeFillInBlanks(
    question: any,
    response: QuestionResponseDto,
    correctAnswerObj: any,
  ): QuestionResultDto {
    const expectedBlanks: string[] = correctAnswerObj?.blanks || [];
    const studentBlanks = response.blankResponses || [];

    const blankResults: BlankResultDto[] = [];
    let correctCount = 0;

    for (let i = 0; i < expectedBlanks.length; i++) {
      const studentBlank = studentBlanks.find((b) => b.blankIndex === i);
      const studentAnswer = studentBlank?.answer?.trim() || '';
      const correctAnswer = expectedBlanks[i].trim();

      const isCorrect = this.normalizeAnswer(studentAnswer) === this.normalizeAnswer(correctAnswer) && studentAnswer !== '';

      if (isCorrect) correctCount++;

      blankResults.push({
        blankIndex: i,
        studentAnswer,
        correctAnswer,
        isCorrect,
      });
    }

    const pointsEarned = expectedBlanks.length > 0
      ? Math.round((correctCount / expectedBlanks.length) * question.points)
      : 0;
    const allCorrect = expectedBlanks.length > 0 && correctCount === expectedBlanks.length;

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      isCorrect: allCorrect,
      pointsEarned,
      possiblePoints: question.points,
      blankResults,
    };
  }

  private gradeFreeText(
    question: any,
    response: QuestionResponseDto,
    correctAnswerObj: any,
  ): QuestionResultDto {
    const studentAnswer = response.answer || '';
    const keywords: string[] = correctAnswerObj?.keywords || [];
    const benchmarkAnswer: string | undefined = question.benchmarkAnswer;

    const evaluation = this.evaluateSemanticSimilarity(studentAnswer, benchmarkAnswer, keywords);
    const pointsEarned = evaluation.isCorrect
      ? Math.round(question.points * Math.max(evaluation.confidenceScore / 100, 0.5))
      : 0;

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      isCorrect: evaluation.isCorrect,
      pointsEarned,
      possiblePoints: question.points,
    };
  }

  private gradeForms(
    question: any,
    response: QuestionResponseDto,
    correctAnswerObj: any,
  ): QuestionResultDto {
    const formDataStr = response.formData || '';
    const hasFormData = Boolean(formDataStr.trim().length > 0);

    let evaluation = { isCorrect: hasFormData, confidenceScore: hasFormData ? 100 : 0 };
    if (hasFormData && question.benchmarkAnswer) {
      evaluation = this.evaluateSemanticSimilarity(formDataStr, question.benchmarkAnswer);
    }

    return {
      questionId: question.id,
      questionText: question.questionText,
      questionType: question.type,
      isCorrect: evaluation.isCorrect,
      pointsEarned: evaluation.isCorrect ? question.points : 0,
      possiblePoints: question.points,
    };
  }

  private evaluateSemanticSimilarity(
    studentAnswer: string,
    benchmarkAnswer?: string,
    keywords?: string[],
  ): { isCorrect: boolean; confidenceScore: number } {
    if (!studentAnswer || !studentAnswer.trim()) {
      return { isCorrect: false, confidenceScore: 0 };
    }

    const studentNormalized = studentAnswer.toLowerCase().trim();
    let score = 0;
    let factors = 0;

    // 1. Keyword coverage check
    if (keywords && keywords.length > 0) {
      factors++;
      const matchedKeywords = keywords.filter((kw) =>
        studentNormalized.includes(kw.toLowerCase().trim()),
      );
      const keywordRatio = matchedKeywords.length / keywords.length;
      score += keywordRatio;
    }

    // 2. Token Jaccard vector similarity against benchmark answer
    if (benchmarkAnswer && benchmarkAnswer.trim()) {
      factors++;
      const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'this', 'that']);
      const studentTokens = new Set(
        studentNormalized
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((t) => t.length > 2 && !stopWords.has(t)),
      );

      const benchmarkTokens = new Set(
        benchmarkAnswer
          .toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter((t) => t.length > 2 && !stopWords.has(t)),
      );

      if (benchmarkTokens.size > 0) {
        let intersectionCount = 0;
        for (const token of studentTokens) {
          if (benchmarkTokens.has(token)) {
            intersectionCount++;
          }
        }
        const jaccardSimilarity = intersectionCount / Math.max(benchmarkTokens.size, 1);
        score += jaccardSimilarity;
      }
    }

    const finalConfidence = factors > 0 ? score / factors : (studentNormalized.length >= 15 ? 0.6 : 0.2);
    const isCorrect = finalConfidence >= 0.4; // 40% similarity match threshold

    return { isCorrect, confidenceScore: Math.min(Math.round(finalConfidence * 100), 100) };
  }

  private async updateProgressData(
    enrollmentId: string,
    existingProgressRaw: any,
    responses: QuestionResponseDto[],
    results: QuestionResultDto[],
    isCompetent: boolean,
    failedQuestionIds: string[],
    earnedPoints: number,
    totalPoints: number,
    questions: any[],
  ) {
    const progressData: ProgressDataModel = existingProgressRaw && typeof existingProgressRaw === 'object'
      ? {
          answeredQuestions: existingProgressRaw.answeredQuestions || [],
          viewedBlobs: existingProgressRaw.viewedBlobs || [],
          requiredReview: existingProgressRaw.requiredReview || [],
          assessmentAttempts: existingProgressRaw.assessmentAttempts || [],
          lastActivityAt: existingProgressRaw.lastActivityAt || new Date().toISOString(),
          currentQuestionIndex: existingProgressRaw.currentQuestionIndex || 0,
          isCompetent: existingProgressRaw.isCompetent || false,
        }
      : {
          answeredQuestions: [],
          viewedBlobs: [],
          requiredReview: [],
          assessmentAttempts: [],
          lastActivityAt: new Date().toISOString(),
          currentQuestionIndex: 0,
          isCompetent: false,
        };

    for (const result of results) {
      const existingAnswer = progressData.answeredQuestions.find((q) => q.questionId === result.questionId);
      if (existingAnswer) {
        existingAnswer.attemptCount++;
        existingAnswer.isCorrect = result.isCorrect;
        existingAnswer.pointsEarned = result.pointsEarned;
        existingAnswer.answeredAt = new Date().toISOString();
        if (result.blankResults) {
          existingAnswer.blankResults = result.blankResults.map((br) => ({
            blankIndex: br.blankIndex,
            studentAnswer: br.studentAnswer,
            correctAnswer: br.correctAnswer,
            isCorrect: br.isCorrect,
          }));
        }
      } else {
        const resp = responses.find((r) => r.questionId === result.questionId);
        progressData.answeredQuestions.push({
          questionId: result.questionId,
          questionType: result.questionType,
          answeredAt: new Date().toISOString(),
          isCorrect: result.isCorrect,
          pointsEarned: result.pointsEarned,
          answer: resp?.answer,
          answerArray: resp?.answerArray,
          blankResults: result.blankResults?.map((br) => ({
            blankIndex: br.blankIndex,
            studentAnswer: br.studentAnswer,
            correctAnswer: br.correctAnswer,
            isCorrect: br.isCorrect,
          })),
          attemptCount: 1,
        });
      }
    }

    const reviewBlobIds = failedQuestionIds
      .map((qId) => questions.find((q) => q.id === qId)?.coreLearningBlobId)
      .filter((bId): bId is string => Boolean(bId));

    progressData.requiredReview = Array.from(new Set(reviewBlobIds));

    progressData.assessmentAttempts.push({
      attemptedAt: new Date().toISOString(),
      questionsAnswered: results.length,
      questionsCorrect: results.filter((r) => r.isCorrect).length,
      pointsEarned: earnedPoints,
      totalPoints,
      passedCompetency: isCompetent,
      failedQuestionIds,
    });

    progressData.isCompetent = isCompetent;
    progressData.lastActivityAt = new Date().toISOString();

    await this.prisma.lmsEnrollment.update({
      where: { id: enrollmentId },
      data: {
        progressData: progressData as any,
        currentScore: earnedPoints,
        possibleScore: totalPoints,
        isCompetent,
        completedAt: isCompetent ? new Date() : null,
      },
    });
  }

  private normalizeAnswer(answer: string): string {
    return answer.trim().toLowerCase().replace(/[\s\-_]/g, '');
  }
}
