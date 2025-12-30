import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions, type Permissions } from '@/hooks/usePermissions';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ShieldX, ArrowLeft } from 'lucide-react';

interface PermissionGuardProps {
  children: React.ReactNode;
  permission: keyof Permissions;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

const DefaultFallback = () => (
  <div className="flex items-center justify-center min-h-[60vh] p-6">
    <Card className="max-w-md w-full">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10 w-fit">
          <ShieldX className="h-8 w-8 text-destructive" />
        </div>
        <CardTitle>Acesso Restrito</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground">
          Você não tem permissão para acessar esta área. 
          Entre em contato com o administrador do workspace se precisar de acesso.
        </p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </CardContent>
    </Card>
  </div>
);

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  fallback,
  redirectTo,
}) => {
  const permissions = usePermissions();
  const { loading, currentWorkspace } = useWorkspace();

  // Still loading - don't render anything yet
  if (loading) {
    return null;
  }

  // No workspace selected - let AuthGuard handle this
  if (!currentWorkspace) {
    return null;
  }

  // Check permission
  const hasPermission = permissions[permission];

  if (!hasPermission) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }
    return <>{fallback || <DefaultFallback />}</>;
  }

  return <>{children}</>;
};

// HOC for wrapping entire pages
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  permission: keyof Permissions,
  redirectTo?: string
) {
  return function WrappedComponent(props: P) {
    return (
      <PermissionGuard permission={permission} redirectTo={redirectTo}>
        <Component {...props} />
      </PermissionGuard>
    );
  };
}
