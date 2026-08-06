import { createFileRoute, Link } from "@tanstack/react-router";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { Search, Users, Compass, Trophy } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BottomNav } from "@/components/BottomNav";

export const Route = createFileRoute("/_authenticated/comunidades/")({ component: Comunidades });

function Comunidades() {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["comunidades", q],
    queryFn: async () => {
      let query = (supabase as any)
        .from("comunidades")
        .select(
          "id,slug,nome,descricao,categoria,avatar_url,capa_url,destaque,comunidade_membros(count)",
        )
        .eq("ativa", true)
        .order("destaque", { ascending: false })
        .order("created_at", { ascending: false });
      if (q.trim().length >= 2)
        query = query.or(
          `nome.ilike.%${q.trim()}%,descricao.ilike.%${q.trim()}%,categoria.ilike.%${q.trim()}%`,
        );
      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="mx-auto max-w-md px-5 pt-6">
        <h1 className="text-3xl font-black">Comunidades</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre sua tribo, compartilhe evolução e cresça com pessoas do mesmo nicho.
        </p>
      </header>
      <div className="mx-auto max-w-md px-5">
        <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3">
          <Search size={18} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou interesse"
            className="w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="mt-5 grid gap-3">
          {isLoading &&
            [1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-3xl bg-card" />
            ))}
          {!isLoading && !data.length && (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center">
              <Compass className="mx-auto text-primary-light" />
              <h2 className="mt-3 font-bold">Nenhuma comunidade encontrada</h2>
              <p className="mt-1 text-xs text-muted-foreground">Novas tribos aparecerão aqui.</p>
            </div>
          )}
          {data.map((c: any) => (
            <Link
              key={c.id}
              to="/comunidades/$id"
              params={{ id: c.id }}
              className="overflow-hidden rounded-3xl border border-border bg-card"
            >
              {c.capa_url && <img src={c.capa_url} className="h-24 w-full object-cover" alt="" />}
              <div className="flex gap-3 p-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/15">
                  {c.avatar_url ? (
                    <img src={c.avatar_url} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <Users className="text-primary-light" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-bold">{c.nome}</h2>
                    {c.destaque && <Trophy size={14} className="text-yellow-400" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.descricao}</p>
                  <div className="mt-2 text-[11px] text-primary-light">
                    {c.categoria} · {c.comunidade_membros?.[0]?.count ?? 0} membros
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
