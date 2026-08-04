import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, PackageOpen, Tag, Circle, Barrel, Droplets, FlaskConical, Wheat } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Dialog } from "../components/ui/dialog";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { fmt, fmtNum } from "../lib/utils";
import type { InventoryItem, InventoryLot } from "@shared/schema";

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------
type CategoryKey = "bottles" | "labels" | "caps" | "barrels" | "wax" | "molasses" | "sugar";

const CATEGORY_CONFIG: Record<CategoryKey, {
  label: string;
  dbCategory: string;
  defaultUnit: string;
  unitOptions: string[];
  namePlaceholder: string;
  Icon: React.ElementType;
}> = {
  bottles: {
    label: "Empty Bottles",
    dbCategory: "Empty Bottles",
    defaultUnit: "units",
    unitOptions: ["units", "cases"],
    namePlaceholder: "e.g. 750 mL Clear Glass Bottle",
    Icon: PackageOpen,
  },
  labels: {
    label: "Labels",
    dbCategory: "Labels",
    defaultUnit: "units",
    unitOptions: ["units", "sheets", "rolls"],
    namePlaceholder: "e.g. Pitorro Label — Front",
    Icon: Tag,
  },
  caps: {
    label: "Caps",
    dbCategory: "Caps",
    defaultUnit: "units",
    unitOptions: ["units", "bags", "cases"],
    namePlaceholder: "e.g. Black Screw Cap 28mm",
    Icon: Circle,
  },
  barrels: {
    label: "Unused Barrels",
    dbCategory: "Unused Barrels",
    defaultUnit: "units",
    unitOptions: ["units"],
    namePlaceholder: "e.g. 53-gal New American Oak #2 Char",
    Icon: Barrel,
  },
  wax: {
    label: "Wax",
    dbCategory: "Wax",
    defaultUnit: "lbs",
    unitOptions: ["lbs", "kg", "oz", "gallons"],
    namePlaceholder: "e.g. Black Bottle Wax",
    Icon: Droplets,
  },
  molasses: {
    label: "Molasses",
    dbCategory: "Molasses",
    defaultUnit: "gallons",
    unitOptions: ["gallons", "drums", "totes"],
    namePlaceholder: "e.g. Blackstrap Molasses — 55-gal Drum",
    Icon: FlaskConical,
  },
  sugar: {
    label: "Cane Sugar",
    dbCategory: "Cane Sugar",
    defaultUnit: "lbs",
    unitOptions: ["lbs", "kg", "bags"],
    namePlaceholder: "e.g. Raw Cane Sugar — 50-lb Bag",
    Icon: Wheat,
  },
};

const TABS = Object.keys(CATEGORY_CONFIG) as CategoryKey[];

// ---------------------------------------------------------------------------
// Blank form state
// ---------------------------------------------------------------------------
const blankIntake = (cat: CategoryKey) => ({
  name: "",
  unit: CATEGORY_CONFIG[cat].defaultUnit,
  quantity: "",
  lotCode: "",
  receivedAt: new Date().toISOString().slice(0, 10),
  notes: "",
});

