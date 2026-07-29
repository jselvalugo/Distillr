import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Dialog } from "../components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Equipment {
  id: string;
  name: string;
  displayName: string | null;
  type: string;
  zone: string;
  capacity: number | null;
  capacityUnit: string;
  status: string;
  linkedBatchId: string | null;
  linkedBarrelId: string | null;
  notes: string | null;
  sortOrder: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ZONE_ORDER = ["mash_cook", "fermentation", "distillation", "barreling", "bottling", "other"] as const;
type ZoneKey = typeof ZONE_ORDER[number];

const ZONE_LABELS: Record<ZoneKey, string> = {
  mash_cook: "Mash & Cook",
  fermentation: "Fermentation",
  distillation: "Distillation",
  barreling: "Barreling & Aging",
  bottling: "Bottling",
  other: "Other",
};

const EQUIPMENT_TYPES = [
  { value: "mash_tun", label: "Mash Tun" },
  { value: "fermenter", label: "Fermenter" },
  { value: "pot_still", label: "Pot Still" },
  { value: "column_still", label: "Column Still" },
  { value: "barrel_rack", label: "Barrel Rack" },
  { value: "bottling_line", label: "Bottling Line" },
  { value: "tank", label: "Tank" },
  { value: "other", label: "Other" },
];

const ZONES = ZONE_ORDER.map(z => ({ value: z, label: ZONE_LABELS[z] }));

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string }> = {
  empty:       { label: "Empty",       dot: "bg-[#d4d4d4]",   bg: "bg-[#f5f5f5]" },
  in_use:      { label: "In Use",      dot: "bg-[#3b82f6]",   bg: "bg-[#eff6ff]" },
  cleaning:    { label: "Cleaning",    dot: "bg-amber-400",   bg: "bg-amber-50" },
  maintenance: { label: "Maintenance", dot: "bg-red-400",     bg: "bg-red-50" },
  offline:     { label: "Offline",     dot: "bg-[#0a0a0a]",   bg: "bg-[#f0f0f0]" },
};

const EMPTY_FORM = {
  name: "", displayName: "", type: "tank", zone: "other",
  status: "empty", capacity: "", capacityUnit: "gallons", notes: "",
};
type FormState = typeof EMPTY_FORM;

// ---------------------------------------------------------------------------
// SVG Equipment Illustrations
// Each is ~120×140 px, copper/amber tones with black outlines
// ---------------------------------------------------------------------------
function MashTunSVG() {
  return (
    <svg viewBox="0 0 120 140" width="100" height="116" fill="none">
      <ellipse cx="60" cy="28" rx="38" ry="10" fill="#c9933a" opacity=".25" stroke="#c9933a" strokeWidth="2"/>
      <path d="M22 28 L22 100 Q22 118 60 118 Q98 118 98 100 L98 28" fill="#f5e6c8" stroke="#c9933a" strokeWidth="2"/>
      <ellipse cx="60" cy="28" rx="38" ry="10" fill="#f5e6c8" stroke="#c9933a" strokeWidth="2"/>
      <line x1="22" y1="55" x2="98" y2="55" stroke="#c9933a" strokeWidth="1.5" opacity=".5"/>
      <line x1="22" y1="75" x2="98" y2="75" stroke="#c9933a" strokeWidth="1.5" opacity=".5"/>
      <rect x="54" y="18" width="12" height="10" rx="2" fill="#c9933a" opacity=".6"/>
      <line x1="60" y1="118" x2="60" y2="132" stroke="#888" strokeWidth="3"/>
      <line x1="48" y1="132" x2="72" y2="132" stroke="#888" strokeWidth="3"/>
    </svg>
  );
}

