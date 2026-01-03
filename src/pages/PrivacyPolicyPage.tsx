import React from 'react';
import { Helmet } from 'react-helmet';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Política de Privacidade - Flowalt</title>
        <meta name="description" content="Política de Privacidade do Flowalt - Sistema de Gestão Jurídica" />
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

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <h1 className="text-3xl font-bold text-foreground mb-2">Política de Privacidade</h1>
            <p className="text-muted-foreground mb-8">Última atualização: 03 de Janeiro de 2025</p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">1. Introdução</h2>
              <p className="text-muted-foreground leading-relaxed">
                A Flowalt ("nós", "nosso" ou "Flowalt") está comprometida em proteger sua privacidade. 
                Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas 
                informações quando você utiliza nosso sistema de gestão jurídica.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">2. Informações que Coletamos</h2>
              <h3 className="text-lg font-medium text-foreground mb-2">2.1 Informações de Conta</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Nome e sobrenome</li>
                <li>Endereço de e-mail</li>
                <li>Informações profissionais (cargo, escritório)</li>
                <li>Foto de perfil (opcional)</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.2 Dados de Uso</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Registros de acesso e atividades</li>
                <li>Informações do dispositivo e navegador</li>
                <li>Endereço IP</li>
                <li>Páginas visitadas e funcionalidades utilizadas</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.3 Dados Jurídicos</h3>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Informações de processos e casos</li>
                <li>Documentos carregados</li>
                <li>Anotações e comentários</li>
                <li>Prazos e compromissos</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">3. Como Usamos suas Informações</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">Utilizamos suas informações para:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Fornecer, manter e melhorar nossos serviços</li>
                <li>Processar e gerenciar sua conta</li>
                <li>Enviar notificações sobre prazos e atividades importantes</li>
                <li>Responder a solicitações de suporte</li>
                <li>Detectar e prevenir fraudes e abusos</li>
                <li>Cumprir obrigações legais</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">4. Compartilhamento de Informações</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Não vendemos suas informações pessoais. Podemos compartilhar informações apenas:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Com membros do seu workspace conforme permissões configuradas</li>
                <li>Com prestadores de serviços que nos auxiliam na operação</li>
                <li>Quando exigido por lei ou ordem judicial</li>
                <li>Para proteger nossos direitos legais</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">5. Segurança dos Dados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações, 
                incluindo criptografia em trânsito e em repouso, controles de acesso baseados em função (RBAC), 
                autenticação segura e auditorias regulares de segurança.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">6. Retenção de Dados</h2>
              <p className="text-muted-foreground leading-relaxed">
                Mantemos suas informações enquanto sua conta estiver ativa ou conforme necessário para 
                fornecer nossos serviços. Após encerramento da conta, podemos reter certas informações 
                conforme exigido por lei ou para fins legítimos de negócio.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">7. Seus Direitos (LGPD)</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Confirmar a existência de tratamento de dados</li>
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar anonimização, bloqueio ou eliminação de dados</li>
                <li>Obter informações sobre compartilhamento</li>
                <li>Revogar consentimento</li>
                <li>Solicitar portabilidade dos dados</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">8. Cookies e Tecnologias Similares</h2>
              <p className="text-muted-foreground leading-relaxed">
                Utilizamos cookies e tecnologias similares para melhorar sua experiência, 
                lembrar preferências e analisar o uso do serviço. Você pode gerenciar suas 
                preferências de cookies através das configurações do navegador.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">9. Integrações de Terceiros</h2>
              <p className="text-muted-foreground leading-relaxed">
                Quando você conecta serviços de terceiros (como redes sociais via OAuth), 
                podemos receber informações conforme as permissões concedidas. Essas integrações 
                estão sujeitas também às políticas de privacidade dos respectivos serviços.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">10. Alterações nesta Política</h2>
              <p className="text-muted-foreground leading-relaxed">
                Podemos atualizar esta política periodicamente. Notificaremos sobre alterações 
                significativas através do e-mail cadastrado ou aviso no sistema. Recomendamos 
                revisar esta página regularmente.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">11. Contato</h2>
              <p className="text-muted-foreground leading-relaxed">
                Para exercer seus direitos ou esclarecer dúvidas sobre esta política, entre em contato:
              </p>
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-foreground font-medium">Flowalt - Encarregado de Proteção de Dados</p>
                <p className="text-muted-foreground">E-mail: privacidade@flowalt.com.br</p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicyPage;
