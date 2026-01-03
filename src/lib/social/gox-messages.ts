/**
 * GOX Enterprise - Mensagens padronizadas para o módulo Social OAuth
 * 
 * Padrão de nomenclatura:
 * - Mensagens contextuais para Super Admin vs Cliente
 * - Códigos de erro consistentes com Edge Functions
 * - CTAs acionáveis
 */

export type GoxErrorCode = 
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_PARTIAL'
  | 'INTEGRATION_IN_PROGRESS'
  | 'PLAN_REQUIRED'
  | 'LIMIT_REACHED'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_EXPIRING_SOON'
  | 'ASSET_REQUIRED'
  | 'NO_ASSETS_FOUND'
  | 'API_ERROR'
  | 'RATE_LIMITED'
  | 'PERMISSION_DENIED'
  | 'UNAUTHORIZED'
  | 'CONNECTION_FAILED'
  | 'SECRETS_MISSING';

export interface GoxMessage {
  title: string;
  message: string;
  cta?: string;
  ctaUrl?: string;
  severity: 'info' | 'warning' | 'error';
}

export interface GoxContext {
  isSuperAdmin: boolean;
  platform?: string;
  missingSecrets?: string[];
  limit?: number;
  expiresIn?: string;
}

// Mensagens base para cada código de erro
const BASE_MESSAGES: Record<GoxErrorCode, {
  superAdmin: GoxMessage;
  client: GoxMessage;
}> = {
  PROVIDER_NOT_CONFIGURED: {
    superAdmin: {
      title: 'Provider não configurado',
      message: 'As credenciais OAuth para esta plataforma ainda não foram configuradas.',
      cta: 'Configurar agora',
      ctaUrl: '/platform?tab=social',
      severity: 'error',
    },
    client: {
      title: 'Integração indisponível',
      message: 'Esta integração ainda está sendo configurada pelo administrador do sistema. Tente novamente em breve.',
      severity: 'warning',
    },
  },
  PROVIDER_PARTIAL: {
    superAdmin: {
      title: 'Configuração incompleta',
      message: 'Algumas credenciais ainda precisam ser adicionadas para esta plataforma.',
      cta: 'Completar configuração',
      ctaUrl: '/platform?tab=social',
      severity: 'warning',
    },
    client: {
      title: 'Integração em configuração',
      message: 'O administrador está finalizando a configuração desta integração.',
      severity: 'info',
    },
  },
  INTEGRATION_IN_PROGRESS: {
    superAdmin: {
      title: 'Aguardando configuração',
      message: 'Complete a configuração das credenciais OAuth para habilitar esta plataforma.',
      cta: 'Ir para configuração',
      ctaUrl: '/platform?tab=social',
      severity: 'warning',
    },
    client: {
      title: 'Em breve disponível',
      message: 'Esta integração está em processo de configuração. O administrador será notificado.',
      severity: 'info',
    },
  },
  PLAN_REQUIRED: {
    superAdmin: {
      title: 'Upgrade necessário',
      message: 'O workspace precisa de um plano superior para acessar esta funcionalidade.',
      cta: 'Gerenciar planos',
      ctaUrl: '/platform?tab=plans',
      severity: 'warning',
    },
    client: {
      title: 'Recurso Premium',
      message: 'Conectar redes sociais requer um plano PRO ou superior. Entre em contato com o administrador.',
      cta: 'Ver planos',
      ctaUrl: '/settings?tab=plano',
      severity: 'warning',
    },
  },
  LIMIT_REACHED: {
    superAdmin: {
      title: 'Limite atingido',
      message: 'O workspace atingiu o limite de plataformas do plano atual.',
      cta: 'Ajustar entitlements',
      ctaUrl: '/platform?tab=entitlements',
      severity: 'warning',
    },
    client: {
      title: 'Limite de conexões',
      message: 'Você atingiu o limite de plataformas conectadas do seu plano.',
      cta: 'Fazer upgrade',
      ctaUrl: '/settings?tab=plano',
      severity: 'warning',
    },
  },
  TOKEN_EXPIRED: {
    superAdmin: {
      title: 'Token expirado',
      message: 'O token de acesso expirou. O cliente precisa reconectar a conta.',
      severity: 'error',
    },
    client: {
      title: 'Conexão expirada',
      message: 'O token de acesso expirou. Reconecte sua conta para continuar publicando.',
      cta: 'Reconectar',
      severity: 'error',
    },
  },
  TOKEN_EXPIRING_SOON: {
    superAdmin: {
      title: 'Token expirando',
      message: 'O token de acesso expira em breve. Recomende ao cliente renovar a conexão.',
      severity: 'warning',
    },
    client: {
      title: 'Renovar conexão',
      message: 'Sua conexão expira em breve. Renove agora para evitar interrupções.',
      cta: 'Renovar agora',
      severity: 'warning',
    },
  },
  ASSET_REQUIRED: {
    superAdmin: {
      title: 'Ativo não selecionado',
      message: 'O cliente ainda não selecionou uma página, canal ou conta.',
      severity: 'info',
    },
    client: {
      title: 'Selecione um ativo',
      message: 'Escolha uma Página, Canal ou Conta para completar a conexão.',
      severity: 'warning',
    },
  },
  NO_ASSETS_FOUND: {
    superAdmin: {
      title: 'Sem ativos',
      message: 'Nenhum ativo encontrado na conta do cliente.',
      severity: 'warning',
    },
    client: {
      title: 'Nenhum ativo encontrado',
      message: 'Não encontramos páginas, canais ou contas vinculadas. Verifique suas configurações na plataforma.',
      severity: 'warning',
    },
  },
  API_ERROR: {
    superAdmin: {
      title: 'Erro de API',
      message: 'A API da plataforma retornou um erro. Verifique os logs para mais detalhes.',
      severity: 'error',
    },
    client: {
      title: 'Erro temporário',
      message: 'A plataforma retornou um erro. Tente novamente em alguns minutos.',
      severity: 'error',
    },
  },
  RATE_LIMITED: {
    superAdmin: {
      title: 'Rate limit',
      message: 'Limite de requisições atingido. Aguarde antes de tentar novamente.',
      severity: 'warning',
    },
    client: {
      title: 'Muitas tentativas',
      message: 'Aguarde alguns minutos antes de tentar novamente.',
      severity: 'warning',
    },
  },
  PERMISSION_DENIED: {
    superAdmin: {
      title: 'Permissão negada',
      message: 'O usuário não tem permissão para executar esta ação.',
      severity: 'error',
    },
    client: {
      title: 'Sem permissão',
      message: 'Você não tem permissão para executar esta ação. Contate o administrador do workspace.',
      severity: 'error',
    },
  },
  UNAUTHORIZED: {
    superAdmin: {
      title: 'Não autorizado',
      message: 'Credenciais inválidas ou sessão expirada.',
      severity: 'error',
    },
    client: {
      title: 'Sessão expirada',
      message: 'Sua sessão expirou. Faça login novamente.',
      severity: 'error',
    },
  },
  CONNECTION_FAILED: {
    superAdmin: {
      title: 'Falha na conexão',
      message: 'Não foi possível estabelecer conexão com a plataforma.',
      severity: 'error',
    },
    client: {
      title: 'Falha na conexão',
      message: 'Não foi possível conectar à plataforma. Verifique suas credenciais e tente novamente.',
      severity: 'error',
    },
  },
  SECRETS_MISSING: {
    superAdmin: {
      title: 'Secrets não configurados',
      message: 'As credenciais OAuth precisam ser adicionadas nos secrets do projeto.',
      cta: 'Configurar secrets',
      ctaUrl: '/platform?tab=social',
      severity: 'error',
    },
    client: {
      title: 'Configuração pendente',
      message: 'O administrador do sistema precisa concluir a configuração desta integração.',
      severity: 'info',
    },
  },
};

