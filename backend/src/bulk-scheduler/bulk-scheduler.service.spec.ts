import { BulkSchedulerService } from './bulk-scheduler.service';

describe('BulkSchedulerService', () => {
  let service: BulkSchedulerService;

  beforeEach(() => {
    service = new BulkSchedulerService({} as any, {} as any, {} as any);
  });

  it('counts expected workshops across a date range for matching weekdays', () => {
    const items = [
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:00', courseCode: 'HLTAID011' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '11:00', courseCode: 'HLTAID009' },
    ];

    const count = service.countExpectedWorkshops(items as any, '2026-07-20', '2026-07-24');

    expect(count).toBe(2);
  });

  it('counts each matching weekday item once per day', () => {
    const items = [
      { dayOfWeek: 2, startTime: '09:00', endTime: '10:00', courseCode: 'HLTAID011' },
      { dayOfWeek: 4, startTime: '09:00', endTime: '10:00', courseCode: 'HLTAID011' },
    ];

    const count = service.countExpectedWorkshops(items as any, '2026-07-20', '2026-07-24');

    expect(count).toBe(2);
  });

  it('expands weekday and all-locations selections into concrete rows', () => {
    const rows = service.expandItemInput({
      scheduleId: 7,
      day: 'weekdays',
      locationId: 'all_locations',
      locationName: 'All Locations',
      startTime: '09:00',
      endTime: '10:00',
      maxParticipants: 20,
      courseCode: 'HLTAID011',
      trainerId: 't1',
      trainerName: 'Alex',
    } as any, [
      { id: 'loc-1', name: 'Brisbane' },
      { id: 'loc-2', name: 'Sydney' },
    ] as any);

    expect(rows).toHaveLength(5 * 2);
    expect(rows[0]).toMatchObject({ dayOfWeek: 1, locationId: 'loc-1', locationName: 'Brisbane', courseCode: 'HLTAID011' });
    expect(rows[rows.length - 1]).toMatchObject({ dayOfWeek: 5, locationId: 'loc-2', locationName: 'Sydney', courseCode: 'HLTAID011' });
  });

  it('creates expanded rows when the UI sends a day field during add-item operations', async () => {
    const createSpy = jest.fn(async ({ data }: any) => data);
    const transactionSpy = jest.fn(async (operations: any[]) => operations);
    const mockAxcelerate = {
      getLocations: jest.fn(async () => [
        { id: 'loc-1', name: 'Brisbane' },
        { id: 'loc-2', name: 'Sydney' },
      ]),
    };
    const itemService = new BulkSchedulerService(mockAxcelerate as any, {
      $transaction: transactionSpy,
      bulkSchedulerScheduleItem: { create: createSpy },
    } as any, {} as any);

    await itemService.addItem(7, {
      day: 'weekdays',
      locationId: 'all_locations',
      locationName: 'All Locations',
      startTime: '09:00',
      endTime: '10:00',
      maxParticipants: 20,
      courseCode: 'HLTAID011',
      trainerId: 't1',
      trainerName: 'Alex',
    } as any);

    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledTimes(10);
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ dayOfWeek: 1, locationId: 'loc-1', locationName: 'Brisbane' }) }));
  });
});
