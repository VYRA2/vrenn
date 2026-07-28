import { useState } from "react";
import { Target } from "lucide-react";

const SUGESTOES: Record<string, number[]> = {
  corrida:   [5, 10, 21, 42],
  caminhada: [5, 10, 20, 30],
  ciclismo:  [20, 50, 100, 200],
  natacao:   [1, 2, 5, 10],
};

interface Props {
  subcategoria: string;
  objetivoKm: number | null;
  modoLivre: boolean;
  onChange: (km: number | null, livre: boolean) => void;
}

export function ObjetivoKmPicker({ subcategoria, objetivoKm, modoLivre, onChange }: Props) {
  const [customKm, setCustomKm] = useState<string>(objetivoKm ? String(objetivoKm) : "");
  const sugestoes = SUGESTOES[subcategoria] ?? [5, 10, 20, 50];
  const unidade = "km";

  return (
    <div className="space-y-3">
      <span className="block text-xs font-medium text-muted-foreground">Objetivo de distância</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onChange(objetivoKm ?? sugestoes[0], false)}
          className={"flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors " + (!modoLivre ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground")}>
          Meta em km
        </button>
        <button type="button" onClick={() => onChange(null, true)}
          className={"flex-1 rounded-xl border py-2.5 text-xs font-semibold transition-colors " + (modoLivre ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground")}>
          km livre
        </button>
      </div>
      {!modoLivre && (
        <>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((km) => (
              <button type="button" key={km} onClick={() => { onChange(km, false); setCustomKm(String(km)); }}
                className={"rounded-full border px-3 py-1.5 text-xs font-bold transition-colors " + (objetivoKm === km ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground")}>
                {km} {unidade}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Target size={14} className="shrink-0 text-muted-foreground" />
            <input type="number" min="0.1" step="0.1" placeholder="Personalizado" value={customKm}
              onChange={(e) => { setCustomKm(e.target.value); const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) onChange(v, false); }}
              className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none" />
            <span className="shrink-0 text-xs text-muted-foreground">{unidade}</span>
          </div>
          {objetivoKm && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-xs text-primary-light">
              Quem completar {objetivoKm} {unidade} primeiro vence automaticamente.
            </div>
          )}
        </>
      )}
      {modoLivre && (
        <div className="rounded-xl border border-border bg-background p-3 text-xs text-muted-foreground">
          Sem meta de distância. Resultado por frequência de check-ins ate o prazo final.
        </div>
      )}
    </div>
  );
}
