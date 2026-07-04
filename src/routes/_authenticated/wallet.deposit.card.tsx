import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { ArrowLeft, CreditCard, Info, Lock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/wallet/deposit/card")({
  component: DepositCard,
});

function DepositCard() {
  const [amount, setAmount] = useState("0,00");
  const [card, setCard] = useState({ number: "", name: "", exp: "", cvv: "", brand: "" });
  const [holder, setHolder] = useState({ cpf: "", email: "", phone: "" });

  const value = Number(amount.replace(",", ".")) || 0;
  const fee = value > 0 ? Number((value * 0.049).toFixed(2)) : 0;
  const total = value + fee;
  const fmt = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto flex max-w-md items-start justify-between gap-3 px-5 pt-6 pb-3">
        <div className="flex items-start gap-3">
          <Link to="/wallet" className="mt-1 rounded-full p-1 text-foreground/90"><ArrowLeft size={22} /></Link>
          <div>
            <h1 className="text-xl font-black tracking-wide">DEPÓSITO VIA CARTÃO</h1>
            <p className="mt-1 text-xs text-muted-foreground">Preencha os dados do seu cartão para realizar o depósito.</p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full text-xs font-semibold text-primary-light">
          <ShieldCheck size={14} /> Transação segura
        </span>
      </header>

      <div className="mx-auto max-w-md px-5 space-y-5">
        {/* Value */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold">Valor do depósito</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-lg font-bold text-primary-light">R$</span>
                <input
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  inputMode="decimal"
                  className="w-32 bg-transparent text-3xl font-bold text-primary-light outline-none"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Valor mínimo: <span className="font-semibold text-primary-light">R$ 10,00</span>
              </p>
            </div>
            <button className="text-xs font-semibold text-primary-light">Alterar valor</button>
          </div>
        </div>

        {/* Card */}
        <section>
          <h3 className="mb-2 text-sm font-bold">Dados do cartão</h3>
          <div className="space-y-2">
            <LabeledInput label="Número do cartão" placeholder="0000 0000 0000 0000" value={card.number} onChange={v => setCard({ ...card, number: v })} rightIcon={<CreditCard size={16} />} />
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="Nome no cartão" placeholder="Como está no cartão" value={card.name} onChange={v => setCard({ ...card, name: v })} />
              <LabeledInput label="Validade" placeholder="MM/AA" value={card.exp} onChange={v => setCard({ ...card, exp: v })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="CVV" placeholder="123" value={card.cvv} onChange={v => setCard({ ...card, cvv: v })} />
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <label className="text-[11px] text-muted-foreground">Bandeira do cartão</label>
                <select
                  value={card.brand}
                  onChange={e => setCard({ ...card, brand: e.target.value })}
                  className="w-full bg-transparent text-sm outline-none"
                >
                  <option value="">Selecione</option>
                  <option>Visa</option><option>Mastercard</option><option>Elo</option><option>Amex</option><option>Hipercard</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2 text-xs font-bold text-muted-foreground opacity-80">
              <span>VISA</span><span>MC</span><span>ELO</span><span>AMEX</span><span>Hipercard</span>
            </div>
          </div>
        </section>

        {/* Holder */}
        <section>
          <h3 className="mb-2 text-sm font-bold">Dados do titular</h3>
          <div className="space-y-2">
            <LabeledInput label="CPF do titular" placeholder="000.000.000-00" value={holder.cpf} onChange={v => setHolder({ ...holder, cpf: v })} />
            <LabeledInput label="E-mail" placeholder="seu@email.com" value={holder.email} onChange={v => setHolder({ ...holder, email: v })} />
            <LabeledInput label="Telefone (opcional)" placeholder="(00) 00000-0000" value={holder.phone} onChange={v => setHolder({ ...holder, phone: v })} />
            <p className="text-xs text-muted-foreground">Usaremos para enviar o comprovante da transação.</p>
          </div>
        </section>

        {/* Summary */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold">Resumo do depósito</h3>
          <div className="mt-3 space-y-2 text-sm">
            <Row label="Valor" value={fmt(value)} />
            <Row label="Taxa de processamento" value={fmt(fee)} icon={<Info size={12} />} />
            <div className="my-2 border-t border-dashed border-border" />
            <Row label="Total a pagar" value={fmt(total)} strong />
          </div>
        </div>

        <button
          onClick={() => toast("Integração de cartão em breve")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-4 text-base font-bold text-white shadow-glow"
        >
          <Lock size={18} /> Pagar e finalizar depósito
        </button>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Lock size={12} /> Seus dados estão protegidos com criptografia de ponta a ponta.
        </p>
      </div>

      <BottomNav />
    </main>
  );
}

function LabeledInput({ label, placeholder, value, onChange, rightIcon }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; rightIcon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        {rightIcon && <span className="text-muted-foreground">{rightIcon}</span>}
      </div>
    </div>
  );
}
function Row({ label, value, icon, strong }: { label: string; value: string; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`inline-flex items-center gap-1 ${strong ? "font-bold" : "text-muted-foreground"}`}>{label} {icon}</span>
      <span className={strong ? "font-bold text-primary-light" : ""}>{value}</span>
    </div>
  );
}
