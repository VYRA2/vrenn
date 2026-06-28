import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, CheckCircle2, Image as ImageIcon, TrendingUp, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meta/$id")({
  component: MetaDetail,
});

function MetaDetail() {
  const { id } = Route.useParams();
  const { data: meta, isLoading } = useQuery({
    queryKey: ["meta", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("*, profiles:user_id (nome, username)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: checkins } = useQuery({
    queryKey: ["checkins", id],
    queryFn: async () => {
      const { data } = await supabase.from("checkins").select("*").eq("meta_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) return <div className="min-h-screen bg-background p-8 text-muted-foreground">Carregando…</div>;
  if (!meta) return <div className="min-h-screen bg-background p-8 text-muted-foreground">Meta não encontrada.</div>;

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="text-base font-bold truncate flex-1">Detalhe</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 pt-4">
        <div>
          <span className="inline-block rounded-full bg-primary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-light">
            {meta.status === "em_andamento" ? "Em andamento" : meta.status}
          </span>
          <h2 className="mt-2 text-2xl font-bold">{meta.titulo}</h2>
          <p className="text-xs text-muted-foreground">por @{(meta as any).profiles?.username ?? "user"}</p>
          {meta.descricao && <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{meta.descricao}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <InfoBox icon={Calendar} label="Prazo" value={meta.prazo ? new Date(meta.prazo).toLocaleDateString("pt-BR") : "Aberto"} />
          <InfoBox icon={TrendingUp} label="Categoria" value={meta.categoria} />
          <InfoBox icon={CheckCircle2} label="Check-ins" value={String(checkins?.length ?? 0)} />
        </div>

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-sm font-semibold">Progresso</span>
            <span className="text-3xl font-bold text-primary-light">{meta.progresso}%</span>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${meta.progresso}%` }} />
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold">Linha do tempo</h3>
          <div className="space-y-3">
            {(checkins ?? []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Sem marcos ainda. Publique seu primeiro check-in.
              </div>
            )}
            {checkins?.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="h-3 w-3 rounded-full bg-gradient-primary" />
                  <div className="flex-1 w-px bg-border my-1" />
                </div>
                <div className="flex-1 rounded-xl border border-border bg-card p-3">
                  <div className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")}</div>
                  {c.mensagem && <p className="mt-1 text-sm">{c.mensagem}</p>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-bold">Galeria da jornada</h3>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="aspect-square rounded-xl border border-border bg-card flex items-center justify-center text-muted-foreground">
                <ImageIcon size={20} />
              </div>
            ))}
          </div>
        </section>

        <button className="w-full rounded-3xl bg-gradient-primary py-3.5 text-sm font-semibold text-primary-foreground shadow-glow">
          Publicar atualização
        </button>
      </div>
    </main>
  );
}

function InfoBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <Icon size={16} className="mx-auto text-primary-light" />
      <div className="mt-1 text-xs font-semibold truncate">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
