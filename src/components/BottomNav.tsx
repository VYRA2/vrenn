import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Target, Plus, Bell, User } from "lucide-react";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/feed", icon: Home, label: "Início" },
    { to: "/perfil", icon: Target, label: "Metas" },
  ] as const;
  const right = [
    { to: "/notificacoes", icon: Bell, label: "Alertas" },
    { to: "/perfil", icon: User, label: "Perfil" },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around px-4 py-2 relative">
        {items.map(({ to, icon: Icon, label }) => {
          const active = path === to;
          return (
            <Link key={label} to={to} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
        <Link to="/nova-meta" className="flex items-center justify-center -mt-8 w-14 h-14 rounded-full bg-gradient-primary shadow-glow text-primary-foreground">
          <Plus size={28} strokeWidth={2.5} />
        </Link>
        {right.map(({ to, icon: Icon, label }) => {
          const active = path === to;
          return (
            <Link key={label} to={to} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
