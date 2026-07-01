import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Share2, MoreHorizontal, Users, Trophy, Flame, Heart, Target, Activity, Settings, Plus, UserPlus, Calendar, ChevronRight } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipes/$id/")({
  component: EquipeDetalhe,
  errorComponent: ({ error }) => <div className="p-8 text-center text-sm text-muted-foreground">Erro: {error.message}</div>,
  notFoundComponent: () => <div className="p-8 text-center text-sm text-muted-foreground">Equipe não encontrada</div>,
});

type Tab = "visao" | "desafios" | "membros" | "atividades" | "config";

function EquipeDetalhe() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("visao");

  const { data: equipe, isLoading } = useQuery({
    queryKey: ["equipe", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("equipes").select("*").eq("id", id).maybeSingle();
      return data;
    },
  });

  const { data: membros } = useQuery({
    queryKey: ["equipe-membros", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("equipe_membros")
        .select("user_id, papel, profiles:user_id (id, nome, username, avatar_url, reputacao_pts)")
        .eq("equipe_id", id);
      return (data ?? []).map((r: any) => ({ ...r.profiles, papel: r.papel })).filter((m: any) => m?.id);
    },
  });

  const { data: desafios } = useQuery({
    queryKey: ["equipe-desafios", id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("desafios_equipe").select("*").eq("equipe_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (isLoading) return <div className="min-h-screen bg-background pt-10"><div className="mx-auto max-w-md px-5 space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-card"/>)}</div></div>;
  if (!equipe) return <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-8 text-sm text-muted-foreground">Equipe não encontrada</div>;

  const isMember = (membros ?? []).some((m: any) => m.id === user.id);
  const desafioAtivo = (desafios ?? []).find((d: any) => d.status === "ativo");
  const proximosDesafios = (desafios ?? []).filter((d: any) => d.id !== desafioAtivo?.id).slice(0, 3);

  async function entrar() {
    const { error } = await (supabase as any).from("equipe_membros").insert({ equipe_id: id, user_id: user.id, papel: "membro" });
    if (error) return toast.error(error.message);
    toast.success("Você entrou na equipe");
    navigate({ to: "/equipes/$id", params: { id } });
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-center justify-between px-5 pt-5 pb-2">
        <button onClick={() => navigate({ to: "/equipes" })} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"><ArrowLeft size={18}/></button>
        <div className="flex items-center gap-2">
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"><Share2 size={16}/></button>
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card"><MoreHorizontal size={16}/></button>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 pt-3">
        <div className="flex items-start gap-4">
          <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary-light overflow-hidden border border-primary/30">
            {equipe.avatar_url ? <img src={equipe.avatar_url} className="h-full w-full object-cover"/> : <Users size={42}/>}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold inline-flex items-center gap-2">{equipe.nome}</h1>
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{equipe.descricao || "Sem descrição"}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Tag icon={<Heart size={11}/>} label="Saúde" />
              <Tag icon={<Target size={11}/>} label={equipe.categoria} />
              <Tag icon={<Flame size={11}/>} label="Constância" />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-4">
          <Stat value={String((membros ?? []).length)} label="Membros" />
          <Stat value={String((desafios ?? []).length)} label="Desafios" />
          <Stat value="—" label="Ranking" />
          <Stat value="0" label="VRENN Coins" small />
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-light"><Trophy size={18}/></div>
          <div className="flex-1">
            <div className="text-[11px] text-muted-foreground">Ranking da equipe</div>
            <div className="text-base font-bold inline-flex items-center gap-2">— <span className="text-[11px] text-muted-foreground font-normal">sem ranking ainda</span></div>
          </div>
          <button className="rounded-xl border border-primary px-3 py-1.5 text-xs font-semibold text-primary-light">Ver ranking ›</button>
        </div>
      </div>

      <div className="mx-auto max-w-md mt-4 overflow-x-auto px-2">
        <div className="flex">
          {([
            { id: "visao", label: "Visão geral", icon: Trophy },
            { id: "desafios", label: "Desafios", icon: Target },
            { id: "membros", label: "Membros", icon: Users },
            { id: "atividades", label: "Atividades", icon: Activity },
            { id: "config", label: "Configurações", icon: Settings },
          ] as { id: Tab; label: string; icon: any }[]).map((t) => {
            const active = tab === t.id;
            const I = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex flex-1 min-w-fit flex-col items-center gap-1 px-3 py-2.5 text-[11px] font-semibold whitespace-nowrap transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
                <I size={18} />
                {t.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>
        <div className="h-px bg-border" />
      </div>

      <div className="mx-auto max-w-md px-5 pt-5 space-y-5">
        {tab === "visao" && (
          <>
            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="text-sm font-bold">Sobre a equipe</div>
              <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">{equipe.descricao || "Sem descrição definida."}</p>
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Calendar size={12}/> Criada em {new Date(equipe.created_at).toLocaleDateString("pt-BR")}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-bold mb-2">Desafio ativo</h3>
              {desafioAtivo ? (
                <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20 text-primary-light"><Flame size={22}/></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{desafioAtivo.titulo}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{desafioAtivo.duracao_dias} dias</div>
                    <div className="mt-2 h-2 rounded-full bg-[#2E2E50] overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary to-primary-light" style={{ width: `0%` }} />
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-muted-foreground"/>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border bg-card p-5 text-center text-xs text-muted-foreground">Nenhum desafio ativo. {isMember && <Link to="/equipes/$id/desafio/novo" params={{ id }} className="text-primary-light font-semibold">Criar desafio</Link>}</div>
              )}
            </section>

            {proximosDesafios.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold">Próximos desafios</h3>
                  <button className="text-[11px] font-semibold text-primary-light">Ver todos</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {proximosDesafios.map((d: any) => (
                    <div key={d.id} className="rounded-2xl border border-border bg-card p-3">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-accent"><Target size={16}/></div>
                      <div className="text-xs font-bold line-clamp-2">{d.titulo}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{d.duracao_dias} dias</div>
                      <button className="mt-2 w-full rounded-lg border border-primary py-1.5 text-[11px] font-semibold text-primary-light">Entrar</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold">Membros em destaque</h3>
                <button className="text-[11px] font-semibold text-primary-light">Ver todos</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(membros ?? []).slice(0, 4).map((m: any) => (
                  <div key={m.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 overflow-hidden border-2 border-primary/40">
                      {m.avatar_url ? <img src={m.avatar_url} className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary-light">{(m.nome || "?")[0]}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{m.nome}</div>
                      <div className="text-[10px] text-primary-light font-semibold">{m.reputacao_pts ?? 0} pts</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {tab === "desafios" && (
          <div className="space-y-3">
            {(desafios ?? []).length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">Nenhum desafio ainda.</div>}
            {(desafios ?? []).map((d: any) => (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold">{d.titulo}</div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${d.status === "ativo" ? "bg-accent/15 text-accent" : "bg-border text-muted-foreground"}`}>{d.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{d.descricao}</p>
                <div className="mt-2 text-[11px] text-muted-foreground">{d.duracao_dias} dias · R$ {Number(d.valor_entrada).toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}

        {tab === "membros" && (
          <div className="space-y-2">
            {(membros ?? []).map((m: any) => (
              <div key={m.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/20 overflow-hidden">
                  {m.avatar_url ? <img src={m.avatar_url} className="h-full w-full object-cover"/> : <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary-light">{(m.nome || "?")[0]}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">{m.nome}</div>
                  <div className="text-[10px] text-muted-foreground">@{m.username} · {m.reputacao_pts ?? 0} pts</div>
                </div>
                {m.papel === "admin" && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary-light">Admin</span>}
              </div>
            ))}
          </div>
        )}

        {tab === "atividades" && <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-xs text-muted-foreground">Feed de atividades em breve.</div>}
        {tab === "config" && (
          <div className="space-y-2">
            <Row label="Visibilidade" value={equipe.publica ? "Pública" : "Privada"} />
            <Row label="Categoria" value={equipe.categoria} />
            {equipe.regras && <Row label="Regras" value={equipe.regras} />}
          </div>
        )}
      </div>

      <div className="mx-auto max-w-md px-5 pt-6 grid grid-cols-2 gap-3">
        {isMember ? (
          <>
            <button className="rounded-2xl border border-primary py-3 text-sm font-semibold text-primary-light inline-flex items-center justify-center gap-2"><UserPlus size={16}/> Convidar membros</button>
            <Link to="/equipes/$id/desafio/novo" params={{ id }} className="rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow inline-flex items-center justify-center gap-2"><Plus size={16}/> Criar novo desafio</Link>
          </>
        ) : (
          <button onClick={entrar} className="col-span-2 rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">Entrar na equipe</button>
        )}
      </div>

      <BottomNav />
    </main>
  );
}

function Stat({ value, label, small }: { value: string; label: string; small?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-bold ${small ? "text-base" : "text-xl"}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
function Tag({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-[10px] text-muted-foreground capitalize">
      {icon} {label}
    </span>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-semibold whitespace-pre-wrap capitalize">{value}</div>
    </div>
  );
}
