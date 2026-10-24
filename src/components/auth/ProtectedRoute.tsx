import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, buildFallbackProfile } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/States';
import type { Profile, UserRole } from '@/types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Authenticating session..." />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Active profile: use profile or fallback from session.user so user is NEVER blocked by a hanging setup screen
  const activeProfile: Profile | null = profile || (session?.user ? buildFallbackProfile(session.user) : null);

  if (!activeProfile) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(activeProfile.role)) {
    const roleRoutes: Record<UserRole, string> = {
      citizen: '/app/citizen',
      volunteer: '/app/volunteer',
      supervisor: '/app/supervisor',
      analyst: '/app/analyst',
      admin: '/app/admin',
    };
    const target = roleRoutes[activeProfile.role] || '/app';
    return <Navigate to={target} replace />;
  }

  return <>{children}</>;
}

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Checking session..." />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
}
