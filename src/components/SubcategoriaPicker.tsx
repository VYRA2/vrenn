import { getSubcategorias } from "@/lib/categorias";

interface Props {
  categoria: string;
  value: string | null;
  onChange: (sub: string | null) => void;
  label?: string;
}

export function SubcategoriaPicker({ categoria, value, onChange, label = "Subcategoria" }: Props) {
  const subs = getSubcategorias(categoria);
  if (!categoria || subs.length === 0) return null;
  return (
    <div>
      <span className="mb-2 block text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {subs.map((s) => {
          const active = value === s.id;
          return (
            <button
              type="button"
              key={s.id}
              onClick={() => onChange(active ? null : s.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                active ? "border-primary bg-primary/15 text-primary-light" : "border-border bg-card text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
