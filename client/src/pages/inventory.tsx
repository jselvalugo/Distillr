import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

export default function Inventory() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("items");
  const [openItem, setOpenItem] = useState(false);
  const [openLot, setOpenLot] = useState(false);
  const [search, setSearch] = useState("");
  const [itemForm, setItemForm] = useState({ name: "", category: "", unitOfMeasure: "", notes: "" });
  const [lotForm, setLotForm] = useState({
    itemId: "",
    lotCode: "",
    quantity: "",
    unitOfMeasure: "",
    abv: "",
    notes: "",
  });

  const { data: items = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory/items"],
    queryFn: () => apiRequest("/api/inventory/items"),
  });
  const { data: lots = [] } = useQuery<InventoryLot[]>({
    queryKey: ["/api/inventory/lots"],
    queryFn: () => apiRequest("/api/inventory/lots"),
  });

  const createItem = useMutation({
    mutationFn: (d: typeof itemForm) =>
      apiRequest("/api/inventory/items", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
      setOpenItem(false);
      setItemForm({ name: "", category: "", unitOfMeasure: "", notes: "" });
      toast.success("Item added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createLot = useMutation({
    mutationFn: (d: typeof lotForm) =>
      apiRequest("/api/inventory/lots", {
        method: "POST",
        body: JSON.stringify({
          ...d,
          quantity: +d.quantity,
          abv: d.abv ? +d.abv : undefined,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/inventory/lots"] });
      setOpenLot(false);
      setLotForm({ itemId: "", lotCode: "", quantity: "", unitOfMeasure: "", abv: "", notes: "" });
      toast.success("Lot added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredItems = items.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.category.toLowerCase().includes(search.toLowerCase())
  );
  const filteredLots = lots.filter((l) =>
    l.lotCode.toLowerCase().includes(search.toLowerCase())
  );

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
              <Button onClick={() => setOpenItem(true)}>+ Add Item</Button>
            ) : (
              <Button onClick={() => setOpenLot(true)}>+ Add Lot</Button>
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
                  ? "border-[#0a0a0a] text-[#0a0a0a]"
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
                </Tr>
              </Thead>
              <Tbody>
                {filteredItems.length === 0 ? (
                  <Tr>
                    <Td colSpan={5} className="text-center text-[#737373] py-10">
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
                </Tr>
              </Thead>
              <Tbody>
                {filteredLots.length === 0 ? (
                  <Tr>
                    <Td colSpan={7} className="text-center text-[#737373] py-10">
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
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          )}
        </div>
      </div>

      <Dialog open={openItem} onClose={() => setOpenItem(false)} title="Add Inventory Item">
        <form onSubmit={(e) => { e.preventDefault(); createItem.mutate(itemForm); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
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

      <Dialog open={openLot} onClose={() => setOpenLot(false)} title="Add Lot">
        <form onSubmit={(e) => { e.preventDefault(); createLot.mutate(lotForm); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
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
    </Layout>
  );
}
