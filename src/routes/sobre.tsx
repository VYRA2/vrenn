import { createFileRoute, Link } from "@tanstack/react-router";
import { Footer } from "@/components/PublicDocument";
import { VyraLogo } from "@/components/VyraLogo";
export const Route = createFileRoute("/sobre")({
  component: () => (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <VyraLogo size={90} vertical />
        <p className="mt-5 text-primary-light font-bold">NÃO DIGA QUE VAI FAZER. MOSTRE.</p>
        <h1 className="mt-5 text-5xl font-black">Disciplina que vira reputação.</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          O VRENN reúne pessoas que transformam intenção em evidência: metas, duelos, equipes e
          comunidades com progresso verificável.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-2xl bg-primary px-6 py-3 font-bold text-primary-foreground"
          >
            Começar agora
          </Link>
          <Link
            to="/regras-de-validacao"
            className="rounded-2xl border border-border px-6 py-3 font-bold"
          >
            Como validamos
          </Link>
        </div>
      </section>
      <Footer />
    </main>
  ),
});