function FermenterSVG() {
  return (
    <svg viewBox="0 0 120 150" width="100" height="125" fill="none">
      <path d="M30 38 Q30 18 60 18 Q90 18 90 38 L90 112 Q90 128 60 128 Q30 128 30 112 Z"
        fill="#e8f4e8" stroke="#2d7a3a" strokeWidth="2"/>
      <path d="M30 38 Q30 18 60 18 Q90 18 90 38" fill="#c8e8c8" stroke="#2d7a3a" strokeWidth="2"/>
      <line x1="30" y1="62" x2="90" y2="62" stroke="#2d7a3a" strokeWidth="1.5" opacity=".4"/>
      <line x1="30" y1="82" x2="90" y2="82" stroke="#2d7a3a" strokeWidth="1.5" opacity=".4"/>
      <line x1="30" y1="102" x2="90" y2="102" stroke="#2d7a3a" strokeWidth="1.5" opacity=".4"/>
      <rect x="88" y="70" width="16" height="8" rx="2" fill="#2d7a3a" opacity=".5"/>
      <circle cx="100" cy="74" r="3" fill="#2d7a3a" opacity=".7"/>
      <line x1="60" y1="128" x2="60" y2="142" stroke="#888" strokeWidth="3"/>
    </svg>
  );
}

function PotStillSVG() {
  return (
    <svg viewBox="0 0 140 150" width="116" height="125" fill="none">
      {/* pot */}
      <ellipse cx="52" cy="104" rx="34" ry="28" fill="#f5e6c8" stroke="#c9933a" strokeWidth="2"/>
      <ellipse cx="52" cy="92" rx="34" ry="16" fill="#fdf3e0" stroke="#c9933a" strokeWidth="2"/>
      {/* neck */}
      <path d="M46 78 Q42 50 52 38 Q62 26 72 30" stroke="#c9933a" strokeWidth="3" fill="none" strokeLinecap="round"/>
      {/* lyne arm */}
      <path d="M72 30 Q100 22 118 32" stroke="#c9933a" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <circle cx="118" cy="32" r="5" fill="#c9933a" opacity=".6"/>
      {/* flame */}
      <path d="M42 120 Q44 108 52 112 Q54 102 58 108 Q62 96 66 108 Q70 102 72 110 Q76 108 76 118 Q76 132 59 132 Q42 132 42 120Z"
        fill="#f97316" opacity=".7"/>
      <path d="M48 120 Q50 112 54 116 Q56 108 60 112 Q64 104 68 112 Q70 110 70 120 Q70 128 59 128 Q48 128 48 120Z"
        fill="#fbbf24" opacity=".8"/>
    </svg>
  );
}

function ColumnStillSVG() {
  return (
    <svg viewBox="0 0 120 160" width="100" height="133" fill="none">
      <rect x="36" y="10" width="48" height="120" rx="4" fill="#e8eef5" stroke="#2d4a7a" strokeWidth="2"/>
      {[30, 48, 66, 84, 102].map(y => (
        <line key={y} x1="36" y1={y} x2="84" y2={y} stroke="#2d4a7a" strokeWidth="1.5" opacity=".4"/>
      ))}
      <rect x="26" y="126" width="68" height="14" rx="3" fill="#2d4a7a" opacity=".3"/>
      <rect x="56" y="4" width="8" height="10" rx="2" fill="#2d4a7a" opacity=".5"/>
      <line x1="84" y1="70" x2="100" y2="70" stroke="#2d4a7a" strokeWidth="2"/>
      <line x1="84" y1="50" x2="100" y2="50" stroke="#2d4a7a" strokeWidth="2"/>
    </svg>
  );
}

function BarrelRackSVG() {
  return (
    <svg viewBox="0 0 160 130" width="133" height="108" fill="none">
      {/* rack frame */}
      <rect x="8" y="8" width="144" height="114" rx="3" fill="none" stroke="#888" strokeWidth="1.5" strokeDasharray="4 3" opacity=".4"/>
      {/* barrel 1 */}
      <ellipse cx="48" cy="62" rx="28" ry="38" fill="#f5e6c8" stroke="#c9933a" strokeWidth="2"/>
      <ellipse cx="48" cy="38" rx="28" ry="10" fill="#fdf3e0" stroke="#c9933a" strokeWidth="1.5"/>
      <line x1="20" y1="50" x2="76" y2="50" stroke="#c9933a" strokeWidth="1.5" opacity=".5"/>
      <line x1="20" y1="76" x2="76" y2="76" stroke="#c9933a" strokeWidth="1.5" opacity=".5"/>
      {/* barrel 2 */}
      <ellipse cx="112" cy="62" rx="28" ry="38" fill="#f5e6c8" stroke="#c9933a" strokeWidth="2"/>
      <ellipse cx="112" cy="38" rx="28" ry="10" fill="#fdf3e0" stroke="#c9933a" strokeWidth="1.5"/>
      <line x1="84" y1="50" x2="140" y2="50" stroke="#c9933a" strokeWidth="1.5" opacity=".5"/>
      <line x1="84" y1="76" x2="140" y2="76" stroke="#c9933a" strokeWidth="1.5" opacity=".5"/>
      <line x1="8" y1="108" x2="152" y2="108" stroke="#888" strokeWidth="2.5"/>
    </svg>
  );
}

