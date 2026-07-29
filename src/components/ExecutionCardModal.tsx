import { useEffect, useState } from "react";
import { X, Loader2, Share2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  renderExecutionCard,
  shareExecutionCard,
  type ExecutionCardData,
  type ExecutionCardMode,
  type ExecutionCardSize,
} from "@/lib/executionCard";

interface Props {
  data: ExecutionCardData;
  onClose: () => void;
}

const SIZES: { id: ExecutionCardSize; label: string; ratio: string }[] = [
  { id: "story", label: "Story · 9:16", ratio: "9/16" },
  { id: "feed", label: "Feed · 4:5", ratio: "4/5" },
  { id: "post", label: "Post · 1:1", ratio: "1/1" },
];

/**
 * Cartão de Execução — modal de preview + share.
 * Reproduz o layout de referência da imagem anexada, em dois modos:
 * premium (fundo escuro + glow roxo) e transparent (sem fundo, para overlay).
 */
export function ExecutionCardModal({ data, onClose }: Props) {
  const [mode, setMode] = useState<ExecutionCardMode>("premium");
  const [size, setSize] = useState<ExecutionCardSize>("story");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    let alive = true;
    let currentUrl: string | null = null;
    (async () => {
      setRendering(true);
      try {
        const blob = await renderExecutionCard(data, mode, size);
        if (!alive) return;
        currentUrl = URL.createObjectURL(blob);
        setPreviewUrl(currentUrl);
      } catch (e: any) {
        toast.error("Erro ao gerar cartão: " + (e?.message ?? "desconhecido"));
      } finally {
        if (alive) setRendering(false);
      }
    })();
    return () => {
      alive = false;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [data, mode, size]);

  async function handleShare() {
    try {
      await shareExecutionCard(data, mode, size);
      toast.success("Cartão pronto para compartilhar!");
    } catch (e: any) {
      toast.error("Erro ao compartilhar: " + (e?.message ?? "desconhecido"));
    }
  }

  async function handleDownload() {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `vrenn-execucao-${size}-${mode}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-primary/30 bg-card p-5 space-y-4 pb-8"
        style={{ maxHeight: "92dvh", overflowY: "auto" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-lg">🏆</div>
          <div className="flex-1">
            <h3 className="text-base font-bold">Cartão de Execução</h3>
            <p className="text-xs text-muted-foreground">Compartilhe sua prova validada pelo VRENN</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background">
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div className="relative flex items-center justify-center rounded-2xl border border-border bg-[#0A0A0F] p-3" style={{ minHeight: 340 }}>
          {rendering && !previewUrl && <Loader2 size={28} className="animate-spin text-primary-light" />}
          {previewUrl && (
            <img
              src={previewUrl}
              alt="Preview do cartão"
              className="max-h-[60dvh] w-auto rounded-xl object-contain"
              style={{ boxShadow: "0 0 40px rgba(123,46,255,0.35)" }}
            />
          )}
        </div>

        {/* Mode toggle */}
        <div>
          <span className="mb-2 block text-xs font-semibold text-muted-foreground">MODO</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("premium")}
              className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                mode === "premium" ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-background text-muted-foreground"
              }`}
            >
              Premium (fundo escuro)
            </button>
            <button
              onClick={() => setMode("transparent")}
              className={`rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors ${
                mode === "transparent" ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-background text-muted-foreground"
              }`}
            >
              Transparente (overlay)
            </button>
          </div>
        </div>

        {/* Size */}
        <div>
          <span className="mb-2 block text-xs font-semibold text-muted-foreground">FORMATO</span>
          <div className="grid grid-cols-3 gap-2">
            {SIZES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSize(s.id)}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors ${
                  size === s.id ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-background text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <button
            onClick={handleDownload}
            disabled={!previewUrl}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-bold text-foreground disabled:opacity-50"
          >
            <Download size={16} /> Baixar
          </button>
          <button
            onClick={handleShare}
            disabled={rendering}
            className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Share2 size={16} /> Compartilhar cartão
          </button>
        </div>
      </div>
    </div>
  );
}
