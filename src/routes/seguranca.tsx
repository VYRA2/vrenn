import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/seguranca")({
  component: () => (
    <PublicDocument
      title="Segurança"
      description="Controles usados para proteger contas, provas, resultados e movimentações."
      sections={[
        {
          title: "Conta",
          items: [
            "Use senha exclusiva e mantenha seu dispositivo protegido.",
            "Nunca compartilhe códigos de autenticação.",
            "Revogue acessos de integrações que não utiliza.",
          ],
        },
        {
          title: "Provas e resultados",
          items: [
            "Validações sensíveis ocorrem no servidor.",
            "Duplicidades e alterações posteriores são bloqueadas.",
            "Decisões e sorteios relevantes mantêm auditoria.",
          ],
        },
        {
          title: "Financeiro",
          items: [
            "Webhooks são autenticados.",
            "Movimentações usam referências únicas.",
            "Saques e contestações podem passar por análise antifraude.",
          ],
        },
        {
          title: "Relato responsável",
          paragraphs: [
            "Envie detalhes para seguranca@vrenn.app sem explorar dados de terceiros. Inclua passos de reprodução e impacto, evitando informações pessoais desnecessárias.",
          ],
        },
      ]}
    />
  ),
});