function BottlingLineSVG() {
  return (
    <svg viewBox="0 0 160 140" width="133" height="116" fill="none">
      {[28, 68, 108].map(x => (
        <g key={x}>
          <rect x={x} y="30" width="24" height="10" rx="2" fill="#6b7280" opacity=".4"/>
          <path d={`M${x+2} 40 L${x+2} 96 Q${x+2} 110 ${x+12} 110 Q${x+22} 110 ${x+22} 96 L${x+22} 40`}
            fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
          <ellipse cx={x+12} cy="110" rx="10" ry="4" fill="#bfdbfe" stroke="#3b82f6" strokeWidth="1.5"/>
        </g>
      ))}
      <rect x="10" y="112" width="140" height="8" rx="2" fill="#d1d5db"/>
      <rect x="10" y="118" width="140" height="6" rx="1" fill="#9ca3af"/>
    </svg>
  );
}

function TankSVG() {
  return (
    <svg viewBox="0 0 120 150" width="100" height="125" fill="none">
      <ellipse cx="60" cy="28" rx="40" ry="12" fill="#e8f4f8" stroke="#0369a1" strokeWidth="2"/>
      <ellipse cx="60" cy="118" rx="40" ry="12" fill="#e8f4f8" stroke="#0369a1" strokeWidth="2"/>
      <rect x="20" y="28" width="80" height="90" fill="#f0f9ff" stroke="#0369a1" strokeWidth="2"/>
      <ellipse cx="60" cy="28" rx="40" ry="12" fill="#bae6fd" stroke="#0369a1" strokeWidth="2"/>
      <line x1="20" y1="60" x2="100" y2="60" stroke="#0369a1" strokeWidth="1" opacity=".3"/>
      <line x1="20" y1="90" x2="100" y2="90" stroke="#0369a1" strokeWidth="1" opacity=".3"/>
      <rect x="98" y="68" width="14" height="6" rx="2" fill="#0369a1" opacity=".5"/>
    </svg>
  );
}

function OtherSVG() {
  return (
    <svg viewBox="0 0 120 120" width="100" height="100" fill="none">
      <rect x="20" y="20" width="80" height="80" rx="6" fill="#f5f5f5" stroke="#737373" strokeWidth="2"/>
      <line x1="20" y1="50" x2="100" y2="50" stroke="#737373" strokeWidth="1.5" opacity=".4"/>
      <line x1="50" y1="50" x2="50" y2="100" stroke="#737373" strokeWidth="1.5" opacity=".4"/>
      <circle cx="35" cy="35" r="6" fill="#737373" opacity=".3"/>
      <circle cx="75" cy="35" r="6" fill="#737373" opacity=".3"/>
    </svg>
  );
}

const EQUIPMENT_SVG: Record<string, () => JSX.Element> = {
  mash_tun: MashTunSVG,
  fermenter: FermenterSVG,
  pot_still: PotStillSVG,
  column_still: ColumnStillSVG,
  barrel_rack: BarrelRackSVG,
  bottling_line: BottlingLineSVG,
  tank: TankSVG,
  other: OtherSVG,
};

