import { useEffect, useRef, useState } from "react";
import { Swords, Trophy, Lock, Download, Share2, CalendarDays, CheckCircle2, Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Perfil {
  nome: string;
  username: string;
  avatar_url: string | null;
}

interface DueloResultadoCardProps {
  duelo: {
    id: string;
    titulo: string;
    categoria: string;
    prazo: string;
    valor_custodia: number;
    progresso_challenger: number;
    progresso_opponent: number;
    winner_id: string | null;
    challenger_id: string;
    opponent_id: string;
    created_at: string;
  };
  challenger: Perfil;
  opponent: Perfil;
  checkinCount: number;
  onShare?: () => void;
  onDownload?: () => void;
}

function Avatar({ src, nome, size, winner }: { src: string | null; nome: string; size: number; winner: boolean }) {
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    objectFit: "cover",
    border: winner ? "3px solid #A855F7" : "3px solid #ffffff30",
    boxShadow: winner ? "0 0 20px #A855F780" : "none",
    background: "#1A1A28",
  };
  if (src) return <img src={src} alt="" crossOrigin="anonymous" style={style} />;
  return (
    <div style={{ ...style, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900, fontSize: size * 0.36 }}>
      {(nome || "?")[0]?.toUpperCase()}
    </div>
  );
}

export function DueloResultadoCard({ duelo, challenger, opponent, checkinCount, onShare, onDownload }: DueloResultadoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    import("qrcode")
      .then((m) =>
        m.default.toDataURL("https://vrenn.app", {
          width: 160,
          margin: 1,
          color: { dark: "#000000", light: "#FFFFFF" },
        }),
      )
      .then((url) => { if (alive) setQr(url); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const challengerWon = duelo.winner_id === duelo.challenger_id;
  const opponentWon = duelo.winner_id === duelo.opponent_id;
  const dias = Math.round((new Date(duelo.prazo).getTime() - new Date(duelo.created_at).getTime()) / 86400000);
  const vencedor = challengerWon ? challenger : opponentWon ? opponent : null;

  async function baixar() {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#0A0A12", scale: 2, useCORS: true, logging: false });
      const link = document.createElement("a");
      link.download = "vrenn-duelo-resultado.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      onDownload?.();
    } catch {
      toast.error("Não foi possível gerar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  async function compartilhar() {
    const url = `https://vrenn.app/duelo/${duelo.id}`;
    try {
      if (navigator.share) await navigator.share({ title: duelo.titulo, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    } catch { /* cancelado pelo usuário */ }
    onShare?.();
  }

  const gray = "#8A8A99";

  function ProgressoCol({ perfil, valor, venceu }: { perfil: Perfil; valor: number; venceu: boolean }) {
    return (
      <div style={{ flex: 1, padding: "0 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Avatar src={perfil.avatar_url} nome={perfil.nome} size={32} winner={venceu} />
          <span style={{ color: venceu ? "#fff" : gray, fontWeight: 700, fontSize: 15 }}>{perfil.nome}</span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "#ffffff12", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, valor ?? 0))}%`, borderRadius: 4, background: venceu ? "#A855F7" : "#ffffff20" }} />
        </div>
        <div style={{ marginTop: 10, fontSize: 28, fontWeight: 900, color: venceu ? "#22D3A1" : "#666" }}>
          {valor ?? 0}%{venceu ? " ✓" : ""}
        </div>
      </div>
    );
  }

  return (
    <section className="flex flex-col items-center">
      <div className="w-full overflow-hidden" style={{ display: "flex", justifyContent: "center" }}>
        <div className="h-[672px] origin-top scale-[0.7] sm:h-auto sm:scale-100">

          <div
            id="duelo-resultado-card"
            ref={cardRef}
            style={{
              width: 540,
              minHeight: 960,
              background: "radial-gradient(ellipse at center, #A855F715 0%, transparent 70%), #0A0A12",
              display: "flex",
              flexDirection: "column",
              fontFamily: "inherit",
            }}
          >
            <div style={{ padding: "28px 28px 0", flex: 1 }}>
              {/* Topo */}
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 42, fontWeight: 900, color: "#fff", letterSpacing: 6 }}>VRENN</div>
                <div style={{ marginTop: 6, fontSize: 11, letterSpacing: 4, color: "#A855F7", textTransform: "uppercase", fontWeight: 700 }}>
                  Resultado do duelo
                </div>
              </div>

              {/* VS */}
              <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                {[{ p: challenger, won: challengerWon }, null, { p: opponent, won: opponentWon }].map((col, i) =>
                  col === null ? (
                    <div key="vs" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 140 }}>
                      <Swords size={48} color="#A855F7" style={{ filter: "drop-shadow(0 0 16px #A855F7AA)" }} />
                      <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1.1 }}>VS</div>
                    </div>
                  ) : (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                      <div style={{ height: 28, marginBottom: 8 }}>
                        {col.won && (
                          <span style={{ display: "inline-block", background: "#F59E0B20", border: "1px solid #F59E0B", color: "#F59E0B", fontSize: 11, fontWeight: 800, letterSpacing: 1, borderRadius: 999, padding: "5px 12px" }}>
                            VENCEDOR 🏆
                          </span>
                        )}
                      </div>
                      <Avatar src={col.p.avatar_url} nome={col.p.nome} size={96} winner={col.won} />
                      <div style={{ marginTop: 12, fontSize: 18, fontWeight: 800, color: col.won ? "#fff" : "#C9C9D4" }}>{col.p.nome}</div>
                      <div style={{ marginTop: 2, fontSize: 13, color: col.won ? "#A855F7" : "#666" }}>@{col.p.username}</div>
                    </div>
                  ),
                )}
              </div>

              {/* Card principal */}
              <div style={{ marginTop: 28, background: "#12122080", border: "1.5px solid #A855F750", borderRadius: 20, padding: 24 }}>
                <div style={{ textAlign: "center" }}>
                  <Trophy size={56} color="#F59E0B" style={{ filter: "drop-shadow(0 0 16px #F59E0B80)" }} />
                </div>
                <h3 style={{ marginTop: 12, fontSize: 26, fontWeight: 900, color: "#fff", textAlign: "center", lineHeight: 1.2 }}>{duelo.titulo}</h3>
                <div style={{ marginTop: 6, fontSize: 13, color: gray, textAlign: "center" }}>
                  Duelo de {dias} dias · {duelo.categoria}
                </div>
                <div style={{ borderTop: "1px solid #A855F730", margin: "16px 0" }} />
                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <ProgressoCol perfil={challenger} valor={duelo.progresso_challenger} venceu={challengerWon} />
                  <div style={{ width: 1, alignSelf: "stretch", background: "#A855F730" }} />
                  <ProgressoCol perfil={opponent} valor={duelo.progresso_opponent} venceu={opponentWon} />
                </div>
              </div>

              {/* Custódia */}
              {Number(duelo.valor_custodia) > 0 && (
                <div style={{ marginTop: 16, background: "#0D0D1A", border: "1px solid #A855F730", borderRadius: 16, padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: "#A855F715", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Lock size={26} color="#A855F7" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: gray }}>Em custódia</div>
                    <div style={{ fontSize: 28, fontWeight: 900, color: "#A855F7", lineHeight: 1.2 }}>
                      R$ {Number(duelo.valor_custodia).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: 10, color: gray }}>Liberado via ASAAS · VRENN</div>
                  </div>
                  {vencedor && (
                    <>
                      <div style={{ width: 1, alignSelf: "stretch", background: "#ffffff12" }} />
                      <div style={{ color: "#F59E0B", fontWeight: 700, fontSize: 15, paddingLeft: 16 }}>→ {vencedor.nome}</div>
                    </>
                  )}
                </div>
              )}

              {/* Stats */}
              <div style={{ marginTop: 16, background: "#12122080", border: "1px solid #ffffff10", borderRadius: 16, padding: 16, display: "flex" }}>
                {[
                  { icon: <CalendarDays size={22} color="#A855F7" />, value: `${dias} dias`, label: "Duração" },
                  { icon: <CheckCircle2 size={22} color="#A855F7" />, value: `${checkinCount} check-ins`, label: "Registros do vencedor" },
                  { icon: <Flame size={22} color="#A855F7" />, value: `${checkinCount} dias`, label: "Maior streak" },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, textAlign: "center", borderLeft: i === 0 ? "none" : "1px solid #ffffff10", padding: "0 8px" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>{s.icon}</div>
                    <div style={{ marginTop: 6, fontSize: 17, fontWeight: 900, color: "#fff" }}>{s.value}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: gray }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé */}
            <div style={{ marginTop: 24, background: "#080810", padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#fff", fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>Mostre que você<br />também consegue.</div>
                <div style={{ marginTop: 8, color: "#A855F7", fontSize: 14, fontWeight: 700 }}>vrenn.app</div>
                <div style={{ marginTop: 8, color: gray, fontSize: 11 }}>
                  {new Date(duelo.prazo).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>
              <div style={{ width: 96, height: 96, borderRadius: 12, border: "1px solid #A855F750", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {qr ? <img src={qr} alt="QR Code vrenn.app" width={80} height={80} /> : <div style={{ width: 80, height: 80 }} />}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex w-full gap-2">
        <button
          onClick={baixar}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-sm font-bold text-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Baixar card
        </button>
        <button
          onClick={compartilhar}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-primary-foreground shadow-glow"
        >
          <Share2 size={16} /> Compartilhar
        </button>
      </div>
    </section>
  );
}
