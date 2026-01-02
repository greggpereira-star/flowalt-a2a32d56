import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LayoutGrid,
  Folder,
  FileText,
  Bell,
  Search,
  Eye,
  EyeOff,
  Lock,
  Settings,
  ExternalLink,
  Filter,
  Crown,
  Shield,
  User,
  Wallet,
  UserCog,
} from 'lucide-react';
import { useMemberAccessDiagnostic, type DiagnosticItem, type AccessStatus } from '@/hooks/useMemberAccessDiagnostic';
import { cn } from '@/lib/utils';
import type { AppRole } from '@/hooks/usePermissions';

interface MemberAccessDiagnosticSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    name: string;
    email: string;
    role: AppRole;
    avatarUrl?: string | null;
  } | null;
}

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Crown; color: string }> = {
  super_admin: { label: 'Super Admin', icon: Shield, color: 'text-red-500' },
  owner: { label: 'Proprietário', icon: Crown, color: 'text-amber-500' },
  admin: { label: 'Administrador', icon: Shield, color: 'text-blue-500' },
  coordinator: { label: 'Coordenador', icon: UserCog, color: 'text-purple-500' },
  finance: { label: 'Financeiro', icon: Wallet, color: 'text-emerald-500' },
  member: { label: 'Colaborador', icon: User, color: 'text-muted-foreground' },
  viewer: { label: 'Visualizador', icon: User, color: 'text-muted-foreground' },
};

export const MemberAccessDiagnosticSheet: React.FC<MemberAccessDiagnosticSheetProps> = ({
  open,
  onOpenChange,
  member,
}) => {
  const [activeTab, setActiveTab] = useState('spaces');
  const [filter, setFilter] = useState<'all' | 'blocked' | 'restricted'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { spaces, folders, cards, notifications, isLoading } = useMemberAccessDiagnostic({
    targetUserId: member?.id || '',
    targetUserRole: member?.role || 'member',
    enabled: open && !!member,
    filter,
    limit: 50,
  });

  if (!member) return null;

  const roleConfig = ROLE_CONFIG[member.role];
  const RoleIcon = roleConfig.icon;

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const filterItems = (items: DiagnosticItem[]) => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(query));
  };

  const blockedSpaces = spaces.filter(s => s.status === 'blocked').length;
  const blockedFolders = folders.filter(f => f.status === 'blocked').length;
  const blockedCards = cards.filter(c => c.status === 'blocked').length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 border-b">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.avatarUrl || undefined} />
              <AvatarFallback>{getInitials(member.name, member.email)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="flex items-center gap-2">
                {member.name}
              </SheetTitle>
              <SheetDescription>{member.email}</SheetDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <RoleIcon className={cn('h-3 w-3', roleConfig.color)} />
              {roleConfig.label}
            </Badge>
          </div>
        </SheetHeader>

        {/* Filters */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="w-36">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="blocked">Bloqueados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span className="text-muted-foreground">
                {blockedSpaces + blockedFolders + blockedCards} bloqueados
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-muted-foreground">
                {(spaces.length - blockedSpaces) + (folders.length - blockedFolders) + (cards.length - blockedCards)} permitidos
              </span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-4 grid grid-cols-4 h-10">
            <TabsTrigger value="spaces" className="gap-1.5 text-xs">
              <LayoutGrid className="h-3.5 w-3.5" />
              Espaços
              {blockedSpaces > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {blockedSpaces}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="folders" className="gap-1.5 text-xs">
              <Folder className="h-3.5 w-3.5" />
              Pastas
              {blockedFolders > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {blockedFolders}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="cards" className="gap-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" />
              Cards
              {blockedCards > 0 && (
                <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                  {blockedCards}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs">
              <Bell className="h-3.5 w-3.5" />
              Notif.
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 min-h-0 p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <TabsContent value="spaces" className="m-0 h-full">
                  <DiagnosticList items={filterItems(spaces)} emptyMessage="Nenhum espaço encontrado" />
                </TabsContent>

                <TabsContent value="folders" className="m-0 h-full">
                  <DiagnosticList items={filterItems(folders)} emptyMessage="Nenhuma pasta encontrada" />
                </TabsContent>

                <TabsContent value="cards" className="m-0 h-full">
                  <DiagnosticList items={filterItems(cards)} emptyMessage="Nenhum card encontrado" />
                </TabsContent>

                <TabsContent value="notifications" className="m-0 h-full">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded-full',
                        notifications.receiving ? 'bg-green-500/10' : 'bg-destructive/10'
                      )}>
                        <Bell className={cn(
                          'h-5 w-5',
                          notifications.receiving ? 'text-green-500' : 'text-destructive'
                        )} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {notifications.receiving ? 'Recebendo notificações' : 'Notificações bloqueadas'}
                        </p>
                        <p className="text-sm text-muted-foreground">{notifications.reason}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </>
            )}
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
};

interface DiagnosticListProps {
  items: DiagnosticItem[];
  emptyMessage: string;
}

const DiagnosticList: React.FC<DiagnosticListProps> = ({ items, emptyMessage }) => {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <Eye className="h-8 w-8 mb-2 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-380px)]">
      <div className="space-y-2">
        {items.map((item) => (
          <DiagnosticItemRow key={item.id} item={item} />
        ))}
      </div>
    </ScrollArea>
  );
};

interface DiagnosticItemRowProps {
  item: DiagnosticItem;
}

const DiagnosticItemRow: React.FC<DiagnosticItemRowProps> = ({ item }) => {
  const getIcon = () => {
    switch (item.type) {
      case 'space':
        return <LayoutGrid className="h-4 w-4" />;
      case 'folder':
        return <Folder className="h-4 w-4" />;
      case 'card':
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className={cn(
      'flex items-center gap-3 p-3 rounded-lg border transition-colors',
      item.status === 'blocked' ? 'bg-destructive/5 border-destructive/20' : 'bg-muted/30'
    )}>
      <div className={cn(
        'p-1.5 rounded-md',
        item.status === 'blocked' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
      )}>
        {getIcon()}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.name}</p>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xs text-muted-foreground truncate cursor-help">
                {item.reason}
              </p>
            </TooltipTrigger>
            <TooltipContent>
              <p>{item.reason}</p>
              {item.visibility && <p className="text-muted-foreground">Visibilidade: {item.visibility}</p>}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2">
        {item.status === 'blocked' ? (
          <Badge variant="destructive" className="gap-1 text-xs">
            <EyeOff className="h-3 w-3" />
            Bloqueado
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1 text-xs text-green-600 bg-green-500/10">
            <Eye className="h-3 w-3" />
            Acessa
          </Badge>
        )}
      </div>
    </div>
  );
};

export default MemberAccessDiagnosticSheet;
