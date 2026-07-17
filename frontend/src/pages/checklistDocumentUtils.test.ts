import { describe, expect, it } from 'vitest';
import { buildChecklistDocumentHtml, isDebugChecklistMode } from './checklistDocumentUtils';

describe('checklist document helpers', () => {
  it('detects debug mode from the URL query string', () => {
    expect(isDebugChecklistMode('?debug=true')).toBe(true);
    expect(isDebugChecklistMode('?debug=false')).toBe(false);
    expect(isDebugChecklistMode('?foo=1')).toBe(false);
  });

  it('builds a readable checklist document with task and sub-element details', () => {
    const html = buildChecklistDocumentHtml(
      { givenName: 'Ada', surname: 'Lovelace' } as any,
      {
        course_code: 'ABC123',
        student_checklist: {
          pt1: {
            task_name: 'Task One',
            elements: {
              e1: {
                title: 'Element One',
                overall_status: 'S',
                sub_elements: {
                  s1: { text: 'Sub One', status: 'S' },
                },
              },
            },
          },
        },
      },
      'ABC123',
      'Trainer Name',
      '2025-02-14',
      12345,
      'MELBOURNE VIC 3000',
    );

    expect(html).toContain('Practical Tasks Observation Checklist');
    expect(html).toContain('Task One');
    expect(html).toContain('Element One');
    expect(html).toContain('Sub One');
  });
});
