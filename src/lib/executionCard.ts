import { decodePolyline } from "./polyline";

export interface ExecutionCardData {
  // Usuário VRENN
  userName: string;
  userHandle: string; // sem @
  avatarUrl?: string | null;
  nivel?: number | null;
  rep?: number | null;
  // Atividade Strava
  tipo: string; // "CORRIDA" | "CICLISMO" | ...
  subtitulo?: string; // "ATIVIDADE AO AR LIVRE"
  distanciaKm: number;
  tempoSeg: number;
  ritmoStr?: string; // "4'05\""
  calorias?: number | null;
  elevacaoM?: number | null;
  fcMedia?: number | null;
  polyline?: string | null; // encoded polyline
  data: Date;
  // VRENN
  repGanho?: number | null;
  metaConcluida?: boolean;
  qrCodeUrl?: string | null; // dataURL do QR
}

export type ExecutionCardMode = "premium" | "transparent";
export type ExecutionCardSize = "story" | "feed" | "post";

const ROXO = "#7B2EFF";
const ROXO_LIGHT = "#A56BFF";
const VERDE = "#00FF9D";
const BG = "#0F1117";
const CARD = "#171A24";

const SIZES: Record<ExecutionCardSize, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  post: { w: 1080, h: 1080 },
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

function fmtTempo(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtDist(km: number) {
  return km.toFixed(2).replace(".", ",");
}

function fmtDate(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function fmtDayHour(d: Date) {
  const dias = ["DOMINGO","SEGUNDA","TERÇA","QUARTA","QUINTA","SEXTA","SÁBADO"];
  return `${dias[d.getDay()]} • ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

async function drawQr(ctx: CanvasRenderingContext2D, url: string | null | undefined, x: number, y: number, size: number) {
  if (!url) {
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y, size, size, 12);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("QR", x + size/2, y + size/2 + 6);
    return;
  }
  try {
    const img = await loadImage(url);
    ctx.fillStyle = "#FFFFFF";
    roundRect(ctx, x, y, size, size, 12);
    ctx.fill();
    ctx.drawImage(img, x + 8, y + 8, size - 16, size - 16);
  } catch {}
}

/**
 * Renderiza o Cartão de Execução em um canvas.
 * Layout fiel à referência anexada — funciona em premium (fundo escuro + glow)
 * e transparent (sem background, para sobrepor em foto/story).
 */
export async function renderExecutionCard(
  data: ExecutionCardData,
  mode: ExecutionCardMode = "premium",
  size: ExecutionCardSize = "story",
): Promise<Blob> {
  const { w: W, h: H } = SIZES[size];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // ============ Card container ============
  const pad = 40;
  const cx0 = pad, cy0 = pad, cw = W - pad * 2, ch = H - pad * 2;

  if (mode === "premium") {
    // Fundo geral
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, W, H);
    // Glow externo
    const g = ctx.createRadialGradient(W/2, H*0.3, 100, W/2, H*0.5, W*0.9);
    g.addColorStop(0, "rgba(123,46,255,0.35)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Card
    ctx.fillStyle = BG;
    roundRect(ctx, cx0, cy0, cw, ch, 36);
    ctx.fill();
    // Borda roxa
    ctx.strokeStyle = ROXO;
    ctx.lineWidth = 3;
    ctx.shadowColor = ROXO;
    ctx.shadowBlur = 30;
    roundRect(ctx, cx0, cy0, cw, ch, 36);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else {
    // Transparente — sem background nem borda de fundo
    ctx.clearRect(0, 0, W, H);
  }

  // ============ Header ============
  const hx = cx0 + 40, hy = cy0 + 40;
  // Logo VRENN (esquerda)
  ctx.fillStyle = ROXO;
  ctx.font = "bold 44px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("V/", hx, hy + 48);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("VRENN", hx + 60, hy + 48);

  // Avatar center
  const avX = W / 2 - 60, avY = hy - 4;
  ctx.save();
  ctx.beginPath();
  ctx.arc(avX + 50, avY + 50, 50, 0, Math.PI * 2);
  ctx.strokeStyle = ROXO;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = CARD;
  ctx.fillRect(avX, avY, 100, 100);
  if (data.avatarUrl) {
    try {
      const img = await loadImage(data.avatarUrl);
      ctx.drawImage(img, avX, avY, 100, 100);
    } catch {}
  }
  ctx.restore();

  // @username + verified
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 28px system-ui";
  ctx.fillText(`@${data.userHandle}`, avX + 120, avY + 42);
  // Nível pill
  if (data.nivel != null) {
    const pillW = 140, pillH = 34;
    const px = avX + 120, py = avY + 58;
    ctx.strokeStyle = VERDE;
    ctx.lineWidth = 2;
    roundRect(ctx, px, py, pillW, pillH, 17);
    ctx.stroke();
    ctx.fillStyle = VERDE;
    ctx.font = "bold 16px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(`NÍVEL ${data.nivel}`, px + pillW/2, py + 23);
    // REP text
    if (data.rep != null) {
      ctx.fillStyle = ROXO_LIGHT;
      ctx.textAlign = "left";
      ctx.font = "bold 16px system-ui";
      ctx.fillText(`• ${data.rep.toLocaleString("pt-BR")} REP`, px + pillW + 14, py + 23);
    }
  }

  // ============ Bloco: tipo atividade + selo ============
  const zoneY = hy + 130;
  ctx.textAlign = "left";
  // Ícone corrida
  ctx.fillStyle = ROXO;
  ctx.font = "44px system-ui";
  ctx.fillText("🏃", hx, zoneY + 30);
  ctx.fillStyle = ROXO_LIGHT;
  ctx.font = "bold 30px system-ui";
  ctx.fillText(data.tipo.toUpperCase(), hx + 70, zoneY + 12);
  ctx.fillStyle = "#B8BCC8";
  ctx.font = "500 20px system-ui";
  ctx.fillText((data.subtitulo ?? "ATIVIDADE AO AR LIVRE").toUpperCase(), hx + 70, zoneY + 42);

  // Distância grande
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 180px system-ui";
  ctx.textAlign = "left";
  const distText = fmtDist(data.distanciaKm);
  ctx.fillText(distText, hx, zoneY + 210);
  const distW = ctx.measureText(distText).width;
  ctx.fillStyle = "#B8BCC8";
  ctx.font = "bold 40px system-ui";
  ctx.fillText("KM", hx + distW + 20, zoneY + 210);

  // Selo VALIDADO (direita)
  const selX = cx0 + cw - 220, selY = zoneY + 20;
  ctx.save();
  ctx.strokeStyle = VERDE;
  ctx.lineWidth = 5;
  ctx.shadowColor = VERDE;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(selX, selY + 100, 110, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(selX, selY + 100, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Texto circular "VALIDADO PELO"
  ctx.save();
  ctx.translate(selX, selY + 100);
  ctx.fillStyle = VERDE;
  ctx.font = "bold 15px system-ui";
  const top = "VALIDADO PELO";
  ctx.textAlign = "center";
  const chars = top.split("");
  const angleStep = Math.PI / (chars.length + 2);
  const startAng = -Math.PI/2 - (angleStep * chars.length) / 2;
  chars.forEach((c, i) => {
    const a = startAng + angleStep * i;
    ctx.save();
    ctx.rotate(a + Math.PI/2);
    ctx.translate(0, -80);
    ctx.rotate(-Math.PI/2 - a - Math.PI/2);
    ctx.fillText(c, 0, 0);
    ctx.restore();
  });
  // Bottom text VRENN
  const bottom = "VRENN";
  const bChars = bottom.split("");
  const bStep = Math.PI / (bChars.length + 3);
  const bStart = Math.PI/2 - (bStep * bChars.length) / 2;
  bChars.forEach((c, i) => {
    const a = bStart + bStep * i;
    ctx.save();
    ctx.rotate(a - Math.PI/2);
    ctx.translate(0, 80);
    ctx.rotate(Math.PI);
    ctx.fillText(c, 0, 0);
    ctx.restore();
  });
  ctx.restore();

  // Checkmark central
  ctx.strokeStyle = VERDE;
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(selX - 28, selY + 100);
  ctx.lineTo(selX - 6, selY + 122);
  ctx.lineTo(selX + 32, selY + 82);
  ctx.stroke();

  // "PROVA DE EXECUÇÃO"
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("PROVA DE EXECUÇÃO", selX, selY + 250);
  ctx.fillStyle = "#B8BCC8";
  ctx.font = "12px system-ui";
  ctx.fillText("DADOS VERIFICADOS VIA", selX, selY + 276);
  ctx.fillStyle = "#FC4C02";
  ctx.font = "bold 20px system-ui";
  ctx.fillText("STRAVA", selX, selY + 302);

  // ============ Mapa ============
  const mx = cx0 + 40, my = zoneY + 260, mw = cw - 80, mh = 460;
  ctx.save();
  roundRect(ctx, mx, my, mw, mh, 24);
  ctx.clip();
  // Fundo escuro do mapa
  const mg = ctx.createLinearGradient(mx, my, mx + mw, my + mh);
  mg.addColorStop(0, "#0B0D14");
  mg.addColorStop(1, "#131826");
  ctx.fillStyle = mg;
  ctx.fillRect(mx, my, mw, mh);
  // Grid sutil
  ctx.strokeStyle = "rgba(123,46,255,0.08)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < mw; gx += 60) {
    ctx.beginPath(); ctx.moveTo(mx + gx, my); ctx.lineTo(mx + gx, my + mh); ctx.stroke();
  }
  for (let gy = 0; gy < mh; gy += 60) {
    ctx.beginPath(); ctx.moveTo(mx, my + gy); ctx.lineTo(mx + mw, my + gy); ctx.stroke();
  }

  // Rota
  const coords = data.polyline ? decodePolyline(data.polyline) : [];
  if (coords.length > 1) {
    const lats = coords.map(c => c[0]);
    const lngs = coords.map(c => c[1]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const padM = 40;
    const spanLat = (maxLat - minLat) || 1;
    const spanLng = (maxLng - minLng) || 1;
    const scale = Math.min((mw - padM*2) / spanLng, (mh - padM*2) / spanLat);
    const offX = mx + (mw - spanLng * scale) / 2;
    const offY = my + (mh - spanLat * scale) / 2;
    const pts = coords.map(([la, ln]) => [offX + (ln - minLng) * scale, offY + (maxLat - la) * scale] as [number, number]);
    // Glow
    ctx.strokeStyle = ROXO;
    ctx.lineWidth = 14;
    ctx.shadowColor = ROXO;
    ctx.shadowBlur = 30;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
    ctx.stroke();
    // Core
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#B47AFF";
    ctx.lineWidth = 6;
    ctx.stroke();
    // Start (verde)
    ctx.fillStyle = VERDE;
    ctx.shadowColor = VERDE; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 14, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    // End (bandeirinha)
    const ep = pts[pts.length - 1];
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.arc(ep[0], ep[1], 18, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("🏁", ep[0], ep[1] + 7);
  } else {
    ctx.fillStyle = "#666";
    ctx.font = "18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Rota não disponível", mx + mw/2, my + mh/2);
  }
  ctx.restore();
  // Borda mapa
  ctx.strokeStyle = "rgba(123,46,255,0.4)";
  ctx.lineWidth = 2;
  roundRect(ctx, mx, my, mw, mh, 24);
  ctx.stroke();

  // ============ Stats ============
  const sy = my + mh + 40;
  const stats = [
    { icon: "⏱", label: "TEMPO", value: fmtTempo(data.tempoSeg), sub: "" },
    { icon: "◎", label: "RITMO MÉDIO", value: data.ritmoStr ?? "—", sub: "/KM" },
    { icon: "🔥", label: "CALORIAS", value: data.calorias != null ? String(data.calorias) : "—", sub: "KCAL" },
    { icon: "⛰", label: "GANHO DE ELEVAÇÃO", value: data.elevacaoM != null ? String(data.elevacaoM) : "—", sub: "M" },
    { icon: "♥", label: "FC MÉDIA", value: data.fcMedia != null ? String(data.fcMedia) : "—", sub: "BPM" },
  ];
  const colW = (cw - 80) / stats.length;
  stats.forEach((s, i) => {
    const scx = cx0 + 40 + colW * i + colW/2;
    ctx.fillStyle = ROXO_LIGHT;
    ctx.font = "22px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(s.icon, scx, sy + 20);
    ctx.fillStyle = "#B8BCC8";
    ctx.font = "500 12px system-ui";
    ctx.fillText(s.label, scx, sy + 48);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 36px system-ui";
    ctx.fillText(s.value, scx, sy + 90);
    if (s.sub) {
      ctx.fillStyle = "#666";
      ctx.font = "12px system-ui";
      ctx.fillText(s.sub, scx, sy + 110);
    }
  });

  // ============ Card inferior: REP + quote ============
  const bx = cx0 + 40, by = sy + 150, bw = cw - 80, bh = 200;
  ctx.strokeStyle = "rgba(123,46,255,0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, bx, by, bw, bh, 24);
  ctx.stroke();

  // Hexágono REP
  const hexCx = bx + 100, hexCy = by + bh/2;
  ctx.save();
  ctx.translate(hexCx, hexCy);
  ctx.strokeStyle = ROXO;
  ctx.lineWidth = 3;
  ctx.shadowColor = ROXO; ctx.shadowBlur = 15;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI/3 * i - Math.PI/2;
    const px = Math.cos(a) * 55, py = Math.sin(a) * 55;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = ROXO;
  ctx.font = "bold 32px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("V/", 0, 12);
  ctx.restore();

  // +REP
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 44px system-ui";
  ctx.textAlign = "left";
  const repText = `+${data.repGanho ?? 250}`;
  ctx.fillText(repText, bx + 180, by + 70);
  const repW = ctx.measureText(repText).width;
  ctx.fillStyle = ROXO_LIGHT;
  ctx.font = "bold 24px system-ui";
  ctx.fillText("REP", bx + 180 + repW + 10, by + 70);
  ctx.fillStyle = "#B8BCC8";
  ctx.font = "500 14px system-ui";
  ctx.fillText("REPUTAÇÃO CONQUISTADA", bx + 180, by + 95);

  if (data.metaConcluida) {
    ctx.fillStyle = "rgba(123,46,255,0.25)";
    roundRect(ctx, bx + 180, by + 115, 200, 34, 17);
    ctx.fill();
    ctx.fillStyle = ROXO_LIGHT;
    ctx.font = "bold 14px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("✓ META CONCLUÍDA", bx + 280, by + 137);
  }

  // Quote direita
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "italic 24px system-ui";
  ctx.textAlign = "left";
  ctx.fillText('"DISCIPLINA HOJE,', bx + bw/2 + 40, by + 80);
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("RESULTADO ", bx + bw/2 + 40, by + 115);
  const rw = ctx.measureText("RESULTADO ").width;
  ctx.fillStyle = VERDE;
  ctx.fillText('SEMPRE."', bx + bw/2 + 40 + rw, by + 115);

  // ============ Footer ============
  const fy = by + bh + 40;
  // Data
  ctx.fillStyle = ROXO_LIGHT;
  ctx.font = "22px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("📅", bx, fy + 20);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px system-ui";
  ctx.fillText(fmtDate(data.data), bx + 34, fy + 12);
  ctx.fillStyle = "#B8BCC8";
  ctx.font = "12px system-ui";
  ctx.fillText(fmtDayHour(data.data), bx + 34, fy + 32);

  // Hashtags centro
  ctx.fillStyle = ROXO_LIGHT;
  ctx.font = "bold 16px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("COMPARTILHE SUA EVOLUÇÃO", cx0 + cw/2 - 60, fy + 12);
  ctx.fillStyle = "#B8BCC8";
  ctx.font = "12px system-ui";
  ctx.fillText("#VRENN #PROVADEEXECUÇÃO", cx0 + cw/2 - 60, fy + 32);

  // Perfil + QR direita
  ctx.fillStyle = "#B8BCC8";
  ctx.font = "12px system-ui";
  ctx.textAlign = "right";
  ctx.fillText("VEJA MAIS NO PERFIL", cx0 + cw - 140, fy + 12);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 14px system-ui";
  ctx.fillText(`VRENN.APP/${data.userHandle.toUpperCase()}`, cx0 + cw - 140, fy + 32);
  await drawQr(ctx, data.qrCodeUrl, cx0 + cw - 120, fy - 10, 110);

  // ============ Export ============
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("toBlob null")), "image/png");
  });
  return blob;
}

export async function shareExecutionCard(data: ExecutionCardData, mode: ExecutionCardMode, size: ExecutionCardSize = "story") {
  const blob = await renderExecutionCard(data, mode, size);
  const file = new File([blob], `vrenn-execucao-${Date.now()}.png`, { type: "image/png" });
  // Tenta Web Share nativa
  const nav: any = navigator;
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "VRENN — Prova de Execução", text: "Validado pelo VRENN 💜" });
      return;
    } catch {}
  }
  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
