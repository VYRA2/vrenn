// Taxonomia de categorias e subcategorias usadas em Metas, Duelos e Desafios de Equipe.

export type CategoriaId =
  | "fitness"
  | "saude"
  | "estudos"
  | "financas"
  | "habitos"
  | "esportes"
  | "foco"
  | "outro";

export type Subcategoria = { id: string; label: string };

export const SUBCATEGORIAS: Record<string, Subcategoria[]> = {
  fitness: [
    { id: "musculacao", label: "Musculação" },
    { id: "corrida", label: "Corrida" },
    { id: "caminhada", label: "Caminhada" },
    { id: "ciclismo", label: "Ciclismo" },
    { id: "natacao", label: "Natação" },
    { id: "calistenia", label: "Calistenia" },
    { id: "crossfit", label: "CrossFit" },
    { id: "yoga", label: "Yoga" },
  ],
  esportes: [
    { id: "corrida", label: "Corrida" },
    { id: "caminhada", label: "Caminhada" },
    { id: "ciclismo", label: "Ciclismo" },
    { id: "natacao", label: "Natação" },
    { id: "futebol", label: "Futebol" },
    { id: "outro", label: "Outro" },
  ],
  saude: [
    { id: "meditacao", label: "Meditação" },
    { id: "sono", label: "Sono" },
    { id: "hidratacao", label: "Hidratação" },
    { id: "alimentacao", label: "Alimentação" },
  ],
  estudos: [
    { id: "leitura", label: "Leitura" },
    { id: "curso", label: "Curso" },
    { id: "idioma", label: "Idioma" },
    { id: "redacao", label: "Redação" },
  ],
  financas: [
    { id: "economia", label: "Economia" },
    { id: "investimento", label: "Investimento" },
    { id: "orcamento", label: "Orçamento" },
  ],
  habitos: [
    { id: "rotina", label: "Rotina" },
    { id: "digital-detox", label: "Digital Detox" },
    { id: "organizacao", label: "Organização" },
  ],
  foco: [
    { id: "produtividade", label: "Produtividade" },
    { id: "digital-detox", label: "Digital Detox" },
    { id: "rotina", label: "Rotina" },
  ],
  outro: [{ id: "livre", label: "Livre" }],
};

// Modalidades esportivas rastreáveis via Strava
const STRAVA_SUBCATEGORIAS = new Set(["corrida", "caminhada", "ciclismo", "natacao"]);

export function subcategoriaSuportaStrava(sub?: string | null): boolean {
  return !!sub && STRAVA_SUBCATEGORIAS.has(sub);
}

export function getSubcategorias(categoria?: string | null): Subcategoria[] {
  if (!categoria) return [];
  return SUBCATEGORIAS[categoria] ?? [];
}

export function labelSubcategoria(categoria?: string | null, sub?: string | null): string {
  if (!sub) return "—";
  const found = getSubcategorias(categoria).find((s) => s.id === sub);
  return found?.label ?? sub;
}
