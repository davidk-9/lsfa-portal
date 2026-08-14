import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { StudentOnboardingGuard } from './components/StudentOnboardingGuard';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { AutoLogPage } from './pages/AutoLogPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminCalendarPage } from './pages/AdminCalendarPage';
import { TrainerPortalPage } from './pages/TrainerPortalPage';
import { MyCalendarPage } from './pages/MyCalendarPage';
import { UsersPage } from './pages/UsersPage';
import { ContactsPage } from './pages/ContactsPage';
import { ContactDetailsPage } from './pages/ContactDetailsPage';
import { SettingsPage } from './pages/SettingsPage';
import { BulkSchedulerPage } from './pages/BulkSchedulerPage';
import { WorkshopDetailPage } from './pages/WorkshopDetailPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { MyDetailsPage } from './pages/MyDetailsPage';
import { LmsAdminPage } from './pages/LmsAdminPage';
import { LmsBlockEditorPage } from './pages/LmsBlockEditorPage';

import { SessionProvider } from './lms/contexts/SessionContext';
import { LmsHome } from './lms/pages/LmsHome';
import { LmsMagicLinkHandler } from './lms/pages/LmsMagicLinkHandler';
import { LmsWelcome } from './lms/pages/LmsWelcome';
import { LmsModeSelector } from './lms/pages/LmsModeSelector';
import { LmsLearnDashboard } from './lms/pages/LmsLearnDashboard';
import { LmsResults } from './lms/pages/LmsResults';

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/autolog" element={<AutoLogPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <StudentOnboardingGuard>
                  <AppLayout />
                </StudentOnboardingGuard>
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<UserProfilePage />} />
            <Route path="my-details" element={<MyDetailsPage />} />
            <Route
              path="contacts"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN']}>
                  <ContactsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="contacts/:id"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN']}>
                  <ContactDetailsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin-calendar"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN']}>
                  <AdminCalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="trainers"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN']}>
                  <TrainerPortalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="lms-admin"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN']}>
                  <LmsAdminPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="lms-admin/blocks/new"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN']}>
                  <LmsBlockEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="lms-admin/blocks/:id/edit"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN']}>
                  <LmsBlockEditorPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="my-calendar"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN', 'TRAINER']}>
                  <MyCalendarPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="workshop/:instanceId"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER', 'ADMIN', 'TRAINER']}>
                  <WorkshopDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER']}>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="bulk-scheduler"
              element={
                <ProtectedRoute allowedRoles={['SUPER_USER']}>
                  <BulkSchedulerPage />
                </ProtectedRoute>
              }
            />
          </Route>

          {/* LMS Student Portal Routes */}
          <Route
            path="/lms"
            element={
              <SessionProvider>
                <Outlet />
              </SessionProvider>
            }
          >
            <Route index element={<LmsHome />} />
            <Route path="start/:enrollmentId" element={<LmsMagicLinkHandler />} />
            <Route path="welcome" element={<LmsWelcome />} />
            <Route path="select-mode" element={<LmsModeSelector />} />
            <Route path="learn" element={<LmsLearnDashboard />} />
            <Route path="results" element={<LmsResults />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
