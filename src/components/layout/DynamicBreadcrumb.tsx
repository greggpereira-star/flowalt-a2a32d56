import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useSpace } from '@/hooks/useSpaces';
import { useFolders } from '@/hooks/useFolders';
import { useCard } from '@/hooks/useCards';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Home, Building2, Layout, Folder, FileText } from 'lucide-react';

interface BreadcrumbSegment {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  isCurrent?: boolean;
}

const routeNames: Record<string, { label: string; icon?: React.ReactNode }> = {
  '/dashboard': { label: 'Dashboard', icon: <Layout className="h-3.5 w-3.5" /> },
  '/tasks': { label: 'Minhas Tarefas', icon: <FileText className="h-3.5 w-3.5" /> },
  '/time': { label: 'Tempo' },
  '/calendar': { label: 'Agenda' },
  '/coordination': { label: 'Coordenação' },
  '/financial': { label: 'Financeiro' },
  '/partners': { label: 'Painel dos Sócios' },
  '/gamification': { label: 'Gamificação' },
  '/analytics': { label: 'Análises' },
  '/settings': { label: 'Configurações' },
  '/marketing': { label: 'Marketing', icon: <Layout className="h-3.5 w-3.5" /> },
  '/clients': { label: 'Clientes' },
  '/people-analytics': { label: 'People Analytics' },
  '/integrations': { label: 'Integrações' },
};

interface DynamicBreadcrumbProps {
  spaceId?: string;
  folderId?: string;
  cardId?: string;
}

export const DynamicBreadcrumb: React.FC<DynamicBreadcrumbProps> = ({
  spaceId,
  folderId,
  cardId,
}) => {
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const { data: space } = useSpace(spaceId);
  const { data: folders } = useFolders(spaceId);
  const { data: card } = useCard(cardId);

  const folder = folders?.find(f => f.id === folderId);

  const segments: BreadcrumbSegment[] = [
    {
      label: currentWorkspace?.name || 'Flowalt',
      href: '/',
      icon: <Home className="h-3.5 w-3.5" />,
    },
  ];

  // Check for static routes
  const staticRoute = routeNames[location.pathname];
  if (staticRoute) {
    segments.push({
      label: staticRoute.label,
      icon: staticRoute.icon,
      isCurrent: true,
    });
  } else if (spaceId && space) {
    // Space page breadcrumb
    segments.push({
      label: space.name,
      href: `/space/${space.id}`,
      icon: (
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: space.color }}
        />
      ),
      isCurrent: !folderId && !cardId,
    });

    if (folder) {
      segments.push({
        label: folder.name,
        href: `/space/${space.id}?folder=${folder.id}`,
        icon: <Folder className="h-3.5 w-3.5" style={{ color: folder.color || undefined }} />,
        isCurrent: !cardId,
      });
    }

    if (card) {
      segments.push({
        label: card.title.length > 30 ? card.title.substring(0, 30) + '...' : card.title,
        icon: <FileText className="h-3.5 w-3.5" />,
        isCurrent: true,
      });
    }
  }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {segments.map((segment, index) => (
          <React.Fragment key={index}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {segment.isCurrent ? (
                <BreadcrumbPage className="flex items-center gap-1.5">
                  {segment.icon}
                  <span>{segment.label}</span>
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={segment.href || '/'} className="flex items-center gap-1.5">
                    {segment.icon}
                    <span>{segment.label}</span>
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
