import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Target, Plus, Bell, User } from "lucide-react";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const left: Array<{ to: string; icon: typeof Home; label: string; dot?: boolean }> = [
    { to: "/feed", icon: Home, label: "Início" },
    { to: "/duelos", icon: Target, label: "Duelos" },
  ];
  const right: Array<{ to: string; icon: typeof Home; label: string; dot?: boolean }> = [
    { to: "/notificacoes", icon: Bell, label: "Notificações", dot: true },
    { to: "/perfil", icon: User, label: "Perfil" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto flex max-w-md items-end justify-between px-6 pt-2 pb-3">
        <div className="flex flex-1 justify-around">
          {left.map(({ to, icon: Icon, label }) => (
            <NavItem key={label} to={to} Icon={Icon} label={label} active={path === to} />
          ))}
        </div>
        <Link
          to="/nova-meta"
          className="absolute left-1/2 -top-6 -translate-x-1/2 flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-glow text-primary-foreground active:scale-95 transition-transform"
        >
          <Plus size={28} strokeWidth={2.5} />
        </Link>
        <div className="flex flex-1 justify-around">
          {right.map(({ to, icon: Icon, label, dot }) => (
            <NavItem key={label} to={to} Icon={Icon} label={label} active={path === to} dot={dot} />
          ))}
        </div>
      </div>
    </nav>
  );
}

function NavItem({ to, Icon, label, active, dot }: { to: string; Icon: typeof Home; label: string; active: boolean; dot?: boolean }) {
  return (
    <Link to={to} className={`flex flex-col items-center gap-1 px-2 transition-colors ${active ? "text-primary-light" : "text-muted-foreground"}`}>
      <span className="relative">
        <Icon size={22} strokeWidth={active ? 2.4 : 2} />
        {dot && <span className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
