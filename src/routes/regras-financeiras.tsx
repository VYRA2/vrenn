import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/regras-financeiras")({
  component: () => (
    <PublicDocument
      title="Regras financeiras e de custódia"
      description="Entenda saldo, bloqueios, taxas, premiação, falhas e saques antes de assumir um compromisso."
      sections={[
        {
          title: "Carteira",
          items: [
            "Saldo disponível pode ser sacado conforme as regras de verificação.",
            "Saldo bloqueado está vinculado a um compromisso ativo.",
            "Cada transação possui referência única e trilha de auditoria.",
          ],
        },
        {
          title: "Metas individuais",
          items: [
            "Conclusão validada: devolução prevista de 97% e taxa de 3%.",
            "Falha: 75% destinado ao fundo da temporada e 25% de taxa, conforme regra apresentada antes da confirmação.",
          ],
        },
        {
          title: "Duelos",
          items: [
            "Vitória normal: vencedor recupera o próprio valor e recebe a parcela prevista do valor do rival.",
            "Empate com sucesso: devolução integral aos dois.",
            "Empate sem sucesso: aplicação das regras de falha individual.",
          ],
        },
        {
          title: "Desafios de equipe",
          items: [
            "Cada membro possui entrada e resultado individual.",
            "O prêmio do desafio é distribuído conforme o regulamento previamente publicado.",
            "Nenhuma premiação é calculada a partir de prova não validada.",
          ],
        },
        {
          title: "Saques, estornos e contestação",
          paragraphs: [
            "Saques podem exigir validação do titular da chave PIX. Contestações não duplicam transferências e podem manter valores bloqueados até decisão autorizada. Prazos e condições operacionais devem ser exibidos no pedido.",
          ],
        },
      ]}
    />
  ),
});
