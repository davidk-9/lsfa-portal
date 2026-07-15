import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AdminCalendarPage } from './pages/AdminCalendarPage';
import { TrainerPortalPage } from './pages/TrainerPortalPage';
import { MyCalendarPage } from './pages/MyCalendarPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorkshopDetailPage } from './pages/WorkshopDetailPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
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
            <Route path="my-calendar" element={<MyCalendarPage />} />
            <Route path="workshop/:instanceId" element={<WorkshopDetailPage />} />
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
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
