import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";
import { ArrowLeft, Bell, Heart, MessageCircle, UserPlus, Trophy, Shield, CheckCircle2, AlertCircle, Target, Swords } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notificacoes")({
  component: Notificacoes,
});

const TYPE_STYLES: Record<string, { icon: any; color: string; bg: string }> = {
  like:                  { icon: Heart,         color: "#F43F5E", bg: "rgba(244,63,94,0.15)" },
  comment:               { icon: MessageCircle, color: "#A855F7", bg: "rgba(168,85,247,0.15)" },
  follow:                { icon: UserPlus,      color: "#38BDF8", bg: "rgba(56,189,248,0.15)" },
  achievement:           { icon: Trophy,        color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
  convite_arbitro:       { icon: Shield,        color: "#A855F7", bg: "rgba(168,85,247,0.15)" },
  checkin_para_validar:  { icon: Target,        color: "#7B3FF2", bg: "rgba(123,63,242,0.15)" },
  checkin_validado:      { icon: CheckCircle2,  color: "#22D3A1", bg: "rgba(34,211,161,0.15)" },
  checkin_questionado:   { icon: AlertCircle,   color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
  arbitro_aceitou:       { icon: CheckCircle2,  color: "#22D3A1", bg: "rgba(34,211,161,0.15)" },
  arbitro_recusou:       { icon: AlertCircle,   color: "#F43F5E", bg: "rgba(244,63,94,0.15)" },
  convite_duelo:         { icon: Swords,        color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
};

function Notificacoes() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const { data: items } = useQuery({
    queryKey: ["notifs", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("notificacoes").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function responder(notif: any, aceitar: boolean) {
    if (!notif.link_id) return;
    const status = aceitar ? "aceito" : "recusado";
    const { data: arb, error } = await supabase.from("arbitros").update({ status }).eq("id", notif.link_id).select("*, metas:meta_id (user_id, titulo)").maybeSingle();
    if (error) return toast.error(error.message);
    await supabase.from("notificacoes").update({ lida: true }).eq("id", notif.id);
    if (arb?.metas) {
      await supabase.from("notificacoes").insert({
        user_id: (arb.metas as any).user_id,
        tipo: aceitar ? "arbitro_aceitou" : "arbitro_recusou",
        mensagem: aceitar
          ? `Seu convite para árbitro foi aceito.`
          : `Seu convite para árbitro foi recusado.`,
        link_id: arb.meta_id,
      });
    }
    toast.success(aceitar ? "Convite aceito!" : "Convite recusado");
    qc.invalidateQueries({ queryKey: ["notifs", user.id] });
  }

  async function marcarTodas() {
    await supabase.from("notificacoes").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
    qc.invalidateQueries({ queryKey: ["notifs", user.id] });
  }

  const groups = groupByDay(items ?? []);

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="flex-1 text-base font-bold text-center">Notificações</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-5">
        {(items?.some(i => !i.lida)) && (
          <div className="flex justify-end">
            <button onClick={marcarTodas} className="text-xs font-semibold text-primary-light">Marcar todas como lidas</button>
          </div>
        )}
        {(!items || items.length === 0) && (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Bell size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Sem notificações por enquanto.</p>
          </div>
        )}
        {Object.entries(groups).map(([label, list]) => (
          <section key={label}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h2>
            <div className="space-y-2">
              {list.map((n) => {
                const style = TYPE_STYLES[n.tipo] ?? { icon: Bell, color: "#A855F7", bg: "rgba(168,85,247,0.15)" };
                const Icon = style.icon;
                const isConvite = n.tipo === "convite_arbitro" && !n.lida;
                const isDueloConvite = n.tipo === "convite_duelo";

                const card = (
                  <div className={`rounded-2xl border border-border bg-card p-3 ${!n.lida ? "ring-1 ring-primary/30" : ""}`}>
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ background: style.bg, color: style.color }}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-snug">{n.mensagem}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                      {!n.lida && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    {isConvite && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button onClick={() => responder(n, true)} className="rounded-xl bg-gradient-primary py-2 text-xs font-bold text-primary-foreground">Aceitar</button>
                        <button onClick={() => responder(n, false)} className="rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground">Recusar</button>
                      </div>
                    )}
                  </div>
                );

                return isDueloConvite ? (
                  <Link key={n.id} to="/duelo-convite/$id" params={{ id: n.link_id }} className="block">
                    {card}
                  </Link>
                ) : (
                  <div key={n.id}>{card}</div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}

function groupByDay(items: any[]) {
  const out: Record<string, any[]> = { Hoje: [], Ontem: [], "Esta semana": [], Anterior: [] };
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  for (const i of items) {
    const d = new Date(i.created_at);
    const diffDays = (now.getTime() - d.getTime()) / 86400000;
    if (d.toDateString() === today) out.Hoje.push(i);
    else if (d.toDateString() === yesterday) out.Ontem.push(i);
    else if (diffDays < 7) out["Esta semana"].push(i);
    else out.Anterior.push(i);
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v.length));
}
