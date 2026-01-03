import React from 'react';
import { Helmet } from 'react-helmet';
import { ArrowLeft, Trash2, Mail, Shield, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const DataDeletionPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Exclusão de Dados - Flowalt</title>
        <meta name="description" content="Solicite a exclusão dos seus dados pessoais do Flowalt" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Exclusão de Dados do Usuário</h1>
            <p className="text-muted-foreground">
              Conforme a Lei Geral de Proteção de Dados (LGPD) e outras regulamentações de privacidade, 
              você tem o direito de solicitar a exclusão dos seus dados pessoais.
            </p>
          </div>

          <div className="grid gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Como Solicitar Exclusão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Para solicitar a exclusão dos seus dados, envie um e-mail para:
                </p>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-foreground">privacidade@flowalt.com.br</p>
                </div>
                <p className="text-muted-foreground">
                  No e-mail, inclua:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Seu nome completo</li>
                  <li>E-mail cadastrado na plataforma</li>
                  <li>Motivo da solicitação (opcional)</li>
                  <li>Se deseja exclusão total ou parcial dos dados</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-destructive" />
                  Dados que Serão Excluídos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Ao solicitar a exclusão, os seguintes dados serão removidos:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Informações de perfil (nome, e-mail, foto)</li>
                  <li>Dados de autenticação e tokens de acesso</li>
                  <li>Conexões com redes sociais e integrações</li>
                  <li>Histórico de atividades e logs de acesso</li>
                  <li>Preferências e configurações pessoais</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Dados Retidos por Obrigação Legal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Alguns dados podem ser retidos conforme exigências legais:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Registros fiscais e financeiros (5 anos)</li>
                  <li>Logs de auditoria para fins de segurança</li>
                  <li>Dados necessários para cumprimento de obrigações contratuais</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Prazo de Processamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sua solicitação será processada em até <strong>15 dias úteis</strong> após o recebimento. 
                  Você receberá uma confirmação por e-mail quando a exclusão for concluída.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="p-6 bg-muted/30 rounded-lg border">
            <h2 className="text-lg font-semibold text-foreground mb-2">Integrações com Redes Sociais</h2>
            <p className="text-muted-foreground mb-4">
              Se você conectou sua conta a redes sociais (Facebook, Instagram, etc.), a exclusão dos dados 
              no Flowalt também removerá os tokens de acesso e informações de conexão. No entanto, 
              recomendamos que você também revogue o acesso diretamente nas configurações de cada rede social.
            </p>
            <p className="text-sm text-muted-foreground">
              Para mais informações, consulte nossa{' '}
              <a href="/privacy" className="text-primary hover:underline">
                Política de Privacidade
              </a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default DataDeletionPage;
