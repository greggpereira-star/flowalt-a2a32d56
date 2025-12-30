import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Target, DollarSign, Users, Calendar } from 'lucide-react';

export interface TrafficBriefingData {
  objective: string;
  platform: string;
  campaign_type: string;
  budget: string;
  audience_description: string;
  audience_age_min: string;
  audience_age_max: string;
  audience_gender: string;
  audience_interests: string;
  audience_locations: string;
  start_date: string;
  end_date: string;
  kpis: string;
  landing_page: string;
  pixel_events: string;
  additional_notes: string;
}

interface TrafficBriefingFormProps {
  data: TrafficBriefingData;
  onChange: (data: TrafficBriefingData) => void;
  disabled?: boolean;
}

export const TrafficBriefingForm: React.FC<TrafficBriefingFormProps> = ({
  data,
  onChange,
  disabled,
}) => {
  const updateField = (field: keyof TrafficBriefingData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Objective Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Objetivo da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Select
                value={data.objective || ''}
                onValueChange={(v) => updateField('objective', v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="awareness">Reconhecimento</SelectItem>
                  <SelectItem value="traffic">Tráfego</SelectItem>
                  <SelectItem value="engagement">Engajamento</SelectItem>
                  <SelectItem value="leads">Geração de Leads</SelectItem>
                  <SelectItem value="conversions">Conversões</SelectItem>
                  <SelectItem value="sales">Vendas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plataforma</Label>
              <Select
                value={data.platform || ''}
                onValueChange={(v) => updateField('platform', v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta (Facebook/Instagram)</SelectItem>
                  <SelectItem value="google">Google Ads</SelectItem>
                  <SelectItem value="tiktok">TikTok Ads</SelectItem>
                  <SelectItem value="linkedin">LinkedIn Ads</SelectItem>
                  <SelectItem value="youtube">YouTube Ads</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de Campanha</Label>
            <Input
              placeholder="Ex: Remarketing, Prospecção, Lançamento..."
              value={data.campaign_type || ''}
              onChange={(e) => updateField('campaign_type', e.target.value)}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Budget Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Orçamento e Período
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Orçamento Total</Label>
              <Input
                placeholder="R$ 0,00"
                value={data.budget || ''}
                onChange={(e) => updateField('budget', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Início</Label>
              <Input
                type="date"
                value={data.start_date || ''}
                onChange={(e) => updateField('start_date', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Término</Label>
              <Input
                type="date"
                value={data.end_date || ''}
                onChange={(e) => updateField('end_date', e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audience Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Público-Alvo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição do Público</Label>
            <Textarea
              placeholder="Descreva o público ideal para esta campanha..."
              value={data.audience_description || ''}
              onChange={(e) => updateField('audience_description', e.target.value)}
              disabled={disabled}
              className="min-h-[60px]"
            />
          </div>

          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Idade Mínima</Label>
              <Input
                type="number"
                placeholder="18"
                value={data.audience_age_min || ''}
                onChange={(e) => updateField('audience_age_min', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Idade Máxima</Label>
              <Input
                type="number"
                placeholder="65"
                value={data.audience_age_max || ''}
                onChange={(e) => updateField('audience_age_max', e.target.value)}
                disabled={disabled}
              />
            </div>
            <div className="md:col-span-2 space-y-2">
              <Label>Gênero</Label>
              <Select
                value={data.audience_gender || ''}
                onValueChange={(v) => updateField('audience_gender', v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                  <SelectItem value="female">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Interesses</Label>
              <Textarea
                placeholder="Ex: Moda, Tecnologia, Esportes..."
                value={data.audience_interests || ''}
                onChange={(e) => updateField('audience_interests', e.target.value)}
                disabled={disabled}
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Localizações</Label>
              <Textarea
                placeholder="Ex: São Paulo, Rio de Janeiro, Brasil..."
                value={data.audience_locations || ''}
                onChange={(e) => updateField('audience_locations', e.target.value)}
                disabled={disabled}
                className="min-h-[60px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Technical Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações Técnicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>KPIs Esperados</Label>
              <Textarea
                placeholder="Ex: CPC < R$2, CTR > 1%, ROAS > 3..."
                value={data.kpis || ''}
                onChange={(e) => updateField('kpis', e.target.value)}
                disabled={disabled}
                className="min-h-[60px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Landing Page</Label>
              <Input
                placeholder="https://..."
                value={data.landing_page || ''}
                onChange={(e) => updateField('landing_page', e.target.value)}
                disabled={disabled}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Eventos de Pixel</Label>
            <Input
              placeholder="Ex: ViewContent, AddToCart, Purchase..."
              value={data.pixel_events || ''}
              onChange={(e) => updateField('pixel_events', e.target.value)}
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações Adicionais</Label>
            <Textarea
              placeholder="Informações extras para o gestor de tráfego..."
              value={data.additional_notes || ''}
              onChange={(e) => updateField('additional_notes', e.target.value)}
              disabled={disabled}
              className="min-h-[60px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
