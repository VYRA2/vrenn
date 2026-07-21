// nivel: 0=sem badge, 1=Bronze, 2=Prata, 3=Ouro, 4=Diamante, 5=Lenda
export function NivelBadge({ nivel, size = "sm" }: { nivel?: number | null; size?: "sm" | "md" }) {
  if (!nivel || nivel < 1) return null;
  const configs = [
    null,
    { label: "Bronze", color: "#CD7F32", emoji: "🥉" },
    { label: "Prata", color: "#C0C0C0", emoji: "🥈" },
    { label: "Ouro", color: "#FFD700", emoji: "🥇" },
    { label: "Diamante", color: "#B9F2FF", emoji: "💎" },
    { label: "Lenda", color: "#7B2EFF", emoji: "👑" },
  ];
  const cfg = configs[nivel];
  if (!cfg) return null;
  const sz = size === "md" ? "px-2.5 py-1 text-xs" : "px-1.5 py-0.5 text-[10px]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${sz}`}
      style={{ background: `${cfg.color}22`, color: cfg.color, border: `1px solid ${cfg.color}55` }}
    >
      <span>{cfg.emoji}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

export function nivelDoUsuario(username?: string | null, nivel?: number | null, userId?: string | null): number {
  // Fundador — sempre Lenda independente dos pontos
  if (username === "matheus" || userId === "52fd9ebb-5d88-4b33-acc3-97b70c62a426") return 5;
  return nivel ?? 1;
}
