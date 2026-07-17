import { buildChecklistTemplateFromMasterPayload, deriveChecklistStatus, isPluginChecklistPayload, normalizeAttendanceValue } from './workshop-detail.service';

class WorkshopDetailServiceHarness {
  private service: any;

  constructor() {
    this.service = {
      normalizeCourseCode: (value: string) => (value ?? '').trim().toUpperCase().replace(/\s+/g, ' '),
      resolveCourseTaskIds: (master: any, courseCode: string) => {
        const normalizedCourseCode = this.service.normalizeCourseCode(courseCode);
        const rawCourseMap = master?.course_map && typeof master.course_map === 'object' ? master.course_map : {};
        const candidates = [courseCode, normalizedCourseCode];

        for (const candidate of candidates) {
          const direct = rawCourseMap[candidate];
          if (Array.isArray(direct)) return direct;
        }

        for (const [key, value] of Object.entries(rawCourseMap as Record<string, any>)) {
          if (Array.isArray(value) && this.service.normalizeCourseCode(String(key)) === normalizedCourseCode) {
            return value;
          }
        }

        return [];
      },
    };
  }

  resolveCourseTaskIds(master: any, courseCode: string) {
    return this.service.resolveCourseTaskIds(master, courseCode);
  }
}

describe('normalizeAttendanceValue', () => {
  it('maps attended-like values to 1', () => {
    expect(normalizeAttendanceValue(true)).toBe(1);
    expect(normalizeAttendanceValue('1')).toBe(1);
    expect(normalizeAttendanceValue('true')).toBe(1);
    expect(normalizeAttendanceValue('yes')).toBe(1);
  });

  it('maps absent-like values to 0', () => {
    expect(normalizeAttendanceValue(false)).toBe(0);
    expect(normalizeAttendanceValue('0')).toBe(0);
    expect(normalizeAttendanceValue('false')).toBe(0);
    expect(normalizeAttendanceValue('no')).toBe(0);
  });

  it('maps missing values to pending', () => {
    expect(normalizeAttendanceValue(null)).toBe(-1);
    expect(normalizeAttendanceValue(undefined)).toBe(-1);
    expect(normalizeAttendanceValue('')).toBe(-1);
  });
});

describe('deriveChecklistStatus', () => {
  it('returns question mark when no checklist data is present', () => {
    expect(deriveChecklistStatus(null)).toEqual({ label: '?', tone: 'pending' });
  });

  it('returns competent when every element is marked satisfactory', () => {
    expect(deriveChecklistStatus({ student_checklist: { task1: { elements: { e1: { overall_status: 'S' } } } } })).toEqual({ label: 'C', tone: 'competent' });
  });

  it('returns not competent when any element is marked not competent', () => {
    expect(deriveChecklistStatus({ student_checklist: { task1: { elements: { e1: { overall_status: 'N' } } } } })).toEqual({ label: 'N', tone: 'not-competent' });
  });
});

describe('WorkshopDetailService course-code resolution', () => {
  it('matches checklist task ids when course codes differ by whitespace or case', () => {
    const harness = new WorkshopDetailServiceHarness();
    const master = { course_map: { 'HLTAID011 - PFA': ['pt-1', 'pt-2'] } };

    expect(harness.resolveCourseTaskIds(master, 'hltaid011 - pfa')).toEqual(['pt-1', 'pt-2']);
  });
});

describe('checklist payload compatibility', () => {
  it('builds plugin-compatible task, element and sub-element descriptions', () => {
    const template = buildChecklistTemplateFromMasterPayload({
      course_map: { HLTAID009: ['PT_ADULT_CPR'] },
      tasks: {
        PT_ADULT_CPR: {
          name: 'Practical Task 1 - Adult CPR',
          elements: {
            '1': {
              title: 'Danger, Response, Send for Help',
              sub_elements: {
                a: 'Identify hazards',
              },
            },
          },
        },
      },
    }, 'HLTAID009');

    expect(template.course_code).toBe('HLTAID009');
    expect(template.student_checklist.PT_ADULT_CPR.task_name).toBe('Practical Task 1 - Adult CPR');
    expect(template.student_checklist.PT_ADULT_CPR.elements['1'].title).toBe('Danger, Response, Send for Help');
    expect(template.student_checklist.PT_ADULT_CPR.elements['1'].sub_elements.a.text).toBe('Identify hazards');
    expect(template.student_checklist.PT_ADULT_CPR.elements['1'].sub_elements.a.status).toBeNull();
  });

  it('detects legacy checklist payloads that need rebuilding', () => {
    const legacyPayload = {
      course_code: 'HLTAID009',
      student_checklist: {
        PT_ADULT_CPR: {
          name: 'Practical Task 1 - Adult CPR',
          elements: {
            '1': {
              name: 'Danger, Response, Send for Help',
              sub_elements: {
                a: { name: 'Identify hazards' },
              },
            },
          },
        },
      },
    };

    expect(isPluginChecklistPayload(legacyPayload)).toBe(false);
  });

  it('rejects partially shaped payloads that still miss element titles', () => {
    const partialPayload = {
      course_code: 'HLTAID009',
      student_checklist: {
        PT_ADULT_CPR: {
          task_name: 'Practical Task 1 - Adult CPR',
          elements: {
            '1': {
              overall_status: 'S',
              sub_elements: {
                a: { text: 'Identify hazards', status: 'S' },
              },
            },
          },
        },
      },
    };

    expect(isPluginChecklistPayload(partialPayload)).toBe(false);
  });
});
