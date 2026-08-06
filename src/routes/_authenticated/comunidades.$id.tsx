import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Trophy, Shield, LogOut, Flag, MessageCircle } from "lucide-react";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/comunidades/$id")({
  component: ComunidadeDetalhe,
});

function ComunidadeDetalhe() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"feed" | "desafio" | "ranking" | "sobre">("feed");
  const { data: c, isLoading } = useQuery({
    queryKey: ["comunidade", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("comunidades")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const { data: membership } = useQuery({
    queryKey: ["comunidade-membership", id, user.id],
    queryFn: async () =>
      (
        await (supabase as any)
          .from("comunidade_membros")
          .select("papel,status")
          .eq("comunidade_id", id)
          .eq("user_id", user.id)
          .maybeSingle()
      ).data,
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["comunidade-posts", id],
    enabled: tab === "feed",
    queryFn: async () =>
      (
        await (supabase as any)
          .from("comunidade_posts")
          .select(
            "id,texto,media_url,created_at,user_id,profiles:user_id(nome,username,avatar_url)",
          )
          .eq("comunidade_id", id)
          .eq("status", "publicado")
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
  });
  const { data: desafios = [] } = useQuery({
    queryKey: ["comunidade-desafios", id],
    enabled: tab === "desafio",
    queryFn: async () =>
      (
        await (supabase as any)
          .from("comunidade_desafios")
          .select("*")
          .eq("comunidade_id", id)
          .order("data_inicio", { ascending: false })
      ).data ?? [],
  });
  const { data: ranking = [] } = useQuery({
    queryKey: ["comunidade-ranking", id],
    enabled: tab === "ranking",
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("comunidade_desafio_participantes")
        .select(
          "user_id,progresso,status,profiles:user_id(nome,username,avatar_url),comunidade_desafios!inner(comunidade_id,status)",
        )
        .eq("comunidade_desafios.comunidade_id", id)
        .in("comunidade_desafios.status", ["ativo", "encerrado"])
        .order("progresso", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });
  const ativo = membership?.status === "ativo";
  async function entrar() {
    const { error } = await (supabase as any).rpc("join_comunidade", { p_comunidade_id: id });
    if (error) return toast.error(error.message);
    toast.success("Você entrou na comunidade!");
    qc.invalidateQueries({ queryKey: ["comunidade-membership", id, user.id] });
  }
  async function sair() {
    const { error } = await (supabase as any)
      .from("comunidade_membros")
      .update({ status: "saiu" })
      .eq("comunidade_id", id)
      .eq("user_id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Você saiu da comunidade");
    qc.invalidateQueries({ queryKey: ["comunidade-membership", id, user.id] });
  }
  if (isLoading) return <main className="min-h-screen bg-background" />;
  if (!c)
    return (
      <main className="min-h-screen bg-background p-6 text-foreground">
        Comunidade não encontrada.
      </main>
    );
  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <div className="relative h-44 bg-gradient-to-br from-primary/50 to-background">
        {c.capa_url && (
          <img src={c.capa_url} className="h-full w-full object-cover opacity-70" alt="" />
        )}
        <button
          onClick={() => nav({ to: "/comunidades" })}
          className="absolute left-4 top-4 rounded-full bg-black/60 p-2"
        >
          <ArrowLeft />
        </button>
      </div>
      <section className="mx-auto max-w-md px-5">
        <div className="-mt-10 flex items-end gap-3">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border-4 border-background bg-primary/20">
            {c.avatar_url ? (
              <img src={c.avatar_url} className="h-full w-full object-cover" alt="" />
            ) : (
              <Users />
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="truncate text-2xl font-black">{c.nome}</h1>
            <p className="text-xs text-primary-light">{c.categoria}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">{c.descricao}</p>
        <div className="mt-4 flex gap-2">
          {ativo ? (
            <button
              onClick={sair}
              className="flex-1 rounded-2xl border border-border py-3 text-sm font-bold"
            >
              <LogOut size={15} className="mr-2 inline" />
              Sair
            </button>
          ) : (
            <button
              onClick={entrar}
              className="flex-1 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground"
            >
              Entrar na comunidade
            </button>
          )}
          <button
            onClick={() => toast("Denúncia registrada pela Central de suporte")}
            className="rounded-2xl border border-border p-3"
            aria-label="Denunciar"
          >
            <Flag size={18} />
          </button>
        </div>
        <nav className="mt-6 flex overflow-x-auto border-b border-border">
          {(
            [
              ["feed", "Feed"],
              ["desafio", "Desafio mensal"],
              ["ranking", "Ranking"],
              ["sobre", "Sobre"],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`shrink-0 px-4 py-3 text-xs font-bold ${tab === k ? "border-b-2 border-primary text-primary-light" : "text-muted-foreground"}`}
            >
              {l}
            </button>
          ))}
        </nav>
        {tab === "feed" && (
          <div className="mt-4 space-y-3">
            {!posts.length && <Empty text="Ainda não há publicações nesta comunidade." />}
            {posts.map((p: any) => (
              <article key={p.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 overflow-hidden rounded-full bg-primary/20">
                    {p.profiles?.avatar_url && (
                      <img
                        src={p.profiles.avatar_url}
                        className="h-full w-full object-cover"
                        alt=""
                      />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-bold">{p.profiles?.nome}</div>
                    <div className="text-[10px] text-muted-foreground">@{p.profiles?.username}</div>
                  </div>
                </div>
                {p.texto && <p className="mt-3 text-sm">{p.texto}</p>}
                {p.media_url && (
                  <img
                    src={p.media_url}
                    className="mt-3 max-h-96 w-full rounded-xl object-cover"
                    alt=""
                  />
                )}
              </article>
            ))}
          </div>
        )}
        {tab === "desafio" && (
          <div className="mt-4 space-y-3">
            {!desafios.length && <Empty text="O próximo desafio mensal está sendo preparado." />}
            {desafios.map((d: any) => (
              <div key={d.id} className="rounded-2xl border border-border bg-card p-4">
                <Trophy className="text-yellow-400" />
                <h2 className="mt-2 font-bold">{d.titulo}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{d.descricao}</p>
                <div className="mt-3 text-[11px] text-primary-light">
                  {d.data_inicio} até {d.data_fim} · {d.tipo_validacao}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "ranking" && (
          <div className="mt-4 space-y-2">
            {!ranking.length && <Empty text="O ranking começa com o próximo desafio." />}
            {ranking.map((r: any, i: number) => (
              <div
                key={r.user_id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <span className="w-7 text-center font-black text-primary-light">{i + 1}</span>
                <div className="flex-1">
                  <div className="text-sm font-bold">{r.profiles?.nome}</div>
                  <div className="text-xs text-muted-foreground">@{r.profiles?.username}</div>
                </div>
                <span className="font-black">{Number(r.progresso).toFixed(0)}</span>
              </div>
            ))}
          </div>
        )}
        {tab === "sobre" && (
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-border bg-card p-4">
              <Shield className="text-primary-light" />
              <h2 className="mt-2 font-bold">Propósito e regras</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {c.regras ||
                  "Respeite as pessoas, publique progresso verdadeiro e não incentive práticas perigosas."}
              </p>
            </div>
            <Link
              to="/diretrizes-da-comunidade"
              className="flex items-center gap-2 rounded-2xl border border-border p-4 text-sm font-bold"
            >
              <MessageCircle size={18} />
              Diretrizes da Comunidade
            </Link>
          </div>
        )}
      </section>
      <BottomNav />
    </main>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
