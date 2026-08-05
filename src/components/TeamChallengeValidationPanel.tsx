import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function TeamChallengeValidationPanel({ teamId, userId }: { teamId: string; userId: string }) {
  const qc = useQueryClient();

  const { data: permission } = useQuery({
    queryKey: ["team-validation-permission", teamId, userId],
    queryFn: async () => {
      const [{ data: team }, { data: member }] = await Promise.all([
        (supabase as any).from("equipes").select("criador_id").eq("id", teamId).maybeSingle(),
        (supabase as any).from("equipe_membros").select("papel").eq("equipe_id", teamId).eq("user_id", userId).maybeSingle(),
      ]);
      return team?.criador_id === userId || ["admin", "co_admin"].includes(member?.papel ?? "");
    },
  });

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["team-pending-validations", teamId],
    enabled: permission === true,
    queryFn: async () => {
      const { data: challenges } = await (supabase as any)
        .from("desafios_equipe")
        .select("id, titulo")
        .eq("equipe_id", teamId)
        .eq("tipo_validacao", "foto_arbitro")
        .eq("status", "ativo");
      const ids = (challenges ?? []).map((d: any) => d.id);
      if (!ids.length) return [];
      const { data: checkins, error } = await (supabase as any)
        .from("checkins_desafio_equipe")
        .select("id, desafio_id, user_id, mensagem, foto_url, created_at")
        .in("desafio_id", ids)
        .eq("validado", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((checkins ?? []).map((c: any) => c.user_id))];
      const { data: profiles } = userIds.length
        ? await (supabase as any).from("profiles").select("id, nome, avatar_url").in("id", userIds)
        : { data: [] };
      const byProfile = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const byChallenge = new Map((challenges ?? []).map((d: any) => [d.id, d]));
      return (checkins ?? []).map((c: any) => ({ ...c, profile: byProfile.get(c.user_id), challenge: byChallenge.get(c.desafio_id) }));
    },
  });

  async function review(checkin: any, approve: boolean) {
    if (checkin.user_id === userId) return toast.error("Você não pode validar a própria prova. Outro admin ou co-admin deve analisar.");
    const { error } = await (supabase as any).rpc("validar_checkin_arbitro", {
      _tipo_checkin: "desafio_equipe",
      _checkin_id: checkin.id,
      _aprovar: approve,
      _comentario: approve ? "Prova aprovada pela equipe." : "Prova questionada pela equipe.",
    });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Prova validada." : "Prova questionada.");
    qc.invalidateQueries({ queryKey: ["team-pending-validations", teamId] });
    qc.invalidateQueries({ queryKey: ["equipe-desafios", teamId] });
  }

  if (!permission || (!isLoading && pending.length === 0)) return null;

  return (
    <section className="mx-auto mb-5 max-w-md rounded-2xl border border-primary/35 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary-light" />
        <div>
          <h3 className="text-sm font-bold">Provas aguardando validação</h3>
          <p className="text-[11px] text-muted-foreground">Somente provas aprovadas contam para progresso, conclusão e prêmio.</p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-primary-light" /></div>
      ) : (
        <div className="space-y-3">
          {pending.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                {c.profile?.avatar_url
                  ? <img src={c.profile.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                  : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold">{(c.profile?.nome ?? "?")[0]}</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{c.profile?.nome ?? "Participante"}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{c.challenge?.titulo}</div>
                </div>
              </div>
              {c.mensagem && <p className="mt-2 text-xs">{c.mensagem}</p>}
              {c.foto_url && <img src={c.foto_url} className="mt-2 max-h-48 w-full rounded-xl object-cover" alt="Prova enviada" />}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => review(c, true)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-500/15 py-2 text-xs font-bold text-emerald-400"><CheckCircle2 size={14} /> Validar</button>
                <button onClick={() => review(c, false)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/10 py-2 text-xs font-bold text-destructive"><XCircle size={14} /> Questionar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
