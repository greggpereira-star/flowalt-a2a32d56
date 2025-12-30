import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Keyboard,
  Navigation,
  FileText,
  Zap,
  Search,
  Settings,
} from 'lucide-react';

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  shortcuts: {
    keys: string[];
    description: string;
  }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Geral',
    icon: <Keyboard className="h-4 w-4" />,
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Abrir Command Palette' },
      { keys: ['⌘', '?'], description: 'Mostrar atalhos de teclado' },
      { keys: ['Esc'], description: 'Fechar modal / Cancelar' },
      { keys: ['⌘', 'S'], description: 'Salvar alterações' },
    ],
  },
  {
    title: 'Navegação',
    icon: <Navigation className="h-4 w-4" />,
    shortcuts: [
      { keys: ['G', 'H'], description: 'Ir para Início' },
      { keys: ['G', 'D'], description: 'Ir para Dashboard' },
      { keys: ['G', 'C'], description: 'Ir para Calendário' },
      { keys: ['G', 'S'], description: 'Ir para Configurações' },
      { keys: ['G', 'A'], description: 'Ir para Analytics' },
    ],
  },
  {
    title: 'Cards & Tarefas',
    icon: <FileText className="h-4 w-4" />,
    shortcuts: [
      { keys: ['N'], description: 'Criar novo card' },
      { keys: ['E'], description: 'Editar card selecionado' },
      { keys: ['D'], description: 'Duplicar card' },
      { keys: ['Del'], description: 'Arquivar card' },
      { keys: ['↑', '↓'], description: 'Navegar entre cards' },
      { keys: ['Enter'], description: 'Abrir detalhes do card' },
    ],
  },
  {
    title: 'Ações Rápidas',
    icon: <Zap className="h-4 w-4" />,
    shortcuts: [
      { keys: ['T'], description: 'Iniciar/parar cronômetro' },
      { keys: ['C'], description: 'Adicionar comentário' },
      { keys: ['M'], description: 'Mover card entre colunas' },
      { keys: ['L'], description: 'Adicionar label' },
      { keys: ['U'], description: 'Alterar urgência' },
    ],
  },
  {
    title: 'Busca & Filtros',
    icon: <Search className="h-4 w-4" />,
    shortcuts: [
      { keys: ['/'], description: 'Focar na busca' },
      { keys: ['F'], description: 'Abrir filtros' },
      { keys: ['⌘', 'F'], description: 'Buscar na página' },
      { keys: ['⌘', '↵'], description: 'Aplicar filtros' },
    ],
  },
  {
    title: 'Visualização',
    icon: <Settings className="h-4 w-4" />,
    shortcuts: [
      { keys: ['V', 'K'], description: 'Visualização Kanban' },
      { keys: ['V', 'L'], description: 'Visualização Lista' },
      { keys: ['V', 'G'], description: 'Visualização Gantt' },
      { keys: ['⌘', '+'], description: 'Aumentar zoom' },
      { keys: ['⌘', '-'], description: 'Diminuir zoom' },
    ],
  },
];

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // ⌘+? or Ctrl+? to open shortcuts
      if ((e.key === '?' && (e.metaKey || e.ctrlKey)) || 
          (e.key === '/' && e.shiftKey && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Atalhos de Teclado
          </DialogTitle>
          <DialogDescription>
            Use esses atalhos para navegar e executar ações rapidamente no Flowalt.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {SHORTCUT_GROUPS.map((group, groupIndex) => (
              <div key={group.title}>
                {groupIndex > 0 && <Separator className="mb-6" />}
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                    {group.icon}
                  </div>
                  <h3 className="font-semibold">{group.title}</h3>
                </div>

                <div className="space-y-2">
                  {group.shortcuts.map((shortcut, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-sm text-muted-foreground">
                        {shortcut.description}
                      </span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, keyIndex) => (
                          <React.Fragment key={keyIndex}>
                            {keyIndex > 0 && (
                              <span className="text-xs text-muted-foreground mx-0.5">+</span>
                            )}
                            <Badge
                              variant="outline"
                              className="px-2 py-0.5 text-xs font-mono min-w-[24px] justify-center"
                            >
                              {key}
                            </Badge>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-between pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">⌘</Badge>
              = Command (Mac) / Ctrl (Windows)
            </span>
          </div>
          <span>
            Pressione <Badge variant="outline" className="text-xs">⌘</Badge>
            <Badge variant="outline" className="text-xs ml-1">?</Badge> para abrir
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
