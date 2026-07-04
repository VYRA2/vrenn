import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, Calendar, CheckCircle2, Clock, Copy, DollarSign, FileText, Info, Key, Sparkles, User, Wallet } from "lucide-react";

type SearchParams = { id?: string; amount?: number; pixKey?: string; pixKeyType?: string };

export const Route = createFileRoute("/_authenticated/wallet/withdraw/success")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    id: typeof s.id === "string" ? s.id : undefined,
    amount: typeof s.amount === "number" ? s.amount : typeof s.amount === "string" ? Number(s.amount) : undefined,
    pixKey: typeof s.pixKey === "string" ? s.pixKey : undefined,
    pixKeyType: typeof s.pixKeyType === "string" ? s.pixKeyType : undefined,
  }),
  component: Success,
});

function Success() {
  const { id, amount, pixKey, pixKeyType } = Route.useSearch();
  const now = new Date();
  const later = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const shortId = "#SAQ" + (id?.replace(/-/g, "").slice(0, 6).toUpperCase() ?? "000000");
  const fmt = (n?: number) => (n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dt = (d: Date) => `${d.toLocaleDateString("pt-BR")}  •  ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
  const typeLabel: Record<string, string> = { CPF: "CPF", EMAIL: "E-mail", PHONE: "Telefone", EVP: "Chave Aleatória" };

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-start gap-3 px-5 pt-6 pb-3">
        <Link to="/wallet" className="mt-1 rounded-full p-1"><ArrowLeft size={22} /></Link>
        <div className="text-center flex-1 -ml-9">
          <h1 className="text-lg font-black tracking-wide">SOLICITAÇÃO ENVIADA</h1>
          <p className="mt-1 text-xs text-muted-foreground">Sua solicitação de saque foi recebida com sucesso.</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 space-y-4">
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <Sparkles size={16} className="absolute left-0 top-2 text-accent" />
            <Sparkles size={14} className="absolute right-2 top-0 text-accent" />
            <Sparkles size={12} className="absolute bottom-2 left-3 text-accent" />
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-accent bg-accent/10">
              <CheckCircle2 size={44} className="text-accent" />
            </div>
          </div>
          <h2 className="mt-5 text-2xl font-bold">Solicitação recebida!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Seu saque será processado em até <span className="font-semibold text-primary-light">24 horas</span>.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Detalhes da solicitação</h3>
          <div className="mt-3 divide-y divide-dashed divide-border">
            <DetailRow icon={<FileText size={16} />} label="Número da solicitação"
              value={
                <button
                  onClick={() => { navigator.clipboard.writeText(shortId); toast.success("Número copiado"); }}
                  className="inline-flex items-center gap-1 font-semibold text-primary-light"
                >
                  {shortId} <Copy size={12} />
                </button>
              } />
            <DetailRow icon={<Calendar size={16} />} label="Data da solicitação" value={dt(now)} />
            <DetailRow icon={<DollarSign size={16} />} label="Valor solicitado" value={fmt(amount)} />
            <DetailRow icon={<Key size={16} />} label="Tipo de chave PIX" value={typeLabel[pixKeyType ?? ""] ?? "—"} />
            <DetailRow icon={<User size={16} />} label="Chave PIX" value={pixKey ?? "—"} />
            <DetailRow icon={<Clock size={16} />} label="Previsão de processamento" value={`Até ${dt(later)}`} />
          </div>
        </div>

        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Info size={16} className="text-primary-light" />
            <span className="text-sm font-semibold text-primary-light">Importante</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Assim que seu saque for processado, o valor será enviado para a chave PIX informada e você receberá uma notificação. O prazo máximo de processamento é de 24 horas úteis.
          </p>
        </div>

        <Link
          to="/wallet"
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-base font-bold text-white shadow-glow"
        >
          <Wallet size={18} /> Voltar para a carteira
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="flex items-center gap-2 text-primary-light">
        <span>{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-right text-sm">{value}</div>
    </div>
  );
}
