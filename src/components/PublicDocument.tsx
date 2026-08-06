import { Link } from "@tanstack/react-router";
import { VyraLogo } from "@/components/VyraLogo";

export type DocSection = { title: string; paragraphs?: string[]; items?: string[] };
export function PublicDocument({
  title,
  description,
  updated = "5 de agosto de 2026",
  sections,
}: {
  title: string;
  description: string;
  updated?: string;
  sections: DocSection[];
}) {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <Link to="/">
            <VyraLogo size={34} />
          </Link>
          <Link
            to="/auth"
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
          >
            Entrar
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-primary-light">VRENN</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">{title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Última atualização: {updated}</p>
        <div className="mt-10 space-y-9">
          {sections.map((s, i) => (
            <section key={s.title}>
              <h2 className="text-xl font-bold">
                <span className="mr-2 text-primary-light">{i + 1}.</span>
                {s.title}
              </h2>
              {s.paragraphs?.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.items && (
                <ul className="mt-3 space-y-2 text-muted-foreground">
                  {s.items.map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-primary-light">•</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
      <Footer />
    </main>
  );
}
export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 text-sm md:grid-cols-3">
        <div>
          <VyraLogo size={34} />
          <p className="mt-3 text-xs text-muted-foreground">Não diga que vai fazer. Mostre.</p>
        </div>
        <div className="grid gap-2">
          <Link to="/sobre">Sobre</Link>
          <Link to="/ajuda">Ajuda</Link>
          <Link to="/contato">Contato</Link>
          <Link to="/seguranca">Segurança</Link>
        </div>
        <div className="grid gap-2">
          <Link to="/termos-de-uso">Termos de Uso</Link>
          <Link to="/politica-privacidade">Privacidade</Link>
          <Link to="/diretrizes-da-comunidade">Diretrizes da Comunidade</Link>
          <Link to="/regras-financeiras">Regras financeiras</Link>
        </div>
      </div>
    </footer>
  );
}
