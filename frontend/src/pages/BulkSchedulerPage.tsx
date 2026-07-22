import { useState, useEffect, useMemo } from 'react';
import { bulkSchedulerApi } from '../api';
import './SettingsPage.css';
import './AdminCalendarPage.css';

type DayGroup = { key: string; locationName: string; startTime: string; endTime: string; items: any[] };
type DayGroupMap = Record<number, DayGroup[]>;
type OptionItem = { value: string; label: string };
type LocationItem = { id: string; name: string };
type TrainerItem = { id: string; name: string };

function ScheduleWeekView({
  items,
  editingItemId,
  onSelectItem,
  onDeleteItems,
  readOnly = false,
}: {
  items: any[];
  editingItemId: number | null;
  onSelectItem?: (item: any) => void;
  onDeleteItems?: (itemIds: number[]) => void;
  readOnly?: boolean;
}) {
  const [expandedGroups, setExpandedGroups] = useState({} as Record<string, boolean>);
  const dayNames = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

  const groupedByDay = useMemo(() => {
    const result = dayNames.reduce((acc, _, index) => {
      acc[index + 1] = [];
      return acc;
    }, {} as DayGroupMap);

    items.forEach((item) => {
      const dayNumber = Number(item.dayOfWeek);
      const locationName = item.displayLocationName || item.locationName || 'All Locations';
      const startTime = item.startTime || '09:00';
      const endTime = item.endTime || '10:00';
      const key = `${dayNumber}-${locationName}`;
      const bucket = result[dayNumber] ?? [];
      const existingGroup = bucket.find((group) => group.key === key);

      if (existingGroup) {
        existingGroup.items.push(item);
        if (startTime < existingGroup.startTime) existingGroup.startTime = startTime;
        if (endTime > existingGroup.endTime) existingGroup.endTime = endTime;
      } else {
        bucket.push({ key, locationName, startTime, endTime, items: [item] });
      }
    });

    Object.values(result).forEach((bucket) => {
      bucket.sort((a, b) => a.locationName.localeCompare(b.locationName));
    });

    return result;
  }, [items, dayNames]);

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const expandAll = () => {
    const allKeys: string[] = [];
    Object.values(groupedByDay).forEach((groups) => groups.forEach((g) => allKeys.push(g.key)));
    const map: Record<string, boolean> = {};
    allKeys.forEach((k) => (map[k] = true));
    setExpandedGroups(map);
  };

  const collapseAll = () => {
    const allKeys: string[] = [];
    Object.values(groupedByDay).forEach((groups) => groups.forEach((g) => allKeys.push(g.key)));
    const map: Record<string, boolean> = {};
    allKeys.forEach((k) => (map[k] = false));
    setExpandedGroups(map);
  };

  return (
    <div className="scheduler-week">
      <div className="scheduler-week-toolbar">
        <button type="button" className="cal-btn-blue" onClick={expandAll}>Expand All</button>
        <button type="button" className="cal-btn-grey" onClick={collapseAll}>Collapse All</button>
      </div>
      <div className="scheduler-week-grid">
        {dayNames.map((name, index) => {
          const dayNumber = index + 1;
          const dayGroups = groupedByDay[dayNumber] ?? [];
          const dayAllItems = dayGroups.flatMap((g) => g.items);
          const dayItemIds = dayAllItems.map((i) => i.id).filter(Boolean);
          const hasDayItems = dayItemIds.length > 0;

          return (
            <div key={dayNumber} className="scheduler-week-day">
              <div className="scheduler-week-day-header">
                {!readOnly && (
                  <button
                    type="button"
                    className={`btn-delete-circle ${!hasDayItems ? 'is-disabled' : ''}`}
                    disabled={!hasDayItems}
                    title={hasDayItems ? `Delete all workshops on ${name}` : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hasDayItems && window.confirm(`Are you sure you want to delete all ${dayItemIds.length} workshop(s) on ${name}?`)) {
                        onDeleteItems?.(dayItemIds);
                      }
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" fill={hasDayItems ? "#ef4444" : "#cbd5e1"} />
                      <line x1="7" y1="12" x2="17" y2="12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
                <span>{name}</span>
              </div>
              {dayGroups.length === 0 ? (
                <div className="scheduler-week-empty">No workshops</div>
              ) : (
                dayGroups.map((group) => {
                  const isExpanded = expandedGroups[group.key] ?? false;
                  const groupItemIds = group.items.map((i) => i.id).filter(Boolean);

                  return (
                    <div
                      key={group.key}
                      className="ws-location-group ws-group-scheduler"
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div className="ws-group-header">
                        <div className="ws-group-title">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {!readOnly && (
                              <button
                                type="button"
                                className="btn-delete-circle"
                                title={`Delete all workshops at ${group.locationName}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (groupItemIds.length > 0 && window.confirm(`Are you sure you want to delete all ${groupItemIds.length} workshop(s) at ${group.locationName} for ${name}?`)) {
                                    onDeleteItems?.(groupItemIds);
                                  }
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24">
                                  <circle cx="12" cy="12" r="10" fill="#ef4444" />
                                  <line x1="7" y1="12" x2="17" y2="12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                                </svg>
                              </button>
                            )}
                            <span>{group.locationName} &ndash; {group.items.length} workshop{group.items.length === 1 ? '' : 's'}</span>
                          </div>
                          <span className="ws-expand-toggle">{isExpanded ? '▾' : '▸'}</span>
                        </div>
                        <div className="ws-group-time">{group.startTime} – {group.endTime}</div>
                      </div>
                      {isExpanded && (
                        <div className="ws-expanded-list" onClick={(e) => e.stopPropagation()}>
                          {group.items.map((item) => (
                            <div
                              key={item.displayKey ?? item.id}
                              className={`ws-expanded-workshop ws-scheduler-workshop${editingItemId === item.id ? ' is-selected' : ''}`}
                              onClick={() => !readOnly && onSelectItem?.(item)}
                              title={readOnly ? undefined : 'Click to edit'}
                            >
                              <div className="ws-course-title">
                                {!readOnly && (
                                  <button
                                    type="button"
                                    className="btn-delete-circle"
                                    title="Delete workshop"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (item.id) {
                                        onDeleteItems?.([item.id]);
                                      }
                                    }}
                                  >
                                    <svg width="12" height="12" viewBox="0 0 24 24">
                                      <circle cx="12" cy="12" r="10" fill="#ef4444" />
                                      <line x1="7" y1="12" x2="17" y2="12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                                    </svg>
                                  </button>
                                )}
                                <span>{item.courseCode}{item.courseName ? ` – ${item.courseName}` : ''}</span>
                              </div>
                              <div className="ws-time">{item.startTime} – {item.endTime}</div>
                              <div className="ws-venue-name">Max {item.maxParticipants || 0}</div>
                              {item.trainerName ? <div className="ws-trainer-name">Trainer: {item.trainerName}</div> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BulkSchedulerPage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [activeScheduleId, setActiveScheduleId] = useState<string>('');
  const [scheduleName, setScheduleName] = useState('');
  const [createName, setCreateName] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [items, setItems] = useState<any[]>([]);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ startDate: '', endDate: '' });
  const [confirmValue, setConfirmValue] = useState('run');
  const [options, setOptions] = useState({ courseCodes: [], locations: [], trainers: [] } as { courseCodes: OptionItem[]; locations: LocationItem[]; trainers: TrainerItem[] });
  const defaultForm = {
    day: '1',
    locationId: 'all_locations',
    locationName: 'All Locations',
    startTime: '09:00',
    endTime: '10:00',
    maxParticipants: '20',
    courseCode: '',
    trainerId: '',
    trainerName: '',
  };
  const [form, setForm] = useState(() => defaultForm);

  const expectedRowCount = useMemo(() => {
    if (!range.startDate || !range.endDate || !items.length) return 0;

    const [startYear, startMonth, startDay] = range.startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = range.endDate.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    let total = 0;
    const current = new Date(start);
    while (current <= end) {
      const dayOfWeek = current.getDay() === 0 ? 7 : current.getDay();
      total += items.filter((item) => Number(item.dayOfWeek) === dayOfWeek).length;
      current.setDate(current.getDate() + 1);
    }
    return total;
  }, [items, range.startDate, range.endDate]);

  const displayItems = useMemo(() => {
    const expandedItems: any[] = [];

    items.forEach((item) => {
      const shouldExpandLocations = item.locationId === 'all_locations' || item.locationName === 'All Locations';
      const resolvedLocations = shouldExpandLocations
        ? options.locations.length > 0
          ? options.locations
          : [{ id: 'all_locations', name: 'All Locations' }]
        : [{ id: item.locationId ?? 'all_locations', name: item.locationName ?? 'All Locations' }];

      resolvedLocations.forEach((location) => {
        expandedItems.push({
          ...item,
          displayKey: `${item.id}-${location.id}`,
          displayLocationId: location.id,
          displayLocationName: location.name,
        });
      });
    });

    return expandedItems;
  }, [items, options.locations]);

  const canQueueRun = Boolean(activeScheduleId && expectedRowCount > 0 && range.startDate && range.endDate && confirmValue.trim());

  const load = async (preferredId?: string) => {
    const [scheduleRes, runRes, optionsRes] = await Promise.all([
      bulkSchedulerApi.listSchedules(),
      bulkSchedulerApi.getRuns(),
      bulkSchedulerApi.getOptions(),
    ]);
    const nextSchedules = scheduleRes.data ?? [];
    const resolvedId = preferredId && nextSchedules.some((schedule: any) => String(schedule.id) === preferredId)
      ? preferredId
      : (activeScheduleId && nextSchedules.some((schedule: any) => String(schedule.id) === activeScheduleId)
        ? activeScheduleId
        : '');

    setSchedules(nextSchedules);
    setOptions(optionsRes.data ?? { courseCodes: [], locations: [], trainers: [] });
    setActiveScheduleId(resolvedId);
    const selectedSchedule = nextSchedules.find((schedule: any) => String(schedule.id) === resolvedId);
    setItems(selectedSchedule?.items ?? []);
    setScheduleName(selectedSchedule?.name ?? '');
    setRuns(runRes.data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreateSchedule = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) return;

    const exists = schedules.some((schedule: any) => schedule.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      setStatus('A schedule with that name already exists.');
      return;
    }

    const res = await bulkSchedulerApi.createSchedule(trimmedName);
    const createdId = String(res.data?.id ?? '');
    setCreateName('');
    setCurrentStep(2);
    await load(createdId);
    setStatus(`Created schedule ${res.data?.name ?? 'new schedule'}.`);
  };

  const handleEditSchedule = async (id: string) => {
    if (!id) return;
    setCurrentStep(2);
    await load(id);
    setStatus('Opened schedule for editing.');
  };

  const handleRunSchedule = async (id: string) => {
    if (!id) return;
    setCurrentStep(3);
    await load(id);
    setStatus('Opened schedule for running.');
  };

  const handleAddOrUpdateItem = async () => {
    if (!activeScheduleId || !form.courseCode.trim()) return;
    const selectedLocation = options.locations.find((loc) => loc.id === form.locationId);
    const selectedTrainer = options.trainers.find((trainer) => trainer.id === form.trainerId);
    const payload = {
      day: form.day,
      locationId: form.locationId === 'all_locations' ? 'all_locations' : (selectedLocation?.id ?? null),
      locationName: form.locationId === 'all_locations' ? 'All Locations' : (selectedLocation?.name ?? (form.locationName || null)),
      startTime: form.startTime,
      endTime: form.endTime,
      maxParticipants: Number(form.maxParticipants || 0),
      courseCode: form.courseCode.trim().toUpperCase(),
      trainerId: selectedTrainer?.id ?? null,
      trainerName: selectedTrainer?.name ?? (form.trainerName || null),
    };

    if (editingItemId) {
      await bulkSchedulerApi.updateItem(editingItemId, payload);
    } else {
      await bulkSchedulerApi.addItem(Number(activeScheduleId), payload);
    }

    setEditingItemId(null);
    setForm(defaultForm);
    await load(activeScheduleId);
    setStatus(editingItemId ? 'Updated workshop rule.' : 'Added workshop rule.');
  };

  const handleEditItem = (item: any) => {
    setEditingItemId(item.id);
    setForm({
      day: String(item.dayOfWeek ?? 1),
      locationId: item.displayLocationId ?? item.locationId ?? 'all_locations',
      locationName: item.displayLocationName ?? item.locationName ?? 'All Locations',
      startTime: item.startTime ?? '09:00',
      endTime: item.endTime ?? '10:00',
      maxParticipants: String(item.maxParticipants ?? 20),
      courseCode: item.courseCode ?? '',
      trainerId: item.trainerId ?? '',
      trainerName: item.trainerName ?? '',
    });
  };

  const handleDeleteItem = async (id: number) => {
    await bulkSchedulerApi.deleteItem(id);
    setEditingItemId(null);
    await load(activeScheduleId);
    setStatus('Deleted workshop rule.');
  };

  const handleDeleteItems = async (itemIds: number[]) => {
    const validIds = itemIds.filter(Boolean);
    if (!validIds.length) return;
    try {
      await Promise.all(validIds.map((id) => bulkSchedulerApi.deleteItem(id)));
      if (editingItemId && validIds.includes(editingItemId)) {
        setEditingItemId(null);
        setForm(defaultForm);
      }
      await load(activeScheduleId);
      setStatus(`Deleted ${validIds.length} workshop rule${validIds.length === 1 ? '' : 's'}.`);
    } catch (error: any) {
      setStatus('Failed to delete workshop rule(s).');
    }
  };

  const handleDeleteSelectedItem = async () => {
    if (!editingItemId) return;
    await handleDeleteItem(editingItemId);
  };

  const handleClearForm = () => {
    setEditingItemId(null);
    setForm(defaultForm);
    setStatus('Editor cleared.');
  };

  const handleDuplicateSchedule = async (id: string) => {
    if (!id) return;
    const selectedSchedule = schedules.find((schedule: any) => String(schedule.id) === id);
    const suggestedName = `${selectedSchedule?.name ?? 'Schedule'} copy`;
    const nextName = window.prompt('New schedule name for duplicate:', suggestedName);
    if (!nextName?.trim()) return;

    const trimmedName = nextName.trim();
    const exists = schedules.some((schedule: any) => String(schedule.id) !== String(id) && schedule.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (exists) {
      setStatus('A schedule with that name already exists.');
      return;
    }

    const res = await bulkSchedulerApi.duplicateSchedule(Number(id), trimmedName);
    const createdId = String(res.data?.id ?? '');
    setCurrentStep(2);
    await load(createdId);
    setStatus(`Duplicated schedule as ${trimmedName}.`);
  };

  const handleGoBack = () => {
    setCurrentStep(1);
    setStatus('Returned to schedule selection.');
  };

  const handleGoToRun = () => {
    if (!activeScheduleId) {
      setStatus('Open or create a schedule first.');
      return;
    }
    setCurrentStep(3);
  };

  const handleQueueRun = async () => {
    if (!activeScheduleId || !range.startDate || !range.endDate) return;
    if (expectedRowCount <= 0) {
      setStatus('No schedule rows match the selected date range.');
      return;
    }
    if (confirmValue.trim().length < 4) {
      setStatus('Please enter confirmation text with at least 4 characters.');
      return;
    }
    try {
      const res = await bulkSchedulerApi.queueRun({
        scheduleId: Number(activeScheduleId),
        startDate: range.startDate,
        endDate: range.endDate,
        confirmValue,
      });
      setStatus(res.data?.message ?? 'Queued scheduler run.');
      await load();
    } catch (error: any) {
      setStatus(error?.response?.data?.message ?? 'Failed to queue scheduler run.');
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Bulk Scheduler</h1>
      </div>

      <div className="tab-panel">
        {status && <div className="settings-alert">{status}</div>}

        <div className="dktp-bs-app">
          {currentStep === 1 ? (
            <div className="dktp-bs-panel">
              <div className="dktp-bs-panel-header compact">
                <div>
                  <h3>Choose a schedule</h3>
                  <p>Create a blank schedule or open an existing one to get started.</p>
                </div>
              </div>

              <div className="dktp-bs-card-grid">
                <div className="dktp-bs-card dktp-bs-card-create">
                  <h4>Create new schedule</h4>
                  <p>Start with a blank schedule and give it a name.</p>
                  <input className="dktp-bs-input" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Schedule name" />
                  <button className="dktp-bs-card-action-btn dktp-bs-card-action-btn-secondary" onClick={handleCreateSchedule} disabled={!createName.trim()}>Create</button>
                </div>

                {schedules.map((schedule) => (
                  <div key={schedule.id} className="dktp-bs-card">
                    <div className="dktp-bs-card-title-row">
                      <h4>{schedule.name}</h4>
                      <span className="dktp-bs-card-count">{schedule.items?.length ?? 0} workshops</span>
                    </div>
                    <div className="dktp-bs-card-actions">
                      <button className="dktp-bs-card-action-btn dktp-bs-card-action-btn-success" onClick={() => void handleRunSchedule(String(schedule.id))}>Run</button>
                      <button className="dktp-bs-card-action-btn dktp-bs-card-action-btn-warning" onClick={() => void handleEditSchedule(String(schedule.id))}>Edit</button>
                      <button className="dktp-bs-card-action-btn dktp-bs-card-action-btn-ghost" onClick={() => void handleDuplicateSchedule(String(schedule.id))}>Duplicate</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="dktp-bs-panel">
              <div className="dktp-bs-panel-header">
                <div>
                  <h3>{scheduleName || 'Untitled schedule'}</h3>
                  <p>Edit the workshop rules for this schedule before you run it.</p>
                </div>
                <div className="dktp-bs-panel-actions">
                  <div className="dktp-bs-summary-item">
                    <span>Workshops</span>
                    <strong>{items.length}</strong>
                  </div>
                  <button className="toggle-visibility" onClick={handleGoBack}>Back to select</button>
                  <button className="btn-save" onClick={handleGoToRun}>Continue to run</button>
                </div>
              </div>

              <div className="dktp-bs-panel">
                <div className="dktp-bs-panel-header compact">
                  <div>
                    <h3>Workshop Editor</h3>
                    <p>Choose a day group and fill the workshop details. The rule will expand into separate entries for each matching day and location.</p>
                  </div>
                </div>

                <div className="dktp-bs-row dktp-bs-row-form">
                  <div className="dktp-bs-field">
                    <label>Day</label>
                    <select className="dktp-bs-input" value={form.day} onChange={(e) => setForm((prev) => ({ ...prev, day: e.target.value }))}>
                      {[1,2,3,4,5,6,7].map((day) => <option key={day} value={day}>{['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][day - 1]}</option>)}
                      <option value="weekdays">Weekdays</option>
                      <option value="weekend">Weekend</option>
                      <option value="everyday">Everyday</option>
                    </select>
                  </div>
                  <div className="dktp-bs-field">
                    <label>Location</label>
                    <select className="dktp-bs-input" value={form.locationId} onChange={(e) => setForm((prev) => ({ ...prev, locationId: e.target.value, locationName: e.target.value === 'all_locations' ? 'All Locations' : (options.locations.find((loc) => loc.id === e.target.value)?.name ?? '') }))}>
                      <option value="all_locations">All Locations</option>
                      {options.locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </div>
                  <div className="dktp-bs-field">
                    <label>Start</label>
                    <input className="dktp-bs-input" type="time" value={form.startTime} onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))} />
                  </div>
                  <div className="dktp-bs-field">
                    <label>End</label>
                    <input className="dktp-bs-input" type="time" value={form.endTime} onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))} />
                  </div>
                  <div className="dktp-bs-field">
                    <label>Max</label>
                    <input className="dktp-bs-input" type="number" min="1" value={form.maxParticipants} onChange={(e) => setForm((prev) => ({ ...prev, maxParticipants: e.target.value }))} placeholder="Max" />
                  </div>
                  <div className="dktp-bs-field">
                    <label>Code</label>
                    <select className="dktp-bs-input" value={form.courseCode} onChange={(e) => setForm((prev) => ({ ...prev, courseCode: e.target.value }))}>
                      <option value="">Select Code</option>
                      {options.courseCodes.map((course) => <option key={course.value} value={course.value}>{course.label}</option>)}
                    </select>
                  </div>
                  <div className="dktp-bs-field">
                    <label>Trainer</label>
                    <select className="dktp-bs-input" value={form.trainerId} onChange={(e) => setForm((prev) => ({ ...prev, trainerId: e.target.value, trainerName: options.trainers.find((trainer) => trainer.id === e.target.value)?.name ?? '' }))}>
                      <option value="">Select Trainer</option>
                      {options.trainers.map((trainer) => <option key={trainer.id} value={trainer.id}>{trainer.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="dktp-bs-row">
                  <button className="btn-save" onClick={handleAddOrUpdateItem}>{editingItemId ? 'Update Workshop' : 'Add Workshop'}</button>
                  <button className="toggle-visibility" onClick={handleClearForm}>Clear</button>
                  <button className="toggle-visibility" onClick={handleDeleteSelectedItem} disabled={!editingItemId}>Delete Workshop</button>
                  <span className="tab-description" style={{ marginBottom: 0 }}>{editingItemId ? 'Editing the selected workshop.' : 'Choose a workshop below to edit it.'}</span>
                </div>
              </div>

              <div className="dktp-bs-grid">
                {items.length === 0 ? (
                  <div className="tab-description">No workshops yet.</div>
                ) : (
                  <ScheduleWeekView items={displayItems} editingItemId={editingItemId} onSelectItem={handleEditItem} onDeleteItems={handleDeleteItems} />
                )}
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="dktp-bs-panel">
              <div className="dktp-bs-panel-header">
                <div>
                  <h3>Run schedule</h3>
                  <p>Queue workshop generation for a future date range once the schedule has workshops.</p>
                </div>
                <div className="dktp-bs-panel-actions">
                  <div className="dktp-bs-summary-item">
                    <span>Schedule</span>
                    <strong>{scheduleName || 'Untitled schedule'}</strong>
                  </div>
                  <button className="toggle-visibility" onClick={handleGoBack}>Back to select</button>
                  <button className="toggle-visibility" onClick={() => setCurrentStep(2)}>Edit schedule</button>
                </div>
              </div>

              <div className="dktp-bs-row dktp-bs-row-form">
                <div className="dktp-bs-field">
                  <label>Start</label>
                  <input className="dktp-bs-input" type="date" value={range.startDate} onChange={(e) => setRange((prev) => ({ ...prev, startDate: e.target.value }))} />
                </div>
                <div className="dktp-bs-field">
                  <label>End</label>
                  <input className="dktp-bs-input" type="date" value={range.endDate} onChange={(e) => setRange((prev) => ({ ...prev, endDate: e.target.value }))} />
                </div>
                <div className="dktp-bs-field">
                  <label>Confirm</label>
                  <input className="dktp-bs-input" value={confirmValue} onChange={(e) => setConfirmValue(e.target.value)} placeholder="Type run to confirm" />
                </div>
                <div className="dktp-bs-summary-item">
                  <span>Expected</span>
                  <strong>{expectedRowCount} workshops</strong>
                </div>
                <button className="btn-save" onClick={handleQueueRun} disabled={!canQueueRun}>Queue Run</button>
              </div>

              <div className="dktp-bs-row">
                {runs.length === 0 ? (
                  <div className="tab-description">No runs yet.</div>
                ) : (
                  <div className="scheduler-grid">
                    {runs.map((run) => (
                      <div key={run.id} className="scheduler-card">
                        <strong>{run.schedule?.name ?? 'Schedule'}</strong>
                        <div className="scheduler-meta">
                          {run.startDate} → {run.endDate}<br />
                          Status: {run.status}<br />
                          {run.createdCount}/{run.totalExpected} created
                        </div>
                        <span className="scheduler-pill">{run.message || 'Queued'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dktp-bs-grid">
                {displayItems.length === 0 ? (
                  <div className="tab-description">No workshops to preview.</div>
                ) : (
                  <ScheduleWeekView items={displayItems} editingItemId={null} readOnly />
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