const blankStock = {
  quantity: "",
  lotCode: "",
  receivedAt: new Date().toISOString().slice(0, 10),
  notes: "",
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function Inventory() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<CategoryKey>("bottles");
  const [search, setSearch] = useState("");

  // New item intake
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [intakeForm, setIntakeForm] = useState(blankIntake("bottles"));

  // Add stock to existing item
  const [stockTarget, setStockTarget] = useState<InventoryItem | null>(null);
  const [stockForm, setStockForm] = useState(blankStock);

  // Edit item name/notes
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [editForm, setEditForm] = useState({ name: "", notes: "" });

  // Edit lot quantity
  const [editLotTarget, setEditLotTarget] = useState<InventoryLot | null>(null);
  const [editLotForm, setEditLotForm] = useState({ quantity: "", notes: "" });

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: "item" | "lot"; id: string; label: string } | null>(null);

  // Expanded rows (show lots per item)
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------
  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
    queryFn: () => apiRequest("/api/inventory/items"),
  });

  const { data: lots = [] } = useQuery<InventoryLot[]>({
    queryKey: ["/api/inventory/lots"],
    queryFn: () => apiRequest("/api/inventory/lots"),
  });

  const { data: platformConfig } = useQuery<{ inventoryLossRates?: Record<string, number> | null }>({
    queryKey: ["/api/platform-config"],
    queryFn: () => apiRequest("/api/platform-config"),
    staleTime: 60_000,
  });

  const lossRates: Record<string, number> = platformConfig?.inventoryLossRates ?? {
    "Labels": 5, "Caps": 2, "Empty Bottles": 0.5, "Wax": 5, "Molasses": 4, "Cane Sugar": 3, "Unused Barrels": 0,
  };

  // ---------------------------------------------------------------------------
  // Derived data for current tab
  // ---------------------------------------------------------------------------
  const cfg = CATEGORY_CONFIG[tab];

  const tabItems = useMemo(() =>
    items.filter(i => i.category === cfg.dbCategory &&
      (search === "" ||
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        (i.notes ?? "").toLowerCase().includes(search.toLowerCase()))),
    [items, cfg.dbCategory, search]
  );

  function lotsForItem(itemId: string) {
    return lots.filter(l => l.itemId === itemId);
  }

  function totalQty(itemId: string) {
    return lotsForItem(itemId).reduce((s, l) => s + (l.quantity ?? 0), 0);
  }

  function lastReceived(itemId: string) {
    const dates = lotsForItem(itemId)
      .map(l => l.receivedAt)
      .filter(Boolean) as string[];
    if (!dates.length) return null;
    return dates.sort().at(-1)!;
  }

  function lossRate(dbCategory: string): number | null {
    const r = lossRates[dbCategory];
    return (r !== undefined && r > 0) ? r : null;
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------
  const createIntake = useMutation({
    mutationFn: async (data: typeof intakeForm) => {
      // 1. Find or create item
      const existing = items.find(
        i => i.name.trim().toLowerCase() === data.name.trim().toLowerCase() &&
             i.category === cfg.dbCategory
      );
      let itemId = existing?.id;
      if (!itemId) {
        const created = await apiRequest<InventoryItem>("/api/inventory/items", {
          method: "POST",
          body: JSON.stringify({
            name: data.name.trim(),
            category: cfg.dbCategory,
            unitOfMeasure: data.unit,
            notes: data.notes || undefined,
          }),
        });
        itemId = created.id;
      }
      // 2. Create lot
      await apiRequest("/api/inventory/lots", {
        method: "POST",
        body: JSON.stringify({
          itemId,
          lotCode: data.lotCode || `${cfg.dbCategory.replace(/\s+/g, "-").toUpperCase()}-${Date.now()}`,
          quantity: +data.quantity,
          unitOfMeasure: data.unit,
          receivedAt: data.receivedAt || undefined,
          notes: data.notes || undefined,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setIntakeOpen(false);
      setIntakeForm(blankIntake(tab));
      toast.success(`${cfg.label} intake recorded`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addStock = useMutation({
    mutationFn: async (data: typeof stockForm) => {
      if (!stockTarget) return;
      await apiRequest("/api/inventory/lots", {
        method: "POST",
        body: JSON.stringify({
          itemId: stockTarget.id,
          lotCode: data.lotCode || `${cfg.dbCategory.replace(/\s+/g, "-").toUpperCase()}-${Date.now()}`,
          quantity: +data.quantity,
          unitOfMeasure: stockTarget.unitOfMeasure,
          receivedAt: data.receivedAt || undefined,
          notes: data.notes || undefined,
        }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setStockTarget(null);
      setStockForm(blankStock);
      toast.success("Stock added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: (data: { id: string; name: string; notes: string }) =>
      apiRequest(`/api/inventory/items/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: data.name, notes: data.notes || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setEditTarget(null);
      toast.success("Item updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateLot = useMutation({
    mutationFn: (data: { id: string; quantity: number; notes: string }) =>
      apiRequest(`/api/inventory/lots/${data.id}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: data.quantity, notes: data.notes || null }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setEditLotTarget(null);
      toast.success("Lot updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/inventory/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setDeleteTarget(null);
      toast.success("Item deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLot = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/inventory/lots/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setDeleteTarget(null);
      toast.success("Lot deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openIntake() {
    setIntakeForm(blankIntake(tab));
    setIntakeOpen(true);
  }

  function openAddStock(item: InventoryItem) {
    setStockTarget(item);
    setStockForm(blankStock);
  }

  function openEditItem(item: InventoryItem) {
    setEditTarget(item);
    setEditForm({ name: item.name, notes: item.notes ?? "" });
  }

  function openEditLot(lot: InventoryLot) {
    setEditLotTarget(lot);
    setEditLotForm({ quantity: String(lot.quantity), notes: lot.notes ?? "" });
  }

  const totalTabItems = tabItems.length;
  const totalTabQty = tabItems.reduce((s, i) => s + totalQty(i.id), 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Layout>
      <PageHeader
        title="Inventory"
        subtitle={`${totalTabItems} ${cfg.label.toLowerCase()} · ${fmtNum(totalTabQty, 0)} ${cfg.defaultUnit} on hand`}
        actions={
          <>
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-40"
            />
            <Button onClick={openIntake}>
              <Plus size={13} className="mr-1" /> New {cfg.label.replace(/^Unused /, "")}
            </Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="px-6 border-b border-[#e5e5e5]">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const c = CATEGORY_CONFIG[t];
            const Icon = c.Icon;
            const count = items.filter(i => i.category === c.dbCategory).length;
            return (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(""); setExpanded(new Set()); }}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? "border-[var(--brand)] text-[#0a0a0a]"
                    : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
                }`}
              >
                <Icon size={12} />
                {c.label}
                {count > 0 && (
                  <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    tab === t ? "bg-[var(--brand)] text-white" : "bg-[#f0f0f0] text-[#737373]"
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          {tabItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <cfg.Icon size={32} className="text-[#d1d5db] mb-3" />
              <p className="text-sm font-medium text-[#0a0a0a] mb-1">No {cfg.label.toLowerCase()} yet</p>
              <p className="text-xs text-[#737373] mb-4">Record your first intake to start tracking stock.</p>
              <Button size="sm" onClick={openIntake}>
                <Plus size={12} className="mr-1" /> New {cfg.label.replace(/^Unused /, "")}
              </Button>
            </div>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th />
                  <Th>Name / Description</Th>
                  <Th>On Hand</Th>
                  {lossRate(cfg.dbCategory) !== null && <>
                    <Th className="hidden md:table-cell text-amber-700">Est. Loss</Th>
                    <Th className="hidden md:table-cell text-[#15803d]">Net Usable</Th>
                  </>}
                  <Th>Unit</Th>
                  <Th>Last Received</Th>
                  <Th>Lots</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {tabItems.map((item) => {
                  const isOpen = expanded.has(item.id);
                  const itemLots = lotsForItem(item.id);
                  const qty = totalQty(item.id);
                  const last = lastReceived(item.id);
                  return (
                    <>
                      <Tr key={item.id} className="hover:bg-[#f7f7f7]">
                        {/* Expand chevron */}
                        <Td className="w-8">
                          {itemLots.length > 0 && (
                            <button
                              onClick={() => toggleExpand(item.id)}
                              className="text-[#737373] hover:text-[#0a0a0a] transition-colors"
                            >
                              <span className={`inline-block transition-transform text-xs ${isOpen ? "rotate-90" : ""}`}>▶</span>
                            </button>
                          )}
                        </Td>
                        <Td>
                          <p className="font-medium text-[#0a0a0a] text-sm">{item.name}</p>
                          {item.notes && <p className="text-[10px] text-[#737373] mt-0.5">{item.notes}</p>}
                        </Td>
                        <Td>
                          <span className={`text-sm font-bold tabular-nums ${qty === 0 ? "text-red-500" : "text-[#0a0a0a]"}`}>
                            {fmtNum(qty, 0)}
                          </span>
                        </Td>
                        {(() => {
                          const rate = lossRate(cfg.dbCategory);
                          if (rate === null) return null;
                          const loss = Math.ceil(qty * rate / 100);
                          const usable = qty - loss;
                          return (<>
                            <Td className="hidden md:table-cell text-xs text-amber-600 font-medium">−{loss.toLocaleString()} ({rate}%)</Td>
                            <Td className="hidden md:table-cell text-xs text-[#15803d] font-medium">{usable.toLocaleString()}</Td>
                          </>);
                        })()}
                        <Td className="text-xs text-[#737373]">{item.unitOfMeasure}</Td>
                        <Td className="text-xs text-[#737373]">{last ? fmt(last) : "—"}</Td>
                        <Td className="text-xs text-[#737373]">{itemLots.length}</Td>
                        <Td>
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => openAddStock(item)}
                              className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                              title="Add stock"
                            >
                              <Plus size={13} />
                            </button>
                            <button
                              onClick={() => openEditItem(item)}
                              className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget({ type: "item", id: item.id, label: item.name })}
                              className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </Td>
                      </Tr>

                      {/* Expanded lot rows */}
                      {isOpen && itemLots.map((lot) => (
                        <Tr key={lot.id} className="bg-[#f7f9fc]">
                          <Td />
                          <Td className="pl-6">
                            <span className="font-mono text-xs text-[#737373]">{lot.lotCode}</span>
                            {lot.notes && <p className="text-[10px] text-[#a3a3a3] mt-0.5">{lot.notes}</p>}
                          </Td>
                          <Td>
                            <span className="text-sm tabular-nums text-[#0369a1] font-medium">
                              {fmtNum(lot.quantity, 0)}
                            </span>
                          </Td>
                          <Td className="text-xs text-[#737373]">{lot.unitOfMeasure}</Td>
                          <Td className="text-xs text-[#737373]">{lot.receivedAt ? fmt(lot.receivedAt) : "—"}</Td>
                          <Td />
                          <Td>
                            <div className="flex items-center gap-1 justify-end">
                              <button
                                onClick={() => openEditLot(lot)}
                                className="p-1.5 rounded hover:bg-[#f3f4f6] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                                title="Edit lot"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => setDeleteTarget({ type: "lot", id: lot.id, label: lot.lotCode })}
                                className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                                title="Delete lot"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </Td>
                        </Tr>
                      ))}
                    </>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </div>
      </div>

      {/* ── New Intake Dialog ── */}
      <Dialog
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        title={`New ${cfg.label} Intake`}
      >
        <div className="space-y-4">
          <p className="text-xs text-[#737373]">
            Record a new {cfg.label.toLowerCase()} receipt. If this item already exists, stock will be added to it automatically.
          </p>

          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Name / Description *</label>
            <Input
              value={intakeForm.name}
              onChange={(e) => setIntakeForm(f => ({ ...f, name: e.target.value }))}
              placeholder={cfg.namePlaceholder}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Quantity Received *</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={intakeForm.quantity}
                onChange={(e) => setIntakeForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Unit of Measure</label>
              <select
                value={intakeForm.unit}
                onChange={(e) => setIntakeForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full h-9 rounded-md border border-[#e5e5e5] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
              >
                {cfg.unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Date Received *</label>
              <Input
                type="date"
                value={intakeForm.receivedAt}
                onChange={(e) => setIntakeForm(f => ({ ...f, receivedAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Lot / Batch Code</label>
              <Input
                value={intakeForm.lotCode}
                onChange={(e) => setIntakeForm(f => ({ ...f, lotCode: e.target.value }))}
                placeholder="Auto-generated if blank"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
            <Input
              value={intakeForm.notes}
              onChange={(e) => setIntakeForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Supplier, PO number, condition…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setIntakeOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createIntake.mutate(intakeForm)}
              disabled={createIntake.isPending || !intakeForm.name || !intakeForm.quantity}
            >
              {createIntake.isPending ? "Recording…" : "Record Intake"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Add Stock Dialog ── */}
      <Dialog
        open={!!stockTarget}
        onClose={() => setStockTarget(null)}
        title={`Add Stock — ${stockTarget?.name ?? ""}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Quantity *</label>
              <Input
                type="number"
                min="0"
                step="1"
                value={stockForm.quantity}
                onChange={(e) => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#737373] mb-1">Date Received</label>
              <Input
                type="date"
                value={stockForm.receivedAt}
                onChange={(e) => setStockForm(f => ({ ...f, receivedAt: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Lot / Batch Code</label>
            <Input
              value={stockForm.lotCode}
              onChange={(e) => setStockForm(f => ({ ...f, lotCode: e.target.value }))}
              placeholder="Auto-generated if blank"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
            <Input
              value={stockForm.notes}
              onChange={(e) => setStockForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Supplier, PO number…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setStockTarget(null)}>Cancel</Button>
            <Button
              onClick={() => addStock.mutate(stockForm)}
              disabled={addStock.isPending || !stockForm.quantity}
            >
              {addStock.isPending ? "Adding…" : "Add Stock"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Edit Item Dialog ── */}
      <Dialog
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Edit Item"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Name / Description *</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
            <Input
              value={editForm.notes}
              onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              onClick={() => editTarget && updateItem.mutate({ id: editTarget.id, ...editForm })}
              disabled={updateItem.isPending || !editForm.name}
            >
              {updateItem.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Edit Lot Dialog ── */}
      <Dialog
        open={!!editLotTarget}
        onClose={() => setEditLotTarget(null)}
        title={`Edit Lot — ${editLotTarget?.lotCode ?? ""}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Quantity *</label>
            <Input
              type="number"
              min="0"
              step="1"
              value={editLotForm.quantity}
              onChange={(e) => setEditLotForm(f => ({ ...f, quantity: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Notes</label>
            <Input
              value={editLotForm.notes}
              onChange={(e) => setEditLotForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setEditLotTarget(null)}>Cancel</Button>
            <Button
              onClick={() => editLotTarget && updateLot.mutate({
                id: editLotTarget.id,
                quantity: +editLotForm.quantity,
                notes: editLotForm.notes,
              })}
              disabled={updateLot.isPending || !editLotForm.quantity}
            >
              {updateLot.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── Delete Confirm Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={`Delete ${deleteTarget?.type === "item" ? "Item" : "Lot"}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-[#0a0a0a]">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{deleteTarget?.label}</span>?
            {deleteTarget?.type === "item" && (
              <span className="block text-xs text-red-600 mt-1">
                This will also delete all lots associated with this item.
              </span>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white border-red-600"
              onClick={() => {
                if (!deleteTarget) return;
                if (deleteTarget.type === "item") deleteItem.mutate(deleteTarget.id);
                else deleteLot.mutate(deleteTarget.id);
              }}
              disabled={deleteItem.isPending || deleteLot.isPending}
            >
              {deleteItem.isPending || deleteLot.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
