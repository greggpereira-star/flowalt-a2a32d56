import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Link2,
  Clock,
  Users,
  Eye,
} from 'lucide-react';
import { WorkflowStage, WorkflowTransition } from '@/hooks/useWorkflow';

interface WorkflowPreviewProps {
  stages: WorkflowStage[];
  transitions: WorkflowTransition[];
}

export function WorkflowPreview({ stages, transitions }: WorkflowPreviewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="h-4 w-4" />
          Preview do Kanban
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {stages.map((stage, index) => (
            <React.Fragment key={stage.id}>
              <div
                className="flex-shrink-0 w-48 rounded-lg border p-3"
                style={{ borderTopColor: stage.color, borderTopWidth: 3 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{stage.name}</span>
                  {stage.is_initial && (
                    <Badge className="bg-blue-500/10 text-blue-500 text-xs">Inicial</Badge>
                  )}
                  {stage.is_final && (
                    <Badge className="bg-green-500/10 text-green-500 text-xs">Final</Badge>
                  )}
                </div>
                
                {/* Gates indicators */}
                <div className="flex items-center gap-1 mb-2">
                  {stage.requires_briefing && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="p-1 rounded bg-muted">
                          <FileText className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Briefing obrigatório</TooltipContent>
                    </Tooltip>
                  )}
                  {stage.requires_checklist && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="p-1 rounded bg-muted">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Checklist {stage.min_checklist_progress}% obrigatório</TooltipContent>
                    </Tooltip>
                  )}
                  {stage.requires_no_dependencies && (
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="p-1 rounded bg-muted">
                          <Link2 className="h-3 w-3 text-muted-foreground" />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>Sem dependências</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Limits indicators */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {stage.wip_limit && (
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      <span>{stage.wip_limit}</span>
                    </div>
                  )}
                  {stage.sla_warning_hours && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{stage.sla_warning_hours}h</span>
                    </div>
                  )}
                </div>

                {/* Sample cards placeholder */}
                <div className="mt-3 space-y-2">
                  <div className="h-12 bg-muted/50 rounded border border-dashed flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">Cards aqui</span>
                  </div>
                </div>
              </div>

              {/* Arrow between stages */}
              {index < stages.length - 1 && (
                <div className="flex-shrink-0 flex items-center">
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            <span>Briefing</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Checklist</span>
          </div>
          <div className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            <span>Dependências</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>WIP Limit</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>SLA</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
