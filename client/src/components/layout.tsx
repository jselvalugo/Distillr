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
  Menu,
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
    label: "Operations",
    items: [
      { href: "/production", label: "Production", sub: "Batches & distilling runs", icon: FlaskConical },
      { href: "/barrels", label: "Barrels", sub: "Aging & warehouse tracking", icon: Layers },
      { href: "/inventory", label: "Inventory", sub: "Lots, items & stock", icon: Package },
      { href: "/floor-plan", label: "Floor Plan", sub: "Equipment & layout", icon: LayoutGrid },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/sales-orders", label: "Sales Orders", sub: "Orders & fulfillment", icon: ShoppingCart },
      { href: "/clients", label: "Trading Partners", sub: "Distributors & retailers", icon: Users },
      { href: "/properties", label: "Facilities", sub: "Locations & properties", icon: Building2 },
    ],
  },
  {
    label: "Compliance & Reporting",
    items: [
      { href: "/compliance", label: "Compliance", sub: "Records & filings", icon: ShieldCheck },
      { href: "/compliance-regulatory", label: "Regulatory", sub: "Permits & licenses", icon: FileText },
      { href: "/reports", label: "Reports", sub: "TTB & excise tax", icon: BarChart3 },
    ],
  },
  {
    label: "Admin",
    items: [
      { href: "/staff", label: "Staff", sub: "Team & scheduling", icon: UserCog },
      { href: "/users", label: "Users", sub: "Accounts & access", icon: Users },
      { href: "/settings", label: "Settings", sub: "Platform configuration", icon: Settings },
    ],
  },
];

function AppLauncher() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [location]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-md transition-colors ${open ? "text-white bg-white/15" : "text-white/60 hover:text-white hover:bg-white/10"}`}
        aria-label="App launcher"
      >
        <LayoutGrid size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-[min(400px,calc(100vw-24px))] bg-white rounded-xl shadow-2xl border border-[#e5e5e5] overflow-hidden">

            {/* Groups */}
            <div className="p-3 space-y-0.5 max-h-[80vh] overflow-y-auto">
              {APP_GROUPS.map((group, gi) => (
                <div key={group.label}>
                  {/* Group label */}
                  <p className="px-2 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
                    {group.label}
                  </p>
                  {/* Items */}
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location === item.href;
                    return (
                      <button
                        key={item.href}
                        onClick={() => { navigate(item.href); setOpen(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                          isActive
                            ? "bg-[#0a0a0a] text-white"
                            : "hover:bg-[#f5f5f5] text-[#0a0a0a]"
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive ? "bg-white/15" : "bg-[#f0f0f0] group-hover:bg-[#e8e8e8]"
                        }`}>
                          <Icon size={15} className={isActive ? "text-white" : "text-[#555]"} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-semibold leading-none mb-0.5 ${isActive ? "text-white" : "text-[#0a0a0a]"}`}>
                            {item.label}
                          </p>
                          <p className={`text-[10px] leading-none truncate ${isActive ? "text-white/50" : "text-[#a3a3a3]"}`}>
                            {item.sub}
                          </p>
                        </div>
                        {isActive && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                  {/* Divider between groups */}
                  {gi < APP_GROUPS.length - 1 && (
                    <div className="mt-2 border-t border-[#f0f0f0]" />
                  )}
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

function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [location] = useLocation();
  const [, navigate] = useLocation();

  useEffect(() => { if (open) onClose(); }, [location]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0a] flex flex-col md:hidden overflow-y-auto">
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/10 shrink-0">
          <span className="text-white text-sm font-bold tracking-tight">Menu</span>
          <button onClick={onClose} className="text-white/60 hover:text-white p-1.5 rounded-md hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-3 space-y-0.5 flex-1">
          {APP_GROUPS.map((group, gi) => (
            <div key={group.label}>
              <p className="px-2 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0]">
                {group.label}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => { navigate(item.href); onClose(); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      isActive ? "bg-white/15 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? "bg-white/20" : "bg-white/8"
                    }`}>
                      <Icon size={14} className={isActive ? "text-white" : "text-white/60"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-none mb-0.5">{item.label}</p>
                      <p className="text-[10px] leading-none truncate text-white/40">{item.sub}</p>
                    </div>
                  </button>
                );
              })}
              {gi < APP_GROUPS.length - 1 && (
                <div className="mt-2 border-t border-white/8" />
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TopNav() {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: config } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest<PlatformConfig>("/api/platform-config"),
    staleTime: 60_000,
  });

  const orgName = config?.organizationNameOverride || config?.organizationName;

  return (
    <>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <header className="h-12 bg-[#0a0a0a] flex items-center px-4 gap-3 shrink-0 border-b border-white/10">
        {/* Hamburger — mobile only */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="md:hidden p-2 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>

        {/* App launcher — desktop only */}
        <div className="hidden md:block">
          <AppLauncher />
        </div>

        <Link
          href="/"
          className={`p-2 rounded-md transition-colors ${location === "/" ? "text-white bg-white/15" : "text-white/40 hover:text-white hover:bg-white/10"}`}
          title="Dashboard"
        >
          <BarChart3 size={15} />
        </Link>

        <div className="w-px h-4 bg-white/10" />

        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {config?.logoDataUrl && (
            <img src={config.logoDataUrl} alt="Logo" className="h-6 object-contain shrink-0" />
          )}
          <div className="flex flex-col leading-none min-w-0">
            {orgName ? (
              <>
                <span className="text-white text-sm font-bold tracking-tight truncate">{orgName}</span>
                <span className="text-white/35 text-[9px] tracking-widest uppercase hidden sm:block">Powered by Distillr — A Loogo Labs Software</span>
              </>
            ) : (
              <span className="text-white text-sm font-bold tracking-tight">Distillr</span>
            )}
          </div>
        </div>

        <UserMenu />
      </header>
    </>
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
    <div className="flex flex-wrap items-start justify-between gap-y-2 px-4 sm:px-6 py-4 sm:py-5 bg-white border-b border-[#e5e5e5]">
      <div>
        <h2 className="text-base font-semibold text-[#0a0a0a]">{title}</h2>
        {subtitle && <p className="text-xs text-[#737373] mt-0.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
