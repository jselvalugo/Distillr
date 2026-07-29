import { type ReactNode, useState, useRef, useEffect } from "react";
import { AiChatPanel } from "./ai-chat-panel";
import { Link, useLocation } from "wouter";
import {
  LayoutGrid,
  BarChart3,
  FlaskConical,
  Package,
  ShieldCheck,
  Users,
  Building2,
  ShoppingCart,
  UserCog,
  FileText,
  Settings,
  Layers,
  X,
  ChevronDown,
  LogOut,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { apiRequest } from "../lib/queryClient";

type PlatformConfig = {
  organizationName: string;
  organizationNameOverride: string | null;
  logoDataUrl: string | null;
};

const APP_GROUPS = [
  {
    label: "Production",
    apps: [
      { href: "/", label: "Dashboard", icon: BarChart3, gradient: "from-[#1a1a2e] to-[#16213e]" },
      { href: "/production", label: "Production", icon: FlaskConical, gradient: "from-[#0f3460] to-[#533483]" },
      { href: "/barrels", label: "Barrels", icon: Layers, gradient: "from-[#2d4a22] to-[#1a3a12]" },
    ],
  },
  {
    label: "Inventory & Sales",
    apps: [
      { href: "/inventory", label: "Inventory", icon: Package, gradient: "from-[#4a2d1a] to-[#6b3f22]" },
      { href: "/sales-orders", label: "Sales Orders", icon: ShoppingCart, gradient: "from-[#1a3a4a] to-[#0d2d3d]" },
      { href: "/clients", label: "Trading Partners", icon: Users, gradient: "from-[#2d1a4a] to-[#3d2060]" },
    ],
  },
  {
    label: "Compliance & Regulatory",
    apps: [
      { href: "/compliance", label: "Compliance", icon: ShieldCheck, gradient: "from-[#4a1a1a] to-[#6b2020]" },
      { href: "/compliance-regulatory", label: "Regulatory", icon: FileText, gradient: "from-[#3a1a4a] to-[#52246b]" },
      { href: "/reports", label: "Reports", icon: BarChart3, gradient: "from-[#1a4a3a] to-[#0d3328]" },
    ],
  },
  {
    label: "Operations",
    apps: [
      { href: "/floor-plan", label: "Floor Plan", icon: LayoutGrid, gradient: "from-[#1a3a2a] to-[#0d2a1d]" },
      { href: "/properties", label: "Facilities", icon: Building2, gradient: "from-[#3a3a1a] to-[#4a4a0d]" },
      { href: "/staff", label: "Staff", icon: UserCog, gradient: "from-[#1a2d4a] to-[#0d1f3d]" },
      { href: "/users", label: "Users", icon: Users, gradient: "from-[#2a2a2a] to-[#3a3a3a]" },
    ],
  },
  {
    label: "Configuration",
    apps: [
      { href: "/settings", label: "Settings", icon: Settings, gradient: "from-[#1a1a1a] to-[#2a2a2a]" },
    ],
  },
];

function AppLauncher() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-2 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        aria-label="App launcher"
      >
        <LayoutGrid size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-[520px] bg-white rounded-xl shadow-2xl border border-[#e5e5e5] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#e5e5e5]">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">App Launcher</span>
              <button onClick={() => setOpen(false)} className="text-[#737373] hover:text-[#0a0a0a] transition-colors">
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {APP_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] font-semibold text-[#a3a3a3] uppercase tracking-wider mb-2">{group.label}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {group.apps.map((app) => {
                      const Icon = app.icon;
                      return (
                        <button
                          key={app.href}
                          onClick={() => { navigate(app.href); setOpen(false); }}
                          className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[#f7f7f7] transition-colors group"
                        >
                          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${app.gradient} flex items-center justify-center shadow-sm`}>
                            <Icon size={18} className="text-white" />
                          </div>
                          <span className="text-[11px] font-medium text-[#0a0a0a] group-hover:text-[#0a0a0a] text-center leading-tight">{app.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "??";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/10 transition-colors"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4a1a6b] to-[#1a3a6b] flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">{initials}</span>
        </div>
        <span className="text-xs font-medium text-white/80 hidden sm:block">{user?.name}</span>
        <ChevronDown size={12} className="text-white/50" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-60 bg-white rounded-xl shadow-2xl border border-[#e5e5e5] overflow-hidden">
          <div className="p-4 border-b border-[#e5e5e5]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4a1a6b] to-[#1a3a6b] flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-white">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#0a0a0a] truncate">{user?.name}</p>
                <p className="text-xs text-[#737373] truncate">{user?.email}</p>
                <span className="inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#0a0a0a]/8 text-[#0a0a0a] capitalize">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
          <div className="p-1.5">
            {user?.role === "admin" && (
              <button
                onClick={() => { navigate("/settings"); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[#0a0a0a] rounded-md hover:bg-[#f7f7f7] transition-colors text-left"
              >
                <Settings size={13} className="text-[#737373]" />
                Settings
              </button>
            )}
            <button
              onClick={() => { logout.mutate(); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-red-600 rounded-md hover:bg-red-50 transition-colors text-left"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TopNav() {
  const { data: config } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest<PlatformConfig>("/api/platform-config"),
    staleTime: 60_000,
  });

  const orgName = config?.organizationNameOverride || config?.organizationName;

  return (
    <header className="h-12 bg-[#0a0a0a] flex items-center px-4 gap-3 shrink-0 border-b border-white/10">
      <AppLauncher />

      <div className="flex items-center gap-2.5">
        {config?.logoDataUrl && (
          <img src={config.logoDataUrl} alt="Logo" className="h-6 object-contain" />
        )}
        <div className="flex flex-col leading-none">
          {orgName ? (
            <>
              <span className="text-white text-sm font-bold tracking-tight">{orgName}</span>
              <span className="text-white/35 text-[9px] tracking-widest uppercase">Powered by Distillr — A Loogo Labs Software</span>
            </>
          ) : (
            <span className="text-white text-sm font-bold tracking-tight">Distillr</span>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <UserMenu />
    </header>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col h-screen bg-[#f7f7f7]">
      <TopNav />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <AiChatPanel />
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
