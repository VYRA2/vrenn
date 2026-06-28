import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { Award, Edit3, LogOut, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

function Perfil() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  const { data: metas } = useQuery({
    queryKey: ["my-metas", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("metas").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const concluidas = (metas ?? []).filter(m => m.status === "concluida").length;
  const falhadas = (metas ?? []).filter(m => m.status === "falhada").length;
  const ativa = (metas ?? []).find(m => m.status === "em_andamento");
  const initial = (profile?.nome ?? "?")[0]?.toUpperCase();

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <div className="relative">
        <div className="h-32 bg-gradient-primary" />
        <div className="absolute right-4 top-4 flex gap-2">
          <button className="rounded-full bg-card/80 p-2 backdrop-blur"><Settings size={18} /></button>
          <button onClick={logout} className="rounded-full bg-card/80 p-2 backdrop-blur"><LogOut size={18} /></button>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 -mt-12">
        <div className="flex items-end gap-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-background bg-gradient-primary text-3xl font-bold">
            {initial}
          </div>
          <div className="pb-2 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{profile?.nome ?? "—"}</h1>
              <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary-light">NÍVEL {profile?.nivel ?? 1}</span>
            </div>
            <p className="text-sm text-muted-foreground">@{profile?.username ?? "—"}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-border bg-card p-3">
          <Stat label="Concluídas" value={concluidas} />
          <Stat label="Falhadas" value={falhadas} />
          <Stat label="Disciplina" value={`${calcDisciplina(concluidas, falhadas)}%`} />
          <Stat label="Reputação" value={profile?.reputacao_pts ?? 0} />
        </div>

        <section className="mt-5 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">Sua missão</h2>
            <button className="text-muted-foreground hover:text-foreground"><Edit3 size={14} /></button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{profile?.bio ?? "Adicione uma bio para mostrar sua missão ao mundo."}</p>
        </section>

        <section className="mt-5">
          <h2 className="mb-3 text-sm font-bold">Conquistas</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {["Primeira meta", "7 dias", "Streak 30", "Validado", "Mentor"].map((b, i) => (
              <Badge key={b} label={b} unlocked={i < 1} />
            ))}
          </div>
        </section>

        {ativa && (
          <section className="mt-5 rounded-2xl border border-border bg-card p-4">
            <h2 className="text-sm font-bold">Meta em andamento</h2>
            <p className="mt-1 text-base font-semibold">{ativa.titulo}</p>
            <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-gradient-primary" style={{ width: `${ativa.progresso}%` }} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{ativa.progresso}% completo</p>
          </section>
        )}

        <section className="mt-5 mb-8 rounded-2xl border border-border bg-card p-4">
          <h2 className="text-sm font-bold">Atividade</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Mini label="Streak" value={`${profile?.streak_dias ?? 0}d`} />
            <Mini label="Créditos" value={profile?.creditos ?? 0} />
            <Mini label="Metas" value={metas?.length ?? 0} />
          </div>
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center">
      <div className="text-lg font-bold text-primary-light">{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-secondary p-3">
      <div className="text-base font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Badge({ label, unlocked }: { label: string; unlocked: boolean }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5 w-20">
      <div className={`relative flex h-16 w-14 items-center justify-center ${unlocked ? "text-accent" : "text-muted-foreground opacity-40"}`} style={{ clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)", background: unlocked ? "var(--gradient-primary)" : "var(--color-card)" }}>
        <Award size={24} className="text-primary-foreground" />
      </div>
      <span className="text-[10px] text-center text-muted-foreground">{label}</span>
    </div>
  );
}

function calcDisciplina(c: number, f: number) {
  const total = c + f;
  if (!total) return 0;
  return Math.round((c / total) * 100);
}
