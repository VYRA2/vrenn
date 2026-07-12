import { useState } from "react";
import { Download, Share2, Loader2 } from "lucide-react";

interface QrCodeExportCardProps {
  nome: string;
  token: string;
}

export function QrCodeExportCard({ nome, token }: QrCodeExportCardProps) {
  const [busy, setBusy] = useState<"baixar" | "compartilhar" | null>(null);
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(token)}`;
  const arquivo = `qrcode-${nome.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;

  async function baixarImagem(): Promise<Blob> {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error("Não foi possível gerar a imagem do QR Code.");
    return resp.blob();
  }

  async function baixar() {
    setBusy("baixar");
    try {
      const blob = await baixarImagem();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = arquivo;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank");
    } finally {
      setBusy(null);
    }
  }

  async function compartilhar() {
    setBusy("compartilhar");
    try {
      const blob = await baixarImagem();
      const file = new File([blob], arquivo, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `QR Code — ${nome}`, text: `QR Code de check-in para ${nome}` });
      } else if (navigator.share) {
        await navigator.share({ title: `QR Code — ${nome}`, url });
      } else {
        window.open(url, "_blank");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") window.open(url, "_blank");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center space-y-3">
      <p className="text-xs text-muted-foreground">
        Imprima este QR Code e cole em{" "}
        <span className="font-semibold text-foreground">{nome}</span>. Ele será escaneado a cada check-in.
      </p>
      <div className="mx-auto flex h-44 w-44 items-center justify-center rounded-xl bg-white p-2">
        <img
          src={url.replace("512x512", "200x200")}
          alt={`QR Code de ${nome}`}
          className="h-full w-full"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={baixar}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-background py-2.5 text-xs font-semibold text-primary-light disabled:opacity-60"
        >
          {busy === "baixar" ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Baixar
        </button>
        <button
          type="button"
          onClick={compartilhar}
          disabled={busy !== null}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-primary py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy === "compartilhar" ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />} Compartilhar
        </button>
      </div>
    </div>
  );
}
