import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield } from "lucide-react";

export const Route = createFileRoute("/politica-privacidade")({
  component: PoliticaPrivacidade,
});

function PoliticaPrivacidade() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-5 py-8 pb-16">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Link to="/" className="rounded-full p-2 text-muted-foreground hover:bg-card">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Política de Privacidade</h1>
            <p className="text-xs text-muted-foreground">Última atualização: julho de 2026</p>
          </div>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">

          {/* Intro */}
          <section>
            <p>
              A VRENN Tecnologia Social Ltda. ("VRENN", "nós" ou "nosso") respeita sua privacidade e está comprometida
              com a proteção dos seus dados pessoais. Esta Política de Privacidade descreve como coletamos, usamos,
              armazenamos e protegemos suas informações quando você utiliza a plataforma VRENN.
            </p>
          </section>

          <Section title="1. Quem somos">
            <p>
              VRENN é uma plataforma brasileira de competição por habilidades com custódia financeira real.
              Somos responsáveis pelo tratamento dos seus dados pessoais conforme a Lei Geral de Proteção de
              Dados (LGPD — Lei nº 13.709/2018).
            </p>
            <p className="mt-2">
              <strong className="text-foreground">Contato do encarregado (DPO):</strong> privacidade@vrenn.app
            </p>
          </Section>

          <Section title="2. Dados que coletamos">
            <SubTitle>2.1 Dados de cadastro</SubTitle>
            <ul className="mt-2 space-y-1 pl-4">
              {["Nome completo", "Endereço de e-mail", "CPF (necessário para transações financeiras via Asaas)", "Username e foto de perfil"].map(i => <li key={i} className="list-disc">{i}</li>)}
            </ul>

            <SubTitle>2.2 Dados de uso</SubTitle>
            <ul className="mt-2 space-y-1 pl-4">
              {["Metas, duelos e desafios criados", "Check-ins realizados (foto, vídeo ou localização)", "Histórico de transações financeiras na carteira VRENN", "Interações sociais (seguir, curtir, comentar)"].map(i => <li key={i} className="list-disc">{i}</li>)}
            </ul>

            <SubTitle>2.3 Dados do Strava (quando conectado voluntariamente)</SubTitle>
            <div className="mt-2 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2 font-semibold text-primary-light">
                <Shield size={14} /> Protocolo de Validação VRENN — Strava
              </div>
              <p>Quando você opta por conectar sua conta Strava ao VRENN, acessamos <strong className="text-foreground">exclusivamente</strong>:</p>
              <ul className="mt-2 space-y-1 pl-4">
                {[
                  "Suas atividades físicas recentes (corrida, caminhada, natação, ciclismo)",
                  "Distância percorrida e duração de cada atividade",
                  "Data e horário da atividade",
                  "Nome e foto de perfil público do Strava",
                ].map(i => <li key={i} className="list-disc">{i}</li>)}
              </ul>
              <p className="mt-3 font-semibold text-foreground">O que NUNCA fazemos com dados do Strava:</p>
              <ul className="mt-2 space-y-1 pl-4">
                {[
                  "Não vendemos dados de atividade a terceiros",
                  "Não usamos para fins publicitários",
                  "Não armazenamos além do necessário para validar o check-in",
                  "Não acessamos localização em tempo real",
                  "Não acessamos dados financeiros ou de pagamento do Strava",
                ].map(i => <li key={i} className="list-disc">{i}</li>)}
              </ul>
              <p className="mt-3 text-xs">
                A conexão com o Strava é <strong className="text-foreground">inteiramente voluntária</strong>. Você pode desconectar a qualquer momento
                em Perfil → Configurações → Strava. Ao desconectar, excluímos os tokens de acesso imediatamente.
              </p>
            </div>
          </Section>

          <Section title="3. Como usamos seus dados">
            <ul className="space-y-2 pl-4">
              {[
                "Autenticação e segurança da sua conta",
                "Processamento de transações financeiras (depósitos, saques e custódia)",
                "Validação automática de check-ins via Strava (apenas quando conectado)",
                "Exibição de conquistas, reputação e ranking",
                "Comunicação sobre atividades na plataforma (notificações in-app)",
                "Cumprimento de obrigações legais e regulatórias",
              ].map(i => <li key={i} className="list-disc">{i}</li>)}
            </ul>
          </Section>

          <Section title="4. Base legal para tratamento (LGPD)">
            <ul className="space-y-2 pl-4">
              {[
                "Execução de contrato: para viabilizar metas, duelos e transações financeiras",
                "Consentimento: para conexão com Strava e notificações opcionais",
                "Legítimo interesse: para segurança, prevenção de fraude e melhoria da plataforma",
                "Obrigação legal: para registros financeiros exigidos por lei",
              ].map(i => <li key={i} className="list-disc">{i}</li>)}
            </ul>
          </Section>

          <Section title="5. Compartilhamento de dados">
            <p>Compartilhamos dados apenas com:</p>
            <ul className="mt-2 space-y-2 pl-4">
              {[
                "Asaas Pagamentos S.A.: processamento de PIX e custódia financeira",
                "Supabase Inc.: infraestrutura de banco de dados (servidores com criptografia em repouso)",
                "Strava Inc.: exclusivamente via OAuth para validação de atividades (quando conectado)",
                "Autoridades públicas: quando exigido por lei ou decisão judicial",
              ].map(i => <li key={i} className="list-disc">{i}</li>)}
            </ul>
            <p className="mt-3">Não vendemos seus dados a terceiros. Nunca.</p>
          </Section>

          <Section title="6. Seus direitos (LGPD)">
            <p>Você tem direito a:</p>
            <ul className="mt-2 space-y-1 pl-4">
              {[
                "Confirmar se tratamos seus dados",
                "Acessar seus dados",
                "Corrigir dados incompletos ou desatualizados",
                "Solicitar anonimização ou exclusão de dados desnecessários",
                "Revogar consentimento a qualquer momento",
                "Portabilidade dos seus dados",
                "Informação sobre compartilhamento com terceiros",
              ].map(i => <li key={i} className="list-disc">{i}</li>)}
            </ul>
            <p className="mt-3">Para exercer seus direitos: <strong className="text-foreground">privacidade@vrenn.app</strong></p>
          </Section>

          <Section title="7. Retenção de dados">
            <ul className="space-y-1 pl-4">
              {[
                "Dados de conta: enquanto a conta estiver ativa",
                "Dados financeiros: 5 anos (obrigação legal)",
                "Tokens do Strava: excluídos imediatamente ao desconectar",
                "Dados de check-in: 2 anos para fins de auditoria de disputas",
              ].map(i => <li key={i} className="list-disc">{i}</li>)}
            </ul>
          </Section>

          <Section title="8. Segurança">
            <p>
              Utilizamos criptografia TLS em trânsito e criptografia em repouso nos servidores Supabase.
              Tokens de acesso ao Strava são armazenados de forma criptografada e nunca expostos ao frontend.
              Realizamos revisões periódicas de segurança.
            </p>
          </Section>

          <Section title="9. Cookies e rastreamento">
            <p>
              Utilizamos apenas cookies essenciais para autenticação. Não utilizamos cookies de rastreamento
              publicitário ou de terceiros para fins de marketing.
            </p>
          </Section>

          <Section title="10. Contato e reclamações">
            <p>Em caso de dúvidas ou para exercer seus direitos:</p>
            <ul className="mt-2 space-y-1 pl-4">
              <li className="list-disc"><strong className="text-foreground">E-mail:</strong> privacidade@vrenn.app</li>
              <li className="list-disc"><strong className="text-foreground">ANPD:</strong> www.gov.br/anpd (Autoridade Nacional de Proteção de Dados)</li>
            </ul>
          </Section>

          <Section title="11. Alterações nesta política">
            <p>
              Notificaremos alterações significativas via e-mail ou notificação in-app com antecedência mínima
              de 15 dias. O uso continuado após as alterações implica aceitação da nova versão.
            </p>
          </Section>

        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 mb-1 text-sm font-semibold text-primary-light">{children}</h3>;
}
