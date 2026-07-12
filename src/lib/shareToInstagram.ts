import { toast } from "sonner";

interface ShareOpts {
  mediaUrl?: string | null;
  userName: string;
  legenda?: string | null;
  metaTitulo?: string | null;
  metaProgresso?: number | null;
  ranking?: number | null;
  valorGanho?: number | null;
}

const ROXO = "#7B2EFF";
const VERDE = "#00FF9D";
const BG = "#0A0A0A";
const CARD = "#111111";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawTextCentered(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.textAlign = "center";
  ctx.fillText(text, x, y);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

  // ==== Background base ====
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // ==== ZONA 1 — Topo (0 a 280) ====
  // Logo "V/ VRENN"
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 72px system-ui, -apple-system, sans-serif";
  const vSlash = "V/ ";
  const vrenn = "VRENN";
  ctx.fillStyle = "#FFFFFF";
  const wSlash = ctx.measureText(vSlash).width;
  const wVrenn = ctx.measureText(vrenn).width;
  const totalW = wSlash + wVrenn;
  const startX = (W - totalW) / 2;
  ctx.textAlign = "left";
  ctx.fillText(vSlash, startX, 140);
  ctx.fillStyle = ROXO;
  ctx.fillText(vrenn, startX + wSlash, 140);

  // Tagline
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  const tagline = "C O M P R O M I S S O   Q U E   V A L E   D I N H E I R O";
  ctx.fillText(tagline, W / 2, 200);

  // ==== ZONA 2 — Headline (280 a 520) ====
  ctx.textAlign = "left";
  ctx.font = "bold 96px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("EU CUMPRI.", 60, 380);
  ctx.fillStyle = ROXO;
  ctx.fillText("EU EVOLUÍ.", 60, 470);

  // Pill de valores
  ctx.font = "bold 20px system-ui, -apple-system, sans-serif";
  const pillText = "✓  DISCIPLINA  ·  FOCO  ·  CONSTÂNCIA  ·  RESULTADOS";
  const pillW = ctx.measureText(pillText).width + 60;
  const pillX = (W - pillW) / 2;
  ctx.fillStyle = "#1A1A1A";
  roundRect(ctx, pillX, 500, pillW, 56, 28);
  ctx.fill();
  ctx.strokeStyle = ROXO;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.fillText(pillText, W / 2, 537);

  // ==== ZONA 3 — Foto + card meta (600 a 1140) ====
  const cardX = 40, cardY = 600, cardW = W - 80, cardH = 540;
  ctx.save();
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.clip();

  if (opts.mediaUrl) {
    try {
      const img = await loadImage(opts.mediaUrl);
      const scale = Math.max(cardW / img.width, cardH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const dx = cardX + (cardW - drawW) / 2;
      const dy = cardY + (cardH - drawH) / 2;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    } catch {
      const g = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
      g.addColorStop(0, "#1A0A2E");
      g.addColorStop(1, BG);
      ctx.fillStyle = g;
      ctx.fillRect(cardX, cardY, cardW, cardH);
      ctx.fillStyle = ROXO;
      ctx.font = "bold 140px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏆", W / 2, cardY + cardH / 2 + 40);
    }
  } else {
    const g = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    g.addColorStop(0, "#1A0A2E");
    g.addColorStop(1, BG);
    ctx.fillStyle = g;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = ROXO;
    ctx.font = "bold 140px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🏆", W / 2, cardY + cardH / 2 + 40);
  }
  ctx.restore();

  // Borda roxa
  ctx.strokeStyle = ROXO;
  ctx.lineWidth = 3;
  roundRect(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.stroke();

  // Badge META CUMPRIDA
  ctx.fillStyle = ROXO;
  roundRect(ctx, cardX + 24, cardY + 24, 240, 52, 12);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("META CUMPRIDA", cardX + 24 + 120, cardY + 24 + 33);

  // Rodapé com meta
  if (opts.metaTitulo) {
    const barH = 80;
    ctx.fillStyle = "rgba(10,10,10,0.85)";
    ctx.fillRect(cardX, cardY + cardH - barH, cardW, barH);
    ctx.fillStyle = ROXO;
    ctx.font = "bold 18px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("◎ META:", cardX + 24, cardY + cardH - 48);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
    const tituloClip = opts.metaTitulo.length > 32 ? opts.metaTitulo.slice(0, 30) + "…" : opts.metaTitulo;
    ctx.fillText(tituloClip.toUpperCase(), cardX + 24, cardY + cardH - 20);

    // Badge concluído
    ctx.fillStyle = VERDE;
    roundRect(ctx, cardX + cardW - 200, cardY + cardH - 56, 176, 40, 20);
    ctx.fill();
    ctx.fillStyle = BG;
    ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✓ CONCLUÍDO", cardX + cardW - 200 + 88, cardY + cardH - 30);
  }

  // ==== ZONA 4 — Stats (1180 a 1400) ====
  const statsY = 1180, statsH = 200;
  ctx.fillStyle = CARD;
  roundRect(ctx, 40, statsY, W - 80, statsH, 20);
  ctx.fill();

  const stats = [
    { icon: "🏆", label: "POSIÇÃO", value: opts.ranking != null ? `${opts.ranking}° LUGAR` : "—", sub: "NO RANKING" },
    { icon: "$",  label: "VALOR GANHO", value: opts.valorGanho != null ? `R$ ${opts.valorGanho.toFixed(2).replace(".", ",")}` : "—", sub: "EM CRÉDITOS" },
    { icon: "🔥", label: "SEQUÊNCIA", value: opts.metaProgresso != null ? `${opts.metaProgresso} DIAS` : "—", sub: "DE DISCIPLINA" },
    { icon: "📈", label: "EVOLUÇÃO", value: "100%", sub: "FOCO TOTAL" },
  ];
  const colW = (W - 80) / 4;
  stats.forEach((s, i) => {
    const cx = 40 + colW * i + colW / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = ROXO;
    ctx.font = "32px system-ui, -apple-system, sans-serif";
    ctx.fillText(s.icon, cx, statsY + 50);
    ctx.fillStyle = "#888";
    ctx.font = "600 12px system-ui, -apple-system, sans-serif";
    ctx.fillText(s.label, cx, statsY + 78);
    ctx.fillStyle = VERDE;
    ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
    ctx.fillText(s.value, cx, statsY + 118);
    ctx.fillStyle = "#666";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.fillText(s.sub, cx, statsY + 148);
  });

  // ==== ZONA 5 — Copy + CTA (1420 a 1920) ====
  const zoneY = 1420;
  const gz = ctx.createLinearGradient(0, zoneY, 0, H);
  gz.addColorStop(0, BG);
  gz.addColorStop(1, "#1A0A2E");
  ctx.fillStyle = gz;
  ctx.fillRect(0, zoneY, W, H - zoneY);

  // Quote esquerda
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.fillText("Não é sobre motivação.", 60, zoneY + 60);
  ctx.fillStyle = VERDE;
  ctx.fillText("É sobre compromisso.", 60, zoneY + 96);

  // Separador
  ctx.strokeStyle = ROXO;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2, zoneY + 40);
  ctx.lineTo(W / 2, zoneY + 110);
  ctx.stroke();

  // Direita: nome do usuário
  ctx.fillStyle = "#DDD";
  ctx.font = "20px system-ui, -apple-system, sans-serif";
  ctx.fillText("Você prometeu.", W / 2 + 30, zoneY + 60);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
  const nomeClip = opts.userName.length > 18 ? opts.userName.slice(0, 16) + "…" : opts.userName;
  ctx.fillText(nomeClip, W / 2 + 30, zoneY + 96);

  // CTA box
  const ctaY = zoneY + 150;
  ctx.fillStyle = ROXO;
  roundRect(ctx, 60, ctaY, W - 120, 130, 20);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SUA MELHOR VERSÃO", W / 2, ctaY + 55);
  ctx.fillText("COMEÇA AGORA.", W / 2, ctaY + 100);

  // Sub
  ctx.fillStyle = "#AAA";
  ctx.font = "18px system-ui, -apple-system, sans-serif";
  const sub = "Crie metas, coloque dinheiro em jogo e mostre do que você é capaz.";
  const subLines = wrapText(ctx, sub, W - 160);
  subLines.forEach((ln, i) => ctx.fillText(ln, W / 2, ctaY + 175 + i * 26));

  // Pill vrenn.app + QR placeholder
  const pillY = ctaY + 250;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, 60, pillY, 300, 60, 30);
  ctx.fill();
  ctx.fillStyle = ROXO;
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("vrenn.app", 60 + 150, pillY + 40);

  ctx.fillStyle = VERDE;
  ctx.font = "bold 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("BAIXE AGORA", 380, pillY + 24);
  ctx.fillStyle = "#AAA";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.fillText("E MUDE SEUS RESULTADOS.", 380, pillY + 48);

  // QR placeholder
  ctx.strokeStyle = "#AAA";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(W - 180, pillY - 10, 120, 120);
  ctx.setLineDash([]);
  ctx.fillStyle = "#888";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("QR CODE", W - 120, pillY + 55);

  // Footer
  const footer = [
    { icon: "◈", label: "Metas com\ndinheiro em jogo" },
    { icon: "👥", label: "Comunidade que\nte impulsiona" },
    { icon: "📊", label: "Prove sua evolução\ntodos os dias" },
    { icon: "★", label: "Ganhe reputação\ne reconhecimento" },
  ];
  const footerY = H - 90;
  const fcolW = W / 4;
  footer.forEach((f, i) => {
    const cx = fcolW * i + fcolW / 2;
    ctx.fillStyle = ROXO;
    ctx.font = "20px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(f.icon, cx - 60, footerY + 10);
    ctx.fillStyle = "#CCC";
    ctx.font = "11px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    const [l1, l2] = f.label.split("\n");
    ctx.fillText(l1, cx - 40, footerY);
    ctx.fillText(l2, cx - 40, footerY + 16);
  });

  // Download
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) { toast.error("Falha ao gerar imagem"); return; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vrenn-story-${Date.now()}.jpg`;
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
