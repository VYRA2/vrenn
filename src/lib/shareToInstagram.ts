import { toast } from "sonner";

interface ShareOpts {
  mediaUrl?: string | null;
  userName: string;
  legenda?: string | null;
  metaTitulo?: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = w;
    } else current = test;
  }
  if (current) lines.push(current);
  return lines;
}

export async function shareToInstagram(opts: ShareOpts) {
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = "#0A0A0A";
  ctx.fillRect(0, 0, W, H);

  // Header VRENN
  ctx.fillStyle = "#7B2EFF";
  ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("VRENN", W / 2, 180);

  // Media area
  const mediaTop = 260;
  const mediaSize = 1080;
  const mediaBottom = mediaTop + mediaSize;

  if (opts.mediaUrl) {
    try {
      const img = await loadImage(opts.mediaUrl);
      const scale = Math.max(mediaSize / img.width, mediaSize / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = (W - drawW) / 2;
      const dy = mediaTop + (mediaSize - drawH) / 2;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, mediaTop, W, mediaSize);
      ctx.clip();
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
    } catch {
      // gradient fallback
      const g = ctx.createLinearGradient(0, mediaTop, W, mediaBottom);
      g.addColorStop(0, "#2a0f3e");
      g.addColorStop(1, "#7B2EFF");
      ctx.fillStyle = g;
      ctx.fillRect(0, mediaTop, W, mediaSize);
    }
  } else {
    const g = ctx.createLinearGradient(0, mediaTop, W, mediaBottom);
    g.addColorStop(0, "#2a0f3e");
    g.addColorStop(1, "#7B2EFF");
    ctx.fillStyle = g;
    ctx.fillRect(0, mediaTop, W, mediaSize);
  }

  // User + legenda area
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 52px system-ui, -apple-system, sans-serif";
  ctx.fillText(opts.userName.slice(0, 32), 80, mediaBottom + 90);

  if (opts.legenda) {
    ctx.fillStyle = "#DDDDDD";
    ctx.font = "36px system-ui, -apple-system, sans-serif";
    const legenda = opts.legenda.slice(0, 120);
    const lines = wrapText(ctx, legenda, W - 160).slice(0, 3);
    lines.forEach((ln, i) => ctx.fillText(ln, 80, mediaBottom + 160 + i * 48));
  }

  if (opts.metaTitulo) {
    ctx.fillStyle = "#7B2EFF";
    ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
    ctx.fillText(`✓ ${opts.metaTitulo.slice(0, 40)}`, 80, H - 220);
  }

  // Footer
  ctx.textAlign = "center";
  ctx.fillStyle = "#888888";
  ctx.font = "32px system-ui, -apple-system, sans-serif";
  ctx.fillText("Participe em vrenn.app", W / 2, H - 100);

  // Download
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) { toast.error("Falha ao gerar imagem"); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vrenn-post-${Date.now()}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  toast.success("Imagem salva! Abra o Instagram e publique nos Stories.", {
    action: {
      label: "Abrir Instagram",
      onClick: () => { window.location.href = "instagram://"; },
    },
    duration: 8000,
  });
}
