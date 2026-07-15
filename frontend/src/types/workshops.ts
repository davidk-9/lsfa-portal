export type WorkshopState =
  | 'future-with-students'
  | 'future-empty'
  | 'past-incomplete'
  | 'past-complete'
  | 'past-no-students';

export interface WorkshopDetail {
  instanceId: string;
  courseCode: string;
  shortName: string;
  startTime: string;
  endTime: string;
  participants: number;
  trainerId: string;
  trainerName: string;
  venueContactName: string;
  isPast: boolean;
  isPublic: boolean;
  progressComplete: boolean;
}

export interface WorkshopGroup {
  location: string;
  isPrivate: boolean;
  state: WorkshopState;
  totalCount: number;
  openCount: number;
  startTime: string;
  endTime: string;
  trainerIds: string[];
  trainerNames: string[];
  workshops: WorkshopDetail[];
}

export interface CalendarDay {
  grouped: WorkshopGroup[];
  groupedPrivate: WorkshopGroup[];
}

export interface CalendarData {
  month: number;
  year: number;
  days: Record<string, CalendarDay>;
  errors: string[];
}

