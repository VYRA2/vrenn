import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Gavel, Loader2, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function TeamChallengeValidationPanel({ teamId, userId }: { teamId: string; userId: string }) {
  const qc = useQueryClient();
  const key = ["team-arbitrations", teamId, userId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: challenges, error: challengeError } = await (supabase as any)
        .from("desafios_equipe").select("id,titulo,modo_arbitragem")
        .eq("equipe_id", teamId).eq("tipo_validacao", "foto_arbitro");
      if (challengeError) throw challengeError;
      const ids = (challenges ?? []).map((d: any) => d.id);
      if (!ids.length) return { cases: [], available: [] };

      const [{ data: cases, error: caseError }, { data: participations }, { data: evidence }, { data: panel }] = await Promise.all([
        (supabase as any).from("desafio_equipe_arbitragens").select("*").in("desafio_id", ids).order("created_at", { ascending: false }),
        (supabase as any).from("desafio_equipe_participantes").select("desafio_id").in("desafio_id", ids).eq("user_id", userId),
        (supabase as any).from("checkins_desafio_equipe").select("desafio_id").in("desafio_id", ids).eq("user_id", userId).not("foto_url", "is", null),
        (supabase as any).from("desafio_equipe_painel_recurso").select("arbitragem_id,voto").eq("arbitro_id", userId),
      ]);
      if (caseError) throw caseError;
      const titles = new Map((challenges ?? []).map((d: any) => [d.id, d]));
      const panelByCase = new Map((panel ?? []).map((p: any) => [p.arbitragem_id, p]));
      const visibleCases = (cases ?? []).map((a: any) => ({ ...a, challenge: titles.get(a.desafio_id), panel: panelByCase.get(a.id) }));
      const ownCaseIds = new Set(visibleCases.filter((a: any) => a.participante_id === userId).map((a: any) => a.desafio_id));
      const participationIds = new Set((participations ?? []).map((p: any) => p.desafio_id));
      const evidenceIds = new Set((evidence ?? []).map((e: any) => e.desafio_id));
      const available = (challenges ?? []).filter((d: any) => participationIds.has(d.id) && evidenceIds.has(d.id) && !ownCaseIds.has(d.id));
      return { cases: visibleCases, available };
    },
  });

  async function rpc(name: string, args: Record<string, unknown>, success: string) {
    const { error } = await (supabase as any).rpc(name, args);
    if (error) return toast.error(error.message);
    toast.success(success);
    await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ["equipe-desafios", teamId] });
  }

  async function decide(id: string, approved: boolean) {
    const reason = window.prompt(approved ? "Explique por que a comprovação foi aprovada:" : "Explique por que a comprovação foi recusada:");
    if (!reason) return;
    await rpc("vrenn_decidir_arbitragem_equipe", { _arbitragem_id: id, _aprovado: approved, _motivo: reason }, "Decisão registrada. O prazo de recurso começou.");
  }

  async function appeal(id: string) {
    const reason = window.prompt("Descreva o motivo do recurso (mínimo de 20 caracteres):");
    if (!reason) return;
    await rpc("vrenn_recorrer_arbitragem_equipe", { _arbitragem_id: id, _motivo: reason, _anexos: [] }, "Recurso enviado para um novo painel.");
  }

  async function vote(id: string, approved: boolean) {
    const reason = window.prompt("Justifique seu voto no recurso:");
    if (!reason) return;
    await rpc("vrenn_votar_recurso_equipe", { _arbitragem_id: id, _voto: approved, _justificativa: reason }, "Voto registrado.");
  }

  const cases = data?.cases ?? [];
  const available = data?.available ?? [];
  if (isLoading) return <div className="flex justify-center py-3"><Loader2 size={18} className="animate-spin text-primary-light" /></div>;
  if (!cases.length && !available.length) return null;

  return (
    <section className="mx-auto mb-5 max-w-md rounded-2xl border border-primary/35 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary-light" />
        <div><h3 className="text-sm font-bold">Arbitragem dos desafios</h3><p className="text-[11px] text-muted-foreground">Decisões justificadas, recurso e custódia protegida.</p></div>
      </div>

      {available.map((d: any) => (
        <div key={d.id} className="rounded-xl border border-border bg-background p-3">
          <div className="text-xs font-bold">{d.titulo}</div>
          <p className="mt-1 text-[11px] text-muted-foreground">Sua foto está pronta para análise.</p>
          <button onClick={() => rpc("vrenn_solicitar_arbitragem_equipe", { _desafio_id: d.id }, "Comprovação enviada ao árbitro.")} className="mt-2 w-full rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground">Enviar para arbitragem</button>
        </div>
      ))}

      {cases.map((a: any) => {
        const own = a.participante_id === userId;
        const originalArbiter = a.arbitro_original_id === userId;
        const canAppeal = own && a.status === "prazo_recurso" && new Date(a.recurso_ate).getTime() > Date.now();
        const canFinalize = own && a.status === "prazo_recurso" && new Date(a.recurso_ate).getTime() <= Date.now();
        const canVote = a.status === "em_recurso" && a.panel && a.panel.voto === null;
        return (
          <div key={a.id} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2"><Gavel size={15} className="text-primary-light" /><div className="text-xs font-bold">{a.challenge?.titulo ?? "Desafio"}</div></div>
            <div className="mt-1 text-[11px] text-muted-foreground">Status: {String(a.status).replaceAll("_", " ")}</div>
            {(originalArbiter || canVote) && Array.isArray(a.evidencia_snapshot) && (
              <div className="mt-2 grid grid-cols-3 gap-1">
                {a.evidencia_snapshot.filter((e: any) => e.foto_url).slice(0, 3).map((e: any) => <img key={e.id} src={e.foto_url} className="h-24 w-full rounded-lg object-cover" alt="Comprovação" />)}
              </div>
            )}
            {a.motivo_decisao && <p className="mt-2 rounded-lg bg-card p-2 text-xs">{a.motivo_decisao}</p>}
            {originalArbiter && a.status === "aguardando_decisao" && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => decide(a.id, true)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-500/15 py-2 text-xs font-bold text-emerald-400"><CheckCircle2 size={14}/> Aprovar</button>
                <button onClick={() => decide(a.id, false)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/10 py-2 text-xs font-bold text-destructive"><XCircle size={14}/> Recusar</button>
              </div>
            )}
            {canAppeal && <button onClick={() => appeal(a.id)} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border border-amber-500/40 py-2 text-xs font-bold text-amber-400"><RotateCcw size={14}/> Recorrer da decisão</button>}
            {canFinalize && <button onClick={() => rpc("vrenn_finalizar_arbitragem_equipe", { _arbitragem_id: a.id }, "Resultado finalizado e custódia processada.")} className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-primary py-2 text-xs font-bold text-primary-foreground"><Clock3 size={14}/> Finalizar após prazo</button>}
            {canVote && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => vote(a.id, true)} className="rounded-xl bg-emerald-500/15 py-2 text-xs font-bold text-emerald-400">Confirmar ganho</button>
                <button onClick={() => vote(a.id, false)} className="rounded-xl bg-destructive/10 py-2 text-xs font-bold text-destructive">Confirmar perda</button>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
