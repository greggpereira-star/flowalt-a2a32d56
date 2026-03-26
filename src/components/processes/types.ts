export interface ProcessStep {
  id: string;
  title: string;
  description: string;
  stepNumber: number;
}

export interface ProcessDecisionPath {
  label: string;
  targetNodeId: string;
}

export interface MacroProcess {
  id: string;
  name: string;
  icon: string;
  nodes: any[];
  edges: any[];
}
