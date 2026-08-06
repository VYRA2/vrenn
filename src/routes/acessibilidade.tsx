import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/acessibilidade")({
  component: () => (
    <PublicDocument
      title="Acessibilidade"
      description="Compromisso do VRENN com experiências utilizáveis por diferentes pessoas e tecnologias assistivas."
      sections={[
        {
          title: "Princípios",
          items: [
            "Navegação por teclado e foco visível.",
            "Contraste suficiente e informação não dependente apenas de cor.",
            "Textos alternativos e rótulos para controles.",
            "Redução de movimento quando solicitada pelo sistema.",
          ],
        },
        {
          title: "Limitações conhecidas",
          paragraphs: [
            "Algumas experiências visuais, vídeos, gráficos e fluxos antigos ainda precisam de revisão contínua. Problemas podem ser enviados para suporte@vrenn.app com tela, dispositivo e tecnologia assistiva utilizada.",
          ],
        },
      ]}
    />
  ),
});
