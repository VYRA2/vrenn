import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/PublicDocument";
export const Route = createFileRoute("/blog")({
  component: () => (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-primary-light font-bold">BLOG VRENN</p>
        <h1 className="mt-3 text-4xl font-black">Disciplina aplicada</h1>
        <p className="mt-3 text-muted-foreground">
          Conteúdos sobre metas, hábitos, provas de progresso e comunidades.
        </p>
        <div className="mt-10 rounded-3xl border border-dashed border-border p-10 text-center">
          <h2 className="font-bold">Primeiros artigos em preparação</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enquanto isso, conheça as regras que tornam o progresso verificável.
          </p>
          <Link
            to="/regras-de-validacao"
            className="mt-5 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
          >
            Ver validação e antifraude
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  ),
});
