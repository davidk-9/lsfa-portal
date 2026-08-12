import { QuestionType, type Question } from '../../types/lms';
import { MultipleChoiceSingle } from './MultipleChoiceSingle';
import { MultipleChoiceMultiple } from './MultipleChoiceMultiple';
import { OrderItems } from './OrderItems';
import { MatchDefinitions } from './MatchDefinitions';
import { FillInBlanks } from './FillInBlanks';
import { FreeText } from './FreeText';
import { Forms } from './Forms';

interface QuestionRendererProps {
  question: Question;
  value?: any;
  onChange: (value: any) => void;
}

export function QuestionRenderer({ question, value, onChange }: QuestionRendererProps) {
  switch (question.type) {
    case QuestionType.MultipleChoiceSingle:
      return <MultipleChoiceSingle questionData={question.questionData} value={value} onChange={onChange} />;

    case QuestionType.MultipleChoiceMultiple:
      return <MultipleChoiceMultiple questionData={question.questionData} value={value} onChange={onChange} />;

    case QuestionType.OrderItems:
      return <OrderItems questionData={question.questionData} value={value} onChange={onChange} />;

    case QuestionType.MatchDefinitions:
      return <MatchDefinitions questionData={question.questionData} value={value} onChange={onChange} />;

    case QuestionType.FillInBlanks:
      return (
        <FillInBlanks
          questionText={question.questionText}
          questionData={question.questionData}
          value={value}
          onChange={onChange}
        />
      );

    case QuestionType.FreeText:
      return <FreeText questionData={question.questionData} value={value} onChange={onChange} />;

    case QuestionType.Forms:
      return <Forms questionData={question.questionData} value={value} onChange={onChange} />;

    default:
      return <p style={{ color: 'red' }}>Unsupported question type: {question.type}</p>;
  }
}
