import { deriveChecklistStatus, normalizeAttendanceValue } from './workshop-detail.service';

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
