import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, ChevronLeft, Copy, Info, QrCode } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet/deposit/pix")({
  component: DepositPix,
});

function DepositPix() {
  const { user } = Route.useRouteContext();
  const [amount, setAmount] = useState<string>("");
  const [cpf, setCpf] = useState("");
  const [cpfSalvo, setCpfSalvo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ pixCode: string; pixQrCodeImage: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("cpf").eq("id", user.id).maybeSingle();
      if (data?.cpf) { setCpf(data.cpf); setCpfSalvo(true); }
    })();
  }, [user.id]);

  function formatCpf(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 11);
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  async function generate() {
    const value = Number(amount.replace(",", "."));
    if (!value || value < 10) return toast.error("Valor mínimo: R$ 10,00");
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) return toast.error("Informe um CPF válido (11 dígitos)");
  setLoading(true);
    try {
      // 1. Salva CPF direto no banco pelo frontend
      await supabase.from("profiles").update({ cpf: cleanCpf }).eq("id", user.id);
      setCpfSalvo(true);

      const { data: session } = await supabase.auth.getSession();

      const token = session.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-pix-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount: value, cpf: cleanCpf }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao gerar PIX");
      setResult({ pixCode: data.pixCode, pixQrCodeImage: data.pixQrCodeImage });
      setCpfSalvo(true);
      toast.success("PIX gerado!");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-start gap-3 px-5 pt-6 pb-3">
        <Link to="/wallet" className="mt-1 rounded-full p-1 text-foreground/90"><ArrowLeft size={22} /></Link>
        <div>
          <h1 className="text-xl font-black tracking-wide">DEPÓSITO VIA PIX</h1>
          <p className="mt-1 text-xs text-muted-foreground">Faça um depósito rápido e seguro via PIX.</p>
        </div>
      </header>

      <div className="mx-auto max-w-md px-5 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold">CPF do titular</label>
          <input
            inputMode="numeric"
            value={formatCpf(cpf)}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="000.000.000-00"
            disabled={cpfSalvo}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-70"
          />
          <p className="mt-2 text-xs text-muted-foreground">Exigido pela Asaas para gerar cobranças PIX no seu nome.</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">Valor do depósito</label>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
            <span className="rounded-md bg-secondary px-2 py-1 text-sm text-muted-foreground">R$</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="flex-1 bg-transparent text-2xl font-bold text-primary-light outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Valor mínimo: <span className="font-semibold text-primary-light">R$ 10,00</span>
          </p>
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-base font-bold text-white shadow-glow disabled:opacity-60"
        >
          <QrCode size={20} /> {loading ? "Gerando…" : "Gerar PIX"}
        </button>

        <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Info size={16} className="text-primary-light" />
            <span className="text-sm font-semibold text-primary-light">Como funciona?</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            1. Gere o PIX  2. Pague no seu banco  3. Seu saldo será atualizado automaticamente em até 1 minuto.
          </p>
        </div>

        {result && (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <h3 className="text-sm font-bold">QR Code PIX</h3>
              <p className="mt-1 text-xs text-muted-foreground">Escaneie o QR Code abaixo com o app do seu banco.</p>
              <div className="mt-4 flex justify-center">
                <div className="rounded-2xl bg-white p-4">
                  <img
                    src={`data:image/png;base64,${result.pixQrCodeImage}`}
                    alt="QR Code PIX"
                    className="h-56 w-56"
                  />
                </div>
              </div>
              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold">Código PIX (Copia e Cola)</p>
                <div className="flex items-start gap-2">
                  <div className="flex-1 break-all rounded-xl bg-secondary p-3 text-[11px] text-muted-foreground font-mono">
                    {result.pixCode}
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(result.pixCode); toast.success("Código copiado"); }}
                    className="flex items-center gap-1 rounded-xl border border-primary/60 px-3 py-2 text-xs font-semibold text-primary-light"
                  >
                    <Copy size={14} /> Copiar código
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3">
              <Info size={18} className="mt-0.5 shrink-0 text-primary-light" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Após o pagamento, seu saldo será atualizado automaticamente em até 1 minuto.
              </p>
            </div>
          </>
        )}

        <Link
          to="/wallet"
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/60 py-3 text-sm font-semibold text-primary-light"
        >
          <ChevronLeft size={16} /> Voltar para a carteira
        </Link>
      </div>

      <BottomNav />
    </main>
  );
}
