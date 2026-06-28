import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { findUserForInvite } from "@/lib/arbitros.functions";
import { BottomNav } from "@/components/BottomNav";
import { toast } from "sonner";
import { ArrowLeft, Info, Swords, Trophy, Users, Loader2, X, Flame } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/duelos")({
  component: Duelos,
});

type Tab = "meus" | "disponiveis" | "historico";

function Duelos() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("meus");
  const [showCreate, setShowCreate] = useState(false);

  const { data: duelos } = useQuery({
    queryKey: ["duelos", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("duelos")
        .select("*, challenger:challenger_id(nome,username,avatar_url), opponent:opponent_id(nome,username,avatar_url)" as any)
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const ativos = (duelos ?? []).filter((d: any) => d.status === "em_andamento" || d.status === "pendente");
  const concluidos = (duelos ?? []).filter((d: any) => d.status === "concluido");
  const ativo = ativos[0];

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 pt-4 pb-2">
          <Link to="/feed" className="rounded-full p-2"><ArrowLeft size={20}/></Link>
          <h1 className="text-base font-bold">Duelos</h1>
          <button className="rounded-full p-2"><Info size={20}/></button>
        </div>
        <div className="mx-auto flex max-w-md px-5">
          {([["meus","Meus duelos"],["disponiveis","Disponíveis"],["historico","Histórico"]] as const).map(([k,l])=>{
            const a = tab===k;
            return <button key={k} onClick={()=>setTab(k)} className={`relative flex-1 py-3 text-sm font-semibold ${a?"text-primary-light":"text-muted-foreground"}`}>{l}{a&&<span className="absolute inset-x-6 -bottom-px h-0.5 rounded-full bg-primary"/>}</button>;
          })}
        </div>
        <div className="h-px bg-border" />
      </header>

      <div className="mx-auto max-w-md space-y-5 px-4 py-5">
        {tab === "meus" && (
          <>
            <section>
              <h2 className="mb-2 text-sm font-bold">Duelo ativo</h2>
              {ativo ? <DueloAtivoCard duelo={ativo} userId={user.id} /> : (
                <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  Nenhum duelo ativo. Desafie alguém abaixo.
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-bold">Duelos recentes</h2>
              <div className="space-y-2">
                {concluidos.length === 0 && <p className="text-xs text-muted-foreground">Sem duelos concluídos ainda.</p>}
                {concluidos.map((d: any) => <DueloHistoricoItem key={d.id} duelo={d} userId={user.id} />)}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold mb-1">Desafie alguém</h3>
              <p className="text-xs text-muted-foreground mb-3">Motivação em dobro, resultados reais.</p>
              <button onClick={() => setShowCreate(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow">
                <Users size={16}/> Convidar
              </button>
            </section>
          </>
        )}

        {tab === "historico" && (
          <div className="space-y-2">
            {concluidos.length === 0 && <p className="text-xs text-muted-foreground">Sem histórico.</p>}
            {concluidos.map((d: any) => <DueloHistoricoItem key={d.id} duelo={d} userId={user.id} />)}
          </div>
        )}

        {tab === "disponiveis" && (
          <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            Em breve: duelos abertos da comunidade.
          </div>
        )}
      </div>

      {showCreate && <CreateDueloModal userId={user.id} onClose={()=>setShowCreate(false)} onCreated={()=>{ qc.invalidateQueries({queryKey:["duelos",user.id]}); setShowCreate(false); }}/>}

      <BottomNav />
    </main>
  );
}

function DueloAtivoCard({ duelo, userId }: { duelo: any; userId: string }) {
  const isChallenger = duelo.challenger_id === userId;
  const me = isChallenger ? duelo.challenger : duelo.opponent;
  const rival = isChallenger ? duelo.opponent : duelo.challenger;
  const meuProgresso = isChallenger ? duelo.progresso_challenger : duelo.progresso_opponent;
  const rivalProgresso = isChallenger ? duelo.progresso_opponent : duelo.progresso_challenger;
  const dias = duelo.prazo ? Math.max(0, Math.ceil((new Date(duelo.prazo).getTime() - Date.now())/86400000)) : null;

  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <Avatar profile={me} ring />
        <div className="flex-1 text-center">
          <span className="inline-flex rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-light">{duelo.status==="pendente"?"Pendente":"Em andamento"}</span>
          <div className="mt-2 text-base font-bold">{duelo.titulo}</div>
          <div className="text-[10px] text-muted-foreground">Iniciado em {new Date(duelo.created_at).toLocaleDateString("pt-BR")}</div>
          <div className="mt-2 text-3xl font-extrabold text-primary">VS</div>
          {dias !== null && <div className="mt-1 text-xs text-muted-foreground">Termina em <span className="font-bold text-primary-light">{dias} dias</span></div>}
        </div>
        <Avatar profile={rival} ring />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <div><div className="font-bold text-primary-light">Você</div></div>
        <div className="text-muted-foreground">{duelo.aposta_creditos>0 && `${duelo.aposta_creditos} créditos em jogo`}</div>
        <div><div className="font-bold">{rival?.nome ?? "Rival"}</div></div>
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs"><span className="text-primary-light font-bold">{meuProgresso}%</span><span className="font-bold">{rivalProgresso}%</span></div>
        <div className="mt-1 relative h-2.5 rounded-full bg-[#2E2E50] overflow-hidden">
          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-primary-light" style={{ width: `${meuProgresso}%` }}/>
        </div>
      </div>
    </article>
  );
}

function DueloHistoricoItem({ duelo, userId }: { duelo: any; userId: string }) {
  const isWinner = duelo.winner_id === userId;
  const isChallenger = duelo.challenger_id === userId;
  const rival = isChallenger ? duelo.opponent : duelo.challenger;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Avatar profile={rival} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">Você vs {rival?.nome ?? "—"}</div>
        <div className="text-xs text-muted-foreground truncate">{duelo.titulo}</div>
        <div className="text-[10px] text-muted-foreground">Concluído em {new Date(duelo.created_at).toLocaleDateString("pt-BR")}</div>
      </div>
      <div className={`text-xs font-bold ${isWinner ? "text-accent" : "text-destructive"}`}>{isWinner?"Você venceu":"Você perdeu"}</div>
    </div>
  );
}

function Avatar({ profile, ring }: { profile: any; ring?: boolean }) {
  const initial = (profile?.nome ?? "?")[0]?.toUpperCase();
  const cls = `h-16 w-16 rounded-full ${ring?"ring-2 ring-primary":""} object-cover`;
  if (profile?.avatar_url) return <img src={profile.avatar_url} alt="" className={cls}/>;
  return <div className={`${cls} flex items-center justify-center bg-gradient-primary text-lg font-bold text-primary-foreground`}>{initial}</div>;
}

function CreateDueloModal({ userId, onClose, onCreated }: { userId: string; onClose: ()=>void; onCreated: ()=>void }) {
  const [titulo, setTitulo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [prazo, setPrazo] = useState("");
  const [aposta, setAposta] = useState("");
  const [oponente, setOponente] = useState("");
  const [loading, setLoading] = useState(false);
  const findUser = useServerFn(findUserForInvite);

  async function criar() {
    if (!titulo) return toast.error("Defina o título");
    setLoading(true);
    try {
      let opponentId: string | null = null;
      let opponentEmail: string | null = null;
      if (oponente.trim()) {
        try {
          const u: any = await findUser({ data: { identifier: oponente } });
          opponentId = u.id;
        } catch {
          if (oponente.includes("@")) opponentEmail = oponente;
          else throw new Error("Oponente não encontrado");
        }
      }
      const { data: duelo, error } = await supabase.from("duelos").insert({
        challenger_id: userId,
        opponent_id: opponentId,
        opponent_email: opponentEmail,
        titulo, categoria,
        prazo: prazo ? new Date(prazo).toISOString() : null,
        aposta_creditos: parseInt(aposta) || 0,
        status: opponentId ? "em_andamento" : "pendente",
      }).select().single();
      if (error) throw error;
      if (opponentId) {
        await supabase.from("notificacoes").insert({
          user_id: opponentId,
          tipo: "desafio_duelo",
          mensagem: `Você foi desafiado para um duelo: ${titulo}`,
          link_id: duelo.id,
        });
      }
      toast.success("Duelo criado!");
      onCreated();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e)=>e.stopPropagation()} className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold inline-flex items-center gap-2"><Swords size={18} className="text-primary-light"/> Novo duelo</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground"><X size={18}/></button>
        </div>
        <Input label="Título" value={titulo} onChange={setTitulo} placeholder="Ex: Perder 5kg em 30 dias"/>
        <Input label="Categoria" value={categoria} onChange={setCategoria} placeholder="fitness, estudos…"/>
        <Input label="Prazo" type="date" value={prazo} onChange={setPrazo}/>
        <Input label="Aposta em créditos" type="number" value={aposta} onChange={setAposta} placeholder="0"/>
        <Input label="Oponente (@username ou email)" value={oponente} onChange={setOponente} placeholder="@joao"/>
        <button onClick={criar} disabled={loading} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin"/>} <Flame size={14}/> Criar duelo
        </button>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type="text", placeholder }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      <input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"/>
    </label>
  );
}
