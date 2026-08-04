import { Swords, Trophy } from "lucide-react";

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

/**
 * Versão temporária e totalmente segura para SSR.
 *
 * Mantém o resultado visível enquanto isola as dependências de exportação
 * (`qrcode` e `html2canvas`) do worker publicado pelo Lovable. Depois que o
 * 502 for diagnosticado, o card exportável pode ser reativado.
 */
export function DueloResultadoCard({
  duelo,
  challenger,
  opponent,
  checkinCount,
}: DueloResultadoCardProps) {
  const challengerWon = duelo.winner_id === duelo.challenger_id;
  const opponentWon = duelo.winner_id === duelo.opponent_id;
  const winner = challengerWon ? challenger : opponentWon ? opponent : null;

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-5">
      <div className="flex items-center justify-center gap-2 text-primary-light">
        <Swords size={18} />
        <span className="text-xs font-black uppercase tracking-[0.2em]">
          Resultado do duelo
        </span>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3 text-center">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{challenger.nome}</div>
          <div className="text-2xl font-black">
            {duelo.progresso_challenger ?? 0}%
          </div>
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
          <Trophy size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{opponent.nome}</div>
          <div className="text-2xl font-black">
            {duelo.progresso_opponent ?? 0}%
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-background px-4 py-3 text-center">
        <div className="text-sm font-black">
          {winner ? `${winner.nome} venceu` : "Duelo concluído"}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {duelo.titulo} · {checkinCount} check-ins registrados
        </div>
      </div>

      <p className="mt-3 text-center text-[11px] text-muted-foreground">
        Exportação e compartilhamento temporariamente desativados durante o diagnóstico do servidor.
      </p>
    </section>
  );
}
