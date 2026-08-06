import { createFileRoute } from "@tanstack/react-router";
import { PublicDocument } from "@/components/PublicDocument";
export const Route = createFileRoute("/contato")({
  component: () => (
    <PublicDocument
      title="Contato"
      description="Escolha o canal adequado para que sua solicitação seja tratada com contexto e segurança."
      sections={[
        {
          title: "Suporte",
          paragraphs: [
            "Dúvidas de conta, metas, equipes, comunidades e uso geral: suporte@vrenn.app.",
          ],
        },
        {
          title: "Privacidade",
          paragraphs: ["Direitos de dados pessoais e LGPD: privacidade@vrenn.app."],
        },
        {
          title: "Segurança",
          paragraphs: [
            "Relatos responsáveis de vulnerabilidade: seguranca@vrenn.app. Não exponha falhas publicamente antes da análise.",
          ],
        },
        {
          title: "Financeiro e contestação",
          paragraphs: [
            "Use preferencialmente o protocolo dentro do aplicativo para preservar identificadores e histórico. Nunca envie senha, código de autenticação ou chave secreta.",
          ],
        },
      ]}
    />
  ),
});
