import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { apiRequest } from "../lib/queryClient";
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
              <Button onClick={() => navigate("/inventory/items/new")}>+ Add Item</Button>
            ) : (
              <Button onClick={() => navigate("/inventory/lots/new")}>+ Add Lot</Button>
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
    </Layout>
  );
}
