import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Swords, Calendar, Wallet } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/duelo-convite/$id")({
  component: DueloConvite,
});

function DueloConvite() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const { data: duelo, isLoading } = useQuery({
    queryKey: ["duelo-convite", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duelos")
        .select("*, challenger:challenger_id (nome, username, avatar_url)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function responder(aceitar: boolean) {
    const novoStatus = aceitar ? "em_andamento" : "recusado";
    const { error } = await supabase.from("duelos").update({ status: novoStatus }).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("notificacoes").update({ lida: true }).eq("link_id", id).eq("user_id", user.id);
    toast.success(aceitar ? "Duelo aceito!" : "Duelo recusado");
    qc.invalidateQueries({ queryKey: ["notifs", user.id] });
    navigate({ to: "/duelos" });
  }

  if (isLoading) return <main className="min-h-screen bg-background" />;

  if (!duelo) {
    return (
      <main className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Duelo não encontrado.</p>
      </main>
    );
  }

  const challenger = duelo.challenger as any;
  const jaRespondido = duelo.status !== "pendente";

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/notificacoes" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="flex-1 text-base font-bold text-center">Convite de duelo</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 pt-6 space-y-5">
        <div className="rounded-3xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15">
            <Swords size={28} className="text-primary-light" />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-bold text-foreground">{challenger?.nome ?? "Alguém"}</span> te desafiou para um duelo
          </p>
          <h2 className="mt-2 text-xl font-black">{duelo.titulo}</h2>
          {duelo.categoria && (
            <span className="mt-2 inline-block rounded-full bg-secondary px-3 py-1 text-[11px] font-semibold text-muted-foreground">{duelo.categoria}</span>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-primary-light" />
            <div>
              <p className="text-[11px] text-muted-foreground">Prazo</p>
              <p className="text-sm font-semibold">{new Date(duelo.prazo).toLocaleDateString("pt-BR")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Wallet size={18} className="text-primary-light" />
            <div>
              <p className="text-[11px] text-muted-foreground">Em custódia (se você aceitar)</p>
              <p className="text-sm font-semibold">
                {Number(duelo.valor_custodia).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </div>
        </div>

        {jaRespondido ? (
          <p className="text-center text-sm text-muted-foreground">
            {duelo.status === "em_andamento" ? "Você já aceitou este duelo." : "Você já recusou este duelo."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => responder(true)} className="rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground">Aceitar</button>
            <button onClick={() => responder(false)} className="rounded-2xl border border-border py-3 text-sm font-bold text-muted-foreground">Recusar</button>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
