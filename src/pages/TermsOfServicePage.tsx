import React from 'react';
import { Helmet } from 'react-helmet';
import { ArrowLeft, FileText, Users, Shield, AlertTriangle, Scale } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const TermsOfServicePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Termos de Serviço - Flowalt</title>
        <meta name="description" content="Termos de Serviço e condições de uso da plataforma Flowalt" />
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
            <h1 className="text-3xl font-bold text-foreground mb-2">Termos de Serviço</h1>
            <p className="text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
            <p className="text-muted-foreground leading-relaxed">
              Ao utilizar a plataforma Flowalt, você concorda com os termos e condições descritos abaixo. 
              Leia atentamente antes de utilizar nossos serviços.
            </p>
          </div>

          <div className="grid gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  1. Aceitação dos Termos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>
                  Ao acessar ou utilizar a plataforma Flowalt, você declara ter lido, compreendido e 
                  concordado em estar vinculado a estes Termos de Serviço, bem como à nossa Política de Privacidade.
                </p>
                <p>
                  Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  2. Descrição do Serviço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>
                  O Flowalt é uma plataforma de gestão de projetos, tarefas e colaboração empresarial que oferece:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Gerenciamento de workspaces e espaços de trabalho</li>
                  <li>Criação e acompanhamento de tarefas e projetos</li>
                  <li>Ferramentas de colaboração em equipe</li>
                  <li>Gestão financeira e controle de tempo</li>
                  <li>Integrações com serviços de terceiros</li>
                  <li>Relatórios e analytics</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  3. Responsabilidades do Usuário
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>Ao utilizar o Flowalt, você se compromete a:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Fornecer informações verdadeiras, precisas e atualizadas</li>
                  <li>Manter a confidencialidade de suas credenciais de acesso</li>
                  <li>Não utilizar a plataforma para fins ilegais ou não autorizados</li>
                  <li>Não tentar acessar áreas restritas ou dados de outros usuários</li>
                  <li>Respeitar os direitos de propriedade intelectual</li>
                  <li>Não transmitir vírus, malware ou código malicioso</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-primary" />
                  4. Propriedade Intelectual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>
                  Todo o conteúdo da plataforma Flowalt, incluindo mas não limitado a textos, gráficos, 
                  logos, ícones, imagens, clipes de áudio, downloads digitais e software, é de propriedade 
                  exclusiva do Flowalt ou de seus licenciadores.
                </p>
                <p>
                  O conteúdo criado por você dentro da plataforma permanece de sua propriedade, 
                  concedendo ao Flowalt apenas a licença necessária para prestar o serviço.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  5. Limitação de Responsabilidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>
                  O Flowalt é fornecido "como está" e "conforme disponível". Não garantimos que o serviço 
                  será ininterrupto, seguro ou livre de erros.
                </p>
                <p>
                  Em nenhuma circunstância o Flowalt será responsável por danos indiretos, incidentais, 
                  especiais, consequenciais ou punitivos, incluindo perda de lucros, dados ou uso.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  6. Modificações dos Termos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>
                  Reservamo-nos o direito de modificar estes termos a qualquer momento. 
                  Alterações significativas serão comunicadas por e-mail ou através de aviso na plataforma.
                </p>
                <p>
                  O uso continuado do serviço após as modificações constitui aceitação dos novos termos.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  7. Rescisão
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-muted-foreground">
                <p>
                  Você pode encerrar sua conta a qualquer momento através das configurações da plataforma 
                  ou entrando em contato conosco.
                </p>
                <p>
                  Reservamo-nos o direito de suspender ou encerrar seu acesso em caso de violação 
                  destes termos, sem aviso prévio.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="p-6 bg-muted/30 rounded-lg border">
            <h2 className="text-lg font-semibold text-foreground mb-2">Contato</h2>
            <p className="text-muted-foreground mb-4">
              Se você tiver dúvidas sobre estes Termos de Serviço, entre em contato conosco:
            </p>
            <p className="font-medium text-foreground">contato@flowalt.com.br</p>
            <p className="text-sm text-muted-foreground mt-4">
              Consulte também nossa{' '}
              <a href="/privacy" className="text-primary hover:underline">
                Política de Privacidade
              </a>{' '}
              e{' '}
              <a href="/data-deletion" className="text-primary hover:underline">
                Política de Exclusão de Dados
              </a>.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default TermsOfServicePage;
