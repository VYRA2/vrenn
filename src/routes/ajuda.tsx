import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/ajuda")({
  component: () => (
    <PublicDocument
      title="Central de Ajuda"
      description="Respostas e caminhos para usar o VRENN com segurança."
      sections={[
        {
          title: "Começando",
          items: [
            "Crie uma conta e complete seu perfil.",
            "Escolha uma meta com regra clara e método de validação.",
            "Acompanhe apenas o progresso confirmado.",
          ],
        },
        {
          title: "Equipes e comunidades",
          items: [
            "Equipe pública permite entrada direta.",
            "Equipe privada exige solicitação e aprovação.",
            "Comunidades são públicas, amplas e organizadas por interesse.",
          ],
        },
        {
          title: "Problemas financeiros",
          paragraphs: [
            "Para depósito, saldo bloqueado, saque ou transação não reconhecida, registre a ocorrência com data, valor e identificador disponível. Nunca envie senha ou código de autenticação.",
          ],
        },
        {
          title: "Contestações e denúncias",
          paragraphs: [
            "Use o fluxo de contestação associado ao resultado ou o canal de suporte. Inclua contexto e anexos relevantes; a revisão mantém uma trilha auditável.",
          ],
        },
        {
          title: "Documentos úteis",
          items: [
            "Termos de Uso",
            "Política de Privacidade",
            "Regras financeiras",
            "Validação e antifraude",
            "Diretrizes da Comunidade",
          ],
        },
        {
          title: "Contato",
          paragraphs: [
            "E-mail: suporte@vrenn.app. Consulte também a página de contato para assuntos específicos.",
          ],
        },
      ]}
    />
  ),
});
