import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { lmsApi } from '../../services/lmsApi';
import { QuestionType, type Question, type QuestionAnswer } from '../../types/lms';
import { QuestionRenderer } from './QuestionRenderer';
import { HelpModal } from './HelpModal';

function checkQuestionIsCorrect(question: Question, value: any): boolean {
  if (value === undefined || value === null) return false;
  if (!question.correctAnswer) return false;

  const rawCorrect = typeof question.correctAnswer === 'string'
    ? JSON.parse(question.correctAnswer)
    : question.correctAnswer;

  switch (question.type) {
    case QuestionType.MultipleChoiceSingle: {
      const expected = (rawCorrect?.answer || rawCorrect || '').toString().trim().toUpperCase();
      const student = (value || '').toString().trim().toUpperCase();
      return student !== '' && student === expected;
    }
    case QuestionType.MultipleChoiceMultiple: {
      const expected = (rawCorrect?.answers || []).map((a: any) => String(a).trim().toUpperCase()).sort();
      const student = (Array.isArray(value) ? value : []).map((a: any) => String(a).trim().toUpperCase()).sort();
      return expected.length > 0 && expected.length === student.length && expected.every((val: string, idx: number) => val === student[idx]);
    }
    case QuestionType.OrderItems: {
      const expected = (rawCorrect?.order || []).map(String);
      const student = (Array.isArray(value) ? value : []).map(String);
      return expected.length > 0 && expected.length === student.length && expected.every((val: string, idx: number) => val === student[idx]);
    }
    case QuestionType.MatchDefinitions: {
      const expected = (rawCorrect?.matches || []).map(String).sort();
      const student = (Array.isArray(value) ? value : []).map(String).sort();
      return expected.length > 0 && expected.length === student.length && expected.every((val: string, idx: number) => val === student[idx]);
    }
    case QuestionType.FillInBlanks: {
      const expected = (rawCorrect?.blanks || []).map((b: any) => String(b).trim().toLowerCase());
      let student: string[] = [];
      if (Array.isArray(value)) {
        student = value.map((v: any) => String(v?.answer || v || '').trim().toLowerCase());
      } else if (value && typeof value === 'object') {
        student = Object.keys(value).sort((a, b) => Number(a) - Number(b)).map((k) => String(value[k]?.answer || value[k] || '').trim().toLowerCase());
      }
      return expected.length > 0 && expected.length === student.length && expected.every((val: string, idx: number) => val === student[idx]);
    }
    case QuestionType.FreeText: {
      const str = String(value || '').trim();
      return str.length >= 10;
    }
    case QuestionType.Forms: {
      return Boolean(value);
    }
    default:
      return false;
  }
}

