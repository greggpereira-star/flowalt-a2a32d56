/**
 * Space Templates Configuration
 * 
 * Templates são opcionais e apenas sugerem estrutura inicial.
 * Nenhum template é obrigatório para criar um espaço.
 */

import { 
  Folder, 
  Smartphone, 
  Calendar, 
  CheckSquare, 
  Lightbulb, 
  Layout,
  ThumbsUp,
  Users,
  Briefcase,
  Video,
  Palette
} from 'lucide-react';

export type SpaceTemplateType = 'blank' | 'social_media' | 'audiovisual' | 'designer' | 'administrative';

export interface TemplateFolder {
  name: string;
  icon: string;
  color: string;
  isPersonal: boolean; // If true, will be created per collaborator
  description?: string;
}

export interface TemplateView {
  name: string;
  type: 'kanban' | 'calendar' | 'checklist' | 'list';
  icon: string;
  description: string;
  config?: Record<string, unknown>;
}

export interface TemplateCustomField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'multiselect';
  options?: string[];
  required?: boolean;
}

export interface SpaceTemplate {
  id: SpaceTemplateType;
  name: string;
  description: string;
  icon: typeof Folder;
  defaultIcon: string;
  defaultColor: string;
  badge?: string;
  folders: TemplateFolder[];
  views: TemplateView[];
  customFields: TemplateCustomField[];
  features: string[];
}

