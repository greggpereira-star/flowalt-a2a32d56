import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  Loader2,
  Shield,
  RefreshCw,
  Info,
  ChevronDown,
  Settings,
  AlertTriangle,
  Crown,
  Key,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getGoxMessage, mapApiErrorToGox, type GoxErrorCode } from '@/lib/social/gox-messages';
import { MetaScopeDiagnostic } from './MetaScopeDiagnostic';
import { MetaSetupGuide } from './MetaSetupGuide';
import { MetaDiagnosticPanel } from './MetaDiagnosticPanel';
import { MetaAppAuditPanel } from './MetaAppAuditPanel';

type PlatformId = 'instagram' | 'facebook' | 'linkedin' | 'tiktok' | 'youtube' | 'twitter';

interface WizardStep {
  id: string;
  title: string;
  description: string;
}

interface PlatformConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformId: PlatformId;
  platformName: string;
  isSuperAdmin?: boolean;
  initialOauthError?: { code: string; description?: string } | null;
  onSuccess?: () => void;
  mode?: 'connect' | 'asset_select' | 'reconnect' | 'add_accounts';
}

// Platform-specific configurations
const PLATFORM_CONFIGS: Record<PlatformId, {
  steps: WizardStep[];
  permissions: string[];
  authUrl?: string;
  instructions: string[];
  oauthSupported: boolean;
}> = {
  instagram: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com Meta' },
      { id: 'select', title: 'Seleção', description: 'Escolha a conta' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar posts, stories e reels',
      'Acessar métricas e insights',
      'Gerenciar mensagens diretas',
      'Ver informações do perfil',
    ],
    instructions: [
      'Você será redirecionado para o Facebook/Meta',
      'Faça login com a conta conectada ao Instagram Business',
      'Selecione a página do Facebook vinculada',
      'Escolha a conta do Instagram a conectar',
      'Autorize as permissões necessárias',
    ],
    oauthSupported: true,
  },
  facebook: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com Facebook' },
      { id: 'select', title: 'Seleção de Página', description: 'Escolha a página' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar em páginas',
      'Acessar insights da página',
      'Gerenciar mensagens',
      'Ver lista de páginas',
    ],
    instructions: [
      'Você será redirecionado para o Facebook',
      'Faça login com sua conta de administrador',
      'Selecione as páginas que deseja conectar',
      'Autorize as permissões de publicação',
    ],
    oauthSupported: true,
  },
  linkedin: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com LinkedIn' },
      { id: 'select', title: 'Seleção', description: 'Escolha empresa/perfil' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar posts e artigos',
      'Acessar analytics',
      'Publicar em nome da empresa',
      'Ver conexões e seguidores',
    ],
    instructions: [
      'Você será redirecionado para o LinkedIn',
      'Faça login com sua conta',
      'Selecione o perfil pessoal ou página da empresa',
      'Autorize as permissões da API Marketing',
    ],
    oauthSupported: true,
  },
  tiktok: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com TikTok' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar vídeos',
      'Acessar métricas',
      'Ver informações do perfil',
    ],
    instructions: [
      'Você será redirecionado para o TikTok for Business',
      'Faça login com sua conta comercial',
      'Autorize as permissões de publicação',
    ],
    oauthSupported: true,
  },
  youtube: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com Google' },
      { id: 'select', title: 'Seleção de Canal', description: 'Escolha o canal' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Fazer upload de vídeos',
      'Publicar Shorts',
      'Acessar YouTube Analytics',
      'Gerenciar playlists',
    ],
    instructions: [
      'Você será redirecionado para o Google',
      'Faça login com a conta do Google vinculada ao canal',
      'Selecione o canal do YouTube',
      'Autorize as permissões de upload e analytics',
    ],
    oauthSupported: true,
  },
  twitter: {
    steps: [
      { id: 'overview', title: 'Visão Geral', description: 'O que será conectado' },
      { id: 'auth', title: 'Autenticação', description: 'Login com X' },
      { id: 'confirm', title: 'Confirmação', description: 'Verifique e confirme' },
    ],
    permissions: [
      'Publicar tweets',
      'Criar threads',
      'Acessar métricas',
      'Ver perfil e seguidores',
    ],
    instructions: [
      'Você será redirecionado para o X (Twitter)',
      'Faça login com sua conta',
      'Autorize o acesso do FlowAlt',
    ],
    oauthSupported: true,
  },
};

