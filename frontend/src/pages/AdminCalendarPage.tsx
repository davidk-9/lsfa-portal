import { useState, useEffect, useCallback } from 'react';
import { workshopsApi, settingsApi, workshopDetailApi } from '../api';
import type { CalendarData, WorkshopGroup, WorkshopDetail, WorkshopState } from '../types/workshops';
import './AdminCalendarPage.css';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function buildAxcelerateUrl(base: string, instanceId: string): string {
  if (!base) return '#';
  if (base.includes('{instanceId}')) return base.replace('{instanceId}', instanceId);
  if (base.includes('{PDataID}')) return base.replace('{PDataID}', instanceId);
  if (base.endsWith('/') || base.endsWith('=')) return base + instanceId;
  if (base.includes('?')) return `${base}&PDataID=${instanceId}`;
  return `${base}?PDataID=${instanceId}`;
}

const STATE_CLASSES: Record<WorkshopState, string> = {
  'future-with-students': 'ws-group-open',
  'future-empty': 'ws-group-future-empty',
  'past-incomplete': 'ws-group-incomplete-past',
  'past-complete': 'ws-group-complete-past',
  'past-no-students': 'ws-group-closed',
};

function getWorkshopClass(w: WorkshopDetail): string {
  const status = (w.status || '').toLowerCase();
  if (status === 'tentative' || status === 'cancelled') return 'ws-expanded-tentative';
  if (!w.isPast) return w.participants > 0 ? 'ws-expanded-future' : 'ws-expanded-future-empty';
  if (w.participants > 0) return w.progressComplete ? 'ws-expanded-past-complete' : 'ws-expanded-past-incomplete';
  return 'ws-expanded-past';
}

