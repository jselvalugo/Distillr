import { type ReactNode, useState, useRef, useEffect, useLayoutEffect } from "react";
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
  Factory,
  Handshake,
  SlidersHorizontal,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";
import { apiRequest } from "../lib/queryClient";
import { DistillrMark, DistillrWordmark, PoweredBy } from "./brand/logo";
import { DEFAULT_DASHBOARD_COLOR } from "../brand";

type PlatformConfig = {
  organizationName: string;
  organizationNameOverride: string | null;
  logoDataUrl: string | null;
  dashboardColor: string | null;
};

type AppItem = {
  href: string;
  label: string;
  sub: string;
  icon: LucideIcon;
  /** Extra route prefixes that belong to this page (forms, detail pages). */
  match?: string[];
};

type AppGroup = { label: string; blurb: string; icon: LucideIcon; items: AppItem[] };

const APP_GROUPS: AppGroup[] = [
  {
    label: "Operations",
    blurb: "Production, aging & stock",
    icon: Factory,
    items: [
      { href: "/production", label: "Production", sub: "Batches & distilling runs", icon: FlaskConical },
      { href: "/barrels", label: "Aging", sub: "Aging & warehouse tracking", icon: Layers },
      { href: "/inventory", label: "Inventory", sub: "Lots, items & stock", icon: Package },
      { href: "/floor-plan", label: "Floor Plan", sub: "Equipment & layout", icon: LayoutGrid },
    ],
  },
  {
    label: "Sales",
    blurb: "Orders, partners & facilities",
    icon: Handshake,
    items: [
      { href: "/sales-orders", label: "Sales Orders", sub: "Orders & fulfillment", icon: ShoppingCart },
      { href: "/clients", label: "Trading Partners", sub: "Distributors & retailers", icon: Users },
      { href: "/properties", label: "Facilities", sub: "Locations & properties", icon: Building2 },
    ],
  },
  {
    label: "Compliance & Reporting",
    blurb: "Filings, permits & TTB",
    icon: ShieldCheck,
    items: [
      { href: "/compliance", label: "Compliance", sub: "Records & filings", icon: ShieldCheck },
      {
        href: "/compliance-regulatory",
        label: "Regulatory",
        sub: "Permits & licenses",
        icon: FileText,
        match: ["/permits", "/cola", "/labels", "/excise"],
      },
      { href: "/reports", label: "Reports", sub: "TTB & excise tax", icon: BarChart3 },
    ],
  },
  {
    label: "Admin",
    blurb: "Team, access & settings",
    icon: SlidersHorizontal,
    items: [
      { href: "/staff", label: "Staff", sub: "Team & scheduling", icon: UserCog },
      { href: "/users", label: "Users", sub: "Accounts & access", icon: Users },
      { href: "/settings", label: "Settings", sub: "Platform configuration", icon: Settings },
    ],
  },
];

/** True when `location` is `prefix` itself or a sub-path of it (segment-aware). */
function isUnder(location: string, prefix: string): boolean {
  return location === prefix || location.startsWith(prefix + "/");
}

function itemMatches(item: AppItem, location: string): boolean {
  return [item.href, ...(item.match ?? [])].some((p) => isUnder(location, p));
}

function findActive(location: string): { group: AppGroup; item: AppItem } | null {
  for (const group of APP_GROUPS) {
    for (const item of group.items) {
      if (itemMatches(item, location)) return { group, item };
    }
  }
  return null;
}

const tint = (pct: number) => `color-mix(in srgb, var(--brand, #4F46E5) ${pct}%, white)`;