export function AssessmentContainer() {
  const { enrollment, unit } = useSession();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [allBlobs, setAllBlobs] = useState<Array<{ id: string; knowledgeEvidences?: Array<{ id: string }> }>>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, any>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    if (!unit) {
      navigate('/lms');
      return;
    }

    async function loadQuestionsAndBlobs() {
      if (!unit) return;
      try {
        setIsLoading(true);
        const [fetchedQuestions, content] = await Promise.all([
          lmsApi.getQuestionsForUnit(unit.unitCode, enrollment?.id),
          enrollment ? lmsApi.getEnrollmentContent(enrollment.id) : Promise.resolve({ chapters: [] }),
        ]);

        setQuestions(fetchedQuestions);

        const blobs = (content.chapters || []).flatMap((ch: any) => ch.blobs || []);
        setAllBlobs(blobs);
      } catch (err: any) {
        console.error('Failed to load questions:', err);
        setError('Failed to load questions. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadQuestionsAndBlobs();
  }, [unit, enrollment, navigate]);

  if (!enrollment || !unit) return null;

  if (isLoading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>Loading assessment questions...</p>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#fef2f2', borderRadius: '0.5rem', border: '1px solid #fecaca' }}>
          <p style={{ fontSize: '1.25rem', color: '#dc2626', marginBottom: '1rem' }}>{error || 'No questions available for this unit.'}</p>
          <button
            type="button"
            onClick={() => navigate('/lms/select-mode')}
            style={{ padding: '0.5rem 1rem', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const currentAnswer = answers.get(currentQuestion.id);

  const handleAnswerChange = (val: any) => {
    const updated = new Map(answers);
    updated.set(currentQuestion.id, val);
    setAnswers(updated);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const canSubmit = answers.size === questions.length;

  // Live Metrics
  const totalQuestions = questions.length;
  const answeredCount = answers.size;
  const progressPercent = totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0;

  const failedKeIds = new Set<string>();
  const failedBlobIds = new Set<string>();
  let correctCount = 0;

  answers.forEach((val, qId) => {
    const q = questions.find((item) => item.id === qId);
    if (!q) return;

    const isCorrect = checkQuestionIsCorrect(q, val);
    if (isCorrect) {
      correctCount++;
    } else {
      if (q.coreLearningBlobId) failedBlobIds.add(q.coreLearningBlobId);
      if (q.supportLearningBlobId) failedBlobIds.add(q.supportLearningBlobId);

      if (q.knowledgeEvidences && Array.isArray(q.knowledgeEvidences)) {
        q.knowledgeEvidences.forEach((ke: any) => {
          if (ke?.id) failedKeIds.add(ke.id);
        });
      }
    }
  });

  const reviewBlobSet = new Set<string>();
  allBlobs.forEach((blob) => {
    if (failedBlobIds.has(blob.id)) {
      reviewBlobSet.add(blob.id);
    } else if (blob.knowledgeEvidences && Array.isArray(blob.knowledgeEvidences)) {
      const sharesKe = blob.knowledgeEvidences.some((ke: any) => failedKeIds.has(ke.id));
      if (sharesKe) {
        reviewBlobSet.add(blob.id);
      }
    }
  });

  const topicsNeedingReviewCount = reviewBlobSet.size;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      setIsSubmitting(true);

      const responses: QuestionAnswer[] = Array.from(answers.entries()).map(([questionId, value]) => {
        const question = questions.find((q) => q.id === questionId)!;
        const resp: QuestionAnswer = { questionId, questionType: question.type };

        switch (question.type) {
          case QuestionType.MultipleChoiceSingle:
          case QuestionType.FreeText:
            resp.answer = value;
            break;
          case QuestionType.MultipleChoiceMultiple:
          case QuestionType.MatchDefinitions:
            resp.answerArray = value;
            break;
          case QuestionType.OrderItems:
            resp.answerArray = value.map((v: number) => String(v));
            break;
          case QuestionType.FillInBlanks:
            resp.blankResponses = value;
            break;
          case QuestionType.Forms:
            resp.formData = typeof value === 'string' ? value : JSON.stringify(value);
            break;
        }

        return resp;
      });

      const result = await lmsApi.submitAssessment(enrollment.id, responses);
      navigate('/lms/results', { state: { result } });
    } catch (err: any) {
      console.error('Failed to submit assessment:', err);
      alert(`Failed to submit assessment: ${err.response?.data?.message || err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#1e3a8a', marginBottom: '0.25rem' }}>
          {unit.unitCode} - {unit.title}
        </h2>
        <p style={{ fontSize: '1rem', color: '#6b7280' }}>
          Fast-Track Assessment Mode
        </p>
      </div>

      {/* Progress Bar & Live Metrics Box */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '1.25rem 1.5rem', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.04)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#334155' }}>
          <span>Question {currentIndex + 1} of {totalQuestions}</span>
          <span>{answeredCount} of {totalQuestions} answered ({progressPercent}%)</span>
        </div>

        {/* Progress Bar Track */}
        <div style={{ width: '100%', height: 10, backgroundColor: '#f1f5f9', borderRadius: 999, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              backgroundColor: '#2563eb',
              borderRadius: 999,
              transition: 'width 0.3s ease-in-out',
            }}
          />
        </div>

        {/* Live Metrics Row */}
        <div style={{ display: 'flex', gap: 12, marginTop: 14, paddingTop: 12, borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#166534', backgroundColor: '#f0fdf4', padding: '6px 12px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
            <span>✅</span>
            <span>{correctCount} / {answeredCount} correct</span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: topicsNeedingReviewCount > 0 ? '#991b1b' : '#334155',
              backgroundColor: topicsNeedingReviewCount > 0 ? '#fef2f2' : '#f8fafc',
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${topicsNeedingReviewCount > 0 ? '#fecaca' : '#e2e8f0'}`,
            }}
          >
            <span>{topicsNeedingReviewCount > 0 ? '🔴' : '📖'}</span>
            <span>{topicsNeedingReviewCount} {topicsNeedingReviewCount === 1 ? 'topic requires' : 'topics require'} review</span>
          </div>
        </div>
      </div>

      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb',
          marginTop: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
          {currentQuestion.type !== QuestionType.FillInBlanks && currentQuestion.type !== QuestionType.Forms ? (
            <div
              className="lms-rich-content"
              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', lineHeight: 1.5, flex: 1 }}
              dangerouslySetInnerHTML={{ __html: currentQuestion.questionText }}
            />
          ) : (
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', lineHeight: 1.5, margin: 0, flex: 1 }}>
              {currentQuestion.type === QuestionType.Forms ? 'Fill out the form / checklist below:' : 'Complete the sentence(s) below:'}
            </h3>
          )}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #bfdbfe',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginLeft: '1rem',
            }}
          >
            💡 Need Help?
          </button>
        </div>

        <QuestionRenderer question={currentQuestion} value={currentAnswer} onChange={handleAnswerChange} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb' }}>
          <button
            type="button"
            onClick={handleBack}
            disabled={currentIndex === 0}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.375rem',
              border: '1px solid #d1d5db',
              backgroundColor: currentIndex === 0 ? '#f3f4f6' : '#ffffff',
              color: currentIndex === 0 ? '#9ca3af' : '#374151',
              fontWeight: 600,
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            ← Previous
          </button>

          {currentIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.375rem',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Next →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || isSubmitting}
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '0.375rem',
                backgroundColor: canSubmit && !isSubmitting ? '#16a34a' : '#9ca3af',
                color: '#ffffff',
                border: 'none',
                fontWeight: 'bold',
                fontSize: '1.125rem',
                cursor: canSubmit && !isSubmitting ? 'pointer' : 'not-allowed',
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assessment 🎉'}
            </button>
          )}
        </div>
      </div>

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        questionText={currentQuestion.questionText}
        supportVideoId={currentQuestion.supportLearningBlob?.vimeoId || currentQuestion.coreLearningBlob?.vimeoId}
      />
    </div>
  );
}
