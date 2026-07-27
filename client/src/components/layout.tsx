import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "../hooks/use-auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/barrels", label: "Barrels" },
  { href: "/production", label: "Production" },
  { href: "/inventory", label: "Inventory" },
  { href: "/compliance", label: "Compliance" },
  { href: "/clients", label: "Trading Partners" },
  { href: "/properties", label: "Facilities" },
  { href: "/sales-orders", label: "Sales Orders" },
  { href: "/staff", label: "Staff" },
  { href: "/users", label: "Users" },
];

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen bg-[#f7f7f7]">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-[#0a0a0a] flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <h1 className="text-white text-sm font-bold tracking-tight">Distillr</h1>
          <p className="text-white/40 text-xs mt-0.5">Distillery Operations</p>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {NAV.map((item) => {
            const active =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={`flex items-center px-5 py-2 text-xs font-medium transition-colors ${
                    active
                      ? "bg-white/15 text-white"
                      : "text-white/55 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-white/70 text-xs font-medium truncate">{user?.name}</p>
          <p className="text-white/30 text-xs capitalize mt-0.5">{user?.role}</p>
          <button
            onClick={() => logout.mutate()}
            className="mt-3 text-xs text-white/35 hover:text-white/70 transition-colors"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between px-6 py-5 bg-white border-b border-[#e5e5e5]">
      <div>
        <h2 className="text-base font-semibold text-[#0a0a0a]">{title}</h2>
        {subtitle && <p className="text-xs text-[#737373] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
