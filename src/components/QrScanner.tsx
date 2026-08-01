import { useEffect, useRef, useState } from "react";
import { QrCode, X, Loader2 } from "lucide-react";
import { validarQrToken } from "@/lib/qrcode-local";

interface QrScannerProps {
  /** Se informado, valida que o QR lido bate com esse token. */
  expectedToken?: string;
  /** Preferencial: valida o QR no servidor, sem expor o token ao cliente. */
  validateLocalId?: string | null;
  onValid: (rawValue: string) => void | Promise<void>;
  onCancel: () => void;
  title?: string;
  helper?: string;
}

export function QrScanner({ expectedToken, validateLocalId, onValid, onCancel, title = "Ler QR Code", helper }: QrScannerProps) {

  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const suportado = typeof window !== "undefined" && "BarcodeDetector" in window;

  useEffect(() => {
    if (!scanning || !suportado) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let ativo = true;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // @ts-ignore
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        const loop = async () => {
          if (!ativo || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const raw = codes[0].rawValue as string;
              const ok = validateLocalId
                ? await validarQrToken(validateLocalId, raw)
                : expectedToken
                  ? raw === expectedToken
                  : true;
              if (!ok) {
                setErro("Esse QR Code não pertence a este desafio.");
              } else {
                ativo = false;
                setBusy(true);
                try {
                  await onValid(raw);
                } catch (e: any) {
                  setErro(e?.message ?? "Erro ao registrar check-in");
                  setBusy(false);
                  ativo = true;
                }
                return;
              }
            }
          } catch {
            /* frame inválido */
          }

          raf = requestAnimationFrame(loop);
        };
        loop();
      } catch {
        setErro("Não foi possível acessar a câmera. Verifique as permissões.");
        setScanning(false);
      }
    }
    start();
    return () => {
      ativo = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, suportado, expectedToken, onValid]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold inline-flex items-center gap-2">
            <QrCode size={18} className="text-primary-light" /> {title}
          </h3>
          <button onClick={onCancel} className="rounded-full p-1.5 text-muted-foreground hover:bg-background">
            <X size={18} />
          </button>
        </div>
        {helper && <p className="text-xs text-muted-foreground">{helper}</p>}
        {!suportado ? (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            Seu navegador não suporta leitura de QR Code pela câmera. Tente pelo Chrome no Android.
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black aspect-square">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-2xl border-2 border-primary" />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 size={28} className="animate-spin text-primary-light" />
              </div>
            )}
          </div>
        )}
        {erro && <p className="text-xs text-destructive text-center">{erro}</p>}
        <button
          onClick={onCancel}
          className="w-full rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-muted-foreground"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
