import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, ChevronDown, Check, CreditCard, Info, Key, Lock, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet/withdraw/")({
  component: Withdraw,
});

type PixType = "CPF" | "EMAIL" | "PHONE" | "EVP";

function Withdraw() {
  const navigate = useNavigate();
  const { user } = Route.useRouteContext();
  const [amount, setAmount] = useState("");
  const [pixType, setPixType] = useState<PixType | "">("");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: wallet } = useQuery({
    queryKey: ["wallet", user.id],
    queryFn: async () => (await supabase.from("wallets").select("*").eq("user_id", user.id).maybeSingle()).data ?? { balance: 0, locked_balance: 0 },
  });

  const fmt = (n: any) => Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function submit() {
    const value = Number(amount.replace(",", "."));
    if (!value || value < 10) return toast.error("Valor mínimo: R$ 10,00");
    if (!pixType) return toast.error("Selecione o tipo de chave PIX");
    if (!pixKey.trim()) return toast.error("Informe a chave PIX");

    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-withdrawal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: value, pixKey: pixKey.trim(), pixKeyType: pixType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao solicitar saque");

      navigate({
        to: "/wallet/withdraw/success",
        search: {
          id: data.requestId,
          amount: value,
          pixKey: pixKey.trim(),
          pixKeyType: pixType,
        } as any,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-start gap-3 px-5 pt-6 pb-3">
        <Link to="/wallet" className="mt-1 rounded-full p-1"><ArrowLeft size={22} /></Link>
        <div>
          <h1 className="text-xl font-black tracking-wide">SOLICITAR SAQUE</h1>
          <p className="mt-1 text-xs text-muted-foreground">Informe os dados para solicitar seu saque.</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div>
            <p className="text-xs text-muted-foreground">Saldo disponível</p>
            <p className="mt-1 text-2xl font-bold text-primary-light">{fmt(wallet?.balance)}</p>
          </div>
          <div className="h-10 w-px bg-border" />
          <div>
            <p className="text-xs text-muted-foreground">Em custódia</p>
            <p className="mt-1 text-2xl font-bold">{fmt(wallet?.locked_balance)}</p>
          </div>
          <CreditCard size={28} className="text-primary-light" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Valor do saque</label>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="rounded-md bg-secondary px-2 py-1 text-sm text-muted-foreground">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0,00"
              className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Valor mínimo: <span className="font-semibold text-primary-light">R$ 10,00</span></p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Tipo de chave PIX</label>
          <PixTypeSelect value={pixType} onChange={setPixType} />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Chave PIX</label>
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
            <CreditCard size={16} className="text-primary-light" />
            <input
              value={pixKey}
              onChange={e => setPixKey(e.target.value)}
              placeholder="Digite sua chave PIX"
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">A chave deve estar em seu nome.</p>
        </div>

        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Info size={16} className="text-primary-light" />
            <span className="text-sm font-semibold text-primary-light">Importante</span>
          </div>
          <ul className="ml-4 list-disc space-y-1 text-xs text-muted-foreground">
            <li>O saque será realizado exclusivamente via PIX.</li>
            <li>Certifique-se de que a chave PIX informada está correta.</li>
            <li>O processamento pode levar até 24 horas úteis.</li>
          </ul>
        </div>

        <button
          onClick={submit}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-base font-bold text-white shadow-glow disabled:opacity-60"
        >
          <Upload size={18} /> {loading ? "Enviando…" : "Solicitar saque"}
        </button>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock size={12} /> Seus dados são protegidos com criptografia.
        </p>
      </div>

      <BottomNav />
    </main>
  );
}
