import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | VRENN" },
      { name: "description", content: "Regras de uso, custódia, validação e segurança do VRENN." },
    ],
  }),
  component: () => (
    <PublicDocument
      title="Termos de Uso"
      description="Estes termos definem as regras para contas, metas, duelos, equipes, comunidades, provas e valores em custódia no VRENN."
      sections={[
        {
          title: "Aceitação e conta",
          items: [
            "Use dados verdadeiros e mantenha sua conta segura.",
            "Você é responsável pelas ações realizadas na sua conta.",
            "O aceite destes Termos e da Política de Privacidade é obrigatório.",
          ],
        },
        {
          title: "Natureza do serviço",
          paragraphs: [
            "O VRENN é uma plataforma de accountability baseada em compromissos, provas e validação. Não é plataforma de aposta ou jogo de azar; resultados decorrem do cumprimento verificável das regras definidas.",
          ],
        },
        {
          title: "Metas, duelos e desafios",
          items: [
            "O participante não declara manualmente conclusão ou vitória.",
            "A forma de validação escolhida determina o resultado.",
            "Regras relevantes não podem ser alteradas depois do início.",
          ],
        },
        {
          title: "Provas e validação",
          items: [
            "Strava, QR Code, geolocalização e foto com árbitro seguem verificações próprias.",
            "Provas falsas, duplicadas ou enviadas para terceiros podem ser rejeitadas.",
            "No método foto + árbitro, o árbitro elegível é sorteado e a decisão pode ser contestada ao suporte.",
          ],
        },
        {
          title: "Custódia, taxas e saques",
          paragraphs: [
            "Valores vinculados a compromissos podem permanecer bloqueados até a resolução. Percentuais, taxas e destinos aplicáveis devem ser apresentados antes da confirmação. Saques podem depender de verificação de identidade, saldo disponível e análise antifraude.",
          ],
          items: [
            "Nenhuma movimentação deve ser processada duas vezes.",
            "Cancelamentos e falhas seguem o regulamento exibido na criação.",
            "Valores de teste não possuem valor financeiro real.",
          ],
        },
        {
          title: "Conduta e moderação",
          items: [
            "São proibidos fraude, assédio, sabotagem, falsificação de provas e desafios perigosos.",
            "Conteúdos podem ser removidos e contas podem ser restringidas, com registro e possibilidade de recurso quando aplicável.",
          ],
        },
        {
          title: "Encerramento",
          paragraphs: [
            "O usuário pode solicitar exclusão da conta, observadas obrigações legais, financeiras e de prevenção a fraude. Valores pendentes precisam ser resolvidos antes do encerramento definitivo.",
          ],
        },
        {
          title: "Contato",
          paragraphs: [
            "Dúvidas, contestações e solicitações podem ser encaminhadas pela Central de Ajuda ou pelo canal suporte@vrenn.app.",
          ],
        },
      ]}
    />
  ),
});
