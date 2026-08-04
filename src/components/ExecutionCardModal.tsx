import { useEffect, useState } from "react";
import { X, Loader2, Share2, Download, Image as ImageIcon, Layers3 } from "lucide-react";
import { toast } from "sonner";
import {
  renderExecutionCard,
  shareExecutionCard,
  type ExecutionCardData,
  type ExecutionCardMode,
  type ExecutionCardSize,
} from "@/lib/executionCard";
import { renderExecutionOverlay, shareExecutionOverlay } from "@/lib/executionOverlay";

interface Props {
  data: ExecutionCardData;
  onClose: () => void;
}

const SIZES: { id: ExecutionCardSize; label: string }[] = [
  { id: "story", label: "Story · 9:16" },
  { id: "feed", label: "Feed · 4:5" },
  { id: "post", label: "Post · 1:1" },
];

/**
 * Compartilhamento de execução em dois formatos:
 * - transparent: PNG sem fundo, para sobrepor em foto/vídeo no Instagram;
 * - premium: card completo VRENN, pronto para publicar sozinho.
 */
export function ExecutionCardModal({ data, onClose }: Props) {
  const [mode, setMode] = useState<ExecutionCardMode>("transparent");
  const [size, setSize] = useState<ExecutionCardSize>("story");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    let alive = true;
    let currentUrl: string | null = null;

    (async () => {
      setRendering(true);
      setPreviewUrl(null);
      try {
        const blob = mode === "transparent"
          ? await renderExecutionOverlay(data, size)
          : await renderExecutionCard(data, "premium", size);
        if (!alive) return;
        currentUrl = URL.createObjectURL(blob);
        setPreviewUrl(currentUrl);
      } catch (error: any) {
        toast.error("Erro ao gerar compartilhamento: " + (error?.message ?? "desconhecido"));
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
      if (mode === "transparent") {
        await shareExecutionOverlay(data, size);
      } else {
        await shareExecutionCard(data, "premium", size);
      }
      toast.success(mode === "transparent" ? "Overlay pronto para o seu Story!" : "Card pronto para compartilhar!");
    } catch (error: any) {
      toast.error("Erro ao compartilhar: " + (error?.message ?? "desconhecido"));
    }
  }

  function handleDownload() {
    if (!previewUrl) return;
    const anchor = document.createElement("a");
    anchor.href = previewUrl;
    anchor.download = mode === "transparent"
      ? `vrenn-overlay-${size}.png`
      : `vrenn-card-${size}.png`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl border-t border-primary/30 bg-card p-5 space-y-4 pb-8"
        style={{ maxHeight: "92dvh", overflowY: "auto" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/15 text-primary-light">
            <Share2 size={20} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold">Compartilhar execução</h3>
            <p className="text-xs text-muted-foreground">Sua atividade vira conteúdo e divulgação do VRENN</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("transparent")}
            className={`rounded-2xl border p-3 text-left transition-colors ${
              mode === "transparent"
                ? "border-primary bg-primary/15 text-primary-light"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            <ImageIcon size={18} className="mb-2" />
            <div className="text-xs font-bold">Story com minha foto</div>
            <div className="mt-1 text-[10px] leading-relaxed opacity-80">PNG transparente para colocar na frente de foto ou vídeo, como o mapa do Strava.</div>
          </button>
          <button
            type="button"
            onClick={() => setMode("premium")}
            className={`rounded-2xl border p-3 text-left transition-colors ${
              mode === "premium"
                ? "border-primary bg-primary/15 text-primary-light"
                : "border-border bg-background text-muted-foreground"
            }`}
          >
            <Layers3 size={18} className="mb-2" />
            <div className="text-xs font-bold">Story VRENN</div>
            <div className="mt-1 text-[10px] leading-relaxed opacity-80">Arte completa com fundo, pronta para publicar sem precisar de outra imagem.</div>
          </button>
        </div>

        <div
          className={`relative flex items-center justify-center rounded-2xl border border-border p-3 ${
            mode === "transparent"
              ? "bg-[linear-gradient(45deg,#222_25%,transparent_25%),linear-gradient(-45deg,#222_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#222_75%),linear-gradient(-45deg,transparent_75%,#222_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px]"
              : "bg-[#0A0A0F]"
          }`}
          style={{ minHeight: 340 }}
        >
          {rendering && <Loader2 size={28} className="animate-spin text-primary-light" />}
          {!rendering && previewUrl && (
            <img
              src={previewUrl}
              alt={mode === "transparent" ? "Preview do overlay transparente" : "Preview do card VRENN"}
              className="max-h-[58dvh] w-auto object-contain"
              style={{ filter: mode === "transparent" ? "drop-shadow(0 8px 16px rgba(0,0,0,.45))" : undefined }}
            />
          )}
        </div>

        {mode === "transparent" && (
          <div className="rounded-xl border border-primary/25 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            O quadriculado aparece apenas no preview para mostrar a transparência. O arquivo exportado não terá fundo.
          </div>
        )}

        <div>
          <span className="mb-2 block text-xs font-semibold text-muted-foreground">FORMATO</span>
          <div className="grid grid-cols-3 gap-2">
            {SIZES.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSize(item.id)}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition-colors ${
                  size === item.id
                    ? "border-primary bg-primary/15 text-primary-light"
                    : "border-border bg-background text-muted-foreground"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleDownload}
            disabled={!previewUrl || rendering}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 text-sm font-bold text-foreground disabled:opacity-50"
          >
            <Download size={16} /> Salvar PNG
          </button>
          <button
            onClick={handleShare}
            disabled={rendering}
            className="flex-[2] inline-flex items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Share2 size={16} /> {mode === "transparent" ? "Compartilhar overlay" : "Compartilhar card"}
          </button>
        </div>
      </div>
    </div>
  );
}
