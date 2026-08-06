import api from './client';

export const authApi = {
  login: (email: string, password: string, deviceToken?: string) =>
    api.post('/auth/login', { email, password, deviceToken }),

  verifyMfa: (email: string, code: string, trustDevice?: boolean) =>
    api.post('/auth/verify-mfa', { email, code, trustDevice }),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, mfaCode: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, mfaCode, newPassword }),

  me: () => api.get('/auth/me'),

  impersonate: (trainerId: number) =>
    api.post('/auth/impersonate', { trainerId }),

  stopImpersonating: () => api.post('/auth/stop-impersonating'),
};

export const usersApi = {
  list: () => api.get('/users'),
  getPaginated: (page: number = 1, limit: number = 20, search: string = '', role: string = '', status: string = 'active') =>
    api.get('/users', { params: { page, limit, search, role, status } }),
  listTrainers: () => api.get('/users/trainers'),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.patch(`/users/${id}`, data),
  archive: (id: number) => api.patch(`/users/${id}/archive`),
  restore: (id: number) => api.patch(`/users/${id}/restore`),
  deactivate: (id: number) => api.patch(`/users/${id}/deactivate`),
  lookupAxcelerateContact: (email: string) => api.post('/users/lookup-axcelerate-contact', { email }),
};

export const contactsApi = {
  getMyContact: () => api.get('/contacts/me'),
  updateMyContact: (data: object) => api.patch('/contacts/me', data),
  syncAxcelerate: (axcelerateContactId?: number) => api.post('/contacts/sync-axcelerate', { axcelerateContactId }),
  verifyMyUsi: (usi?: string) => api.post('/contacts/me/verify-usi', { usi }),
  
  getPaginated: (page: number = 1, limit: number = 20, search: string = '', status: string = 'active') =>
    api.get('/contacts', { params: { page, limit, search, status } }),
  getById: (id: number) => api.get(`/contacts/${id}`),
  updateById: (id: number, data: object) => api.patch(`/contacts/${id}`, data),
  syncAxcelerateForContact: (id: number) => api.post(`/contacts/${id}/sync-axcelerate`),
  verifyContactUsi: (id: number, usi?: string) => api.post(`/contacts/${id}/verify-usi`, { usi }),
  searchQuick: (q: string, limit: number = 10) => api.get('/contacts/search', { params: { q, limit } }),
  linkUser: (contactId: number, userId: number) => api.post(`/contacts/${contactId}/link-user`, { userId }),
  unlinkUser: (contactId: number) => api.post(`/contacts/${contactId}/unlink-user`),
  createUser: (contactId: number, password?: string) => api.post(`/contacts/${contactId}/create-user`, { password }),
  syncUsersWithVerifiedUsi: () => api.post('/contacts/sync-users-usi'),
};

export const settingsApi = {
  getAll: () => api.get('/settings'),
  saveAll: (settings: { key: string; value: string }[]) =>
    api.put('/settings', { settings }),
  getCourseCodes: () => api.get('/settings/course-codes'),
  createCourseCode: (data: { code: string; name: string; shortName: string; cost: number }) =>
    api.post('/settings/course-codes', data),
  updateCourseCode: (id: number, data: { code?: string; name?: string; shortName?: string; cost?: number }) =>
    api.put(`/settings/course-codes/${id}`, data),
  deleteCourseCode: (id: number) => api.delete(`/settings/course-codes/${id}`),
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
export const profileApi = {
  getProfile: () => api.get('/profile/me'),
  updateProfile: (data: { name?: string; email?: string; axcelerateContactId?: string }) =>
    api.patch('/profile/me', data),
  changePassword: (data: { newPassword: string }) =>
    api.post('/profile/change-password', data),
};