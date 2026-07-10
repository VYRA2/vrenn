import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { findUserForInvite } from "@/lib/arbitros.functions";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertCircle, Image as ImageIcon, Calendar, Target, UserPlus, Loader2, Camera, Shield, X, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meta/$id")({
  component: MetaDetail,
});

function MetaDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { data: meta, isLoading } = useQuery({
    queryKey: ["meta", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metas")
        .select("id, user_id, titulo, categoria, descricao, prazo, progresso, status, foto_capa_url, created_at, profiles:user_id (nome, username, avatar_url)")
        .eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: valorCustodia } = useQuery({
    queryKey: ["meta-valor-custodia", id],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_meta_valor_custodia", { _meta_id: id });
      return Number(data ?? 0);
    },
  });

  const { data: checkins } = useQuery({
    queryKey: ["checkins", id],
    queryFn: async () => {
      const { data } = await supabase.from("checkins").select("*").eq("meta_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: arbitros } = useQuery({
    queryKey: ["arbitros", id],
    queryFn: async () => {
      const { data } = await supabase.from("arbitros").select("*, profiles:arbitro_id (nome, username, avatar_url)").eq("meta_id", id);
      return data ?? [];
    },
  });

  const { data: validacoes } = useQuery({
    queryKey: ["validacoes", id],
    queryFn: async () => {
      if (!checkins?.length) return [];
      const { data } = await supabase.from("checkin_validacoes").select("*").in("checkin_id", checkins.map(c => c.id));
      return data ?? [];
    },
    enabled: !!checkins,
  });

  if (isLoading) return <div className="min-h-screen bg-background p-8 text-muted-foreground">Carregando…</div>;
  if (!meta) return <div className="min-h-screen bg-background p-8 text-muted-foreground">Meta não encontrada.</div>;

  const isOwner = meta.user_id === user.id;
  const myArbitro = arbitros?.find(a => a.arbitro_id === user.id && a.status === "aceito");
  const acceptedArbitros = arbitros?.filter(a => a.status === "aceito") ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          <Link to="/feed" className="rounded-full p-2 hover:bg-card"><ArrowLeft size={20} /></Link>
          <h1 className="flex-1 text-base font-bold truncate text-center">Minha Meta</h1>
          <div className="w-8" />
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-light">
            {meta.status === "em_andamento" ? "Em andamento" : meta.status}
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <h2 className="mt-2 text-3xl font-bold">{meta.titulo}</h2>
          {meta.descricao && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{meta.descricao}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <InfoBox icon={Calendar} label="Prazo" value={meta.prazo ? new Date(meta.prazo).toLocaleDateString("pt-BR") : "Aberto"} />
          <InfoBox icon={Target} label="Categoria" value={meta.categoria} />
          <InfoBox icon={CheckCircle2} label="Check-ins" value={String(checkins?.length ?? 0)} />
        </div>

        {isOwner && Number(valorCustodia ?? 0) > 0 && (
          <section className="rounded-2xl border border-primary/40 bg-primary/5 p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary-light">🔒</div>
            <div className="flex-1">
              <div className="text-xs text-muted-foreground">Em custódia</div>
              <div className="text-lg font-bold text-primary-light">R$ {Number(valorCustodia).toLocaleString("pt-BR")}</div>
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-primary-light/80">Em jogo</span>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Progresso atual</div>
              <div className="mt-1 text-4xl font-bold text-primary-light leading-none">{meta.progresso}%</div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {meta.prazo && (
                <div className="font-semibold text-foreground/80">
                  {Math.max(0, Math.ceil((new Date(meta.prazo).getTime() - Date.now()) / 86400000))} dias restantes
                </div>
              )}
            </div>
          </div>
          <div className="h-3 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gradient-primary transition-all" style={{ width: `${meta.progresso}%` }} />
          </div>
        </section>

        {isOwner && <EmJogoPrivado metaId={id} />}

        <ArbitrosSection metaId={id} isOwner={isOwner} arbitros={arbitros ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["arbitros", id] })} ownerId={meta.user_id} />

        <section>
          <h3 className="mb-3 text-sm font-bold">Últimas publicações</h3>
          <div className="space-y-3">
            {(checkins ?? []).length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                Sem check-ins ainda.
              </div>
            )}
            {checkins?.map((c) => (
              <CheckinItem
                key={c.id}
                checkin={c}
                validacoes={(validacoes ?? []).filter(v => v.checkin_id === c.id)}
                canValidate={!!myArbitro}
                userId={user.id}
                ownerId={meta.user_id}
                onChange={() => qc.invalidateQueries({ queryKey: ["validacoes", id] })}
              />
            ))}
          </div>
        </section>

        {isOwner && (
          <div className="fixed bottom-24 left-0 right-0 z-30 mx-auto flex max-w-md gap-2 px-4">
            <button
              onClick={() => setShowCheckinModal(true)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground shadow-glow"
            >
              <Camera size={16} /> Publicar atualização
            </button>
            <button
              onClick={() => { navigator.clipboard?.writeText(window.location.href); toast.success("Link copiado — convide apoiadores!"); }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold"
            >
              <UserPlus size={16} /> Apoiadores
            </button>
          </div>
        )}
      </div>

      {showCheckinModal && (
        <CheckinModal
          metaId={id}
          userId={user.id}
          acceptedArbitros={acceptedArbitros}
          onClose={() => setShowCheckinModal(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["checkins", id] });
            qc.invalidateQueries({ queryKey: ["feed-metas"] });
            setShowCheckinModal(false);
          }}
        />
      )}
    </main>
  );
}

function InfoBox({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center">
      <Icon size={18} className="mx-auto text-primary-light" />
      <div className="mt-1 text-xs font-bold truncate">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ArbitrosSection({ metaId, isOwner, arbitros, onChange, ownerId }: any) {
  const [open, setOpen] = useState(false);
  const [ident, setIdent] = useState("");
  const [loading, setLoading] = useState(false);
  const findUser = useServerFn(findUserForInvite);

  async function invite() {
    if (!ident.trim()) return;
    setLoading(true);
    try {
      const target: any = await findUser({ data: { identifier: ident } });
      if (target.id === ownerId) throw new Error("Você não pode ser árbitro da própria meta");
      const { data: arb, error } = await supabase.from("arbitros").insert({
        meta_id: metaId, arbitro_id: target.id, convidado_por: ownerId,
      }).select().single();
      if (error) throw error;
      await supabase.rpc("notify", {
        _user_id: target.id,
        _tipo: "convite_arbitro",
        _mensagem: "Você foi convidado para ser árbitro de uma meta.",
        _link_id: metaId,
      });
      toast.success(`Convite enviado para ${target.nome || target.username}`);
      setIdent(""); setOpen(false); onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally { setLoading(false); }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold inline-flex items-center gap-2"><Shield size={16} className="text-primary-light"/> Árbitros</h3>
        {isOwner && (
          <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary-light">
            <UserPlus size={14} /> Convidar
          </button>
        )}
      </div>

      {open && (
        <div className="mb-3 space-y-2">
          <input value={ident} onChange={(e) => setIdent(e.target.value)} placeholder="@username ou email"
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
          <button onClick={invite} disabled={loading} className="w-full rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 size={14} className="animate-spin"/>} Enviar convite
          </button>
        </div>
      )}

      {arbitros.length === 0 && <p className="text-xs text-muted-foreground">Nenhum árbitro ainda.</p>}
      <div className="space-y-2">
        {arbitros.map((a: any) => (
          <div key={a.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                {(a.profiles?.nome || "?")[0].toUpperCase()}
              </div>
              <div>
                <div className="text-xs font-semibold">{a.profiles?.nome || "Usuário"}</div>
                <div className="text-[10px] text-muted-foreground">@{a.profiles?.username}</div>
              </div>
            </div>
            <StatusPill status={a.status} />
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    pendente: { c: "bg-yellow-500/15 text-yellow-300", l: "Pendente" },
    aceito: { c: "bg-accent/15 text-accent", l: "Aceito" },
    recusado: { c: "bg-destructive/15 text-destructive", l: "Recusado" },
  };
  const m = map[status] ?? map.pendente;
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${m.c}`}>{m.l}</span>;
}

function CheckinModal({ metaId, userId, acceptedArbitros, onClose, onCreated }: any) {
  const [msg, setMsg] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!msg.trim() && !file) return toast.error("Adicione uma mensagem ou foto");
    setLoading(true);
    try {
      let foto_url: string | null = null;
      if (file) {
        const ok = ["image/jpeg","image/png","image/webp","video/mp4"].includes(file.type);
        if (!ok) throw new Error("Formato inválido. Use JPG, PNG, WebP ou MP4.");
        if (file.size > 50 * 1024 * 1024) throw new Error("Arquivo maior que 50MB.");
        const path = `${userId}/${metaId}/${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("checkins").upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from("checkins").getPublicUrl(path);
        foto_url = data.publicUrl;
      }
      const { error } = await supabase.from("checkins").insert({
        meta_id: metaId, user_id: userId, mensagem: msg, foto_url,
      });
      if (error) throw error;
      for (const c of (await supabase.from("checkins").select("id").eq("meta_id", metaId).order("created_at", { ascending: false }).limit(1)).data ?? []) {
        for (const a of acceptedArbitros) {
          await supabase.rpc("notify", {
            _user_id: a.arbitro_id,
            _tipo: "checkin_para_validar",
            _mensagem: "Novo check-in aguardando sua validação.",
            _link_id: c.id,
          });
        }
      }
      toast.success("Check-in publicado!");
      onCreated();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 space-y-3 animate-in slide-in-from-bottom">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Publicar atualização</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18}/></button>
        </div>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={4} placeholder="O que você fez hoje? Conte sua evolução…"
          className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" />
        {preview && (
          <div className="relative">
            <img src={preview} alt="" className="w-full h-48 rounded-xl object-cover" />
            <button onClick={() => pickFile(null)} className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white"><X size={14}/></button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-xs font-semibold text-primary-light cursor-pointer">
            <Camera size={16} /> {file ? "Trocar foto" : "Adicionar foto"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>
        <button onClick={submit} disabled={loading} className="w-full rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground inline-flex items-center justify-center gap-2 disabled:opacity-60">
          {loading && <Loader2 size={14} className="animate-spin"/>} Publicar check-in
        </button>
      </div>
    </div>
  );
}

function CheckinItem({ checkin, validacoes, canValidate, userId, onChange }: any) {
  const [comentario, setComentario] = useState("");
  const myValidacao = validacoes.find((v: any) => v.arbitro_id === userId);
  const validados = validacoes.filter((v: any) => v.status === "validado").length;
  const questionados = validacoes.filter((v: any) => v.status === "questionado").length;

  async function validar(status: "validado" | "questionado") {
    const { error } = await supabase.from("checkin_validacoes").upsert({
      checkin_id: checkin.id, arbitro_id: userId, status, comentario: comentario || null,
    }, { onConflict: "checkin_id,arbitro_id" });
    if (error) return toast.error(error.message);
    if (status === "validado") {
      await supabase.from("checkins").update({ validado: true }).eq("id", checkin.id);
    }
    await supabase.rpc("notify", {
      _user_id: checkin.user_id,
      _tipo: status === "validado" ? "apoio" : "cobranca",
      _mensagem: status === "validado" ? "Um árbitro validou seu check-in." : `Um árbitro questionou: ${comentario || "sem comentário"}`,
      _link_id: checkin.meta_id,
    });
    toast.success(status === "validado" ? "Check-in validado" : "Check-in questionado");
    setComentario(""); onChange();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-3">
        {checkin.foto_url ? (
          <img src={checkin.foto_url} alt="" className="h-20 w-20 rounded-xl object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-background text-muted-foreground"><ImageIcon size={20}/></div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground">{new Date(checkin.created_at).toLocaleString("pt-BR")}</div>
          {checkin.mensagem && <p className="mt-1 text-sm">{checkin.mensagem}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {validados > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent"><CheckCircle2 size={10}/>{validados} validado(s)</span>}
            {questionados > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-300"><AlertCircle size={10}/>{questionados} questionado(s)</span>}
          </div>
        </div>
      </div>

      {canValidate && (
        <div className="mt-3 border-t border-border pt-3 space-y-2">
          {myValidacao ? (
            <div className="text-xs text-muted-foreground">Você {myValidacao.status === "validado" ? "validou" : "questionou"} este check-in.</div>
          ) : (
            <>
              <input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Comentário (opcional)"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => validar("validado")} className="rounded-xl bg-accent/20 py-2 text-xs font-bold text-accent inline-flex items-center justify-center gap-1"><CheckCircle2 size={14}/> Validar</button>
                <button onClick={() => validar("questionado")} className="rounded-xl bg-yellow-500/15 py-2 text-xs font-bold text-yellow-300 inline-flex items-center justify-center gap-1"><AlertCircle size={14}/> Questionar</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmJogoPrivado({ metaId }: { metaId: string }) {
  const { data } = useQuery({
    queryKey: ["motivacao", metaId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_meta_motivacao", { _meta_id: metaId });
      return data as string | null;
    },
  });
  if (!data) return null;
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 text-xs font-bold text-primary-light">
        <Shield size={14}/> O que está em jogo (só você vê)
      </div>
      <p className="mt-2 text-sm whitespace-pre-line">{data}</p>
    </section>
  );
}
