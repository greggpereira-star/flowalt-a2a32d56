import React from 'react';
import { 
  Folder, 
  Layout, 
  Calendar, 
  CheckSquare, 
  List,
  Lightbulb,
  ThumbsUp,
  FileText,
  Image,
  Bookmark,
  GitBranch,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SpaceTemplate, TemplateView, TemplateFolder, TemplateCustomField } from '@/lib/spaceTemplates';

interface SpaceTemplatePreviewProps {
  template: SpaceTemplate;
  spaceName?: string;
  spaceColor?: string;
}

const VIEW_ICONS: Record<string, typeof Layout> = {
  'layout': Layout,
  'calendar': Calendar,
  'check-square': CheckSquare,
  'thumbs-up': ThumbsUp,
  'lightbulb': Lightbulb,
  'list': List,
};

const FOLDER_ICONS: Record<string, typeof Folder> = {
  'folder': Folder,
  'lightbulb': Lightbulb,
  'thumbs-up': ThumbsUp,
  'file-text': FileText,
  'image': Image,
  'folder-open': Folder,
  'bookmark': Bookmark,
  'git-branch': GitBranch,
};

function ViewIcon({ iconName }: { iconName: string }) {
  const Icon = VIEW_ICONS[iconName] || Layout;
  return <Icon className="w-4 h-4" />;
}

function FolderIcon({ iconName, color }: { iconName: string; color: string }) {
  const Icon = FOLDER_ICONS[iconName] || Folder;
  return (
    <div
      className="w-6 h-6 rounded flex items-center justify-center"
      style={{ backgroundColor: `${color}20` }}
    >
      <Icon className="w-3.5 h-3.5" style={{ color }} />
    </div>
  );
}

function PreviewSection({ 
  title, 
  children,
  isEmpty = false,
}: { 
  title: string; 
  children: React.ReactNode;
  isEmpty?: boolean;
}) {
  if (isEmpty) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground italic">Nenhum item pré-configurado</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

export function SpaceTemplatePreview({ template, spaceName, spaceColor }: SpaceTemplatePreviewProps) {
  const displayName = spaceName || template.name;
  const displayColor = spaceColor || template.defaultColor;
  const Icon = template.icon;

  return (
    <ScrollArea className="h-[320px] pr-4">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${displayColor}20` }}
          >
            <Icon className="w-5 h-5" style={{ color: displayColor }} />
          </div>
          <div>
            <h3 className="font-medium">{displayName}</h3>
            <p className="text-xs text-muted-foreground">{template.description}</p>
          </div>
        </div>

        <Separator />

        {/* Features */}
        <PreviewSection title="O que será criado">
          <div className="space-y-1.5">
            {template.features.map((feature, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-foreground/80">{feature}</span>
              </div>
            ))}
          </div>
        </PreviewSection>

        <Separator />

        {/* Views */}
        <PreviewSection title="Views" isEmpty={template.views.length === 0}>
          <div className="grid grid-cols-2 gap-2">
            {template.views.map((view, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/50"
              >
                <ViewIcon iconName={view.icon} />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{view.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{view.type}</p>
                </div>
              </div>
            ))}
          </div>
        </PreviewSection>

        {/* Folders */}
        <PreviewSection title="Pastas" isEmpty={template.folders.length === 0}>
          <div className="space-y-2">
            {template.folders.map((folder, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/50"
              >
                <FolderIcon iconName={folder.icon} color={folder.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{folder.name}</p>
                  {folder.description && (
                    <p className="text-xs text-muted-foreground truncate">{folder.description}</p>
                  )}
                </div>
                {folder.isPersonal && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    Por colaborador
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </PreviewSection>

        {/* Custom Fields */}
        <PreviewSection title="Campos Personalizados" isEmpty={template.customFields.length === 0}>
          <div className="flex flex-wrap gap-2">
            {template.customFields.map((field, index) => (
              <Badge 
                key={index} 
                variant={field.required ? 'default' : 'outline'}
                className="text-xs"
              >
                {field.label}
                {field.required && <span className="ml-1 text-destructive">*</span>}
              </Badge>
            ))}
          </div>
        </PreviewSection>
      </div>
    </ScrollArea>
  );
}
