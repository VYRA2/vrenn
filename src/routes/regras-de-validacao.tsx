import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/regras-de-validacao")({
  component: () => (
    <PublicDocument
      title="Validação, arbitragem e antifraude"
      description="Como o VRENN confirma progresso e impede que participantes escolham o próprio resultado."
      sections={[
        {
          title: "Princípio central",
          paragraphs: [
            "O resultado é determinado pelo método escolhido. Participantes não alteram progresso, conclusão, eliminação ou vencedor diretamente.",
          ],
        },
        {
          title: "Strava",
          items: [
            "Atividade vinculada ao usuário, período, modalidade e objetivo.",
            "Uma atividade externa só pode ser usada uma vez.",
            "Registros incompatíveis ou duplicados são rejeitados.",
          ],
        },
        {
          title: "QR Code e geolocalização",
          items: [
            "Tokens são validados no servidor.",
            "Localização é verificada conforme as regras da atividade.",
            "Leitura ou coordenada isolada no frontend não conclui uma meta.",
          ],
        },
        {
          title: "Foto e árbitro",
          items: [
            "Somente voluntários elegíveis participam do sorteio.",
            "Competidores não podem arbitrar a própria disputa.",
            "O sorteio e a decisão ficam registrados para auditoria.",
          ],
        },
        {
          title: "Contestação",
          items: [
            "O competidor pode enviar motivo e anexos ao suporte.",
            "O resultado original é preservado.",
            "A abertura não altera automaticamente resultado ou custódia.",
          ],
        },
      ]}
    />
  ),
});
