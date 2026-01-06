/**
 * Modal to display connected assets for a social platform
 */

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Instagram, Facebook, Linkedin, Youtube, Music2, Twitter, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AssetWithConnection } from '@/hooks/usePlatformAssets';

interface ConnectedAssetsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  platformName: string;
  platformId: string;
  assets: AssetWithConnection[];
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  youtube: Youtube,
  tiktok: Music2,
  twitter: Twitter,
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
  facebook: 'bg-blue-600',
  linkedin: 'bg-blue-700',
  youtube: 'bg-red-600',
  tiktok: 'bg-black',
  twitter: 'bg-black',
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  instagram_business: 'Conta Business',
  facebook_page: 'Página',
  linkedin_company: 'Empresa',
  youtube_channel: 'Canal',
  tiktok_account: 'Conta',
  twitter_account: 'Conta',
};

export function ConnectedAssetsModal({
  open,
  onOpenChange,
  platformName,
  platformId,
  assets,
}: ConnectedAssetsModalProps) {
  const Icon = PLATFORM_ICONS[platformId] || Users;
  const bgColor = PLATFORM_COLORS[platformId] || 'bg-muted';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg text-white", bgColor)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Contas conectadas - {platformName}</DialogTitle>
              <DialogDescription>
                {assets.length} {assets.length === 1 ? 'conta conectada' : 'contas conectadas'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-3">
            {assets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma conta encontrada
              </p>
            ) : (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage 
                      src={asset.asset_meta?.profile_picture_url} 
                      alt={asset.asset_name} 
                    />
                    <AvatarFallback className={cn("text-white text-xs", bgColor)}>
                      {asset.asset_name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {asset.asset_name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-xs px-1.5 py-0">
                        {ASSET_TYPE_LABELS[asset.asset_type] || asset.asset_type}
                      </Badge>
                      {asset.asset_meta?.followers_count !== undefined && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {asset.asset_meta.followers_count.toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}