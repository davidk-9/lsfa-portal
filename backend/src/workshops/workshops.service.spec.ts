import { resolveWorkshopGroupState, type WorkshopStateLike } from './workshops.service';

describe('resolveWorkshopGroupState', () => {
  const makeWorkshop = (overrides: Partial<WorkshopStateLike> = {}): WorkshopStateLike => ({
    isPast: false,
    participants: 0,
    progressComplete: false,
    ...overrides,
  });

  it('uses red for past headers when any past workshop is incomplete', () => {
    const workshops = [
      makeWorkshop({ isPast: true, participants: 1, progressComplete: true }),
      makeWorkshop({ isPast: true, participants: 1, progressComplete: false }),
    ];

    expect(resolveWorkshopGroupState(workshops, '2024-01-02', '2024-01-03')).toBe('past-incomplete');
  });

  it('uses white for past headers when no past workshop is incomplete even if some had no students', () => {
    const workshops = [
      makeWorkshop({ isPast: true, participants: 0 }),
      makeWorkshop({ isPast: true, participants: 1, progressComplete: true }),
    ];

    expect(resolveWorkshopGroupState(workshops, '2024-01-02', '2024-01-03')).toBe('past-complete');
  });

  it('uses green for current-day headers when past workshops are complete but future workshops still have students', () => {
    const workshops = [
      makeWorkshop({ isPast: true, participants: 1, progressComplete: true }),
      makeWorkshop({ isPast: false, participants: 1 }),
    ];

    expect(resolveWorkshopGroupState(workshops, '2024-01-03', '2024-01-03')).toBe('future-with-students');
  });

  it('uses yellow for future headers when any workshop has no students', () => {
    const workshops = [
      makeWorkshop({ isPast: false, participants: 1 }),
      makeWorkshop({ isPast: false, participants: 0 }),
    ];

    expect(resolveWorkshopGroupState(workshops, '2024-01-04', '2024-01-03')).toBe('future-empty');
  });
});