function AppLauncher() {
  const [open, setOpen] = useState(false);
  const [location, navigate] = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const active = findActive(location);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Close on navigation
  useEffect(() => { setOpen(false); }, [location]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`p-2 rounded-md transition-colors ${open ? "text-white bg-white/15" : "text-white/60 hover:text-white hover:bg-white/10"}`}
        aria-label="App launcher"
        aria-expanded={open}
      >
        <LayoutGrid size={18} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-2 z-50 w-[min(480px,calc(100vw-24px))] rounded-2xl bg-white p-2 shadow-[0_24px_60px_-20px_rgba(15,27,66,0.45)] ring-1 ring-black/5 origin-top-left launchpad-pop"
          >
            <div className="flex items-center justify-between px-3 pt-2 pb-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#a3a3a3]">Launchpad</p>
              <DistillrMark size={16} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {APP_GROUPS.map((group) => {
                const Icon = group.icon;
                const isActive = active?.group.label === group.label;
                return (
                  <button
                    key={group.label}
                    onClick={() => {
                      if (isActive) setOpen(false);
                      else navigate(group.items[0].href);
                    }}
                    className={`group relative flex flex-col items-start gap-3 rounded-xl p-3.5 text-left transition-all duration-150 ${
                      isActive ? "ring-1 ring-[var(--brand,#4F46E5)]/25" : "hover:bg-[#f6f6f7]"
                    }`}
                    style={isActive ? { background: tint(7) } : undefined}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-sm transition-transform duration-150 group-hover:scale-105"
                        style={{ background: "var(--brand, #4F46E5)" }}
                      >
                        <Icon size={17} strokeWidth={2} />
                      </span>
                      <ArrowUpRight
                        size={14}
                        className="text-[#c4c4c4] opacity-0 -translate-x-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-x-0"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[#0a0a0a] leading-tight">{group.label}</p>
                      <p className="mt-0.5 text-[11px] text-[#8a8a8a] leading-snug">{group.blurb}</p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {group.items.map((item) => (
                        <span
                          key={item.href}
                          className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-[#6b6b6b]"
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Thin secondary bar listing the pages of the current category. The active
 * page gets a brand-colored underline that slides between tabs.
 */
function CategoryNav() {
  const [location, navigate] = useLocation();
  const active = findActive(location);
  const barRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const activeHref = active?.item.href;

  useLayoutEffect(() => {
    const measure = () => {
      const tab = activeHref ? tabRefs.current[activeHref] : null;
      const bar = barRef.current;
      if (!tab || !bar) return setIndicator(null);
      setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeHref, active?.group.label]);

  useEffect(() => {
    // Keep the active tab in view on narrow screens.
    if (activeHref) tabRefs.current[activeHref]?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeHref]);

  if (!active) return null;
  const GroupIcon = active.group.icon;

  return (
    <nav
      aria-label={`${active.group.label} pages`}
      className="h-10 shrink-0 border-b border-[#ececec] bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/70"
    >
      <div className="flex h-full items-stretch px-2 sm:px-4">
        <div className="hidden sm:flex items-center gap-1.5 pr-3 mr-1 border-r border-[#efefef]">
          <GroupIcon size={13} className="text-[var(--brand,#4F46E5)]" strokeWidth={2.25} />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a9a9a] whitespace-nowrap">
            {active.group.label}
          </span>
        </div>
        <div
          ref={barRef}
          className="relative flex h-full items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {active.group.items.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === activeHref;
            return (
              <button
                key={item.href}
                ref={(el) => { tabRefs.current[item.href] = el; }}
                onClick={() => { if (location !== item.href) navigate(item.href); }}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex items-center gap-1.5 px-3 text-[12.5px] whitespace-nowrap transition-colors duration-150 ${
                  isActive ? "text-[#0a0a0a] font-semibold" : "text-[#7a7a7a] font-medium hover:text-[#0a0a0a]"
                }`}
              >
                <Icon
                  size={13}
                  strokeWidth={2.25}
                  className={isActive ? "text-[var(--brand,#4F46E5)]" : "text-[#a8a8a8]"}
                />
                {item.label}
              </button>
            );
          })}
          {indicator && (
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-[var(--brand,#4F46E5)] transition-all duration-300 ease-out"
              style={{ left: indicator.left + 8, width: Math.max(indicator.width - 16, 12) }}
            />
          )}
        </div>
      </div>
    </nav>
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

function MobileDrawer({ open, onClose, navColor }: { open: boolean; onClose: () => void; navColor?: string }) {
  const [location] = useLocation();
  const [, navigate] = useLocation();
  const isDashboard = location === "/";
  const drawerBg = navColor ?? NAVY;

  useEffect(() => { if (open) onClose(); }, [location]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 md:hidden" onClick={onClose} />
      <div className="fixed inset-y-0 left-0 z-50 w-72 flex flex-col md:hidden overflow-y-auto" style={{ background: drawerBg }}>
        <div className="flex items-center justify-between px-4 h-12 border-b border-white/10 shrink-0">
          <DistillrWordmark variant="mono-white" height={16} />
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
                const isActive = itemMatches(item, location);
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

const NAVY = DEFAULT_DASHBOARD_COLOR;

function TopNav() {
  const [location] = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDashboard = location === "/";
  const { data: config } = useQuery<PlatformConfig>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest<PlatformConfig>("/api/platform-config"),
    staleTime: 60_000,
  });

  const orgName = config?.organizationNameOverride || config?.organizationName;
  const dashColor = config?.dashboardColor ?? NAVY;

  useEffect(() => {
    document.documentElement.style.setProperty("--brand", dashColor);
  }, [dashColor]);

  return (
    <>
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} navColor={dashColor} />
      <header className="h-12 flex items-center px-4 gap-3 shrink-0 border-b border-white/10" style={{ background: dashColor }}>
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
          <div className="flex flex-col leading-none min-w-0 gap-[3px]">
            {orgName ? (
              <>
                <span className="text-white text-sm font-bold tracking-tight truncate">{orgName}</span>
                <span className="hidden sm:block">
                  <PoweredBy tone="light" />
                </span>
              </>
            ) : (
              <DistillrWordmark variant="mono-white" height={16} />
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
      <CategoryNav />
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
