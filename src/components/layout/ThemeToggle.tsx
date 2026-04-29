import React from 'react';
import { Moon, Sun, Monitor, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTheme, type Theme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface ThemeToggleProps {
  className?: string;
}

const OPTIONS: {
  value: Theme;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { value: 'light', label: 'Claro', description: 'Tema claro', icon: Sun },
  { value: 'dark', label: 'Escuro', description: 'Tema escuro', icon: Moon },
  { value: 'system', label: 'Sistema', description: 'Acompanhar SO', icon: Monitor },
];

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Alternar tema"
              onClick={(e) => {
                // Click rápido alterna; long-press / right-click abre menu
                if (e.detail === 0) return; // veio do teclado, deixa abrir
              }}
              onAuxClick={toggleTheme}
              className={cn(
                'relative h-9 w-9 rounded-lg',
                'text-muted-foreground hover:text-foreground',
                'hover:bg-accent transition-colors',
                className,
              )}
            >
              <Sun
                className={cn(
                  'h-[18px] w-[18px] transition-all duration-300',
                  isDark
                    ? 'rotate-90 scale-0 opacity-0'
                    : 'rotate-0 scale-100 opacity-100',
                )}
              />
              <Moon
                className={cn(
                  'absolute h-[18px] w-[18px] transition-all duration-300',
                  isDark
                    ? 'rotate-0 scale-100 opacity-100'
                    : '-rotate-90 scale-0 opacity-0',
                )}
              />
              <span className="sr-only">Alternar tema (atual: {resolvedTheme})</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Tema · {theme === 'system' ? `Sistema (${resolvedTheme})` : theme === 'dark' ? 'Escuro' : 'Claro'}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Aparência
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(({ value, label, description, icon: Icon }) => {
          const active = theme === value;
          return (
            <DropdownMenuItem
              key={value}
              onClick={() => setTheme(value)}
              className="cursor-pointer gap-2"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col flex-1">
                <span className="text-sm">{label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {description}
                </span>
              </div>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
