import vrennIcon from "@/assets/vrenn-icon.png.asset.json";
import { decodePolyline } from "./polyline";
import type { ExecutionCardData, ExecutionCardSize } from "./executionCard";

const PURPLE = "#8B3DFF";
const PURPLE_LIGHT = "#C3A0FF";
const GREEN = "#19F5A5";
const WHITE = "#FFFFFF";

const SIZES: Record<ExecutionCardSize, { w: number; h: number }> = {
  story: { w: 1080, h: 1920 },
  feed: { w: 1080, h: 1350 },
  post: { w: 1080, h: 1080 },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function shadowText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.9)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function formatDistance(km: number) {
  return km.toFixed(2).replace(".", ",");
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatDate(date: Date) {
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

async function drawOfficialLogo(ctx: CanvasRenderingContext2D, x: number, y: number, iconSize: number) {
  try {
    const logo = await loadImage(vrennIcon.url);
    ctx.save();
    ctx.shadowColor = PURPLE;
    ctx.shadowBlur = 22;
    ctx.drawImage(logo, x, y, iconSize, iconSize);
    ctx.restore();
  } catch {
    // O wordmark continua identificando a marca caso o asset não carregue.
  }

  ctx.fillStyle = WHITE;
  ctx.font = `300 ${Math.round(iconSize * 0.48)}px Inter, system-ui, sans-serif`;
  ctx.letterSpacing = `${Math.round(iconSize * 0.09)}px`;
  ctx.textAlign = "left";
  shadowText(ctx, "VRENN", x + iconSize + 16, y + iconSize * 0.66);
  ctx.letterSpacing = "0px";
}

function routePoints(data: ExecutionCardData, x: number, y: number, width: number, height: number) {
  const coordinates = data.polyline ? decodePolyline(data.polyline) : [];
  if (coordinates.length < 2) return [] as [number, number][];

  const latitudes = coordinates.map(([lat]) => lat);
  const longitudes = coordinates.map(([, lng]) => lng);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latSpan = maxLat - minLat || 1;
  const lngSpan = maxLng - minLng || 1;
  const padding = 54;
  const scale = Math.min((width - padding * 2) / lngSpan, (height - padding * 2) / latSpan);
  const offsetX = x + (width - lngSpan * scale) / 2;
  const offsetY = y + (height - latSpan * scale) / 2;

  return coordinates.map(([lat, lng]) => [
    offsetX + (lng - minLng) * scale,
    offsetY + (maxLat - lat) * scale,
  ] as [number, number]);
}

function drawRoute(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth = 22;
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur = 32;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#D5BCFF";
  ctx.lineWidth = 7;
  ctx.stroke();

  const start = points[0];
  const end = points[points.length - 1];
  ctx.fillStyle = GREEN;
  ctx.shadowColor = GREEN;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(start[0], start[1], 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(end[0], end[1], 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111318";
  ctx.font = "bold 20px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("🏁", end[0], end[1] + 7);
  ctx.restore();
}

async function drawProfile(ctx: CanvasRenderingContext2D, data: ExecutionCardData, x: number, y: number) {
  const avatarSize = 72;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(12,14,22,.82)";
  ctx.fillRect(x, y, avatarSize, avatarSize);
  if (data.avatarUrl) {
    try {
      const avatar = await loadImage(data.avatarUrl);
      ctx.drawImage(avatar, x, y, avatarSize, avatarSize);
    } catch {
      // Mantém o placeholder, nunca inventa uma foto.
    }
  }
  ctx.restore();
  ctx.strokeStyle = PURPLE_LIGHT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.fillStyle = WHITE;
  ctx.font = "700 25px Inter, system-ui, sans-serif";
  shadowText(ctx, `@${data.userHandle}`, x + avatarSize + 16, y + 31);
  ctx.fillStyle = PURPLE_LIGHT;
  ctx.font = "700 16px Inter, system-ui, sans-serif";
  const level = data.nivel != null ? `NÍVEL ${data.nivel}` : "ATLETA VRENN";
  shadowText(ctx, level, x + avatarSize + 16, y + 58);
}

function drawVerifiedPill(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const width = 210;
  const height = 44;
  ctx.fillStyle = "rgba(5,18,15,.62)";
  roundedRect(ctx, x, y, width, height, 22);
  ctx.fill();
  ctx.strokeStyle = "rgba(25,245,165,.88)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = GREEN;
  ctx.font = "700 15px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("✓ STRAVA VERIFICADO", x + width / 2, y + 28);
}

/** PNG transparente para sobrepor diretamente em foto ou vídeo no Story. */
export async function renderExecutionOverlay(
  data: ExecutionCardData,
  size: ExecutionCardSize = "story",
): Promise<Blob> {
  const { w, h } = SIZES[size];
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.clearRect(0, 0, w, h);

  const side = Math.round(w * 0.075);
  const top = Math.round(h * 0.07);
  await drawOfficialLogo(ctx, side, top, 72);
  await drawProfile(ctx, data, w - side - 330, top + 2);

  const titleY = Math.round(h * 0.22);
  ctx.textAlign = "left";
  ctx.fillStyle = PURPLE_LIGHT;
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  shadowText(ctx, data.tipo.toUpperCase(), side, titleY);
  ctx.fillStyle = WHITE;
  ctx.font = `900 ${size === "story" ? 154 : 122}px Inter, system-ui, sans-serif`;
  shadowText(ctx, formatDistance(data.distanciaKm), side, titleY + 145);
  const distanceWidth = ctx.measureText(formatDistance(data.distanciaKm)).width;
  ctx.fillStyle = PURPLE_LIGHT;
  ctx.font = "800 36px Inter, system-ui, sans-serif";
  shadowText(ctx, "KM", side + distanceWidth + 18, titleY + 145);

  drawVerifiedPill(ctx, w - side - 210, titleY + 76);

  const routeY = Math.round(h * 0.39);
  const routeH = Math.round(h * (size === "story" ? 0.33 : 0.29));
  const points = routePoints(data, side, routeY, w - side * 2, routeH);
  drawRoute(ctx, points);

  const statsY = routeY + routeH + 74;
  const stats = [
    ["TEMPO", formatTime(data.tempoSeg)],
    ["RITMO", data.ritmoStr ? `${data.ritmoStr}/km` : "—"],
    ["ELEVAÇÃO", data.elevacaoM != null ? `${data.elevacaoM} m` : "—"],
  ];
  stats.forEach(([label, value], index) => {
    const x = side + index * ((w - side * 2) / 3);
    ctx.textAlign = index === 2 ? "right" : index === 1 ? "center" : "left";
    const anchor = index === 2 ? w - side : index === 1 ? w / 2 : x;
    ctx.fillStyle = PURPLE_LIGHT;
    ctx.font = "700 17px Inter, system-ui, sans-serif";
    shadowText(ctx, label, anchor, statsY);
    ctx.fillStyle = WHITE;
    ctx.font = "900 39px Inter, system-ui, sans-serif";
    shadowText(ctx, value, anchor, statsY + 48);
  });

  const footerY = Math.min(h - 92, statsY + 145);
  ctx.textAlign = "left";
  ctx.fillStyle = WHITE;
  ctx.font = "700 18px Inter, system-ui, sans-serif";
  shadowText(ctx, formatDate(data.data), side, footerY);
  ctx.fillStyle = PURPLE_LIGHT;
  ctx.font = "700 16px Inter, system-ui, sans-serif";
  shadowText(ctx, "#VRENN  #PROVADEEXECUÇÃO", side, footerY + 30);

  if (data.repGanho != null) {
    ctx.textAlign = "right";
    ctx.fillStyle = GREEN;
    ctx.font = "900 36px Inter, system-ui, sans-serif";
    shadowText(ctx, `+${data.repGanho} REP`, w - side, footerY + 10);
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG")), "image/png");
  });
}

export async function shareExecutionOverlay(data: ExecutionCardData, size: ExecutionCardSize = "story") {
  const blob = await renderExecutionOverlay(data, size);
  const file = new File([blob], `vrenn-overlay-${Date.now()}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };

  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "VRENN — Minha execução" });
      return;
    } catch {
      // Usuário cancelou ou o app não aceitou: baixa o PNG.
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