// ---------------------------------------------------------------------------
// Equipment Card — click to edit
// ---------------------------------------------------------------------------
function EquipmentCard({ eq, onClick }: { eq: Equipment; onClick: () => void }) {
  const sc = STATUS_CONFIG[eq.status] ?? STATUS_CONFIG.empty;
  const Graphic = EQUIPMENT_SVG[eq.type] ?? OtherSVG;

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-[#e5e5e5] hover:border-[#0a0a0a] hover:shadow-md transition-all w-52 text-left ${sc.bg}`}
    >
      {/* Graphic */}
      <div className="flex items-end justify-center h-28">
        <Graphic />
      </div>

      {/* Status dot + label */}
      <div className="flex items-center gap-1.5 self-start">
        <span className={`w-2 h-2 rounded-full ${sc.dot}`} />
        <span className="text-[10px] font-semibold text-[#737373] uppercase tracking-wide">{sc.label}</span>
      </div>

      {/* Name */}
      <div className="self-start w-full">
        <p className="font-mono font-bold text-base text-[#0a0a0a] leading-tight">{eq.name}</p>
        {eq.displayName && <p className="text-xs text-[#737373] mt-0.5 truncate">{eq.displayName}</p>}
      </div>

      {/* Capacity */}
      {eq.capacity != null && (
        <p className="self-start text-xs text-[#737373]">
          {eq.capacity.toLocaleString()} {eq.capacityUnit}
        </p>
      )}

      {/* Edit hint */}
      <p className="self-start text-[10px] text-[#0a0a0a] opacity-0 group-hover:opacity-60 transition-opacity">
        Click to edit
      </p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Equipment form fields (shared add / edit)
// ---------------------------------------------------------------------------
function EquipmentFormFields({ form, onChange }: {
  form: FormState;
  onChange: (p: Partial<FormState>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium mb-1">ID / Code *</label>
        <Input value={form.name} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. FT01" required />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Display Name</label>
        <Input value={form.displayName} onChange={e => onChange({ displayName: e.target.value })} placeholder="e.g. Corn Fermenter" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Type *</label>
        <Select value={form.type} onChange={e => onChange({ type: e.target.value })}>
          {EQUIPMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Zone *</label>
        <Select value={form.zone} onChange={e => onChange({ zone: e.target.value })}>
          {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
        </Select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Status</label>
        <Select value={form.status} onChange={e => onChange({ status: e.target.value })}>
          <option value="empty">Empty</option>
          <option value="in_use">In Use</option>
          <option value="cleaning">Cleaning</option>
          <option value="maintenance">Maintenance</option>
          <option value="offline">Offline</option>
        </Select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Capacity</label>
        <Input type="number" min="0" value={form.capacity} onChange={e => onChange({ capacity: e.target.value })} placeholder="e.g. 1000" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">Capacity Unit</label>
        <Select value={form.capacityUnit} onChange={e => onChange({ capacityUnit: e.target.value })}>
          <option value="gallons">Gallons</option>
          <option value="barrels">Barrels</option>
          <option value="liters">Liters</option>
          <option value="cases">Cases</option>
        </Select>
      </div>
      <div className="col-span-2">
        <label className="block text-xs font-medium mb-1">Notes</label>
        <Input value={form.notes} onChange={e => onChange({ notes: e.target.value })} placeholder="Optional notes" />
      </div>
    </div>
  );
}

const formToPayload = (f: FormState) => ({
  name: f.name,
  displayName: f.displayName || null,
  type: f.type,
  zone: f.zone,
  status: f.status,
  capacity: f.capacity ? parseFloat(f.capacity) : null,
  capacityUnit: f.capacityUnit,
  notes: f.notes || null,
});

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function FloorPlan() {
  const qc = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(EMPTY_FORM);

  const [editTarget, setEditTarget] = useState<Equipment | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    queryFn: () => apiRequest("/api/equipment"),
  });

  const openEdit = (eq: Equipment) => {
    setEditTarget(eq);
    setEditForm({
      name: eq.name,
      displayName: eq.displayName ?? "",
      type: eq.type,
      zone: eq.zone,
      status: eq.status,
      capacity: eq.capacity != null ? String(eq.capacity) : "",
      capacityUnit: eq.capacityUnit,
      notes: eq.notes ?? "",
    });
  };

  const createEq = useMutation({
    mutationFn: (f: FormState) =>
      apiRequest("/api/equipment", { method: "POST", body: JSON.stringify(formToPayload(f)) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/equipment"] });
      setAddOpen(false);
      setAddForm(EMPTY_FORM);
      toast.success("Equipment added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEq = useMutation({
    mutationFn: (f: FormState) =>
      apiRequest(`/api/equipment/${editTarget!.id}`, { method: "PATCH", body: JSON.stringify(formToPayload(f)) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/equipment"] });
      setEditTarget(null);
      toast.success("Equipment updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEq = useMutation({
    mutationFn: () =>
      apiRequest(`/api/equipment/${editTarget!.id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/equipment"] });
      setEditTarget(null);
      setConfirmDelete(false);
      toast.success("Equipment removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byZone = ZONE_ORDER.reduce<Record<string, Equipment[]>>((acc, z) => {
    acc[z] = equipment.filter(e => e.zone === z);
    return acc;
  }, {} as Record<string, Equipment[]>);

  const inUse = equipment.filter(e => e.status === "in_use").length;

  return (
    <Layout>
      <PageHeader
        title="Distillery Floor Plan"
        subtitle={equipment.length > 0
          ? `${equipment.length} equipment · ${inUse} in use`
          : "Add equipment to build your floor plan"}
        actions={<Button onClick={() => setAddOpen(true)}>+ Add Equipment</Button>}
      />

      <div className="p-6 space-y-10">
        {isLoading && <p className="text-center text-[#737373] py-16 text-sm">Loading…</p>}

        {!isLoading && equipment.length === 0 && (
          <div className="flex flex-col items-center py-24 gap-4">
            <TankSVG />
            <p className="text-[#737373] text-sm">No equipment yet — add your first piece.</p>
            <Button onClick={() => setAddOpen(true)}>+ Add Equipment</Button>
          </div>
        )}

        {!isLoading && ZONE_ORDER.map(zone => {
          const items = byZone[zone];
          if (!items.length) return null;
          return (
            <div key={zone}>
              <div className="flex items-center gap-3 mb-5">
                <h2 className="text-sm font-semibold text-[#0a0a0a] whitespace-nowrap">{ZONE_LABELS[zone]}</h2>
                <div className="flex-1 h-px bg-[#e5e5e5]" />
                <span className="text-xs text-[#737373]">{items.length} unit{items.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="flex flex-wrap gap-4">
                {items.map(eq => (
                  <EquipmentCard key={eq.id} eq={eq} onClick={() => openEdit(eq)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Dialog */}
      <Dialog open={addOpen} onClose={() => { setAddOpen(false); setAddForm(EMPTY_FORM); }} title="Add Equipment">
        <form onSubmit={e => { e.preventDefault(); createEq.mutate(addForm); }} className="space-y-4">
          <EquipmentFormFields form={addForm} onChange={p => setAddForm(f => ({ ...f, ...p }))} />
          <div className="flex justify-end gap-2 pt-2 border-t border-[#e5e5e5]">
            <Button type="button" variant="outline" onClick={() => { setAddOpen(false); setAddForm(EMPTY_FORM); }}>Cancel</Button>
            <Button type="submit" disabled={createEq.isPending}>{createEq.isPending ? "Adding…" : "Add Equipment"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      {editTarget && !confirmDelete && (
        <Dialog open onClose={() => setEditTarget(null)} title={`Edit — ${editTarget.name}`}>
          <form onSubmit={e => { e.preventDefault(); updateEq.mutate(editForm); }} className="space-y-4">
            <EquipmentFormFields form={editForm} onChange={p => setEditForm(f => ({ ...f, ...p }))} />
            <div className="flex justify-between items-center pt-2 border-t border-[#e5e5e5]">
              <Button
                type="button"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setConfirmDelete(true)}
              >
                Remove
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={updateEq.isPending}>{updateEq.isPending ? "Saving…" : "Save Changes"}</Button>
              </div>
            </div>
          </form>
        </Dialog>
      )}

      {/* Delete confirm */}
      {editTarget && confirmDelete && (
        <Dialog open onClose={() => setConfirmDelete(false)} title="Remove Equipment">
          <div className="space-y-4">
            <p className="text-sm">Remove <span className="font-mono font-semibold">{editTarget.name}</span>{editTarget.displayName && ` — ${editTarget.displayName}`} from the floor plan?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              <Button className="bg-red-600 hover:bg-red-700 text-white border-red-600" onClick={() => deleteEq.mutate()} disabled={deleteEq.isPending}>
                {deleteEq.isPending ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Layout>
  );
}
