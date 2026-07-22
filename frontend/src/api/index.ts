import api from './client';

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  verifyMfa: (email: string, code: string) =>
    api.post('/auth/verify-mfa', { email, code }),

  me: () => api.get('/auth/me'),

  impersonate: (trainerId: number) =>
    api.post('/auth/impersonate', { trainerId }),

  stopImpersonating: () => api.post('/auth/stop-impersonating'),
};

export const usersApi = {
  list: () => api.get('/users'),
  listTrainers: () => api.get('/users/trainers'),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.patch(`/users/${id}`, data),
  archive: (id: number) => api.patch(`/users/${id}/archive`),
  restore: (id: number) => api.patch(`/users/${id}/restore`),
  deactivate: (id: number) => api.patch(`/users/${id}/deactivate`),
  lookupAxcelerateContact: (email: string) => api.post('/users/lookup-axcelerate-contact', { email }),
};

export const settingsApi = {
  getAll: () => api.get('/settings'),
  saveAll: (settings: { key: string; value: string }[]) =>
    api.put('/settings', { settings }),
};

export const workshopsApi = {
  getCalendar: (month: number, year: number) =>
    api.get('/workshops/calendar', { params: { month, year } }),
  getTrainerCalendar: (trainerId: string, month: number, year: number) =>
    api.get('/workshops/trainer-calendar', { params: { trainerId, month, year } }),
  getFilters: () => api.get('/workshops/filters'),
};

export const uploadsApi = {
  upload: (formData: FormData) =>
    api.post('/uploads', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: number) => api.delete(`/uploads/${id}`),
  getForInstance: (instanceId: number) =>
    api.get('/uploads', { params: { instanceId } }),
};

export const workshopDetailApi = {
  getHeader: (instanceId: number, enrolOpen: string, isPublic: string) =>
    api.get('/workshop-detail/header', { params: { instanceId, enrolOpen, isPublic } }),
  getStudents: (instanceId: number, startDate: string, courseCode: string) =>
    api.get('/workshop-detail/students', { params: { instanceId, startDate, courseCode } }),
  markAttendance: (data: object) => api.post('/workshop-detail/attendance', data),
  getChecklist: (instanceId: number, contactId: number, courseCode: string) =>
    api.get('/workshop-detail/checklist', { params: { instanceId, contactId, courseCode } }),
  saveChecklist: (data: object) => api.post('/workshop-detail/checklist', data),
  resetChecklists: (instanceId: number, courseCode: string) =>
    api.post('/workshop-detail/checklist/reset', { instanceId, courseCode }),
  bulkMarkAllTasksSatisfactory: (instanceId: number, courseCode: string) =>
    api.post('/workshop-detail/checklist/bulk-mark-satisfactory', { instanceId, courseCode }),
  saveProgress: (data: object) => api.post('/workshop-detail/progress', data),
  getTaskStructure: (instanceId: number, courseCode: string) =>
    api.get('/workshop-detail/task-structure', { params: { instanceId, courseCode } }),
  saveWizardResults: (data: object) => api.post('/workshop-detail/wizard-save', data),
  getOlka: (instanceId: number, courseCode: string) =>
    api.get('/workshop-detail/olka', { params: { instanceId, courseCode } }),
  getSuccessComment: (ptId: string) =>
    api.get('/workshop-detail/success-comment', { params: { ptId } }),
};

export const bulkSchedulerApi = {
  listSchedules: () => api.get('/bulk-scheduler/schedules'),
  createSchedule: (name: string) => api.post('/bulk-scheduler/schedules', { name }),
  renameSchedule: (id: number, name: string) => api.put(`/bulk-scheduler/schedules/${id}`, { name }),
  duplicateSchedule: (id: number, name?: string) => api.post(`/bulk-scheduler/schedules/${id}/duplicate`, name ? { name } : {}),
  deleteSchedule: (id: number) => api.delete(`/bulk-scheduler/schedules/${id}`),
  addItem: (scheduleId: number, item: any) => api.post(`/bulk-scheduler/schedules/${scheduleId}/items`, item),
  updateItem: (id: number, item: any) => api.put(`/bulk-scheduler/items/${id}`, item),
  deleteItem: (id: number) => api.delete(`/bulk-scheduler/items/${id}`),
  queueRun: (payload: { scheduleId: number; startDate: string; endDate: string; confirmValue?: string }) => api.post('/bulk-scheduler/runs', payload),
  getRuns: () => api.get('/bulk-scheduler/runs'),
  getOptions: () => api.get('/bulk-scheduler/options'),
  processRun: (id: number) => api.post(`/bulk-scheduler/runs/${id}/process`),
};

export const aiApi = {
  classifyPage: (data: {
    instanceId: number;
    pageNumber: number;
    pageImage: string;
    roster: { contact_id: number; name: string }[];
  }) => api.post('/ai/classify-page', data),
};
