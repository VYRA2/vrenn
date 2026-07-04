import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import {
  HelpCircle, Wallet, Lock, Eye, EyeOff, ArrowRight, ArrowUp, ArrowDown,
  QrCode, CreditCard, Upload, Info, CheckCircle2, Clock, XCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet/")({
  component: WalletPage,
});

function fmt(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")}  •  ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
}

function WalletPage() {
  const { user } = Route.useRouteContext();
  const [hideBalance, setHideBalance] = useState(false);
  const [hideLocked, setHideLocked] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user.id],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle();
      return data ?? { balance: 0, locked_balance: 0 };
    },
  });

  const { data: transactions } = useQuery({
    queryKey: ["transactions", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-start justify-between px-5 pt-6 pb-3">
        <div>
          <h1 className="text-2xl font-black tracking-wide">CARTEIRA</h1>
          <p className="mt-1 text-xs text-muted-foreground">Gerencie seu saldo e acompanhe suas movimentações.</p>
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/60 text-primary-light">
          <HelpCircle size={18} />
        </button>
      </header>

      <div className="mx-auto max-w-md px-5">
        {/* Balance cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-primary p-4 shadow-glow">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-white/90">Saldo disponível</span>
              <Wallet size={20} className="text-white/80" />
            </div>
            <div className="mt-3 text-2xl font-bold text-white">
              {hideBalance ? "R$ ••••" : fmt(wallet?.balance)}
            </div>
            <button onClick={() => setHideBalance(v => !v)} className="mt-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white">
              {hideBalance ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium text-muted-foreground">Em custódia</span>
              <Lock size={18} className="text-muted-foreground" />
            </div>
            <div className="mt-3 text-2xl font-bold">
              {hideLocked ? "R$ ••••" : fmt(wallet?.locked_balance)}
            </div>
            <button onClick={() => setHideLocked(v => !v)} className="mt-2 flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-foreground/80">
              {hideLocked ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <ActionBtn to="/wallet/deposit/pix" icon={<QrCode size={18} />} label="Depositar via PIX" variant="primary" />
          <ActionBtn to="/wallet/deposit/card" icon={<CreditCard size={18} />} label="Depositar via Cartão" variant="soft" />
          <ActionBtn to="/wallet/withdraw" icon={<Upload size={18} />} label="Solicitar saque" variant="outline" />
        </div>

        {/* Transactions */}
        <div className="mt-6 flex items-center justify-between">
          <h2 className="text-base font-bold">Últimas movimentações</h2>
          <button className="flex items-center gap-1 text-xs font-semibold text-primary-light">
            Ver todas <ArrowRight size={12} />
          </button>
        </div>

        <div className="mt-3 space-y-2">
          {(transactions ?? []).length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Nenhuma movimentação ainda.
            </div>
          )}
          {(transactions ?? []).map((t) => <TxRow key={t.id} tx={t} />)}
        </div>

        <div className="mt-5 flex gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3">
          <Info size={18} className="mt-0.5 shrink-0 text-primary-light" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Depósitos via <span className="font-semibold text-primary-light">PIX</span> são aprovados em até 1 minuto.
            Depósitos via <span className="font-semibold text-primary-light">cartão</span> são aprovados em até 10 minutos.
          </p>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

function ActionBtn({ to, icon, label, variant }: { to: string; icon: React.ReactNode; label: string; variant: "primary" | "soft" | "outline" }) {
  const cls =
    variant === "primary"
      ? "bg-gradient-primary text-white shadow-glow"
      : variant === "soft"
      ? "bg-primary/20 text-white border border-primary/40"
      : "border border-primary/60 text-primary-light";
  return (
    <Link to={to} className={`flex flex-col items-start justify-between gap-3 rounded-2xl p-3 h-24 ${cls}`}>
      <div className="flex w-full items-center justify-between">
        {icon}
        <ArrowRight size={14} />
      </div>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </Link>
  );
}

function TxRow({ tx }: { tx: any }) {
  const isDeposit = tx.type === "deposit" || tx.type === "prize";
  const isWithdrawal = tx.type === "withdrawal";
  const isLock = tx.type === "lock";
  const title = isDeposit
    ? tx.type === "prize" ? "Prêmio recebido" : "Depósito via PIX"
    : isWithdrawal ? "Saque solicitado"
    : isLock ? "Em custódia"
    : tx.type === "unlock" ? "Liberação de custódia"
    : "Taxa";

  const color = isDeposit ? "text-accent border-accent/40 bg-accent/10"
    : isWithdrawal ? "text-destructive border-destructive/40 bg-destructive/10"
    : "text-amber-400 border-amber-400/40 bg-amber-400/10";

  const Icon = isDeposit ? ArrowDown : isWithdrawal ? ArrowUp : Lock;
  const amountSign = isDeposit ? "" : "- ";
  const amountClass = isDeposit ? "text-foreground" : "text-foreground";

  const StatusBadge = () => {
    const s = tx.status;
    const map: Record<string, { text: string; cls: string; Icon: React.ElementType }> = {
      confirmed: { text: "Confirmado", cls: "text-accent bg-accent/15", Icon: CheckCircle2 },
      pending: { text: "Pendente", cls: "text-amber-400 bg-amber-400/15", Icon: Clock },
      failed: { text: "Falhou", cls: "text-destructive bg-destructive/15", Icon: XCircle },
      cancelled: { text: "Cancelado", cls: "text-muted-foreground bg-secondary", Icon: XCircle },
    };
    const c = map[s] ?? map.pending;
    return <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold ${c.cls}`}>{c.text}</span>;
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${color}`}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{title}</div>
        {tx.description && <div className="text-[11px] text-muted-foreground truncate">{tx.description}</div>}
        <div className="text-[11px] text-muted-foreground">{fmtDateTime(tx.created_at)}</div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-bold ${amountClass}`}>{amountSign}{fmt(tx.amount)}</div>
        <div className="mt-1"><StatusBadge /></div>
      </div>
    </div>
  );
}
