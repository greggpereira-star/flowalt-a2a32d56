import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useFolders } from '@/hooks/useFolders';
import { useFolderViews } from '@/hooks/useSocialMediaTemplates';
import { useExpandedFolders } from '@/hooks/useUserPreferences';
import { useSocialMediaTracking } from '@/hooks/useSocialMediaTracking';
import { CreateFolderWithTemplateDialog } from './CreateFolderWithTemplateDialog';
import { CreateViewDialog } from './CreateViewDialog';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  LayoutGrid,
  Kanban,
  Calendar,
  List,
  Lightbulb,
  CheckCircle,
  Megaphone,
  BarChart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SocialMediaTreeNavProps {
  spaceId: string;
  spaceName: string;
  spaceColor?: string;
}

const viewTypeIcons: Record<string, React.ElementType> = {
  kanban: Kanban,
  calendar: Calendar,
  list: List,
  ideas: Lightbulb,
  approvals: CheckCircle,
  campaigns: Megaphone,
  reports: BarChart,
};

const getViewIcon = (viewType: string, viewName?: string) => {
  // Try to infer from view name
  const nameLower = viewName?.toLowerCase() || '';
  if (nameLower.includes('ideias') || nameLower.includes('ideas')) return Lightbulb;
  if (nameLower.includes('aprovação') || nameLower.includes('approval')) return CheckCircle;
  if (nameLower.includes('campanha') || nameLower.includes('campaign')) return Megaphone;
  if (nameLower.includes('relatório') || nameLower.includes('report')) return BarChart;
  
  return viewTypeIcons[viewType] || LayoutGrid;
};

interface FolderItemProps {
  folder: { id: string; name: string; color: string | null };
  spaceId: string;
  isExpanded: boolean;
  onToggle: () => void;
  selectedViewId?: string | null;
  onViewSelect: (viewId: string, viewType: string) => void;
  onCreateView: () => void;
}

const FolderItem: React.FC<FolderItemProps> = ({
  folder,
  spaceId,
  isExpanded,
  onToggle,
  selectedViewId,
  onViewSelect,
  onCreateView,
}) => {
  const { data: views, isLoading } = useFolderViews(folder.id);

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="flex items-center group">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-1 px-2 h-8 font-normal hover:bg-muted/50"
          >
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            )}
            {isExpanded ? (
              <FolderOpen
                className="h-4 w-4 flex-shrink-0"
                style={{ color: folder.color || undefined }}
              />
            ) : (
              <Folder
                className="h-4 w-4 flex-shrink-0"
                style={{ color: folder.color || undefined }}
              />
            )}
            <span className="truncate text-sm">{folder.name}</span>
          </Button>
        </CollapsibleTrigger>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onCreateView();
          }}
          title="Adicionar View"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <CollapsibleContent>
        <div className="ml-4 pl-2 border-l border-border/50 space-y-0.5 py-0.5">
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-full" />
            </>
          ) : views && views.length > 0 ? (
            views.map((view) => {
              const Icon = getViewIcon(view.view_type, view.name);
              const isActive = selectedViewId === view.id;

              return (
                <Button
                  key={view.id}
                  variant={isActive ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'w-full justify-start gap-2 px-2 h-7 font-normal text-sm',
                    isActive && 'bg-primary/10 text-primary'
                  )}
                  onClick={() => onViewSelect(view.id, view.view_type)}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{view.name}</span>
                </Button>
              );
            })
          ) : (
            <p className="text-xs text-muted-foreground px-2 py-1">Sem views</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export const SocialMediaTreeNav: React.FC<SocialMediaTreeNavProps> = ({
  spaceId,
  spaceName,
  spaceColor,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: folders, isLoading: foldersLoading } = useFolders(spaceId);
  const { value: expandedFolders, setValue: setExpandedFolders } = useExpandedFolders(spaceId);
  const { trackFolderExpanded, trackFolderCollapsed, trackViewOpened } = useSocialMediaTracking();

  const [createFolderOpen, setCreateFolderOpen] = useState(false);
  const [createViewOpen, setCreateViewOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Parse current view from URL
  const searchParams = new URLSearchParams(location.search);
  const currentViewId = searchParams.get('view');

  const handleToggleFolder = useCallback(
    (folderId: string, isCurrentlyExpanded: boolean) => {
      const newExpanded = isCurrentlyExpanded
        ? expandedFolders.filter((id) => id !== folderId)
        : [...expandedFolders, folderId];

      setExpandedFolders(newExpanded);

      // Track event
      if (isCurrentlyExpanded) {
        trackFolderCollapsed(spaceId, folderId);
      } else {
        trackFolderExpanded(spaceId, folderId);
      }
    },
    [expandedFolders, setExpandedFolders, spaceId, trackFolderExpanded, trackFolderCollapsed]
  );

  const handleViewSelect = useCallback(
    (viewId: string, viewType: string) => {
      navigate(`/space/${spaceId}?view=${viewId}`);
      trackViewOpened({ space_id: spaceId, view_id: viewId, view_type: viewType });
    },
    [navigate, spaceId, trackViewOpened]
  );

  const handleCreateViewForFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    setCreateViewOpen(true);
  };

  return (
    <div className="space-y-1">
      {/* Space Header */}
      <div className="flex items-center justify-between px-2 py-1 group">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: spaceColor }}
          />
          <span className="text-sm font-medium truncate">{spaceName}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          onClick={() => setCreateFolderOpen(true)}
          title="Adicionar Pasta"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Folders Tree */}
      <div className="space-y-0.5">
        {foldersLoading ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : folders && folders.length > 0 ? (
          folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              spaceId={spaceId}
              isExpanded={expandedFolders.includes(folder.id)}
              onToggle={() =>
                handleToggleFolder(folder.id, expandedFolders.includes(folder.id))
              }
              selectedViewId={currentViewId}
              onViewSelect={handleViewSelect}
              onCreateView={() => handleCreateViewForFolder(folder.id)}
            />
          ))
        ) : (
          <p className="text-xs text-muted-foreground px-2 py-2">
            Nenhuma pasta. Clique em + para criar.
          </p>
        )}
      </div>

      {/* Create Folder Dialog */}
      <CreateFolderWithTemplateDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        spaceId={spaceId}
        spaceType="social_media"
      />

      {/* Create View Dialog */}
      <CreateViewDialog
        open={createViewOpen}
        onOpenChange={setCreateViewOpen}
        folderId={selectedFolderId}
        spaceType="social_media"
        onSuccess={(viewId, viewType) => {
          handleViewSelect(viewId, viewType);
        }}
      />
    </div>
  );
};
