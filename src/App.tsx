import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ProtectedRoute, PublicOnlyRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingState } from '@/components/ui/States';

import { LandingPage } from '@/pages/LandingPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ResetPasswordPage } from '@/pages/auth/ResetPasswordPage';
import { UnauthorizedPage, NotFoundPage, ErrorPage } from '@/pages/auth/ErrorPages';

import { CitizenDashboard } from '@/pages/citizen/CitizenDashboard';
import { ReportIssuePage } from '@/pages/citizen/ReportIssuePage';
import { MyReportsPage } from '@/pages/citizen/MyReportsPage';
import { ReportDetailsPage } from '@/pages/citizen/ReportDetailsPage';
import { TrackReportsPage } from '@/pages/citizen/TrackReportsPage';

import { VolunteerDashboard } from '@/pages/volunteer/VolunteerDashboard';
import { AvailableTasksPage } from '@/pages/volunteer/AvailableTasksPage';
import { VolunteerTasksPage } from '@/pages/volunteer/VolunteerTasksPage';
import { TaskDetailsPage } from '@/pages/volunteer/TaskDetailsPage';
import { CompletedTasksPage } from '@/pages/volunteer/CompletedTasksPage';

import { SupervisorDashboard } from '@/pages/supervisor/SupervisorDashboard';
import { IncomingReportsPage } from '@/pages/supervisor/IncomingReportsPage';
import { PriorityQueuePage } from '@/pages/supervisor/PriorityQueuePage';
import { DuplicateReviewPage } from '@/pages/supervisor/DuplicateReviewPage';
import { VolunteerMatchingPage } from '@/pages/supervisor/VolunteerMatchingPage';
import { TaskAssignmentPage } from '@/pages/supervisor/TaskAssignmentPage';
import { EvidenceVerificationPage } from '@/pages/supervisor/EvidenceVerificationPage';

import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { UserManagementPage } from '@/pages/admin/UserManagementPage';
import { VolunteerManagementPage } from '@/pages/admin/VolunteerManagementPage';

import { MapDashboardPage } from '@/pages/shared/MapDashboardPage';
import { AnalyticsPage } from '@/pages/shared/AnalyticsPage';
import { NotificationsPage } from '@/pages/shared/NotificationsPage';
import { ProfilePage } from '@/pages/shared/ProfilePage';
import { SettingsPage } from '@/pages/shared/SettingsPage';
import { AuditLogsPage } from '@/pages/shared/AuditLogsPage';
import { FeedbackPage } from '@/pages/shared/FeedbackPage';

function DashboardRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!profile) return <Navigate to="/login" replace />;
  const redirectMap: Record<string, string> = {
    citizen: '/app/citizen',
    volunteer: '/app/volunteer',
    supervisor: '/app/supervisor',
    admin: '/app/admin',
  };
  return <Navigate to={redirectMap[profile.role] || '/app/citizen'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          {/* Protected */}
          <Route path="/app" element={<ProtectedRoute><AppLayout><DashboardRedirect /></AppLayout></ProtectedRoute>} />

          {/* Citizen */}
          <Route path="/app/citizen" element={<ProtectedRoute allowedRoles={['citizen','admin']}><AppLayout><CitizenDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/citizen/report" element={<ProtectedRoute allowedRoles={['citizen','admin']}><AppLayout><ReportIssuePage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/citizen/reports" element={<ProtectedRoute allowedRoles={['citizen','admin']}><AppLayout><MyReportsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/citizen/track" element={<ProtectedRoute allowedRoles={['citizen','admin']}><AppLayout><TrackReportsPage /></AppLayout></ProtectedRoute>} />

          {/* Volunteer */}
          <Route path="/app/volunteer" element={<ProtectedRoute allowedRoles={['volunteer','admin']}><AppLayout><VolunteerDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/volunteer/available" element={<ProtectedRoute allowedRoles={['volunteer','admin']}><AppLayout><AvailableTasksPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/volunteer/tasks" element={<ProtectedRoute allowedRoles={['volunteer','admin']}><AppLayout><VolunteerTasksPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/volunteer/completed" element={<ProtectedRoute allowedRoles={['volunteer','admin']}><AppLayout><CompletedTasksPage /></AppLayout></ProtectedRoute>} />

          {/* Supervisor */}
          <Route path="/app/supervisor" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><SupervisorDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/supervisor/incoming" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><IncomingReportsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/supervisor/priority" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><PriorityQueuePage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/supervisor/duplicates" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><DuplicateReviewPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/supervisor/matching" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><VolunteerMatchingPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/supervisor/assignment" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><TaskAssignmentPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/supervisor/verification" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><EvidenceVerificationPage /></AppLayout></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/app/admin" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><AdminDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/app/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><UserManagementPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/admin/volunteers" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><VolunteerManagementPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/admin/reports" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><MyReportsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/admin/tasks" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><VolunteerTasksPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/admin/verification" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><EvidenceVerificationPage /></AppLayout></ProtectedRoute>} />

          {/* Shared */}
          <Route path="/app/map" element={<ProtectedRoute><AppLayout><MapDashboardPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/analytics" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><AnalyticsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/notifications" element={<ProtectedRoute><AppLayout><NotificationsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/profile" element={<ProtectedRoute><AppLayout><ProfilePage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/settings" element={<ProtectedRoute allowedRoles={['admin']}><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/audit" element={<ProtectedRoute allowedRoles={['supervisor','admin']}><AppLayout><AuditLogsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/feedback/:reportId" element={<ProtectedRoute><AppLayout><FeedbackPage /></AppLayout></ProtectedRoute>} />

          {/* Report & Task Details (shared) */}
          <Route path="/app/reports/:id" element={<ProtectedRoute><AppLayout><ReportDetailsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/app/tasks/:id" element={<ProtectedRoute><AppLayout><TaskDetailsPage /></AppLayout></ProtectedRoute>} />

          {/* Errors */}
          <Route path="/error" element={<ErrorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
