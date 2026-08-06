import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/carreiras")({
  component: () => (
    <PublicDocument
      title="Carreiras"
      description="Ajude a construir uma infraestrutura de compromisso, reputação e progresso verificável."
      sections={[
        {
          title: "Como trabalhamos",
          items: [
            "Segurança e clareza antes de velocidade.",
            "Decisões orientadas por evidência.",
            "Respeito às pessoas e responsabilidade financeira.",
          ],
        },
        {
          title: "Oportunidades",
          paragraphs: [
            "Ainda não há vagas públicas abertas. Futuras oportunidades serão publicadas nesta página. Não envie documentos sensíveis sem uma vaga e um canal verificados.",
          ],
        },
      ]}
    />
  ),
});
