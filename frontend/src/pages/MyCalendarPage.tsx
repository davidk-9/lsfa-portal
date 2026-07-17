import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { workshopsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { CalendarData, WorkshopGroup, WorkshopState } from '../types/workshops';
import '../pages/AdminCalendarPage.css';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATE_CLASSES: Record<WorkshopState, string> = {
  'future-with-students': 'ws-group-open',
  'future-empty': 'ws-group-future-empty',
  'past-incomplete': 'ws-group-incomplete-past',
  'past-complete': 'ws-group-complete-past',
  'past-no-students': 'ws-group-closed',
};

function TrainerGroupTile({
  group, locationFilter, forceExpanded, onWorkshopClick,
}: {
  group: WorkshopGroup; locationFilter: string;
  forceExpanded: boolean | null;
  onWorkshopClick: (instanceId: string, enrolOpen: boolean, isPublic: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (forceExpanded !== null) setExpanded(forceExpanded);
  }, [forceExpanded]);

  const matchesLocation =
    locationFilter === 'all' ||
    (group.isPrivate && locationFilter === '__onsite__') ||
    group.location.toLowerCase().includes(locationFilter.toLowerCase());

  if (!matchesLocation) return null;

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
      </div>
      {expanded && (
        <div className="ws-expanded-list" onClick={(e) => e.stopPropagation()}>
          {group.workshops.map((w) => (
            <div
              key={w.instanceId}
              className={`ws-expanded-workshop ${w.isPast ? (w.progressComplete ? 'ws-expanded-past-complete' : (w.participants > 0 ? 'ws-expanded-past-incomplete' : 'ws-expanded-past')) : (w.participants > 0 ? 'ws-expanded-future' : 'ws-expanded-future-empty')}${w.isPublic ? '' : ' ws-expanded-private'}`}
              onClick={() => onWorkshopClick(w.instanceId, !w.isPast, w.isPublic)}
              title="Open workshop"
            >
              <div className="ws-course-title">{w.courseCode} – {w.shortName}</div>
              <div className="ws-time">{w.startTime} – {w.endTime}</div>
              {w.venueContactName && <div className="ws-venue-name">Client: {w.venueContactName}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function MyCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [locationFilter, setLocationFilter] = useState('all');
  const [locations, setLocations] = useState<string[]>([]);
  const [forceExpanded, setForceExpanded] = useState<boolean | null>(null);

  // Use the impersonated trainer's Axcelerate ID when impersonating,
  // otherwise use the logged-in user's own Axcelerate ID
  const trainerContactId = user?.impersonating
    ? (user.impersonatingAxcelerateContactId ?? '')
    : (user?.axcelerateContactId ?? '');

  useEffect(() => {
    workshopsApi.getFilters().then((res) => setLocations(res.data.locations)).catch(() => {});
  }, []);

  const loadCalendar = useCallback((m: number, y: number) => {
    if (!trainerContactId) {
      setError('No Axcelerate contact ID linked to this trainer account. Please contact an admin.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    workshopsApi.getTrainerCalendar(trainerContactId, m, y)
      .then((res) => setCalendarData(res.data))
      .catch((err) => setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load calendar'))
      .finally(() => setLoading(false));
  }, [trainerContactId]);

  useEffect(() => { loadCalendar(month, year); }, [month, year, loadCalendar]);

  const navigate_ = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  };

  const handleWorkshopClick = (instanceId: string, enrolOpen: boolean, isPublic: boolean) => {
    navigate(`/workshop/${instanceId}?enrolOpen=${enrolOpen}&isPublic=${isPublic}`);
  };

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  return (
    <div className="admin-calendar-page">
      <div className="cal-controls">
        <div className="cal-month-nav">
          <button className="cal-nav-btn" onClick={() => navigate_(-1)}>&#8249; Prev</button>
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
          <button className="cal-nav-btn" onClick={() => navigate_(1)}>Next &#8250;</button>
        </div>

        <div className="cal-filters">
          <label>Location:</label>
          <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
            <option value="all">All Locations</option>
            <option value="__onsite__">On Site</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div className="cal-global-btns">
          <button className="cal-btn-blue" onClick={() => setForceExpanded(true)}>Expand All</button>
          <button className="cal-btn-grey" onClick={() => setForceExpanded(false)}>Collapse All</button>
        </div>
      </div>

      {error && <div className="cal-error">{error}</div>}

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
                  <TrainerGroupTile key={`p${gi}`} group={g} locationFilter={locationFilter} forceExpanded={forceExpanded} onWorkshopClick={handleWorkshopClick} />
                ))}
                {dayData?.groupedPrivate?.map((g, gi) => (
                  <TrainerGroupTile key={`r${gi}`} group={g} locationFilter={locationFilter} forceExpanded={forceExpanded} onWorkshopClick={handleWorkshopClick} />
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
