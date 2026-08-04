import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, BellRing, Clock3, Loader2, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lembrete-checkin")({
  component: LembreteCheckinPage,
});

const DEFAULT_TIME = "21:00";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";

function LembreteCheckinPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [enabled, setEnabled] = useState(true);
  const [time, setTime] = useState(DEFAULT_TIME);
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
    setTimezone(detected);

    supabase
      .from("profiles")
      .select("checkin_reminder_enabled, checkin_reminder_time, timezone")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Não foi possível carregar o lembrete.");
        if (data) {
          setEnabled(data.checkin_reminder_enabled ?? true);
          setTime((data.checkin_reminder_time ?? "21:00:00").slice(0, 5));
          setTimezone(data.timezone || detected);
        }
        setLoading(false);
      });
  }, [user.id]);

  async function salvar() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        checkin_reminder_enabled: enabled,
        checkin_reminder_time: `${time}:00`,
        timezone,
      })
      .eq("id", user.id);
    setSaving(false);

    if (error) return toast.error(error.message);
    toast.success("Lembrete de check-in atualizado.");
  }

  async function testarAgora() {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-checkin-reminders", {
        body: { mode: "self_test" },
      });
      if (error) throw error;

      const created = Number(data?.reminders_created ?? 0);
      const pushed = Number(data?.pushes_sent ?? 0);
      if (created === 0) {
        toast.info("Nenhum check-in pendente foi encontrado para testar agora.");
      } else if (pushed > 0) {
        toast.success("Teste enviado. Verifique as notificações do celular.");
      } else {
        toast.success("Notificação interna criada. Ative o push do navegador para receber no celular.");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Não foi possível executar o teste.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-12">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <button onClick={() => navigate({ to: "/configuracoes" })} className="rounded-full p-2 hover:bg-card" aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
          <h1 className="flex-1 text-center text-base font-bold">Lembrete de check-in</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-5 pt-5">
        <section className="rounded-3xl border border-primary/30 bg-card p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary-light">
              <BellRing size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold">Check-in pendente</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                O VRENN avisa quando você ainda possui uma meta, duelo ou desafio ativo sem check-in no dia.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEnabled((value) => !value)}
              disabled={loading}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-border"}`}
              aria-label={enabled ? "Desativar lembrete" : "Ativar lembrete"}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5">
          <label className="flex items-center gap-3">
            <Clock3 size={20} className="text-primary-light" />
            <div className="flex-1">
              <div className="text-sm font-bold">Horário do lembrete</div>
              <div className="text-xs text-muted-foreground">21h é o padrão recomendado.</div>
            </div>
            <input
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              disabled={!enabled || loading}
              className="rounded-xl border border-border bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary disabled:opacity-50"
            />
          </label>

          <div className="mt-4 flex items-start gap-3 rounded-2xl bg-background p-3">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-accent" />
            <div className="text-xs leading-relaxed text-muted-foreground">
              Fuso detectado: <span className="font-semibold text-foreground">{timezone}</span>. O lembrete respeita o horário local do aparelho e não é repetido no mesmo dia.
            </div>
          </div>
        </section>

        <button
          onClick={salvar}
          disabled={loading || saving}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-60"
        >
          {saving && <Loader2 size={16} className="animate-spin" />} Salvar configuração
        </button>

        <section className="rounded-3xl border border-dashed border-border bg-card p-5">
          <h2 className="text-sm font-bold">Teste controlado</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Procura agora um compromisso seu que esteja ativo e sem check-in hoje. O teste mantém a proteção contra notificações duplicadas.
          </p>
          <button
            onClick={testarAgora}
            disabled={testing || loading}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/50 bg-primary/10 py-3 text-sm font-bold text-primary-light disabled:opacity-60"
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar teste agora
          </button>
        </section>
      </div>
    </main>
  );
}
