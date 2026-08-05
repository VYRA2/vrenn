from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    p = ROOT / path
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: esperava 1 ocorrência, encontrei {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def regex_once(path: str, pattern: str, repl: str, flags: int = 0) -> None:
    text = read(path)
    new, count = re.subn(pattern, repl, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: padrão não encontrado: {pattern[:160]!r}")
    write(path, new)


# ─────────────────────────────────────────────────────────────────────────────
# Componentes compartilhados
# ─────────────────────────────────────────────────────────────────────────────

write(
    "src/components/GeolocationCheckinModal.tsx",
    '''import { useState } from "react";
import { Crosshair, Loader2, MapPin, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type EntityType = "meta" | "duelo" | "desafio_equipe";

export function GeolocationCheckinModal({
  entityType,
  entityId,
  local,
  onClose,
  onCreated,
}: {
  entityType: EntityType;
  entityId: string;
  local: any;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!local?.id) return setError("Nenhum local de validação foi configurado.");
    if (!navigator.geolocation) return setError("Geolocalização não suportada neste aparelho.");

    setLoading(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const { error: rpcError } = await (supabase as any).rpc("registrar_checkin_validado", {
            _entidade: entityType,
            _entidade_id: entityId,
            _metodo: "geolocalizacao",
            _qrcode_token: null,
            _latitude: coords.latitude,
            _longitude: coords.longitude,
            _mensagem: `Check-in validado por geolocalização em ${local.nome}.`,
          });
          if (rpcError) throw rpcError;
          toast.success("Check-in validado pela localização!");
          onCreated();
        } catch (e: any) {
          setError(e?.message ?? "Não foi possível validar a localização.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError("Não foi possível obter sua localização. Verifique a permissão do navegador.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">Validar pela localização</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15">
          <MapPin size={28} className="text-emerald-400" />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Confirme que você está em <span className="font-semibold text-foreground">{local?.nome ?? "local definido"}</span>.
          A distância é verificada no servidor e não pode ser informada manualmente.
        </p>
        {error && <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
        <button onClick={confirm} disabled={loading || !local?.id} className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Crosshair size={16} />}
          Confirmar localização atual
        </button>
      </div>
    </div>
  );
}
''',
)

write(
    "src/components/TeamChallengeValidationPanel.tsx",
    '''import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function TeamChallengeValidationPanel({ teamId, userId }: { teamId: string; userId: string }) {
  const qc = useQueryClient();

  const { data: permission } = useQuery({
    queryKey: ["team-validation-permission", teamId, userId],
    queryFn: async () => {
      const [{ data: team }, { data: member }] = await Promise.all([
        (supabase as any).from("equipes").select("criador_id").eq("id", teamId).maybeSingle(),
        (supabase as any).from("equipe_membros").select("papel").eq("equipe_id", teamId).eq("user_id", userId).maybeSingle(),
      ]);
      return team?.criador_id === userId || ["admin", "co_admin"].includes(member?.papel ?? "");
    },
  });

  const { data: pending = [], isLoading } = useQuery({
    queryKey: ["team-pending-validations", teamId],
    enabled: permission === true,
    queryFn: async () => {
      const { data: challenges } = await (supabase as any)
        .from("desafios_equipe")
        .select("id, titulo")
        .eq("equipe_id", teamId)
        .eq("tipo_validacao", "foto_arbitro")
        .eq("status", "ativo");
      const ids = (challenges ?? []).map((d: any) => d.id);
      if (!ids.length) return [];
      const { data: checkins, error } = await (supabase as any)
        .from("checkins_desafio_equipe")
        .select("id, desafio_id, user_id, mensagem, foto_url, created_at")
        .in("desafio_id", ids)
        .eq("validado", false)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const userIds = [...new Set((checkins ?? []).map((c: any) => c.user_id))];
      const { data: profiles } = userIds.length
        ? await (supabase as any).from("profiles").select("id, nome, avatar_url").in("id", userIds)
        : { data: [] };
      const byProfile = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const byChallenge = new Map((challenges ?? []).map((d: any) => [d.id, d]));
      return (checkins ?? []).map((c: any) => ({ ...c, profile: byProfile.get(c.user_id), challenge: byChallenge.get(c.desafio_id) }));
    },
  });

  async function review(checkin: any, approve: boolean) {
    if (checkin.user_id === userId) return toast.error("Você não pode validar a própria prova. Outro admin ou co-admin deve analisar.");
    const { error } = await (supabase as any).rpc("validar_checkin_arbitro", {
      _tipo_checkin: "desafio_equipe",
      _checkin_id: checkin.id,
      _aprovar: approve,
      _comentario: approve ? "Prova aprovada pela equipe." : "Prova questionada pela equipe.",
    });
    if (error) return toast.error(error.message);
    toast.success(approve ? "Prova validada." : "Prova questionada.");
    qc.invalidateQueries({ queryKey: ["team-pending-validations", teamId] });
    qc.invalidateQueries({ queryKey: ["equipe-desafios", teamId] });
  }

  if (!permission || (!isLoading && pending.length === 0)) return null;

  return (
    <section className="mx-auto mb-5 max-w-md rounded-2xl border border-primary/35 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={18} className="text-primary-light" />
        <div>
          <h3 className="text-sm font-bold">Provas aguardando validação</h3>
          <p className="text-[11px] text-muted-foreground">Somente provas aprovadas contam para progresso, conclusão e prêmio.</p>
        </div>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-primary-light" /></div>
      ) : (
        <div className="space-y-3">
          {pending.map((c: any) => (
            <div key={c.id} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center gap-2">
                {c.profile?.avatar_url
                  ? <img src={c.profile.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
                  : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-bold">{(c.profile?.nome ?? "?")[0]}</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-bold">{c.profile?.nome ?? "Participante"}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{c.challenge?.titulo}</div>
                </div>
              </div>
              {c.mensagem && <p className="mt-2 text-xs">{c.mensagem}</p>}
              {c.foto_url && <img src={c.foto_url} className="mt-2 max-h-48 w-full rounded-xl object-cover" alt="Prova enviada" />}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => review(c, true)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-emerald-500/15 py-2 text-xs font-bold text-emerald-400"><CheckCircle2 size={14} /> Validar</button>
                <button onClick={() => review(c, false)} className="inline-flex items-center justify-center gap-1 rounded-xl bg-destructive/10 py-2 text-xs font-bold text-destructive"><XCircle size={14} /> Questionar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
''',
)

# ─────────────────────────────────────────────────────────────────────────────
# Meta: remove conclusão manual e usa RPCs seguros
# ─────────────────────────────────────────────────────────────────────────────

replace_once(
    "src/routes/_authenticated/meta.$id.tsx",
    '  const [showConcluirModal, setShowConcluirModal] = useState(false);\n',
    '',
)
regex_once(
    "src/routes/_authenticated/meta.$id.tsx",
    r'\n\s*<button\n\s*onClick=\{\(\) => setShowConcluirModal\(true\)\}[\s\S]*?<CheckCircle2 size=\{16\} /> Concluir\n\s*</button>',
    '',
)
regex_once(
    "src/routes/_authenticated/meta.$id.tsx",
    r'\n\s*\{showConcluirModal && \([\s\S]*?\n\s*\)\}\n\n\s*\{showJustificarModal',
    '\n\n      {showJustificarModal',
)
replace_once(
    "src/routes/_authenticated/meta.$id.tsx",
    '''async function registrarCheckinAutomatico(metaId: string, userId: string, mensagem: string) {
  const { error } = await supabase.from("checkins").insert({
    meta_id: metaId,
    user_id: userId,
    mensagem,
    foto_url: null,
    validado: true,
  } as any);
  if (error) throw error;
}''',
    '''async function registrarCheckinAutomatico(
  metaId: string,
  _userId: string,
  mensagem: string,
  metodo: "qrcode" | "geolocalizacao",
  proof: { token?: string; latitude?: number; longitude?: number } = {},
) {
  const { error } = await (supabase as any).rpc("registrar_checkin_validado", {
    _entidade: "meta",
    _entidade_id: metaId,
    _metodo: metodo,
    _qrcode_token: proof.token ?? null,
    _latitude: proof.latitude ?? null,
    _longitude: proof.longitude ?? null,
    _mensagem: mensagem,
  });
  if (error) throw error;
}''',
)
replace_once(
    "src/routes/_authenticated/meta.$id.tsx",
    '      await registrarCheckinAutomatico(metaId, userId, `Check-in validado por QR Code em ${local.nome}.`);',
    '      await registrarCheckinAutomatico(metaId, userId, `Check-in validado por QR Code em ${local.nome}.`, "qrcode", { token: valor });',
)
replace_once(
    "src/routes/_authenticated/meta.$id.tsx",
    '          await registrarCheckinAutomatico(metaId, userId, `Check-in validado por geolocalização em ${local.nome}.`);',
    '          await registrarCheckinAutomatico(metaId, userId, `Check-in validado por geolocalização em ${local.nome}.`, "geolocalizacao", { latitude: pos.coords.latitude, longitude: pos.coords.longitude });',
)
regex_once(
    "src/routes/_authenticated/meta.$id.tsx",
    r'''    const \{ error \} = await supabase\.from\("checkin_validacoes"\)\.upsert\([\s\S]*?    if \(error\) return toast\.error\(error\.message\);\n    if \(status === "validado"\) \{\n      await supabase\.from\("checkins"\)\.update\(\{ validado: true \}\)\.eq\("id", checkin\.id\);\n    \}''',
    '''    const { error } = await (supabase as any).rpc("validar_checkin_arbitro", {
      _tipo_checkin: "geral",
      _checkin_id: checkin.id,
      _aprovar: status === "validado",
      _comentario: comentario || null,
    });
    if (error) return toast.error(error.message);''',
)
replace_once(
    "src/routes/_authenticated/meta.$id.tsx",
    '            qc.invalidateQueries({ queryKey: ["checkins", id] });\n            qc.invalidateQueries({ queryKey: ["feed-metas"] });',
    '            qc.invalidateQueries({ queryKey: ["checkins", id] });\n            qc.invalidateQueries({ queryKey: ["meta", id] });\n            qc.invalidateQueries({ queryKey: ["feed-metas"] });',
)

# Criação de meta: geolocalização também exige/salva local.
replace_once(
    "src/routes/_authenticated/nova-meta.tsx",
    '''    // Geolocalização usa coordenadas em tempo real — não precisa de local cadastrado
    if (step === 3 && tipoValidacao === "qrcode" && !localId) {
      return toast.error("Selecione ou cadastre um local para QR Code");
    }''',
    '''    if (step === 3 && ["qrcode", "geolocalizacao"].includes(tipoValidacao) && !localId) {
      return toast.error("Selecione ou cadastre o local que será usado na validação");
    }''',
)
replace_once(
    "src/routes/_authenticated/nova-meta.tsx",
    '      local_id: tipoValidacao === "qrcode" ? localId : null,',
    '      local_id: ["qrcode", "geolocalizacao"].includes(tipoValidacao) ? localId : null,',
)

# ─────────────────────────────────────────────────────────────────────────────
# Duelos: método obrigatório, sem declaração manual e QR/geo no servidor
# ─────────────────────────────────────────────────────────────────────────────

replace_once(
    "src/routes/_authenticated/duelos.tsx",
    'import { subcategoriaSuportaStrava } from "@/lib/categorias";\n',
    'import { subcategoriaSuportaStrava } from "@/lib/categorias";\nimport { ValidacaoStep, type TipoValidacao } from "@/components/ValidacaoStep";\n',
)
replace_once(
    "src/routes/_authenticated/duelos.tsx",
    '  const [frequenciaQtd, setFrequenciaQtd] = useState(1);\n  const [loading, setLoading] = useState(false);',
    '  const [frequenciaQtd, setFrequenciaQtd] = useState(1);\n  const [tipoValidacao, setTipoValidacao] = useState<TipoValidacao>("foto_arbitro");\n  const [localId, setLocalId] = useState<string | null>(null);\n  const [loading, setLoading] = useState(false);',
)
replace_once(
    "src/routes/_authenticated/duelos.tsx",
    '    if (!titulo) return toast.error("Defina o título");\n    setLoading(true);',
    '    if (!titulo) return toast.error("Defina o título");\n    if (["qrcode", "geolocalizacao"].includes(tipoValidacao) && !localId) return toast.error("Selecione o local de validação");\n    if (tipoValidacao === "strava" && subcategoriaSuportaStrava(subcategoria) && !modoLivre && !objetivoKm) return toast.error("Defina a distância que o Strava deve validar");\n    setLoading(true);',
)
replace_once(
    "src/routes/_authenticated/duelos.tsx",
    '''        frequencia_tipo: frequenciaTipo,
        frequencia_quantidade: frequenciaQtd,
        status: opponentId ? "em_andamento" : "pendente",''',
    '''        frequencia_tipo: frequenciaTipo,
        frequencia_quantidade: frequenciaQtd,
        tipo_validacao: tipoValidacao,
        local_id: ["qrcode", "geolocalizacao"].includes(tipoValidacao) ? localId : null,
        status: "pendente",''',
)
replace_once(
    "src/routes/_authenticated/duelos.tsx",
    '        {/* Tipo: duelo privado ou aberto */}',
    '''        <div>
          <span className="mb-2 block text-xs font-medium text-muted-foreground">Como o resultado será validado</span>
          <ValidacaoStep
            tipoValidacao={tipoValidacao}
            onChangeTipo={setTipoValidacao}
            localId={localId}
            onChangeLocalId={setLocalId}
            userId={userId}
            subcategoria={subcategoria}
          />
        </div>

        {/* Tipo: duelo privado ou aberto */}''',
)

replace_once(
    "src/routes/_authenticated/duelo.$id.tsx",
    'import { DueloResultadoCard } from "@/components/DueloResultadoCard";\n',
    'import { DueloResultadoCard } from "@/components/DueloResultadoCard";\nimport { GeolocationCheckinModal } from "@/components/GeolocationCheckinModal";\n',
)
replace_once("src/routes/_authenticated/duelo.$id.tsx", '  const [showEncerrar, setShowEncerrar] = useState(false);\n', '')
replace_once(
    "src/routes/_authenticated/duelo.$id.tsx",
    "  const podeEncerrarManual = isOwner && duelo.status === 'ativo' && !usaArbitro;\n",
    '',
)
replace_once(
    "src/routes/_authenticated/duelo.$id.tsx",
    "  const podeArbitroDeclarar = isArbitro && duelo.arbitro_status === 'aceito' && duelo.status === 'ativo';",
    "  const dueloAtivo = ['ativo', 'em_andamento'].includes(duelo.status);\n  const podeArbitroDeclarar = isArbitro && duelo.arbitro_status === 'aceito' && dueloAtivo;",
)
# Cards e ações consideram os dois status ativos.
text = read("src/routes/_authenticated/duelo.$id.tsx")
text = text.replace("duelo.status === 'ativo'", "dueloAtivo").replace('duelo.status === "ativo"', 'dueloAtivo')
write("src/routes/_authenticated/duelo.$id.tsx", text)
regex_once(
    "src/routes/_authenticated/duelo.$id.tsx",
    r'\n\s*\{\/\* Encerrar manual[\s\S]*?\n\s*\)\}\n\n\s*\{\/\* Frequência \*\/\}',
    '\n\n        {/* Frequência */}',
)
regex_once(
    "src/routes/_authenticated/duelo.$id.tsx",
    r'\n\s*\{showEncerrar && \([\s\S]*?\n\s*\)\}\n\s*\{showDelete',
    '\n      {showDelete',
)
replace_once(
    "src/routes/_authenticated/duelo.$id.tsx",
    '''        onValid={async (raw) => {
          const { error } = await supabase.from("checkins").insert({
            duelo_id: dueloId,
            user_id: userId,
            meta_id: null,
            validado: true,
            mensagem: `Check-in validado por QR Code em ${local.nome}.`,
          } as any);
          if (error) throw error;
          toast.success("Check-in validado por QR Code!");
          onDone();
        }}''',
    '''        onValid={async (raw) => {
          const { error } = await (supabase as any).rpc("registrar_checkin_validado", {
            _entidade: "duelo",
            _entidade_id: dueloId,
            _metodo: "qrcode",
            _qrcode_token: raw,
            _latitude: null,
            _longitude: null,
            _mensagem: `Check-in validado por QR Code em ${local.nome}.`,
          });
          if (error) throw error;
          toast.success("Check-in validado por QR Code!");
          onDone();
        }}''',
)
replace_once(
    "src/routes/_authenticated/duelo.$id.tsx",
    '  // ─── QR Code: escaneia obrigatoriamente antes de registrar ───\n  if (tipoValidacao === "qrcode") {',
    '''  if (tipoValidacao === "geolocalizacao") {
    return <GeolocationCheckinModal entityType="duelo" entityId={dueloId} local={local} onClose={onClose} onCreated={onDone} />;
  }

  // ─── QR Code: escaneia obrigatoriamente antes de registrar ───
  if (tipoValidacao === "qrcode") {''',
)

# ─────────────────────────────────────────────────────────────────────────────
# Desafios de equipe: objetivo, validação segura, geolocalização e painel de árbitro
# ─────────────────────────────────────────────────────────────────────────────

replace_once(
    "src/routes/_authenticated/equipes.$id.desafio.novo.tsx",
    'import { SubcategoriaPicker } from "@/components/SubcategoriaPicker";\n',
    'import { SubcategoriaPicker } from "@/components/SubcategoriaPicker";\nimport { ObjetivoKmPicker } from "@/components/ObjetivoKmPicker";\nimport { subcategoriaSuportaStrava } from "@/lib/categorias";\n',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.desafio.novo.tsx",
    '  const [subcategoria, setSubcategoria] = useState<string | null>(null);\n  const [duracao, setDuracao] = useState(30);',
    '  const [subcategoria, setSubcategoria] = useState<string | null>(null);\n  const [objetivoKm, setObjetivoKm] = useState<number | null>(null);\n  const [modoLivre, setModoLivre] = useState(false);\n  const [duracao, setDuracao] = useState(30);',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.desafio.novo.tsx",
    '    if (step === 5 && tipoValidacao !== "foto_arbitro" && !localId) return toast.error("Selecione ou cadastre um local");',
    '    if (step === 5 && ["qrcode", "geolocalizacao"].includes(tipoValidacao) && !localId) return toast.error("Selecione ou cadastre um local");\n    if (step === 5 && tipoValidacao === "strava" && subcategoriaSuportaStrava(subcategoria) && !modoLivre && !objetivoKm) return toast.error("Defina a distância que o Strava deve validar");',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.desafio.novo.tsx",
    '''      categoria,
      subcategoria,
      duracao_dias: duracao,''',
    '''      categoria,
      subcategoria,
      modalidade: subcategoria,
      objetivo_km: subcategoriaSuportaStrava(subcategoria) && !modoLivre ? objetivoKm : null,
      duracao_dias: duracao,''',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.desafio.novo.tsx",
    '      local_id: tipoValidacao === "foto_arbitro" ? null : localId,',
    '      local_id: ["qrcode", "geolocalizacao"].includes(tipoValidacao) ? localId : null,',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.desafio.novo.tsx",
    '            <SubcategoriaPicker categoria={categoria} value={subcategoria} onChange={setSubcategoria} label="Modalidade" />\n',
    '''            <SubcategoriaPicker categoria={categoria} value={subcategoria} onChange={setSubcategoria} label="Modalidade" />
            {subcategoriaSuportaStrava(subcategoria) && (
              <ObjetivoKmPicker
                subcategoria={subcategoria!}
                objetivoKm={objetivoKm}
                modoLivre={modoLivre}
                onChange={(km, livre) => { setObjetivoKm(km); setModoLivre(livre); }}
              />
            )}
''',
)

replace_once(
    "src/routes/_authenticated/equipes.$id.index.tsx",
    'import { StravaCheckinModal } from "@/components/StravaCheckinModal";\n',
    'import { StravaCheckinModal } from "@/components/StravaCheckinModal";\nimport { GeolocationCheckinModal } from "@/components/GeolocationCheckinModal";\nimport { TeamChallengeValidationPanel } from "@/components/TeamChallengeValidationPanel";\n',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.index.tsx",
    '''  async function registrarQr(_raw: string) {
    const { error } = await (supabase as any).from("checkins_desafio_equipe").insert({
      desafio_id: desafio.id,
      user_id: userId,
      mensagem: `Check-in validado por QR Code em ${local?.nome ?? "local"}.`,
      foto_url: null,
    });
    if (error) throw error;
    toast.success("Check-in validado por QR Code!");
    onCreated();
  }''',
    '''  async function registrarQr(raw: string) {
    const { error } = await (supabase as any).rpc("registrar_checkin_validado", {
      _entidade: "desafio_equipe",
      _entidade_id: desafio.id,
      _metodo: "qrcode",
      _qrcode_token: raw,
      _latitude: null,
      _longitude: null,
      _mensagem: `Check-in validado por QR Code em ${local?.nome ?? "local"}.`,
    });
    if (error) throw error;
    toast.success("Check-in validado por QR Code!");
    onCreated();
  }''',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.index.tsx",
    '  // ─── QR Code: exige leitura da câmera ───\n  if (desafio.tipo_validacao === "qrcode") {',
    '''  if (desafio.tipo_validacao === "geolocalizacao") {
    return <GeolocationCheckinModal entityType="desafio_equipe" entityId={desafio.id} local={local} onClose={onClose} onCreated={onCreated} />;
  }

  // ─── QR Code: exige leitura da câmera ───
  if (desafio.tipo_validacao === "qrcode") {''',
)
replace_once(
    "src/routes/_authenticated/equipes.$id.index.tsx",
    '      <BottomNav />',
    '      <TeamChallengeValidationPanel teamId={id} userId={user.id} />\n\n      <BottomNav />',
)
# Editor não pode remover local do Strava nem tratar Strava como validação local.
replace_once(
    "src/routes/_authenticated/equipes.$id.index.tsx",
    '      local_id: tipoValidacao === "foto_arbitro" ? null : localId,',
    '      local_id: ["qrcode", "geolocalizacao"].includes(tipoValidacao) ? localId : null,',
)

# Remove a trava manual de saldo ao entrar; o trigger do banco já é atômico e autoritativo.
regex_once(
    "src/routes/_authenticated/equipes.$id.index.tsx",
    r'''      // 1\. Verifica e trava saldo se houver valor[\s\S]*?      // 2\. Insere participante''',
    '''      // O banco verifica e trava a custódia de forma atômica ao inserir o participante.
      // Isso evita dupla cobrança e impede manipulação pelo navegador.

      // Insere participante''',
)

# ─────────────────────────────────────────────────────────────────────────────
# Modal Strava: só declara conclusão quando o servidor confirmar
# ─────────────────────────────────────────────────────────────────────────────

replace_once(
    "src/components/StravaCheckinModal.tsx",
    '              metaConcluida: true,',
    '              metaConcluida: Boolean(resultado?.entidade_concluida),',
)

# ─────────────────────────────────────────────────────────────────────────────
# Edge Function Strava: autorização, modalidade, distância e registro atômico
# ─────────────────────────────────────────────────────────────────────────────

edge_path = "supabase/functions/strava-validate-checkin/index.ts"
edge = read(edge_path)
needle = '''    if (!meta_id && !duelo_id && !desafio_id) {
      return json({ error: "meta_id, duelo_id ou desafio_id obrigatório" }, 400);
    }

    const { data: conexao } = await supabase'''
insert = '''    if (!meta_id && !duelo_id && !desafio_id) {
      return json({ error: "meta_id, duelo_id ou desafio_id obrigatório" }, 400);
    }

    const entityType = meta_id ? "meta" : duelo_id ? "duelo" : "desafio_equipe";
    const entityId = meta_id ?? duelo_id ?? desafio_id;
    let entity: any = null;

    if (entityType === "meta") {
      const { data } = await supabase.from("metas")
        .select("id,user_id,status,tipo_validacao,subcategoria,modalidade,objetivo_km")
        .eq("id", entityId).eq("user_id", user.id).maybeSingle();
      entity = data;
      if (!entity || entity.status !== "em_andamento") return json({ error: "Meta não encontrada ou inativa" }, 403);
    } else if (entityType === "duelo") {
      const { data } = await supabase.from("duelos")
        .select("id,challenger_id,opponent_id,status,tipo_validacao,subcategoria,modalidade,objetivo_km,challenger_eliminado,opponent_eliminado")
        .eq("id", entityId).maybeSingle();
      entity = data;
      const participant = entity && [entity.challenger_id, entity.opponent_id].includes(user.id);
      const eliminated = entity && (user.id === entity.challenger_id ? entity.challenger_eliminado : entity.opponent_eliminado);
      if (!participant || eliminated || !["ativo", "em_andamento"].includes(entity?.status)) return json({ error: "Duelo não encontrado, inativo ou usuário eliminado" }, 403);
    } else {
      const [{ data: challenge }, { data: participation }] = await Promise.all([
        supabase.from("desafios_equipe")
          .select("id,status,tipo_validacao,subcategoria,modalidade,objetivo_km")
          .eq("id", entityId).maybeSingle(),
        supabase.from("desafio_equipe_participantes")
          .select("id,eliminado")
          .eq("desafio_id", entityId).eq("user_id", user.id).maybeSingle(),
      ]);
      entity = challenge;
      if (!entity || entity.status !== "ativo" || !participation || participation.eliminado) return json({ error: "Desafio não encontrado, inativo ou usuário eliminado" }, 403);
    }

    if (entity.tipo_validacao !== "strava") return json({ error: "Este compromisso não usa validação Strava" }, 403);

    const { data: conexao } = await supabase'''
if needle not in edge:
    raise RuntimeError("strava edge: bloco de autorização não encontrado")
edge = edge.replace(needle, insert, 1)

# Modalidade compatível após carregar a atividade.
needle = '''    const erros: string[] = [];
    const inicioAtividade = new Date(atividade.start_date);'''
insert = '''    const erros: string[] = [];
    const inicioAtividade = new Date(atividade.start_date);

    const modality = String(entity.subcategoria ?? entity.modalidade ?? "").toLowerCase();
    const activityType = String(atividade.sport_type ?? atividade.type ?? "").toLowerCase();
    const allowedByModality: Record<string, string[]> = {
      corrida: ["run", "trailrun", "virtualrun"], running: ["run", "trailrun", "virtualrun"],
      caminhada: ["walk", "hike"], caminhada_corrida: ["walk", "hike", "run", "trailrun"],
      ciclismo: ["ride", "virtualride", "ebikeride", "mountainbikeride"], bike: ["ride", "virtualride", "ebikeride", "mountainbikeride"],
      natacao: ["swim"], swimming: ["swim"],
    };
    const allowedTypes = allowedByModality[modality];
    if (allowedTypes && !allowedTypes.includes(activityType)) {
      erros.push(`A atividade ${atividade.type ?? atividade.sport_type} não corresponde à modalidade ${entity.subcategoria ?? entity.modalidade}`);
    }'''
if needle not in edge:
    raise RuntimeError("strava edge: ponto de modalidade não encontrado")
edge = edge.replace(needle, insert, 1)

# Substitui insert direto por RPC transacional.
pattern = r'''    if \(valido\) \{[\s\S]*?    \}\n\n    const dstKm = atividade\.distance / 1000;'''
replacement = '''    let entityResult: any = null;
    if (valido) {
      const dstKmValidated = Number(atividade.distance ?? 0) / 1000;
      const msg = `Atividade Strava: ${atividade.name} (${dstKmValidated.toFixed(2)}km, ${Math.round(Number(atividade.moving_time ?? 0) / 60)}min)`;
      const { data: registration, error: registrationError } = await supabase.rpc("registrar_checkin_strava", {
        _user_id: user.id,
        _entidade: entityType,
        _entidade_id: entityId,
        _activity_id: String(atividade.id),
        _activity_started_at: atividade.start_date,
        _km: dstKmValidated,
        _mensagem: msg,
      });
      if (registrationError) {
        const duplicate = registrationError.code === "23505" || /duplicate|unique/i.test(registrationError.message ?? "");
        return json({
          error: duplicate ? "Esta atividade do Strava já foi usada em um check-in." : "A atividade foi validada, mas o check-in não pôde ser registrado.",
          code: duplicate ? "activity_already_used" : "checkin_insert_failed",
          details: registrationError.message,
        }, duplicate ? 409 : 500);
      }
      checkinId = registration?.checkin_id ?? null;
      entityResult = registration?.resultado ?? null;
    }

    const dstKm = atividade.distance / 1000;'''
edge, count = re.subn(pattern, replacement, edge, count=1)
if count != 1:
    raise RuntimeError("strava edge: bloco de registro não encontrado")

needle = '''      checkin_id: checkinId,
      atividade: {'''
insert = '''      checkin_id: checkinId,
      resultado: entityResult,
      entidade_concluida: Boolean(entityResult?.concluida || entityResult?.status === "concluido"),
      atividade: {'''
if needle not in edge:
    raise RuntimeError("strava edge: resposta não encontrada")
edge = edge.replace(needle, insert, 1)
write(edge_path, edge)

# Corrige função de trigger para não acessar OLD em INSERT.
migration = read("supabase/migrations/20260805021000_validated_automatic_outcomes.sql")
migration += '''

-- Ajuste final: evita referência a OLD durante INSERT.
CREATE OR REPLACE FUNCTION public.vrenn_after_validated_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.validado=true THEN
      IF NEW.meta_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_meta(NEW.meta_id);
      ELSIF NEW.duelo_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_duel(NEW.duelo_id,false); END IF;
      PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_validado',COALESCE(NEW.meta_id,NEW.duelo_id));
    END IF;
  ELSIF NEW.validado=true AND OLD.validado IS DISTINCT FROM true THEN
    IF NEW.meta_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_meta(NEW.meta_id);
    ELSIF NEW.duelo_id IS NOT NULL THEN PERFORM public.vrenn_evaluate_duel(NEW.duelo_id,false); END IF;
    PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_validado',COALESCE(NEW.meta_id,NEW.duelo_id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.vrenn_after_validated_team_checkin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.validado=true THEN
      PERFORM public.vrenn_evaluate_team_participant(NEW.desafio_id,NEW.user_id,false);
      PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_desafio_validado',NEW.desafio_id);
    END IF;
  ELSIF NEW.validado=true AND OLD.validado IS DISTINCT FROM true THEN
    PERFORM public.vrenn_evaluate_team_participant(NEW.desafio_id,NEW.user_id,false);
    PERFORM public.dar_reputacao(NEW.user_id,5,'checkin_desafio_validado',NEW.desafio_id);
  END IF;
  RETURN NEW;
END;
$$;
'''
write("supabase/migrations/20260805021000_validated_automatic_outcomes.sql", migration)

# Remove os arquivos temporários da alteração final.
for temporary in [ROOT / "scripts/apply_antifraud.py", ROOT / ".github/workflows/apply-antifraud.yml"]:
    if temporary.exists():
        temporary.unlink()

print("Correção antifraude aplicada com sucesso.")
