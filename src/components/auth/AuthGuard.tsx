import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileComplete } from '@/hooks/useProfileComplete';
import { Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
}

// Pages that don't require complete profile
const EXEMPT_PATHS = ['/complete-profile', '/auth', '/invite'];

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const { data: profileStatus, isLoading: profileLoading } = useProfileComplete();

  // Check if current path is exempt
  const isExemptPath = EXEMPT_PATHS.some(path => location.pathname.startsWith(path));

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Wait for profile status to load (but not on exempt pages)
  if (!isExemptPath && profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verificando perfil...</p>
        </div>
      </div>
    );
  }

  // If profile is not complete and not on exempt path, redirect
  if (!isExemptPath && profileStatus && !profileStatus.isComplete) {
    return <Navigate to="/complete-profile" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
