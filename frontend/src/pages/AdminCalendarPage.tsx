import { useState, useEffect, useCallback } from 'react';
import { workshopsApi, settingsApi } from '../api';
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
  if (!w.isPast) return w.participants > 0 ? 'ws-expanded-future' : 'ws-expanded-future-empty';
  if (w.participants > 0) return w.progressComplete ? 'ws-expanded-past-complete' : 'ws-expanded-past-incomplete';
  return 'ws-expanded-past';
}

function GroupTile({
  group, workshopBaseUrl, showTrainer, locationFilter, trainerFilter, forceExpanded,
}: {
  group: WorkshopGroup; workshopBaseUrl: string; showTrainer: boolean;
  locationFilter: string; trainerFilter: string; forceExpanded: boolean | null;
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
        <div className="ws-group-time">{group.startTime} – {group.endTime}</div>
        {showTrainer && group.trainerNames.length > 0 && (
          <div className="ws-group-trainer">{group.trainerNames.join(', ')}</div>
        )}
      </div>
      {expanded && (
        <div className="ws-expanded-list" onClick={(e) => e.stopPropagation()}>
          {group.workshops.map((w) => (
            <div
              key={w.instanceId}
              className={`ws-expanded-workshop ${getWorkshopClass(w)}${w.isPublic ? '' : ' ws-expanded-private'}`}
              onClick={() => window.open(buildAxcelerateUrl(workshopBaseUrl, w.instanceId), '_blank', 'noopener')}
              title="Open in Axcelerate"
            >
              <div className="ws-course-title">{w.courseCode} – {w.shortName}</div>
              <div className="ws-time">{w.startTime} – {w.endTime}</div>
              {w.venueContactName && <div className="ws-venue-name">Client: {w.venueContactName}</div>}
              {showTrainer && w.trainerName && <div className="ws-trainer-name">Trainer: {w.trainerName}</div>}
            </div>
          ))}
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
                  <GroupTile key={`p${gi}`} group={g} workshopBaseUrl={workshopBaseUrl} showTrainer locationFilter={locationFilter} trainerFilter={trainerFilter} forceExpanded={forceExpanded} />
                ))}
                {dayData?.groupedPrivate?.map((g, gi) => (
                  <GroupTile key={`r${gi}`} group={g} workshopBaseUrl={workshopBaseUrl} showTrainer locationFilter={locationFilter} trainerFilter={trainerFilter} forceExpanded={forceExpanded} />
                ))}
              </div>
            );
          })}
          {(() => { const trailing = 7 - ((firstDay + daysInMonth) % 7); return trailing < 7 ? Array.from({ length: trailing }, (_, i) => <div key={`t${i}`} className="cal-day cal-day-empty" />) : null; })()}
        </div>
      )}
    </div>
  );
}