export function PlatformConnectionWizard({
  open,
  onOpenChange,
  platformId,
  platformName,
  isSuperAdmin,
  initialOauthError,
  onSuccess,
  mode = 'connect',
}: PlatformConnectionWizardProps) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isFetchingAssets, setIsFetchingAssets] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [accountName, setAccountName] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<{ id: string; name: string; type: string } | null>(null);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [setupInstructions, setSetupInstructions] = useState<string[]>([]);
  const [requiresSetup, setRequiresSetup] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [platformConnectionId, setPlatformConnectionId] = useState<string | null>(null);
  const [availableAssets, setAvailableAssets] = useState<Array<{
    asset_type: string;
    asset_id: string;
    asset_name: string;
    asset_meta: Record<string, unknown>;
  }>>([]);
  const [requiresUpgrade, setRequiresUpgrade] = useState(false);
  const [planLimit, setPlanLimit] = useState<number | null>(null);
  const [showScopeRetry, setShowScopeRetry] = useState(false);
  const [requiresReauth, setRequiresReauth] = useState(false);
  const [reauthStrategy, setReauthStrategy] = useState<'pages_list' | 'pages_publish' | 'full' | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showAppAudit, setShowAppAudit] = useState(false);
  const [userConsentMissing, setUserConsentMissing] = useState(false);
  const [missingScopes, setMissingScopes] = useState<string[]>([]);
  const [grantedScopes, setGrantedScopes] = useState<string[]>([]);
  const [requestedScopes, setRequestedScopes] = useState<string[]>([]);
  
  const config = PLATFORM_CONFIGS[platformId];
  const steps = config.steps;
  const totalSteps = steps.length;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const isMetaPlatform = platformId === 'facebook' || platformId === 'instagram';

  // When wizard opens, check if we should fetch the platform connection (after OAuth redirect)
  // The parent component (PlatformConnector) handles detecting the OAuth callback and opening this wizard.
  useEffect(() => {
    if (open && currentWorkspace?.id) {
      // For add_accounts mode, go directly to the select step and fetch assets
      if (mode === 'add_accounts') {
        fetchPlatformConnectionForAddAccounts();
      } else {
        // Check if there's a pending connection for this platform
        fetchPlatformConnection();
      }
    }
  }, [open, currentWorkspace?.id, platformId, mode]);

  // If we were redirected back with an OAuth error, show a GOX message (Enterprise)
  useEffect(() => {
    if (!open) return;
    if (!initialOauthError?.code) return;

    const goxCode = mapApiErrorToGox(initialOauthError.code);
    const goxMessage = getGoxMessage(goxCode, {
      isSuperAdmin: !!isSuperAdmin,
      platform: platformName,
    });

    setConnectionStatus('error');
    setErrorMessage(goxMessage.message);

    // Check if this is a USER_CONSENT_MISSING error - show detailed scope info
    if (initialOauthError.code === 'USER_CONSENT_MISSING') {
      setUserConsentMissing(true);
      
      // Parse scope info from URL params
      const urlParams = new URLSearchParams(window.location.search);
      const missing = urlParams.get('missing_scopes')?.split(',').filter(Boolean) || [];
      const granted = urlParams.get('granted_scopes')?.split(',').filter(Boolean) || [];
      const requested = urlParams.get('requested_scopes')?.split(',').filter(Boolean) || [];
      
      setMissingScopes(missing);
      setGrantedScopes(granted);
      setRequestedScopes(requested);
    }

    // Check if this is an INVALID_SCOPE error - show retry option for Meta
    if (goxCode === 'INVALID_SCOPE' && isMetaPlatform) {
      setShowScopeRetry(true);
    }

    // Keep the user on the auth step so they can retry
    const authStepIndex = steps.findIndex((s) => s.id === 'auth');
    if (authStepIndex >= 0) setCurrentStep(authStepIndex);
  }, [open, initialOauthError?.code, isSuperAdmin, platformName, isMetaPlatform]);

  // Fetch the platform connection after OAuth
  const fetchPlatformConnection = async () => {
    if (!currentWorkspace?.id) return;
    
    try {
      const { data: connections, error } = await supabase
        .from('social_platforms')
        .select('id, account_name, connection_status, platform_account_type')
        .eq('workspace_id', currentWorkspace.id)
        .eq('platform', platformId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (connections && connections.length > 0) {
        const conn = connections[0];
        setPlatformConnectionId(conn.id);
        setAccountName(conn.account_name || '');
        
        // If assets not selected yet, move to select step and fetch assets
        if (conn.connection_status === 'pending_assets' || !conn.platform_account_type) {
          // Find the select step index
          const selectStepIndex = steps.findIndex(s => s.id === 'select');
          if (selectStepIndex >= 0) {
            setCurrentStep(selectStepIndex);
            await fetchAssets(conn.id);
          } else {
            // No select step, go to confirm
            setCurrentStep(totalSteps - 1);
            setConnectionStatus('success');
          }
        } else {
          // Assets already selected
          setConnectionStatus('success');
          setCurrentStep(totalSteps - 1);
        }
      }
    } catch (error) {
      console.error('Error fetching platform connection:', error);
    }
  };

  // Fetch platform connection for "add accounts" mode - starts OAuth to allow selecting a new business portfolio
  const fetchPlatformConnectionForAddAccounts = async () => {
    if (!currentWorkspace?.id) return;
    
    try {
      const { data: connections, error } = await supabase
        .from('social_platforms')
        .select('id, account_name, connection_status, platform_account_type')
        .eq('workspace_id', currentWorkspace.id)
        .eq('platform', platformId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      if (connections && connections.length > 0) {
        const conn = connections[0];
        setPlatformConnectionId(conn.id);
        setAccountName(conn.account_name || '');
        
        // Fetch currently active assets to pre-select them later
        const { data: activeAssets } = await supabase
          .from('social_platform_assets')
          .select('asset_id')
          .eq('platform_connection_id', conn.id)
          .eq('is_active', true);
        
        if (activeAssets) {
          setSelectedAssetIds(new Set(activeAssets.map(a => a.asset_id)));
        }
        
        // Go to auth step so user can login and select a different business portfolio
        const authStepIndex = steps.findIndex(s => s.id === 'auth');
        if (authStepIndex >= 0) {
          setCurrentStep(authStepIndex);
        }
      } else {
        // No connection found - go to beginning
        setCurrentStep(0);
      }
    } catch (error) {
      console.error('Error fetching platform connection for add accounts:', error);
      setErrorMessage('Erro ao carregar conexão.');
    }
  };

  // Fetch assets specifically for add accounts mode - shows already active assets as pre-selected
  const fetchAssetsForAddAccounts = async (connectionId: string) => {
    if (!currentWorkspace?.id) return;
    
    setIsFetchingAssets(true);
    setErrorMessage(null);
    
    try {
      // First, get already active assets
      const { data: activeAssets, error: activeError } = await supabase
        .from('social_platform_assets')
        .select('asset_id')
        .eq('platform_connection_id', connectionId)
        .eq('is_active', true);

      if (activeError) throw activeError;

      // Fetch all available assets from the platform
      const { data, error } = await supabase.functions.invoke('social-connection-assets', {
        body: {
          workspace_id: currentWorkspace.id,
          platform_connection_id: connectionId,
        },
      });

      if (error) throw error;

      if (data.success && data.assets) {
        // In add_accounts mode, show ALL assets so user can select from everything
        // This allows users to add new accounts from the full list
        setAvailableAssets(data.assets);
        
        // Pre-select already active assets
        const activeAssetIds = new Set(activeAssets?.map(a => a.asset_id) || []);
        setSelectedAssetIds(activeAssetIds);
        
        if (data.assets.length === 0) {
          setErrorMessage('Nenhuma conta disponível. Verifique se você tem páginas/contas vinculadas.');
        }
      } else {
        setErrorMessage(data.error_message || 'Erro ao buscar ativos');
      }
    } catch (error: any) {
      console.error('Error fetching assets for add accounts:', error);
      setErrorMessage(error.message || 'Erro ao buscar ativos da plataforma');
    } finally {
      setIsFetchingAssets(false);
    }
  };

  // Fetch available assets from the platform
  const fetchAssets = async (connectionId: string) => {
    if (!currentWorkspace?.id) return;
    
    setIsFetchingAssets(true);
    setErrorMessage(null);
    setRequiresReauth(false);
    setReauthStrategy(null);
    try {
      const { data, error } = await supabase.functions.invoke('social-connection-assets', {
        body: {
          workspace_id: currentWorkspace.id,
          platform_connection_id: connectionId,
        },
      });

      if (error) throw error;

      // Handle REQUIRES_REAUTH - user needs to add more permissions
      if (data.error_code === 'REQUIRES_REAUTH' || data.reason_code === 'REQUIRES_REAUTH') {
        console.log('Requires re-auth with strategy:', data.reauth_strategy);
        setRequiresReauth(true);
        setReauthStrategy(data.reauth_strategy || 'pages_list');
        setErrorMessage(data.reason_message || 'Precisamos de permissões adicionais para listar suas páginas.');
        return;
      }

      if (data.success && data.assets) {
        // Filter assets based on platform - Instagram shows only IG accounts, Facebook shows pages
        let filteredAssets = data.assets;
        if (platformId === 'instagram' && data.instagram) {
          filteredAssets = data.instagram;
        } else if (platformId === 'facebook' && data.pages) {
          filteredAssets = data.pages;
        }
        
        setAvailableAssets(filteredAssets);
        if (filteredAssets.length === 0) {
          if (platformId === 'facebook' || platformId === 'instagram') {
            const platformLabel = platformId === 'instagram' ? 'Instagram Business' : 'páginas do Facebook';
            setErrorMessage(
              `Nenhuma conta ${platformLabel} retornada pela Meta para este login. Isso geralmente acontece quando:\n` +
              '• você não entrou com o perfil que é admin da Página\n' +
              '• o app ainda não tem acesso aprovado/configurado para permissões de Páginas/Instagram (ex.: pages_read_engagement, pages_manage_posts, instagram_basic)\n\n' +
              'Clique em "Atualizar Lista". Se continuar vazio, reconecte. Se aparecer "Invalid Scopes", é configuração do app (admin/suporte).'
            );
          } else {
            setErrorMessage('Nenhum ativo encontrado. Verifique se você tem páginas/canais/contas configurados.');
          }
        }
      } else {
        setErrorMessage(data.error_message || 'Erro ao buscar ativos');
      }
    } catch (error: any) {
      console.error('Error fetching assets:', error);
      setErrorMessage(error.message || 'Erro ao buscar ativos da plataforma');
    } finally {
      setIsFetchingAssets(false);
    }
  };

  // Toggle asset selection (multi-select)
  const handleToggleAsset = (asset: typeof availableAssets[0]) => {
    setSelectedAssetIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(asset.asset_id)) {
        newSet.delete(asset.asset_id);
      } else {
        newSet.add(asset.asset_id);
      }
      return newSet;
    });
  };

  // Select all assets
  const handleSelectAll = () => {
    if (selectedAssetIds.size === availableAssets.length) {
      setSelectedAssetIds(new Set());
    } else {
      setSelectedAssetIds(new Set(availableAssets.map(a => a.asset_id)));
    }
  };

  // Activate selected assets when moving to next step
  const [isActivating, setIsActivating] = useState(false);
  
  const handleActivateAssets = async () => {
    if (!currentWorkspace?.id || !platformConnectionId || selectedAssetIds.size === 0) return;
    
    setIsActivating(true);
    try {
      const { data, error } = await supabase.functions.invoke('social-assets-activate', {
        body: {
          workspace_id: currentWorkspace.id,
          platform_connection_id: platformConnectionId,
          asset_ids: Array.from(selectedAssetIds),
        },
      });

      if (error) throw error;

      if (data.ok) {
        setAccountName(data.display_name);
        setSelectedAccount({
          id: data.assets[0]?.asset_id || '',
          name: data.display_name,
          type: data.assets[0]?.asset_type || '',
        });
        setConnectionStatus('success');
        toast.success(`${data.activated_count} conta(s) ativada(s)!`);
        return true;
      } else {
        setErrorMessage(data.error_message || 'Erro ao ativar ativos');
        return false;
      }
    } catch (error: any) {
      console.error('Error activating assets:', error);
      setErrorMessage(error.message || 'Erro ao ativar ativos');
      return false;
    } finally {
      setIsActivating(false);
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  /**
   * Start OAuth flow with optional scope strategy
   * 
   * Scope strategies for Meta (AUTOMATIC FALLBACK):
   * - 'connect' (NEW DEFAULT): Only public_profile - always works, no App Review needed
   * - 'pages_list': For listing pages
   * - 'pages_publish': For managing/publishing to pages
   * - 'full': All production scopes (requires App Review)
   * - 'minimal': Same as connect (backwards compat)
   * - 'pages_only': Same as pages_publish (backwards compat)
   */
  const handleStartOAuth = async (scopeStrategy: 'connect' | 'pages_list' | 'pages_publish' | 'full' | 'minimal' | 'pages_only' = 'connect') => {
    if (!currentWorkspace?.id || !user?.id) {
      toast.error('Erro: workspace ou usuário não encontrado');
      return;
    }

    setIsConnecting(true);
    setConnectionStatus('connecting');
    setErrorMessage(null);
    setRequiresSetup(false);

    const isMetaPlatform = platformId === 'facebook' || platformId === 'instagram';

    try {
      // For Meta platforms, optionally run preflight check
      if (isMetaPlatform && scopeStrategy === 'full') {
        try {
          const { data: preflight } = await supabase.functions.invoke('social-meta-preflight', {
            body: {
              workspace_id: currentWorkspace.id,
              platform: platformId,
            },
          });

          if (preflight?.detected_issue) {
            const goxCode = mapApiErrorToGox(preflight.detected_issue.code);
            const goxMessage = getGoxMessage(goxCode, { isSuperAdmin: !!isSuperAdmin, platform: platformName });
            
            if (preflight.detected_issue.code === 'PROVIDER_NOT_CONFIGURED') {
              setRequiresSetup(true);
            }
            setConnectionStatus('error');
            setErrorMessage(goxMessage.message);
            setIsConnecting(false);
            return;
          }
        } catch (preflightError) {
          console.warn('Preflight check failed, proceeding with OAuth:', preflightError);
          // Continue with OAuth even if preflight fails
        }
      }

      // Call the OAuth start edge function
      const { data, error } = await supabase.functions.invoke('social-oauth-start', {
        body: {
          platform: platformId,
          workspace_id: currentWorkspace.id,
          return_url: `${window.location.origin}${window.location.pathname}`,
          scope_strategy: isMetaPlatform ? scopeStrategy : undefined,
          // When adding accounts/pages, force Meta to show login again so the user can switch profile/portfolio
          meta_auth_type: isMetaPlatform && mode === 'add_accounts' ? 'reauthenticate' : 'rerequest',
        },
      });

      // Handle edge function errors
      if (error) {
        console.error('Edge function error:', error);
        const errorMsg = error.message || 'Erro ao conectar com o servidor';
        setConnectionStatus('error');
        setErrorMessage(errorMsg);
        setIsConnecting(false);
        return;
      }

      // Handle application-level errors in response
      if (data?.error || data?.error_code) {
        console.log('OAuth response error:', data);
        
        // Map API error to GOX message
        const goxCode = mapApiErrorToGox(data.error_code || data.error);
        const goxMessage = getGoxMessage(goxCode, { isSuperAdmin: !!isSuperAdmin, platform: platformName });
        
        if (data.requires_setup) {
          setRequiresSetup(true);
          setSetupInstructions(data.setup_instructions || []);
          setErrorMessage(goxMessage.message);
        } else if (data.requires_upgrade || data.error_code === 'PLAN_REQUIRED') {
          setRequiresUpgrade(true);
          setErrorMessage(goxMessage.message);
        } else if (data.error_code === 'LIMIT_REACHED') {
          setRequiresUpgrade(true);
          setPlanLimit(data.limit);
          setErrorMessage(goxMessage.message);
        } else {
          setErrorMessage(data.message || goxMessage.message);
        }
        setConnectionStatus('error');
        setIsConnecting(false);
        return;
      }

      if (data?.auth_url) {
        // Store scope strategy in sessionStorage for retry handling
        if (isMetaPlatform) {
          sessionStorage.setItem('meta_oauth_scope_strategy', scopeStrategy);
        }
        
        // Redirect to OAuth provider - Facebook blocks iframes, so we must handle this carefully
        try {
          // Check if we're in an iframe (preview environment)
          const isInIframe = window.self !== window.top;
          
          if (isInIframe) {
            // In iframe: try to navigate top-level window first, fallback to new tab
            try {
              window.top!.location.href = data.auth_url;
            } catch {
              // Cross-origin iframe - open in new tab
              window.open(data.auth_url, '_blank', 'noopener,noreferrer');
            }
          } else {
            // Not in iframe: navigate directly
            window.location.href = data.auth_url;
          }
        } catch {
          // Last resort: open in new tab
          window.open(data.auth_url, '_blank', 'noopener,noreferrer');
        }
      } else {
        throw new Error('Nenhuma URL de autenticação recebida. Verifique as credenciais da plataforma.');
      }
    } catch (error: any) {
      console.error('OAuth start error:', error);
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Erro ao iniciar autenticação');
      setIsConnecting(false);
    }
  };

  const handleValidateConnection = async () => {
    if (!platformConnectionId) {
      setConnectionStatus('error');
      setErrorMessage('Conexão não encontrada. Volte e selecione a conta novamente.');
      return;
    }

    setIsValidating(true);
    setConnectionStatus('connecting');
    setErrorMessage(null);

    try {
      // IMPORTANT: social-connection-test expects the platform connection id (social_platforms.id)
      const { data, error } = await supabase.functions.invoke('social-connection-test', {
        body: { platform_id: platformConnectionId },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (data.success) {
        setConnectionStatus('success');
        // Prefer backend returned name, fallback to selectedAccount (asset name)
        setAccountName(data.account_name || selectedAccount?.name || '');
      } else {
        setConnectionStatus('error');
        setErrorMessage(data.gox_message || data.error_message || 'Falha na validação');

        if (data.requires_reconnect) {
          toast.error('Token expirado', {
            description: 'Você precisa reconectar a plataforma.',
          });
        }
      }
    } catch (error: any) {
      setConnectionStatus('error');
      setErrorMessage(error.message || 'Falha na validação');
    } finally {
      setIsValidating(false);
    }
  };

  const handleFinishConnection = async () => {
    // Connection was already saved by OAuth callback
    // Just close the wizard and refresh
    queryClient.invalidateQueries({ queryKey: ['social-platforms'] });
    queryClient.invalidateQueries({ queryKey: ['social-platforms-active'] });
    
    toast.success(`${platformName} conectado com sucesso!`);
    onSuccess?.();
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep(0);
    setConnectionStatus('idle');
    setAccountName('');
    setSelectedAccount(null);
    setErrorMessage(null);
    setRequiresSetup(false);
    setSetupInstructions([]);
    setRequiresUpgrade(false);
    setPlanLimit(null);
    onOpenChange(false);
  };

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.id) {
      case 'overview':
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Conectar {platformName}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                O FlowAlt precisará das seguintes permissões para gerenciar suas publicações:
              </p>
            </div>

            <div className="space-y-2">
              {config.permissions.map((permission, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{permission}</span>
                </div>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Suas credenciais são criptografadas e nunca compartilhadas. 
                Você pode revogar o acesso a qualquer momento.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'auth':
        return (
          <div className="space-y-6">
            {requiresUpgrade ? (
              // Plan upgrade required
              <div className="space-y-4">
                <div className="text-center py-4">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                    <Crown className="h-8 w-8 text-amber-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    Recurso Premium
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    {planLimit 
                      ? `Você atingiu o limite de ${planLimit} plataformas do seu plano.`
                      : 'Conectar redes sociais requer um plano PRO ou superior.'}
                  </p>
                </div>

                <Alert className="bg-amber-50 border-amber-200">
                  <Crown className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Faça upgrade para continuar</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    Com o plano PRO você pode conectar múltiplas redes sociais e agendar publicações.
                  </AlertDescription>
                </Alert>

                <Button asChild className="w-full" size="lg">
                  <Link to="/settings?tab=plano">
                    <Crown className="h-4 w-4 mr-2" />
                    Ver Planos
                  </Link>
                </Button>
              </div>
            ) : requiresSetup ? (
              // Platform not configured - show setup instructions
              <div className="space-y-4">
                {isSuperAdmin && isMetaPlatform ? (
                  // Super Admin sees setup guide for Meta
                  <MetaSetupGuide
                    appId="2562991294073382"
                    callbackUrl="https://vnohlxerngxizmzyptyw.supabase.co/functions/v1/social-oauth-callback"
                    onClose={() => {
                      setRequiresSetup(false);
                      setErrorMessage(null);
                      setConnectionStatus('idle');
                    }}
                  />
                ) : (
                  <>
                    <Alert className="bg-blue-50 border-blue-200">
                      <Info className="h-4 w-4 text-blue-600" />
                      <AlertTitle className="text-blue-800">Integração em configuração</AlertTitle>
                      <AlertDescription className="text-blue-700">
                        O administrador do sistema está configurando esta integração. Tente novamente em breve.
                      </AlertDescription>
                    </Alert>

                    <Collapsible open={instructionsOpen} onOpenChange={setInstructionsOpen}>
                      <CollapsibleTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          <span className="flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            Detalhes técnicos
                          </span>
                          <ChevronDown className={cn("h-4 w-4 transition-transform", instructionsOpen && "rotate-180")} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="space-y-2 p-4 rounded-lg bg-muted/50 border">
                          {setupInstructions.map((instruction, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm">
                              <span className="text-muted-foreground">{instruction}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <p className="text-xs text-muted-foreground text-center">
                      Se você é administrador, acesse Platform Admin para configurar.
                    </p>
                  </>
                )}
              </div>
            ) : userConsentMissing && isMetaPlatform ? (
              // USER_CONSENT_MISSING - user didn't grant all permissions
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Permissões não concedidas</AlertTitle>
                  <AlertDescription>
                    Você não autorizou todas as permissões necessárias durante o login com Meta.
                    É preciso reconectar e clicar em "Permitir" para cada permissão.
                  </AlertDescription>
                </Alert>

                {/* Scope comparison panel */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h4 className="font-medium text-sm">Diagnóstico via debug_token:</h4>
                  
                  {requestedScopes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Escopos solicitados:</p>
                      <div className="flex flex-wrap gap-1">
                        {requestedScopes.map((scope) => (
                          <Badge key={scope} variant="outline" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {grantedScopes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-green-600">✓ Escopos concedidos:</p>
                      <div className="flex flex-wrap gap-1">
                        {grantedScopes.map((scope) => (
                          <Badge key={scope} variant="secondary" className="text-xs bg-green-100 text-green-700">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {missingScopes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-destructive">✗ Escopos NÃO concedidos:</p>
                      <div className="flex flex-wrap gap-1">
                        {missingScopes.map((scope) => (
                          <Badge key={scope} variant="destructive" className="text-xs">
                            {scope}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <strong>Para corrigir:</strong> Ao reconectar, quando o Facebook mostrar o diálogo de permissões,
                    certifique-se de clicar em "Permitir" (ou "Allow") para cada permissão listada.
                    Não clique em "Recusar" ou "Editar permissões" desmarcando itens.
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setUserConsentMissing(false);
                      setMissingScopes([]);
                      setGrantedScopes([]);
                      setRequestedScopes([]);
                      setErrorMessage(null);
                      setConnectionStatus('idle');
                      // Reconectar com auth_type=rerequest (já configurado no backend)
                      handleStartOAuth('full');
                    }}
                    disabled={isConnecting}
                    className="flex-1"
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Reconectar e autorizar tudo
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setUserConsentMissing(false);
                      setErrorMessage(null);
                      setConnectionStatus('idle');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : showScopeRetry && isMetaPlatform ? (
              // INVALID_SCOPE error - show comprehensive diagnostic
              <MetaScopeDiagnostic
                isSuperAdmin={!!isSuperAdmin}
                platform={platformId as 'facebook' | 'instagram'}
                errorDescription={initialOauthError?.description}
                onRetry={(strategy) => {
                  setShowScopeRetry(false);
                  setErrorMessage(null);
                  setConnectionStatus('idle');
                  handleStartOAuth(strategy);
                }}
                onClose={() => {
                  setShowScopeRetry(false);
                  setErrorMessage(null);
                  setConnectionStatus('idle');
                }}
                isConnecting={isConnecting}
              />
            ) : showDiagnostics && isMetaPlatform && currentWorkspace?.id ? (
              // Diagnostics panel
              <MetaDiagnosticPanel
                workspaceId={currentWorkspace.id}
                platformConnectionId={platformConnectionId || undefined}
                platform={platformId as 'facebook' | 'instagram'}
                isSuperAdmin={isSuperAdmin}
                onReauth={(strategy) => {
                  setShowDiagnostics(false);
                  handleStartOAuth(strategy);
                }}
                onClose={() => setShowDiagnostics(false)}
              />
            ) : showAppAudit && isMetaPlatform && currentWorkspace?.id && isSuperAdmin ? (
              // App Audit panel - Admin only
              <MetaAppAuditPanel
                workspaceId={currentWorkspace.id}
                platformConnectionId={platformConnectionId || undefined}
                redirectUri={`${window.location.origin}/marketing`}
                onClose={() => setShowAppAudit(false)}
              />
            ) : (
              // Normal OAuth flow with MIN/FULL mode selection for Meta
              <>
                <div className="text-center py-4">
                  <h3 className="text-lg font-semibold mb-2">
                    Autenticação
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
                    Siga os passos abaixo para conectar sua conta:
                  </p>

                  {mode === 'add_accounts' && isMetaPlatform && (
                    <Alert className="text-left mb-4">
                      <Info className="h-4 w-4" />
                      <AlertTitle>Adicionar páginas de outro portfólio</AlertTitle>
                      <AlertDescription className="text-xs">
                        Para conectar páginas de outro portfólio empresarial, na tela do Facebook/Meta clique em "Não é você?" para trocar de conta ou em "Editar configurações" para selecionar outros ativos.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-3">
                  {config.instructions.map((instruction, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </div>
                      <span className="text-sm pt-0.5">{instruction}</span>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Connection mode selection for Meta platforms */}
                {isMetaPlatform ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground text-center">
                      Escolha o modo de conexão:
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        onClick={() => handleStartOAuth('full')}
                        disabled={isConnecting}
                        variant="default"
                        className="flex-col h-auto py-4"
                      >
                        <Shield className="h-5 w-5 mb-1" />
                        <span className="text-xs font-medium">Modo Completo</span>
                        <span className="text-[10px] text-primary-foreground/70">Publicar + Agendar</span>
                      </Button>
                      <Button
                        onClick={() => handleStartOAuth('connect')}
                        disabled={isConnecting}
                        variant="outline"
                        className="flex-col h-auto py-4"
                      >
                        <Key className="h-5 w-5 mb-1" />
                        <span className="text-xs font-medium">Modo Mínimo</span>
                        <span className="text-[10px] text-muted-foreground">Conectar primeiro</span>
                      </Button>
                    </div>
                    {isConnecting && (
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        <span className="text-sm text-muted-foreground">Redirecionando...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    onClick={() => handleStartOAuth('full')}
                    disabled={isConnecting}
                    className="w-full"
                    size="lg"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Redirecionando...
                      </>
                    ) : (
                      <>
                        Iniciar Conexão OAuth
                        <ExternalLink className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}

                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="whitespace-pre-wrap">{errorMessage}</AlertDescription>
                  </Alert>
                )}

                {connectionStatus === 'error' && !showScopeRetry && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setConnectionStatus('idle');
                        setErrorMessage(null);
                      }}
                      className="flex-1"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Tentar novamente
                    </Button>
                    {isMetaPlatform && (
                      <>
                        <Button
                          variant="ghost"
                          onClick={() => setShowDiagnostics(true)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Diagnóstico
                        </Button>
                        {isSuperAdmin && (
                          <Button
                            variant="ghost"
                            onClick={() => setShowAppAudit(true)}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Auditoria App
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'select':
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              <h3 className="text-lg font-semibold mb-2">
                {mode === 'add_accounts' ? 'Gerenciar Contas' : 'Selecione as Contas'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {mode === 'add_accounts' 
                  ? 'Marque as contas que deseja manter ativas. Novas contas serão adicionadas e contas desmarcadas serão desativadas:'
                  : 'Escolha quais páginas, contas ou canais deseja usar para agendamento de posts:'}
              </p>
            </div>

            {isFetchingAssets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Buscando ativos...</span>
              </div>
            ) : availableAssets.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {/* Select all toggle */}
                <button
                  onClick={handleSelectAll}
                  className="w-full flex items-center gap-4 p-3 rounded-lg border border-dashed hover:border-primary/50 transition-all text-left"
                >
                  <div className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    selectedAssetIds.size === availableAssets.length
                      ? "bg-primary border-primary"
                      : "border-muted-foreground/50"
                  )}>
                    {selectedAssetIds.size === availableAssets.length && (
                      <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-sm font-medium">
                    {selectedAssetIds.size === availableAssets.length ? 'Desmarcar todas' : 'Selecionar todas'}
                  </span>
                  <Badge variant="secondary" className="ml-auto">
                    {selectedAssetIds.size}/{availableAssets.length}
                  </Badge>
                </button>

                {availableAssets.map((asset) => (
                  <button
                    key={`${asset.asset_type}_${asset.asset_id}`}
                    onClick={() => handleToggleAsset(asset)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left",
                      selectedAssetIds.has(asset.asset_id)
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className={cn(
                      "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                      selectedAssetIds.has(asset.asset_id)
                        ? "bg-primary border-primary"
                        : "border-muted-foreground/50"
                    )}>
                      {selectedAssetIds.has(asset.asset_id) && (
                        <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                      )}
                    </div>
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {asset.asset_name[0]?.toUpperCase() || 'A'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{asset.asset_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {asset.asset_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : requiresReauth && isMetaPlatform ? (
              // Need to re-authenticate with additional scopes
              <div className="space-y-4">
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Permissões adicionais necessárias</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    {errorMessage || 'Para listar suas páginas, precisamos de permissões adicionais.'}
                  </AlertDescription>
                </Alert>
                
                <Button
                  onClick={() => handleStartOAuth(reauthStrategy || 'pages_list')}
                  disabled={isConnecting}
                  className="w-full"
                  size="lg"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecionando...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4 mr-2" />
                      Adicionar Permissões
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="whitespace-pre-wrap">
                  {errorMessage || 'Nenhum ativo disponível. Verifique suas permissões.'}
                </AlertDescription>
              </Alert>
            )}

            {platformConnectionId && !isFetchingAssets && !requiresReauth && (
              <Button
                variant="outline"
                onClick={() => mode === 'add_accounts' 
                  ? fetchAssetsForAddAccounts(platformConnectionId) 
                  : fetchAssets(platformConnectionId)}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar Lista
              </Button>
            )}
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-6">
            <div className="text-center py-4">
              {connectionStatus === 'success' ? (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-green-700">
                    Conexão Validada!
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Finalizar" para concluir a configuração.
                  </p>
                </>
              ) : connectionStatus === 'error' ? (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2 text-red-700">
                    Erro na Validação
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {errorMessage || 'Não foi possível validar a conexão.'}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold mb-2">
                    Confirmar Conexão
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                    Revise as informações antes de finalizar:
                  </p>
                </>
              )}
            </div>

            <div className="space-y-3 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Plataforma</span>
                <span className="font-medium">{platformName}</span>
              </div>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">Contas selecionadas</span>
                <div className="mt-2 space-y-2">
                  {availableAssets
                    .filter(a => selectedAssetIds.has(a.asset_id))
                    .map(asset => (
                      <div key={asset.asset_id} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{asset.asset_name}</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          ({asset.asset_type.replace(/_/g, ' ')})
                        </span>
                      </div>
                    ))}
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge
                  variant="outline"
                  className={cn(
                    connectionStatus === 'success' && "bg-green-50 text-green-700 border-green-200",
                    connectionStatus === 'error' && "bg-red-50 text-red-700 border-red-200",
                    connectionStatus === 'idle' && "bg-amber-50 text-amber-700 border-amber-200"
                  )}
                >
                  {connectionStatus === 'success' ? 'Validado' :
                   connectionStatus === 'error' ? 'Erro' : 'Aguardando validação'}
                </Badge>
              </div>
            </div>

            {connectionStatus !== 'success' && (
              <Button
                onClick={handleValidateConnection}
                disabled={isValidating}
                variant="outline"
                className="w-full"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </>
                )}
              </Button>
            )}

            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // Determine dialog title based on mode
  const getDialogTitle = () => {
    if (mode === 'add_accounts') {
      return `Adicionar contas - ${platformName}`;
    }
    if (mode === 'reconnect') {
      return `Reconectar ${platformName}`;
    }
    return `Conectar ${platformName}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getDialogTitle()}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add_accounts' 
              ? 'Selecione as contas que deseja adicionar ou remover'
              : steps[currentStep]?.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress - hide in add_accounts mode */}
        {mode !== 'add_accounts' && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Passo {currentStep + 1} de {totalSteps}</span>
                <span>{steps[currentStep]?.title}</span>
              </div>
              <Progress value={progress} className="h-1" />
              
              {/* Step indicators */}
              <div className="flex items-center justify-between pt-2">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={cn(
                      "flex items-center gap-1",
                      idx <= currentStep ? "text-primary" : "text-muted-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium",
                        idx < currentStep
                          ? "bg-primary text-primary-foreground"
                          : idx === currentStep
                          ? "border-2 border-primary text-primary"
                          : "border border-muted-foreground/30"
                      )}
                    >
                      {idx < currentStep ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />
          </>
        )}

        {/* Step Content */}
        <div className="py-4">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={mode === 'add_accounts' ? handleClose : (currentStep === 0 ? handleClose : handlePrevious)}
            disabled={isConnecting}
          >
            {mode === 'add_accounts' || currentStep === 0 ? (
              'Cancelar'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Voltar
              </>
            )}
          </Button>

          {/* For add_accounts mode on select step, show "Save" button that activates and closes */}
          {mode === 'add_accounts' && steps[currentStep]?.id === 'select' ? (
            <Button
              onClick={async () => {
                if (selectedAssetIds.size > 0) {
                  const success = await handleActivateAssets();
                  if (success) {
                    handleFinishConnection();
                  }
                }
              }}
              disabled={selectedAssetIds.size === 0 || isActivating}
            >
              {isActivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          ) : currentStep < totalSteps - 1 ? (
            <Button
              onClick={async () => {
                // If on select step, activate assets before moving forward
                if (steps[currentStep].id === 'select' && selectedAssetIds.size > 0) {
                  const success = await handleActivateAssets();
                  if (success) {
                    handleNext();
                  }
                } else {
                  handleNext();
                }
              }}
              disabled={
                (steps[currentStep].id === 'auth' && requiresSetup) ||
                (steps[currentStep].id === 'select' && selectedAssetIds.size === 0)
              }
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinishConnection}
              disabled={isConnecting || connectionStatus !== 'success'}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finalizando...
                </>
              ) : (
                'Finalizar'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
