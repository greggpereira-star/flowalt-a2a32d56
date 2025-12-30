import React from 'react';
import { useDashboardWidgets, WidgetConfig } from '@/hooks/useDashboardWidgets';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Settings2, GripVertical, RotateCcw } from 'lucide-react';

export const WidgetCustomizer: React.FC = () => {
  const { widgets, toggleWidget, resetToDefaults } = useDashboardWidgets();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          Personalizar
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Personalizar Dashboard</SheetTitle>
          <SheetDescription>
            Escolha quais widgets exibir na sua página inicial.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {widgets.map((widget) => (
            <WidgetToggleItem
              key={widget.id}
              widget={widget}
              onToggle={() => toggleWidget(widget.id)}
            />
          ))}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={resetToDefaults} className="w-full gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

interface WidgetToggleItemProps {
  widget: WidgetConfig;
  onToggle: () => void;
}

const WidgetToggleItem: React.FC<WidgetToggleItemProps> = ({ widget, onToggle }) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
        <div>
          <Label htmlFor={widget.id} className="font-medium cursor-pointer">
            {widget.label}
          </Label>
          <p className="text-xs text-muted-foreground">{widget.description}</p>
        </div>
      </div>
      <Switch
        id={widget.id}
        checked={widget.enabled}
        onCheckedChange={onToggle}
      />
    </div>
  );
};
