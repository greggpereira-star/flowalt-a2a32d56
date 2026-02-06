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
    description: 'Ideal para produção de vídeos. Estrutura livre para você personalizar.',
    icon: Video,
    defaultIcon: 'video',
    defaultColor: '#8b5cf6',
    folders: [], // Blank - user creates their own structure
    views: [],
    customFields: [],
    features: [
      'Estrutura totalmente flexível',
      'Crie pastas e views conforme sua necessidade',
      'Ideal para produtoras, agências e criadores de conteúdo',
    ],
  },

  designer: {
    id: 'designer',
    name: 'Design',
    description: 'Ideal para equipes de design. Estrutura livre para você personalizar.',
    icon: Palette,
    defaultIcon: 'palette',
    defaultColor: '#ec4899',
    folders: [], // Blank - user creates their own structure
    views: [],
    customFields: [],
    features: [
      'Estrutura totalmente flexível',
      'Crie pastas e views conforme sua necessidade',
      'Ideal para designers, agências criativas e estúdios',
    ],
  },

  administrative: {
    id: 'administrative',
    name: 'Administrativo',
    description: 'Ideal para gestão administrativa, RH e processos. Estrutura livre.',
    icon: Briefcase,
    defaultIcon: 'briefcase',
    defaultColor: '#10b981',
    folders: [], // Blank - user creates their own structure
    views: [],
    customFields: [],
    features: [
      'Estrutura totalmente flexível',
      'Crie pastas e views conforme sua necessidade',
      'Ideal para RH, financeiro, jurídico e operações',
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
