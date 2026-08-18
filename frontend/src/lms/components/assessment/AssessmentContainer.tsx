import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../contexts/SessionContext';
import { lmsApi } from '../../services/lmsApi';
import { QuestionType, type Question, type QuestionAnswer } from '../../types/lms';
import { QuestionRenderer } from './QuestionRenderer';
import { ProgressDots } from './ProgressDots';
import { HelpModal } from './HelpModal';

export function AssessmentContainer() {
  const { enrollment, unit } = useSession();
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
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

    async function loadQuestions() {
      if (!unit) return;
      try {
        setIsLoading(true);
        const fetchedQuestions = await lmsApi.getQuestionsForUnit(unit.unitCode);
        setQuestions(fetchedQuestions);
      } catch (err: any) {
        console.error('Failed to load questions:', err);
        setError('Failed to load questions. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }

    loadQuestions();
  }, [unit, navigate]);

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
  const answeredIndices = new Set(
    Array.from(answers.keys()).map((id) => questions.findIndex((q) => q.id === id))
  );

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
          Question {currentIndex + 1} of {questions.length}
        </p>
      </div>

      <ProgressDots
        total={questions.length}
        current={currentIndex}
        answeredIndices={answeredIndices}
        onSelect={(idx) => setCurrentIndex(idx)}
      />

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
          {currentQuestion.type !== QuestionType.FillInBlanks ? (
            <div
              className="lms-rich-content"
              style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', lineHeight: 1.5, flex: 1 }}
              dangerouslySetInnerHTML={{ __html: currentQuestion.questionText }}
            />
          ) : (
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#111827', lineHeight: 1.5, margin: 0, flex: 1 }}>
              Complete the sentence(s) below:
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