export const SPACE_TEMPLATES: Record<SpaceTemplateType, SpaceTemplate> = {
  blank: {
    id: 'blank',
    name: 'Espaço em Branco',
    description: 'Estrutura livre. Ideal para projetos gerais ou áreas customizadas.',
    icon: Folder,
    defaultIcon: 'folder',
    defaultColor: '#6366f1',
    folders: [],
    views: [
      {
        name: 'Kanban',
        type: 'kanban',
        icon: 'layout',
        description: 'Visualização em colunas por status',
      },
    ],
    customFields: [],
    features: [
      'Estrutura totalmente flexível',
      'Crie pastas e views conforme sua necessidade',
      'Sem campos obrigatórios',
    ],
  },

  social_media: {
    id: 'social_media',
    name: 'Social Media',
    description: 'Gestão de conteúdo com calendário editorial, aprovações e organização por colaborador.',
    icon: Smartphone,
    defaultIcon: 'smartphone',
    defaultColor: '#0ea5e9',
    badge: 'Recomendado',
    folders: [
      {
        name: 'Banco de Ideias',
        icon: 'lightbulb',
        color: '#f59e0b',
        isPersonal: false,
        description: 'Ideias e referências para conteúdo futuro',
      },
      {
        name: 'Aprovações Pendentes',
        icon: 'thumbs-up',
        color: '#ef4444',
        isPersonal: false,
        description: 'Conteúdos aguardando aprovação do cliente',
      },
    ],
    views: [
      {
        name: 'Kanban Conteúdo',
        type: 'kanban',
        icon: 'layout',
        description: 'Fluxo de produção de conteúdo',
      },
      {
        name: 'Calendário Editorial',
        type: 'calendar',
        icon: 'calendar',
        description: 'Visualização por data de postagem',
      },
      {
        name: 'Aprovações',
        type: 'list',
        icon: 'thumbs-up',
        description: 'Lista de conteúdos pendentes de aprovação',
      },
      {
        name: 'Checklist Semanal',
        type: 'checklist',
        icon: 'check-square',
        description: 'Tarefas recorrentes da semana',
      },
      {
        name: 'Banco de Ideias',
        type: 'kanban',
        icon: 'lightbulb',
        description: 'Organização de ideias por categoria',
      },
    ],
    customFields: [
      {
        key: 'platform',
        label: 'Plataforma',
        type: 'multiselect',
        options: ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Twitter/X', 'YouTube', 'Pinterest'],
        required: true,
      },
      {
        key: 'content_type',
        label: 'Tipo de Peça',
        type: 'select',
        options: ['Feed', 'Stories', 'Reels', 'Carrossel', 'Vídeo', 'Live', 'Thread'],
        required: true,
      },
      {
        key: 'post_date',
        label: 'Data de Postagem',
        type: 'date',
        required: false,
      },
      {
        key: 'editorial_status',
        label: 'Status Editorial',
        type: 'select',
        options: ['Rascunho', 'Em Produção', 'Aguardando Aprovação', 'Aprovado', 'Agendado', 'Publicado'],
        required: true,
      },
    ],
    features: [
      'Organização por colaborador (pastas pessoais)',
      'Calendário editorial integrado',
      'Fluxo de aprovação com cliente',
      'Checklist semanal recorrente',
      'Banco de ideias compartilhado',
      'Campos: plataforma, tipo de peça, data de postagem',
    ],
  },

  audiovisual: {
    id: 'audiovisual',
    name: 'Audiovisual',
    description: 'Produção de vídeos com pipeline de pré-produção, gravação, edição e entrega.',
    icon: Video,
    defaultIcon: 'video',
    defaultColor: '#8b5cf6',
    folders: [
      {
        name: 'Roteiros',
        icon: 'file-text',
        color: '#6366f1',
        isPersonal: false,
        description: 'Scripts e roteiros aprovados',
      },
      {
        name: 'Assets',
        icon: 'image',
        color: '#10b981',
        isPersonal: false,
        description: 'Imagens, músicas e recursos',
      },
    ],
    views: [
      {
        name: 'Pipeline de Produção',
        type: 'kanban',
        icon: 'layout',
        description: 'Fluxo completo de produção',
      },
      {
        name: 'Cronograma',
        type: 'calendar',
        icon: 'calendar',
        description: 'Datas de gravação e entrega',
      },
    ],
    customFields: [
      {
        key: 'video_type',
        label: 'Tipo de Vídeo',
        type: 'select',
        options: ['Institucional', 'Comercial', 'Social', 'Documentário', 'Animação', 'Motion'],
        required: true,
      },
      {
        key: 'duration',
        label: 'Duração Estimada',
        type: 'select',
        options: ['Até 30s', '30s - 1min', '1 - 3min', '3 - 10min', '10min+'],
        required: false,
      },
      {
        key: 'delivery_date',
        label: 'Data de Entrega',
        type: 'date',
        required: true,
      },
    ],
    features: [
      'Pipeline: Briefing → Roteiro → Gravação → Edição → Revisão → Entrega',
      'Gestão de assets e roteiros',
      'Cronograma de gravações',
      'Campos: tipo de vídeo, duração, data de entrega',
    ],
  },

  designer: {
    id: 'designer',
    name: 'Design',
    description: 'Gestão de projetos de design com versões, aprovações e biblioteca de assets.',
    icon: Palette,
    defaultIcon: 'palette',
    defaultColor: '#ec4899',
    folders: [
      {
        name: 'Biblioteca de Assets',
        icon: 'folder-open',
        color: '#ec4899',
        isPersonal: false,
        description: 'Logos, ícones, templates reutilizáveis',
      },
      {
        name: 'Referências',
        icon: 'bookmark',
        color: '#f59e0b',
        isPersonal: false,
        description: 'Inspirações e moodboards',
      },
    ],
    views: [
      {
        name: 'Kanban de Projetos',
        type: 'kanban',
        icon: 'layout',
        description: 'Fluxo de design',
      },
      {
        name: 'Timeline',
        type: 'calendar',
        icon: 'calendar',
        description: 'Prazos de entrega',
      },
    ],
    customFields: [
      {
        key: 'design_type',
        label: 'Tipo de Peça',
        type: 'select',
        options: ['Logo', 'Identidade Visual', 'Material Impresso', 'Digital', 'Embalagem', 'UI/UX'],
        required: true,
      },
      {
        key: 'version',
        label: 'Versão',
        type: 'text',
        required: false,
      },
    ],
    features: [
      'Controle de versões',
      'Biblioteca de assets reutilizáveis',
      'Fluxo de aprovação',
      'Campos: tipo de peça, versão',
    ],
  },

  administrative: {
    id: 'administrative',
    name: 'Administrativo',
    description: 'Gestão de tarefas administrativas, RH, financeiro e processos internos.',
    icon: Briefcase,
    defaultIcon: 'briefcase',
    defaultColor: '#10b981',
    folders: [
      {
        name: 'Documentos',
        icon: 'file-text',
        color: '#6366f1',
        isPersonal: false,
        description: 'Documentos e contratos',
      },
      {
        name: 'Processos',
        icon: 'git-branch',
        color: '#10b981',
        isPersonal: false,
        description: 'Processos e procedimentos',
      },
    ],
    views: [
      {
        name: 'Tarefas',
        type: 'kanban',
        icon: 'layout',
        description: 'Kanban de tarefas',
      },
      {
        name: 'Agenda',
        type: 'calendar',
        icon: 'calendar',
        description: 'Compromissos e prazos',
      },
    ],
    customFields: [
      {
        key: 'category',
        label: 'Categoria',
        type: 'select',
        options: ['RH', 'Financeiro', 'Jurídico', 'TI', 'Operacional', 'Outros'],
        required: true,
      },
      {
        key: 'priority',
        label: 'Prioridade',
        type: 'select',
        options: ['Baixa', 'Média', 'Alta', 'Urgente'],
        required: true,
      },
    ],
    features: [
      'Organização por categoria',
      'Gestão de documentos',
      'Processos e procedimentos',
      'Campos: categoria, prioridade',
    ],
  },
};

// Helper to get template by type
export function getSpaceTemplate(type: SpaceTemplateType): SpaceTemplate {
  return SPACE_TEMPLATES[type] || SPACE_TEMPLATES.blank;
}

// Get all templates as array
export function getAllTemplates(): SpaceTemplate[] {
  return Object.values(SPACE_TEMPLATES);
}

// Check if template has pre-defined structure
export function templateHasStructure(type: SpaceTemplateType): boolean {
  const template = getSpaceTemplate(type);
  return template.folders.length > 0 || template.views.length > 1 || template.customFields.length > 0;
}