function WorkshopProgressModal({
  instanceId,
  title,
  onClose,
}: {
  instanceId: number;
  title: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lmsEnabled, setLmsEnabled] = useState(false);
  const [learningPlanId, setLearningPlanId] = useState<number | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    workshopDetailApi.getProgressRecord(instanceId)
      .then((res) => {
        setData(res.data);
        setLmsEnabled(Boolean(res.data?.lmsEnabled));
        setLearningPlanId(res.data?.learningPlanId ?? null);
      })
      .catch((err) => {
        console.error('Failed to fetch progress record', err);
      })
      .finally(() => setLoading(false));
  }, [instanceId]);

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      await workshopDetailApi.toggleLmsEnabled(instanceId, lmsEnabled, learningPlanId);
      setToast({ type: 'success', message: 'LMS settings saved successfully!' });
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save LMS setting' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 24,
          width: '100%',
          maxWidth: 540,
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
              Workshop Progress & LMS Settings
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              {title} &bull; Instance #{instanceId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}
          >
            &times;
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748b' }}>
            Loading progress record...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Editable LMS Setting */}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14, color: '#0369a1' }}>
                  <input
                    type="checkbox"
                    checked={lmsEnabled}
                    onChange={(e) => setLmsEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  LMS Managed in LSFA Central (lmsEnabled)
                </label>
                <p style={{ margin: '4px 0 0 28px', fontSize: 12, color: '#0284c7', lineHeight: 1.4 }}>
                  When enabled, students enrolled in this workshop will complete their online training in LSFA Central. When disabled, students use Axcelerate's native LMS portal.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 4 }}>
                  Assigned LMS Learning Plan:
                </label>
                <select
                  value={learningPlanId ?? ''}
                  onChange={(e) => setLearningPlanId(e.target.value ? Number(e.target.value) : null)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 6,
                    border: '1px solid #93c5fd',
                    fontSize: 13,
                    color: '#0f172a',
                    background: '#ffffff',
                  }}
                >
                  <option value="">-- No Learning Plan Assigned --</option>
                  {((showAllPlans ? data?.allPlans : data?.availablePlans) || []).map((plan: any) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.courseCode?.code || 'Unit'} &bull; {plan.title || 'Plan'} ({plan.version}) [{plan.status || 'DRAFT'}]
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#0369a1' }}>
                    {showAllPlans ? 'Showing all plans across all units' : `Filtered for unit: ${data?.resolvedCourseCode || 'workshop'}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAllPlans(!showAllPlans)}
                    style={{ background: 'none', border: 'none', color: '#0284c7', fontSize: 11, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {showAllPlans ? 'Filter by Workshop Unit' : 'Show All Units'}
                  </button>
                </div>
              </div>
            </div>

            {/* Read-Only Record Fields */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Record Details (Read-Only)
              </h4>

              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Axcelerate Instance ID: </span>
                <strong style={{ color: '#0f172a', fontFamily: 'monospace' }}>#{instanceId}</strong>
              </div>

              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Assigned Learning Plan: </span>
                <span style={{ color: '#0f172a' }}>
                  {data?.learningPlan
                    ? `${data.learningPlan.courseCode?.code || ''} - ${data.learningPlan.title || 'Plan v' + data.learningPlan.version}`
                    : 'None assigned'}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Trainer Contact ID: </span>
                <span style={{ color: '#0f172a' }}>{data?.trainerContactId || 'None'}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Practical Observations Progress: </span>
                <span style={{ color: '#0f172a' }}>
                  {data?.completedSteps ?? 0} / {data?.totalSteps ?? 3} steps
                  {data?.isComplete ? ' (✓ Overall Complete)' : ' (Incomplete)'}
                </span>
              </div>

              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Created At: </span>
                <span style={{ color: '#0f172a' }}>{data?.createdAt ? new Date(data.createdAt).toLocaleString('en-AU') : 'Not yet created in DB'}</span>
              </div>

              <div>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Last Updated: </span>
                <span style={{ color: '#0f172a' }}>{data?.updatedAt ? new Date(data.updatedAt).toLocaleString('en-AU') : 'N/A'}</span>
              </div>
            </div>

            {toast && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  background: toast.type === 'success' ? '#dcfce7' : '#fee2e2',
                  color: toast.type === 'success' ? '#166534' : '#991b1b',
                  border: toast.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
                }}
              >
                {toast.message}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ background: '#ffffff', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '8px 20px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (saving || loading) ? 0.7 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupTile({
  group, workshopBaseUrl, showTrainer, locationFilter, trainerFilter, forceExpanded, onOpenProgressModal,
}: {
  group: WorkshopGroup; workshopBaseUrl: string; showTrainer: boolean;
  locationFilter: string; trainerFilter: string; forceExpanded: boolean | null;
  onOpenProgressModal: (instanceId: number, title: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceExpanded !== null) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const matchesLocation =
    locationFilter === 'all' ||
    (group.isPrivate && locationFilter === '__onsite__') ||
    group.location.toLowerCase().includes(locationFilter.toLowerCase());

  const matchesTrainer =
    trainerFilter === 'all' || group.trainerIds.includes(trainerFilter);

  if (!matchesLocation || !matchesTrainer) return null;

  const noTrainerCount = group.workshops.filter(
    (w) => !w.trainerName || w.trainerName.trim() === '' || w.trainerName.toLowerCase() === 'no trainer',
  ).length;

  const tentativeCount = group.workshops.filter((w) => {
    const s = (w.status || '').toLowerCase();
    return s === 'tentative' || s === 'cancelled';
  }).length;

  const trainerItems: { name: string; isNoTrainer: boolean }[] = group.trainerNames.map((name) => ({
    name,
    isNoTrainer: name.toLowerCase() === 'no trainer',
  }));

  if (noTrainerCount > 0 && !trainerItems.some((item) => item.isNoTrainer)) {
    trainerItems.push({ name: 'No Trainer', isNoTrainer: true });
  }

  return (
    <div
      className={`ws-location-group ${STATE_CLASSES[group.state]}${group.isPrivate ? ' ws-private-group' : ''}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="ws-group-header">
        <div className="ws-group-title">
          <span>{group.isPrivate ? 'On Site' : group.location} &ndash; {group.openCount} of {group.totalCount}</span>
          <span className="ws-expand-toggle">{expanded ? '▾' : '▸'}</span>
        </div>
        <div className="ws-group-time-row">
          <span className="ws-group-time">{group.startTime} – {group.endTime}</span>
          <div className="ws-group-badges">
            {noTrainerCount > 0 && (
              <span
                className="ws-badge-t"
                title={`${noTrainerCount} of ${group.totalCount} workshops have No Trainer as an assigned Trainer`}
              >
                T
              </span>
            )}
            {tentativeCount > 0 && (
              <span
                className="ws-badge-m"
                title={`${tentativeCount} of ${group.totalCount} workshops are marked as Tentative or Cancelled`}
              >
                !
              </span>
            )}
          </div>
        </div>
        {showTrainer && trainerItems.length > 0 && (
          <div className="ws-group-trainer">
            {trainerItems.map((item, index) => (
              <span key={index}>
                {index > 0 && ', '}
                {item.isNoTrainer ? (
                  <span className="ws-no-trainer-text">No Trainer</span>
                ) : (
                  item.name
                )}
              </span>
            ))}
          </div>
        )}
      </div>
      {expanded && (
        <div className="ws-expanded-list" onClick={(e) => e.stopPropagation()}>
          {group.workshops.map((w) => {
            const isNoTrainer =
              !w.trainerName || w.trainerName.trim() === '' || w.trainerName.toLowerCase() === 'no trainer';
            const statusLower = (w.status || '').toLowerCase();
            return (
              <div
                key={w.instanceId}
                className={`ws-expanded-workshop ${getWorkshopClass(w)}${w.isPublic ? '' : ' ws-expanded-private'}`}
                onClick={() => window.open(buildAxcelerateUrl(workshopBaseUrl, w.instanceId), '_blank', 'noopener')}
                title="Open in Axcelerate"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="ws-course-title">
                    {w.courseCode} – {w.shortName}
                    {statusLower === 'tentative' ? ' (T)' : statusLower === 'cancelled' ? ' (C)' : ''}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProgressModal(parseInt(w.instanceId, 10), `${w.courseCode} - ${w.shortName}`);
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.85)',
                      border: '1px solid rgba(0, 0, 0, 0.25)',
                      borderRadius: 3,
                      padding: '0px 4px',
                      fontSize: 10,
                      fontWeight: 'bold',
                      lineHeight: 1.3,
                      cursor: 'pointer',
                      color: '#0f172a',
                      marginLeft: 4,
                      flexShrink: 0,
                    }}
                    title="View Workshop Progress & LMS Settings"
                  >
                    [...]
                  </button>
                </div>
                <div className="ws-time">{w.startTime} – {w.endTime}</div>
                {w.venueContactName && <div className="ws-venue-name">Client: {w.venueContactName}</div>}
                {showTrainer && (
                  <div className="ws-trainer-name">
                    Trainer:{' '}
                    {isNoTrainer ? (
                      <span className="ws-no-trainer-text">No Trainer</span>
                    ) : (
                      w.trainerName
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminCalendarPage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [trainerFilter, setTrainerFilter] = useState('all');
  const [locations, setLocations] = useState<string[]>([]);
  const [trainers, setTrainers] = useState<{ id: string; name: string }[]>([]);
  const [workshopBaseUrl, setWorkshopBaseUrl] = useState('');
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);

  // Workshop Progress Modal state
  const [selectedWorkshopForProgress, setSelectedWorkshopForProgress] = useState<{ instanceId: number; title: string } | null>(null);

  useEffect(() => {
    workshopsApi.getFilters().then((res) => {
      setLocations(res.data.locations);
      setTrainers(res.data.trainers);
    }).catch(() => {});
    settingsApi.getAll().then((res) => {
      setWorkshopBaseUrl(res.data.axcelerate_workshop_url ?? '');
    }).catch(() => {});
  }, []);

  const loadCalendar = useCallback((m: number, y: number) => {
    setLoading(true);
    setError('');
    workshopsApi.getCalendar(m, y)
      .then((res) => setCalendarData(res.data))
      .catch((err) => setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load calendar'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadCalendar(month, year); }, [month, year, loadCalendar]);

  const navigate = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="admin-calendar-page">
      <div className="cal-controls">
        <div className="cal-month-nav">
          <button className="cal-nav-btn" onClick={() => navigate(-1)}>&#8249; Prev</button>
          <select
            className="cal-month-jump"
            value={`${year}-${month}`}
            onChange={(e) => {
              const [y, m] = e.target.value.split('-').map(Number);
              setYear(y); setMonth(m);
            }}
          >
            {Array.from({ length: 24 }, (_, i) => {
              const d = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
              const v = `${d.getFullYear()}-${d.getMonth() + 1}`;
              return <option key={v} value={v}>{MONTH_NAMES[d.getMonth()]} {d.getFullYear()}</option>;
            })}
          </select>
          <button className="cal-nav-btn" onClick={() => navigate(1)}>Next &#8250;</button>
        </div>

        <div className="cal-filters">
          <label>Location:</label>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="all">All Locations</option>
            <option value="__onsite__">On Site</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <label>Trainer:</label>
          <select value={trainerFilter} onChange={(e) => setTrainerFilter(e.target.value)}>
            <option value="all">All Trainers</option>
            {trainers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        <div className="cal-global-btns">
          <button className="cal-btn-blue" onClick={() => setForceExpanded(true)}>Expand All</button>
          <button className="cal-btn-grey" onClick={() => setForceExpanded(false)}>Collapse All</button>
          <button className="cal-btn-disabled" disabled>[Open Scheduler]</button>
        </div>
      </div>

      <div className="cal-legend">
        <span className="legend-swatch ws-group-open">Future (enrolled)</span>
        <span className="legend-swatch ws-group-future-empty">Future (empty)</span>
        <span className="legend-swatch ws-group-incomplete-past">Past — incomplete</span>
        <span className="legend-swatch ws-group-complete-past">Past — complete</span>
        <span className="legend-swatch ws-group-closed">Past — no students</span>
        <span className="legend-swatch ws-expanded-tentative">Tentative / Cancelled</span>
        <span className="legend-swatch ws-private-indicator">Blue outline = On Site</span>
      </div>

      {error && <div className="cal-error">{error}</div>}

      {calendarData?.errors?.length ? (
        <div className="cal-api-warnings">
          <strong>API warnings:</strong>
          <ul>{calendarData.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      ) : null}

      {loading ? (
        <div className="cal-loading">Loading {MONTH_NAMES[month - 1]} {year}...</div>
      ) : (
        <div className="cal-grid">
          {DAY_NAMES.map((d) => <div key={d} className="cal-day-name">{d}</div>)}
          {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} className="cal-day cal-day-empty" />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayData = calendarData?.days[dateStr];
            const isToday = dateStr === todayStr;
            return (
              <div key={dateStr} className={`cal-day${isToday ? ' cal-today' : ''}`}>
                <div className="cal-day-number">{day}</div>
                {dayData?.grouped?.map((g, gi) => (
                  <GroupTile
                    key={`p${gi}`}
                    group={g}
                    workshopBaseUrl={workshopBaseUrl}
                    showTrainer
                    locationFilter={locationFilter}
                    trainerFilter={trainerFilter}
                    forceExpanded={forceExpanded}
                    onOpenProgressModal={(instanceId, title) => setSelectedWorkshopForProgress({ instanceId, title })}
                  />
                ))}
                {dayData?.groupedPrivate?.map((g, gi) => (
                  <GroupTile
                    key={`r${gi}`}
                    group={g}
                    workshopBaseUrl={workshopBaseUrl}
                    showTrainer
                    locationFilter={locationFilter}
                    trainerFilter={trainerFilter}
                    forceExpanded={forceExpanded}
                    onOpenProgressModal={(instanceId, title) => setSelectedWorkshopForProgress({ instanceId, title })}
                  />
                ))}
              </div>
            );
          })}
          {(() => { const trailing = 7 - ((firstDay + daysInMonth) % 7); return trailing < 7 ? Array.from({ length: trailing }, (_, i) => <div key={`t${i}`} className="cal-day cal-day-empty" />) : null; })()}
        </div>
      )}

      {selectedWorkshopForProgress && (
        <WorkshopProgressModal
          instanceId={selectedWorkshopForProgress.instanceId}
          title={selectedWorkshopForProgress.title}
          onClose={() => setSelectedWorkshopForProgress(null)}
        />
      )}
    </div>
  );
}