/**
 * Obtém a mensagem GOX apropriada baseada no contexto
 */
export function getGoxMessage(
  errorCode: GoxErrorCode,
  context: GoxContext
): GoxMessage {
  const messages = BASE_MESSAGES[errorCode];
  if (!messages) {
    return {
      title: 'Erro desconhecido',
      message: 'Ocorreu um erro inesperado. Tente novamente.',
      severity: 'error',
    };
  }

  const baseMessage = context.isSuperAdmin ? messages.superAdmin : messages.client;
  let message = { ...baseMessage };

  // Personalizar mensagem com contexto
  if (context.platform) {
    message.message = message.message.replace('esta plataforma', context.platform);
  }

  if (context.missingSecrets?.length) {
    message.message += ` Secrets faltando: ${context.missingSecrets.join(', ')}`;
  }

  if (context.limit !== undefined) {
    message.message = message.message.replace('limite', `limite de ${context.limit}`);
  }

  if (context.expiresIn) {
    message.message = message.message.replace('em breve', `em ${context.expiresIn}`);
  }

  return message;
}

/**
 * Mapeamento de códigos de erro da API para códigos GOX
 */
export function mapApiErrorToGox(apiError: string): GoxErrorCode {
  const errorMap: Record<string, GoxErrorCode> = {
    'SECRETS_NOT_CONFIGURED': 'PROVIDER_NOT_CONFIGURED',
    'PROVIDER_NOT_READY': 'PROVIDER_NOT_CONFIGURED',
    'REQUIRES_SETUP': 'SECRETS_MISSING',
    'ENTITLEMENT_DISABLED': 'PLAN_REQUIRED',
    'PLAN_LIMIT_REACHED': 'LIMIT_REACHED',
    'TOKEN_EXPIRED': 'TOKEN_EXPIRED',
    'TOKEN_EXPIRING': 'TOKEN_EXPIRING_SOON',
    'NO_ASSET_SELECTED': 'ASSET_REQUIRED',
    'ASSETS_EMPTY': 'NO_ASSETS_FOUND',
    'API_ERROR': 'API_ERROR',
    'RATE_LIMITED': 'RATE_LIMITED',
    'FORBIDDEN': 'PERMISSION_DENIED',
    'UNAUTHORIZED': 'UNAUTHORIZED',
    'CONNECTION_FAILED': 'CONNECTION_FAILED',
  };

  return errorMap[apiError] || 'API_ERROR';
}

/**
 * Nomes amigáveis para as plataformas
 */
export const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  meta: 'Meta (Facebook/Instagram)',
  facebook: 'Facebook',
  instagram: 'Instagram',
  google: 'Google (YouTube)',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  twitter: 'X (Twitter)',
  x: 'X (Twitter)',
};

/**
 * Obtém o nome de exibição da plataforma
 */
export function getPlatformDisplayName(platform: string): string {
  return PLATFORM_DISPLAY_NAMES[platform.toLowerCase()] || platform;
}
