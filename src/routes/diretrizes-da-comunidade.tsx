import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/diretrizes-da-comunidade")({
  component: () => (
    <PublicDocument
      title="Diretrizes da Comunidade"
      description="Regras para manter o VRENN seguro, respeitoso e orientado a progresso verdadeiro."
      sections={[
        {
          title: "Respeito",
          items: [
            "Não pratique assédio, ameaça, perseguição, humilhação ou discriminação.",
            "Não exponha dados pessoais de terceiros.",
            "Discordâncias não autorizam ataques pessoais.",
          ],
        },
        {
          title: "Progresso verdadeiro",
          items: [
            "Não falsifique, reutilize ou manipule provas.",
            "Não valide a si mesmo nem atue em nome de outra pessoa.",
            "Não combine resultados em duelos ou desafios.",
          ],
        },
        {
          title: "Segurança",
          items: [
            "Não publique desafios que incentivem automutilação, privação extrema, crime ou risco físico desnecessário.",
            "Conteúdo de saúde não substitui orientação profissional.",
            "Denuncie situações urgentes aos serviços locais adequados.",
          ],
        },
        {
          title: "Comunidades e equipes",
          items: [
            "Comunidades são públicas por nicho; equipes são grupos menores públicos ou privados.",
            "Conteúdo de equipe privada é restrito a membros aprovados.",
            "Administradores devem aplicar regras de forma transparente.",
          ],
        },
        {
          title: "Moderação e recurso",
          paragraphs: [
            "Usuários podem denunciar conteúdo e decisões. A moderação pode ocultar publicações, restringir contas ou remover participantes. Recursos serão avaliados sem alterar automaticamente o resultado original.",
          ],
        },
      ]}
    />
  ),
});
