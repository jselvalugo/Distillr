import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2, Upload, Download } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { exportToCsv, downloadCsvTemplate, parseCsv } from "../lib/csv";
import { Layout, PageHeader } from "../components/layout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Table, Thead, Tbody, Tr, Th, Td } from "../components/ui/table";
import { Dialog } from "../components/ui/dialog";
import { statusBadge } from "../components/ui/badge";
import { fmt, fmtNum } from "../lib/utils";
import type { InventoryItem, InventoryLot } from "@shared/schema";

type Tab = "items" | "lots";

const BLANK_ITEM = { name: "", category: "", unitOfMeasure: "", notes: "" };
const BLANK_LOT = { itemId: "", lotCode: "", quantity: "", unitOfMeasure: "", abv: "", notes: "" };

export default function Inventory() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");

  // create dialogs
  const [openItem, setOpenItem] = useState(false);
  const [openLot, setOpenLot] = useState(false);
  const [itemForm, setItemForm] = useState(BLANK_ITEM);
  const [lotForm, setLotForm] = useState(BLANK_LOT);

  // edit dialogs
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [editItemForm, setEditItemForm] = useState(BLANK_ITEM);
  const [editLot, setEditLot] = useState<InventoryLot | null>(null);
  const [editLotForm, setEditLotForm] = useState(BLANK_LOT);

  // delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{ type: "item" | "lot"; id: number; name: string } | null>(null);

  // import
  const [importItemOpen, setImportItemOpen] = useState(false);
  const [importLotOpen, setImportLotOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
    queryFn: () => apiRequest("/api/inventory/items"),
  });
  const { data: lots = [] } = useQuery<InventoryLot[]>({
    queryKey: ["/api/inventory/lots"],
    queryFn: () => apiRequest("/api/inventory/lots"),
  });

  // --- create ---
  const createItem = useMutation({
    mutationFn: (d: typeof itemForm) =>
      apiRequest("/api/inventory/items", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setOpenItem(false);
      setItemForm(BLANK_ITEM);
      toast.success("Item added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createLot = useMutation({
    mutationFn: (d: typeof lotForm) =>
      apiRequest("/api/inventory/lots", {
        method: "POST",
        body: JSON.stringify({ ...d, quantity: +d.quantity, abv: d.abv ? +d.abv : undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setOpenLot(false);
      setLotForm(BLANK_LOT);
      toast.success("Lot added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- edit ---
  const updateItem = useMutation({
    mutationFn: ({ id, ...d }: typeof editItemForm & { id: number }) =>
      apiRequest(`/api/inventory/items/${id}`, { method: "PATCH", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setEditItem(null);
      toast.success("Item updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLot = useMutation({
    mutationFn: ({ id, ...d }: typeof editLotForm & { id: number }) =>
      apiRequest(`/api/inventory/lots/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...d, quantity: +d.quantity, abv: d.abv ? +d.abv : undefined }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setEditLot(null);
      toast.success("Lot updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- delete ---
  const deleteItem = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/inventory/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setDeleteTarget(null);
      toast.success("Item deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLot = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/inventory/lots/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setDeleteTarget(null);
      toast.success("Lot deleted");
    },
    onError: (e: any) => toast.error(e.message),
  });

  function openEditItem(i: InventoryItem) {
    setEditItem(i);
    setEditItemForm({ name: i.name, category: i.category, unitOfMeasure: i.unitOfMeasure, notes: i.notes ?? "" });
  }

  function openEditLot(l: InventoryLot) {
    setEditLot(l);
    setEditLotForm({
      itemId: String(l.itemId),
      lotCode: l.lotCode,
      quantity: String(l.quantity),
      unitOfMeasure: l.unitOfMeasure ?? "",
      abv: l.abv != null ? String(l.abv) : "",
      notes: l.notes ?? "",
    });
  }

  const ITEM_EXPORT_COLS = [
    { header: "name",          key: "name" },
    { header: "category",      key: "category" },
    { header: "unitOfMeasure", key: "unitOfMeasure" },
    { header: "status",        key: "status" },
    { header: "notes",         key: "notes" },
  ] as const;
  const ITEM_IMPORT_HEADERS = ITEM_EXPORT_COLS.map(c => c.header);

  const LOT_EXPORT_COLS = [
    { header: "lotCode",       key: "lotCode" },
    { header: "itemId",        key: "itemId" },
    { header: "quantity",      key: "quantity" },
    { header: "unitOfMeasure", key: "unitOfMeasure" },
    { header: "abv",           key: "abv" },
    { header: "proofGallons",  key: "proofGallons" },
    { header: "receivedAt",    key: "receivedAt" },
    { header: "expiresAt",     key: "expiresAt" },
    { header: "notes",         key: "notes" },
  ] as const;
  const LOT_IMPORT_HEADERS = LOT_EXPORT_COLS.map(c => c.header);

  async function handleImportItems() {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const rows = parseCsv(text);
      let ok = 0, fail = 0;
      for (const row of rows) {
        try {
          await apiRequest("/api/inventory/items", {
            method: "POST",
            body: JSON.stringify({
              name: row.name,
              category: row.category,
              unitOfMeasure: row.unitOfMeasure,
              notes: row.notes || undefined,
            }),
          });
          ok++;
        } catch { fail++; }
      }
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setImportItemOpen(false);
      setImportFile(null);
      toast.success(`Imported ${ok} item${ok !== 1 ? "s" : ""}${fail ? ` (${fail} failed)` : ""}`);
    } catch {
      toast.error("Failed to read file");
    } finally {
      setImporting(false);
    }
  }

  async function handleImportLots() {
    if (!importFile) return;
    setImporting(true);
    try {
      const text = await importFile.text();
      const rows = parseCsv(text);
      let ok = 0, fail = 0;
      for (const row of rows) {
        try {
          await apiRequest("/api/inventory/lots", {
            method: "POST",
            body: JSON.stringify({
              lotCode: row.lotCode,
              itemId: row.itemId,
              quantity: +row.quantity,
              unitOfMeasure: row.unitOfMeasure || undefined,
              abv: row.abv ? +row.abv : undefined,
              proofGallons: row.proofGallons ? +row.proofGallons : undefined,
              receivedAt: row.receivedAt || undefined,
              expiresAt: row.expiresAt || undefined,
              notes: row.notes || undefined,
            }),
          });
          ok++;
        } catch { fail++; }
      }
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setImportLotOpen(false);
      setImportFile(null);
      toast.success(`Imported ${ok} lot${ok !== 1 ? "s" : ""}${fail ? ` (${fail} failed)` : ""}`);
    } catch {
      toast.error("Failed to read file");
    } finally {
      setImporting(false);
    }
  }

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );
  const filteredLots = lots.filter((l) =>
    l.lotCode.toLowerCase().includes(search.toLowerCase())
  );

  const isDeleting = deleteItem.isPending || deleteLot.isPending;

  return (
    <Layout>
      <PageHeader
        title="Inventory"
        subtitle={`${items.length} items · ${lots.length} lots`}
        actions={
          <>
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44"
            />
            {tab === "items" ? (
              <>
                <Button variant="outline" onClick={() => exportToCsv("inventory-items.csv", items, ITEM_EXPORT_COLS as any)}>
                  <Download size={13} className="mr-1.5" /> Export
                </Button>
                <Button variant="outline" onClick={() => { setImportFile(null); setImportItemOpen(true); }}>
                  <Upload size={13} className="mr-1.5" /> Import
                </Button>
                <Button onClick={() => navigate("/inventory/items/new")}>+ Add Item</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => exportToCsv("inventory-lots.csv", lots, LOT_EXPORT_COLS as any)}>
                  <Download size={13} className="mr-1.5" /> Export
                </Button>
                <Button variant="outline" onClick={() => { setImportFile(null); setImportLotOpen(true); }}>
                  <Upload size={13} className="mr-1.5" /> Import
                </Button>
                <Button onClick={() => navigate("/inventory/lots/new")}>+ Add Lot</Button>
              </>
            )}
          </>
        }
      />

      <div className="p-6">
        <div className="flex gap-1 mb-4 border-b border-[#e5e5e5]">
          {(["items", "lots"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? "border-[var(--brand)] text-[#0a0a0a]"
                  : "border-transparent text-[#737373] hover:text-[#0a0a0a]"
              }`}
            >
              {t === "items" ? "Items" : "Lots"}
            </button>
          ))}
        </div>

        <div className="bg-white border border-[#e5e5e5] rounded-lg overflow-hidden">
          {tab === "items" ? (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Category</Th>
                  <Th>Unit</Th>
                  <Th>Status</Th>
                  <Th>Updated</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {filteredItems.length === 0 ? (
                  <Tr>
                    <Td colSpan={6} className="text-center text-[#737373] py-10">
                      No items
                    </Td>
                  </Tr>
                ) : (
                  filteredItems.map((i) => (
                    <Tr key={i.id}>
                      <Td className="font-medium">{i.name}</Td>
                      <Td>{i.category}</Td>
                      <Td>{i.unitOfMeasure}</Td>
                      <Td>{statusBadge(i.status)}</Td>
                      <Td>{fmt(i.updatedAt)}</Td>
                      <Td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEditItem(i)}
                            className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: "item", id: i.id, name: i.name })}
                            className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Lot Code</Th>
                  <Th>Quantity</Th>
                  <Th>Unit</Th>
                  <Th>ABV %</Th>
                  <Th>Proof Gal.</Th>
                  <Th>Received</Th>
                  <Th>Expires</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {filteredLots.length === 0 ? (
                  <Tr>
                    <Td colSpan={8} className="text-center text-[#737373] py-10">
                      No lots
                    </Td>
                  </Tr>
                ) : (
                  filteredLots.map((l) => (
                    <Tr key={l.id}>
                      <Td className="font-mono font-medium">{l.lotCode}</Td>
                      <Td>{fmtNum(l.quantity)}</Td>
                      <Td>{l.unitOfMeasure}</Td>
                      <Td>{fmtNum(l.abv)}%</Td>
                      <Td>{fmtNum(l.proofGallons)}</Td>
                      <Td>{fmt(l.receivedAt)}</Td>
                      <Td>{fmt(l.expiresAt)}</Td>
                      <Td>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => openEditLot(l)}
                            className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#737373] hover:text-[#0a0a0a] transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ type: "lot", id: l.id, name: l.lotCode })}
                            className="p-1.5 rounded hover:bg-red-50 text-[#737373] hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}
        </div>
      </div>

      {/* Create Item */}
      <Dialog open={openItem} onClose={() => setOpenItem(false)} title="Add Inventory Item">
        <form onSubmit={(e) => { e.preventDefault(); createItem.mutate(itemForm); }} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <Input value={itemForm.name} onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category *</label>
              <Input value={itemForm.category} onChange={(e) => setItemForm((f) => ({ ...f, category: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit of Measure *</label>
              <Input value={itemForm.unitOfMeasure} onChange={(e) => setItemForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} placeholder="gal, lbs, cases…" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input value={itemForm.notes} onChange={(e) => setItemForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenItem(false)}>Cancel</Button>
            <Button type="submit" disabled={createItem.isPending}>{createItem.isPending ? "Saving…" : "Add Item"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Item */}
      <Dialog open={!!editItem} onClose={() => setEditItem(null)} title="Edit Inventory Item">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editItem) updateItem.mutate({ ...editItemForm, id: editItem.id });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Name *</label>
              <Input value={editItemForm.name} onChange={(e) => setEditItemForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category *</label>
              <Input value={editItemForm.category} onChange={(e) => setEditItemForm((f) => ({ ...f, category: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit of Measure *</label>
              <Input value={editItemForm.unitOfMeasure} onChange={(e) => setEditItemForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} placeholder="gal, lbs, cases…" required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input value={editItemForm.notes} onChange={(e) => setEditItemForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
            <Button type="submit" disabled={updateItem.isPending}>{updateItem.isPending ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Create Lot */}
      <Dialog open={openLot} onClose={() => setOpenLot(false)} title="Add Lot">
        <form onSubmit={(e) => { e.preventDefault(); createLot.mutate(lotForm); }} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Item *</label>
              <Select value={lotForm.itemId} onChange={(e) => setLotForm((f) => ({ ...f, itemId: e.target.value }))} required>
                <option value="">Select item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Lot Code *</label>
              <Input value={lotForm.lotCode} onChange={(e) => setLotForm((f) => ({ ...f, lotCode: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quantity *</label>
              <Input type="number" step="0.01" value={lotForm.quantity} onChange={(e) => setLotForm((f) => ({ ...f, quantity: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit</label>
              <Input value={lotForm.unitOfMeasure} onChange={(e) => setLotForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">ABV %</label>
              <Input type="number" step="0.01" value={lotForm.abv} onChange={(e) => setLotForm((f) => ({ ...f, abv: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input value={lotForm.notes} onChange={(e) => setLotForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpenLot(false)}>Cancel</Button>
            <Button type="submit" disabled={createLot.isPending}>{createLot.isPending ? "Saving…" : "Add Lot"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Lot */}
      <Dialog open={!!editLot} onClose={() => setEditLot(null)} title="Edit Lot">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (editLot) updateLot.mutate({ ...editLotForm, id: editLot.id });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Item *</label>
              <Select value={editLotForm.itemId} onChange={(e) => setEditLotForm((f) => ({ ...f, itemId: e.target.value }))} required>
                <option value="">Select item…</option>
                {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Lot Code *</label>
              <Input value={editLotForm.lotCode} onChange={(e) => setEditLotForm((f) => ({ ...f, lotCode: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quantity *</label>
              <Input type="number" step="0.01" value={editLotForm.quantity} onChange={(e) => setEditLotForm((f) => ({ ...f, quantity: e.target.value }))} required />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Unit</label>
              <Input value={editLotForm.unitOfMeasure} onChange={(e) => setEditLotForm((f) => ({ ...f, unitOfMeasure: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">ABV %</label>
              <Input type="number" step="0.01" value={editLotForm.abv} onChange={(e) => setEditLotForm((f) => ({ ...f, abv: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <Input value={editLotForm.notes} onChange={(e) => setEditLotForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditLot(null)}>Cancel</Button>
            <Button type="submit" disabled={updateLot.isPending}>{updateLot.isPending ? "Saving…" : "Save Changes"}</Button>
          </div>
        </form>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Confirm Delete">
        <p className="text-sm text-[#0a0a0a] mb-1">
          Are you sure you want to delete <span className="font-semibold">"{deleteTarget?.name}"</span>?
        </p>
        <p className="text-xs text-[#737373] mb-4">This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <button
            onClick={() => {
              if (!deleteTarget) return;
              if (deleteTarget.type === "item") deleteItem.mutate(deleteTarget.id);
              else deleteLot.mutate(deleteTarget.id);
            }}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </Dialog>

      {/* Import Items */}
      <Dialog open={importItemOpen} onClose={() => { setImportItemOpen(false); setImportFile(null); }} title="Import Inventory Items">
        <div className="space-y-4">
          <p className="text-xs text-[#737373]">
            Upload a CSV with columns: <span className="font-mono">{ITEM_IMPORT_HEADERS.join(", ")}</span>.
            Required: <span className="font-mono">name, category, unitOfMeasure</span>.
          </p>
          <button
            onClick={() => downloadCsvTemplate("inventory-items-template.csv", ITEM_IMPORT_HEADERS)}
            className="text-xs text-[#0369a1] hover:underline"
          >
            Download blank template →
          </button>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[#737373] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-[#e5e5e5] file:text-xs file:font-medium file:bg-white hover:file:bg-[#f5f5f5] file:cursor-pointer"
          />
          {importFile && (
            <p className="text-xs text-[#737373]">Selected: <span className="font-medium text-[#0a0a0a]">{importFile.name}</span></p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { setImportItemOpen(false); setImportFile(null); }}>Cancel</Button>
            <Button onClick={handleImportItems} disabled={!importFile || importing}>
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Import Lots */}
      <Dialog open={importLotOpen} onClose={() => { setImportLotOpen(false); setImportFile(null); }} title="Import Lots">
        <div className="space-y-4">
          <p className="text-xs text-[#737373]">
            Upload a CSV with columns: <span className="font-mono">{LOT_IMPORT_HEADERS.join(", ")}</span>.
            Required: <span className="font-mono">lotCode, itemId, quantity</span>.
            The <span className="font-mono">itemId</span> must match an existing item's ID.
          </p>
          <button
            onClick={() => downloadCsvTemplate("inventory-lots-template.csv", LOT_IMPORT_HEADERS)}
            className="text-xs text-[#0369a1] hover:underline"
          >
            Download blank template →
          </button>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-[#737373] file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-[#e5e5e5] file:text-xs file:font-medium file:bg-white hover:file:bg-[#f5f5f5] file:cursor-pointer"
          />
          {importFile && (
            <p className="text-xs text-[#737373]">Selected: <span className="font-medium text-[#0a0a0a]">{importFile.name}</span></p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => { setImportLotOpen(false); setImportFile(null); }}>Cancel</Button>
            <Button onClick={handleImportLots} disabled={!importFile || importing}>
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </Dialog>
    </Layout>
  );
}
