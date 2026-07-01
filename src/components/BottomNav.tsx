import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Home, Compass, Plus, Bell, User, X, Flag, Camera, Swords, Shield, UserPlus } from "lucide-react";
import { useState } from "react";

export function BottomNav({ onPublish }: { onPublish?: () => void } = {}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [openSheet, setOpenSheet] = useState(false);
  const navigate = useNavigate();

  const left = [
    { to: "/feed", icon: Home, label: "Início" },
    { to: "/busca", icon: Compass, label: "Descobrir" },
  ] as const;
  const right = [
    { to: "/notificacoes", icon: Bell, label: "Notificações" },
    { to: "/perfil", icon: User, label: "Perfil" },
  ] as const;

  function go(to: string) {
    setOpenSheet(false);
    navigate({ to });
  }

  function publish() {
    setOpenSheet(false);
    if (onPublish) onPublish();
    else navigate({ to: "/feed", search: { publish: 1 } as any });
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
        <div className="relative mx-auto flex max-w-md items-end justify-between px-4 pt-2 pb-3">
          <div className="flex flex-1 justify-around">
            {left.map(({ to, icon: Icon, label }) => (
              <NavItem key={label} to={to} Icon={Icon} label={label} active={path === to || path.startsWith(to + "/")} />
            ))}
          </div>
          <button
            onClick={() => setOpenSheet(true)}
            aria-label="Criar"
            className="absolute left-1/2 -top-6 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-glow text-primary-foreground active:scale-95 transition-transform"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
          <div className="flex flex-1 justify-around">
            {right.map(({ to, icon: Icon, label }) => (
              <NavItem key={label} to={to} Icon={Icon} label={label} active={path === to || path.startsWith(to + "/")} />
            ))}
          </div>
        </div>
      </nav>

      {openSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={() => setOpenSheet(false)}>
          <div className="w-full max-w-md rounded-t-3xl border-t border-border bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-bold">Criar</h3>
              <button onClick={() => setOpenSheet(false)} className="rounded-full p-1.5 text-muted-foreground hover:bg-background"><X size={18} /></button>
            </div>
            <div className="space-y-2">
              <SheetItem icon={<Camera size={20} />} title="Publicar prova" desc="Foto ou vídeo vinculado a uma meta" onClick={publish} color="#7B3FF2" />
              <SheetItem icon={<Flag size={20} />} title="Criar meta" desc="Defina um novo compromisso público" onClick={() => go("/nova-meta")} color="#22D3A1" />
              <SheetItem icon={<Swords size={20} />} title="Criar duelo" desc="Desafie alguém em uma meta" onClick={() => go("/duelos")} color="#A855F7" />
              <SheetItem icon={<Shield size={20} />} title="Criar desafio de equipe" desc="Lance um desafio para sua equipe" onClick={() => go("/equipes")} color="#F59E0B" />
              <SheetItem icon={<UserPlus size={20} />} title="Criar equipe" desc="Reúna pessoas com o mesmo objetivo" onClick={() => go("/equipes/nova")} color="#22D3A1" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SheetItem({ icon, title, desc, onClick, color }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}20`, color }}>{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}

function NavItem({ to, Icon, label, active }: { to: string; Icon: typeof Home; label: string; active: boolean }) {
  return (
    <Link to={to} className={`flex flex-col items-center gap-1 px-1 transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
      <Icon size={22} strokeWidth={active ? 2.4 : 2} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}
