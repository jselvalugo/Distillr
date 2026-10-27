import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Archive, Box, MapPin, Plus, Trash2, X } from "lucide-react";
import type { Ingredient } from "@shared/spirits";
import { BOTTLE_SIZES, INGREDIENT_UNITS, TAX_CLASSES, spiritTypeForClass, spiritTypeLabel } from "@shared/spirits";
import { LOCATION_KINDS, type Product, type StorageLocation } from "@shared/reference";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Dialog } from "../components/ui/dialog";
import { SpiritClassSelect, SpiritTypeSelect } from "../components/reference/pickers";
import { useDeleteLocation, useDeleteProduct, useProducts, useSaveLocation, useSaveProduct, useStorageLocations } from "../lib/reference";

const label = "block text-xs font-medium text-[#737373] mb-1";

function Shell({ title, description, action, children }: { title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="p-5 sm:p-8 space-y-5 max-w-5xl">
      <div className="bg-white rounded-xl border border-[#e5e5e5] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#f0f0f0] bg-[#fafafa] flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0a0a0a]">{title}</p>
            <p className="text-xs text-[#737373] mt-0.5 max-w-2xl">{description}</p>
          </div>
          {action}
        </div>
        {children}
      </div>
    </div>
  );
}

function Empty({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      <div className="w-11 h-11 rounded-2xl bg-[#4F46E5]/10 text-[#4F46E5] flex items-center justify-center mb-3"><Icon size={20} /></div>
      <p className="text-sm font-semibold text-[#0a0a0a]">{title}</p>
      <p className="text-xs text-[#737373] mt-1 max-w-sm">{text}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  return status === "retired"
    ? <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#f1f5f9] text-[#64748b]">Retired</span>
    : <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#ecfdf5] text-[#047857]">Active</span>;
}

// ─── Products ───────────────────────────────────────────────────────────────

export function ProductsTab() {
  const { data: products = [], isLoading } = useProducts({ all: true });
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const visible = products.filter((p) => showRetired || p.status !== "retired");
  const retiredCount = products.filter((p) => p.status === "retired").length;

  const addButton = <Button size="sm" onClick={() => setEditing("new")}><Plus size={13} className="mr-1" /> Add product</Button>;

  return (
    <Shell
      title="Products"
      description="Your catalog. Every product picker in Distillr — batches, barrels, labels, COLAs, inventory — reads from this list. Renaming a product here updates every record that uses it."
      action={products.length > 0 ? addButton : undefined}
    >
      {isLoading ? (
        <p className="px-5 py-10 text-sm text-[#a3a3a3]">Loading…</p>
      ) : products.length === 0 ? (
        <Empty
          icon={Box}
          title="No products yet"
          text="Add the spirits you make, or import them with the Products sheet in Settings → Import. Batches, barrels and labels will offer them from then on."
          action={addButton}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-[#a3a3a3] border-b border-[#f0f0f0]">
                  <th className="px-5 py-2.5 font-semibold">Product</th>
                  <th className="px-3 py-2.5 font-semibold">Class</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Proof</th>
                  <th className="px-3 py-2.5 font-semibold">Sizes</th>
                  <th className="px-3 py-2.5 font-semibold">Variants</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id} onClick={() => setEditing(p)} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] cursor-pointer">
                    <td className="px-5 py-3">
                      <p className="font-medium text-[#0a0a0a]">{p.name}</p>
                      <p className="text-[11px] text-[#a3a3a3]">{[spiritTypeLabel(p.spiritType), p.sku].filter(Boolean).join(" · ") || "—"}</p>
                    </td>
                    <td className="px-3 py-3 text-[#525252]">{p.spiritClass || "—"}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[#525252]">{p.bottlingProof ? `${p.bottlingProof}°` : "—"}</td>
                    <td className="px-3 py-3 text-[#525252]">{p.sizes.map((s) => BOTTLE_SIZES.find((b) => b.value === s)?.label ?? s).join(", ") || "—"}</td>
                    <td className="px-3 py-3 text-[#525252]">{p.variants.length ? p.variants.join(", ") : "—"}</td>
                    <td className="px-5 py-3"><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {retiredCount > 0 && (
            <div className="px-5 py-2.5 border-t border-[#f0f0f0] text-xs">
              <button className="text-[#4F46E5] font-medium" onClick={() => setShowRetired((v) => !v)}>
                {showRetired ? "Hide" : "Show"} {retiredCount} retired product{retiredCount === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </>
      )}
      {editing && <ProductEditor product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </Shell>
  );
}

function ChipInput({ values, onChange, placeholder }: { values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-h-9 rounded-md border border-[#e5e5e5] bg-white px-2 py-1.5">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-[#eef2ff] text-[#4338ca] text-xs font-medium pl-2 pr-1 py-0.5">
          {v}
          <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} className="rounded hover:bg-[#e0e7ff] p-0.5"><X size={11} /></button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        value={draft}
        placeholder={values.length ? "" : placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={add}
      />
    </div>
  );
}

export function IngredientRows({ rows, onChange }: { rows: Ingredient[]; onChange: (rows: Ingredient[]) => void }) {
  const set = (i: number, patch: Partial<Ingredient>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2">
          <Input value={r.name} onChange={(e) => set(i, { name: e.target.value })} placeholder="Ingredient, e.g. Corn" />
          <Input type="number" step="0.01" min="0" value={r.quantity ?? ""} onChange={(e) => set(i, { quantity: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Qty" />
          <Select value={r.unit} onChange={(e) => set(i, { unit: e.target.value })}>
            <option value="">Unit</option>
            {INGREDIENT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            {r.unit && !INGREDIENT_UNITS.includes(r.unit) && <option value={r.unit}>{r.unit}</option>}
          </Select>
          <button type="button" aria-label="Remove ingredient" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="h-9 w-8 flex items-center justify-center rounded-md text-[#a3a3a3] hover:text-red-600 hover:bg-red-50"><Trash2 size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...rows, { name: "", quantity: null, unit: "lb" }])} className="inline-flex items-center gap-1 text-xs font-medium text-[#4F46E5]">
        <Plus size={12} /> Add ingredient
      </button>
    </div>
  );
}

function ProductEditor({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const save = useSaveProduct();
  const del = useDeleteProduct();
  const [f, setF] = useState(() => ({
    name: product?.name ?? "",
    spiritType: product?.spiritType ?? "",
    spiritClass: product?.spiritClass ?? "",
    bottlingProof: product?.bottlingProof ? String(product.bottlingProof) : "",
    taxClass: product?.taxClass ?? "craft_tier1",
    sku: product?.sku ?? "",
    sizes: product?.sizes ?? ["750ml"],
    labelsPerBottle: product?.labelsPerBottle != null ? String(product.labelsPerBottle) : "",
    variants: product?.variants ?? [],
    combineBarrelAging: product?.combineBarrelAging ?? false,
    recipe: product?.recipe ?? [],
    status: product?.status ?? "active",
    notes: product?.notes ?? "",
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const renaming = !!product && f.name.trim() !== product.name;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({
        id: product?.id,
        name: f.name.trim(),
        spiritType: f.spiritType || null,
        spiritClass: f.spiritClass || null,
        bottlingProof: f.bottlingProof ? Number(f.bottlingProof) : null,
        taxClass: f.taxClass || null,
        sku: f.sku.trim() || null,
        sizes: f.sizes,
        labelsPerBottle: f.labelsPerBottle ? Number(f.labelsPerBottle) : null,
        variants: f.variants,
        combineBarrelAging: f.combineBarrelAging,
        recipe: f.recipe.filter((r) => r.name.trim()),
        status: f.status as "active" | "retired",
        notes: f.notes.trim() || null,
      });
      toast.success(product ? (renaming ? `Renamed to ${f.name.trim()} everywhere` : "Product saved") : "Product added");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Could not save product");
    }
  }

  async function remove() {
    if (!product) return;
    try {
      await del.mutateAsync(product.id);
      toast.success(`${product.name} deleted`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Could not delete product");
    }
  }

  return (
    <Dialog open onClose={onClose} title={product ? `Edit ${product.name}` : "Add a product"} size="lg">
      <form onSubmit={submit} className="space-y-5">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={label}>Product name</label>
            <Input required autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Small Batch Bourbon" />
            {renaming && <p className="text-[11px] text-[#b45309] mt-1">Every batch, barrel, label, COLA and inventory record named “{product!.name}” will be renamed too.</p>}
          </div>
          <div>
            <label className={label}>Spirit type</label>
            <SpiritTypeSelect value={f.spiritType} onChange={(v) => setF((x) => ({ ...x, spiritType: v, spiritClass: "" }))} />
          </div>
          <div>
            <label className={label}>Class designation</label>
            <SpiritClassSelect spiritType={f.spiritType} value={f.spiritClass} onChange={(v) => setF((x) => ({ ...x, spiritClass: v, spiritType: x.spiritType || spiritTypeForClass(v) || "" }))} />
          </div>
          <div>
            <label className={label}>Bottling proof</label>
            <Input type="number" step="0.1" min="0" max="200" value={f.bottlingProof} onChange={(e) => set("bottlingProof", e.target.value)} placeholder="e.g. 90" />
          </div>
          <div>
            <label className={label}>Federal tax class</label>
            <Select value={f.taxClass} onChange={(e) => set("taxClass", e.target.value)}>
              {TAX_CLASSES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </div>
          <div>
            <label className={label}>SKU <span className="font-normal text-[#a3a3a3]">(optional)</span></label>
            <Input value={f.sku} onChange={(e) => set("sku", e.target.value)} placeholder="e.g. SBB-750" />
          </div>
          <div>
            <label className={label}>Labels per bottle</label>
            <Input type="number" min="0" max="20" value={f.labelsPerBottle} onChange={(e) => set("labelsPerBottle", e.target.value)} placeholder="e.g. 2 (front + back)" />
          </div>
        </section>

        <section>
          <label className={label}>Bottle sizes</label>
          <div className="flex flex-wrap gap-2">
            {BOTTLE_SIZES.map((s) => {
              const on = f.sizes.includes(s.value);
              return (
                <button key={s.value} type="button" aria-pressed={on}
                  onClick={() => set("sizes", on ? f.sizes.filter((x) => x !== s.value) : [...f.sizes, s.value])}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${on ? "border-[#4F46E5] bg-[#4F46E5]/5 text-[#4F46E5]" : "border-[#e5e5e5] text-[#525252] hover:border-[#d0d0d0]"}`}>
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <label className={label}>Variants <span className="font-normal text-[#a3a3a3]">— flavors, finishes or strengths made under this product</span></label>
            <ChipInput values={f.variants} onChange={(v) => set("variants", v)} placeholder="Type a variant and press Enter, e.g. Cask Strength" />
          </div>
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={f.combineBarrelAging} onChange={(e) => set("combineBarrelAging", e.target.checked)} />
            <span>
              <span className="font-medium text-[#0a0a0a]">Barreled and aged in one step</span>
              <span className="block text-xs text-[#737373]">For spirits infused or rested in the barrel — the batch shows a single Barreling / Aging stage and asks for the variant there.</span>
            </span>
          </label>
        </section>

        <section>
          <label className={label}>Recipe / mash bill <span className="font-normal text-[#a3a3a3]">— pre-fills each new production record</span></label>
          <IngredientRows rows={f.recipe} onChange={(rows) => set("recipe", rows)} />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
          <div>
            <label className={label}>Notes</label>
            <Input value={f.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className={label}>Status</label>
            <Select value={f.status} onChange={(e) => set("status", e.target.value as "active" | "retired")}>
              <option value="active">Active</option>
              <option value="retired">Retired — hide from pickers</option>
            </Select>
          </div>
        </section>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#f0f0f0]">
          {product ? (
            <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={del.isPending} className="text-red-600 hover:bg-red-50">
              <Trash2 size={13} className="mr-1" /> Delete
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={save.isPending || !f.name.trim()}>{save.isPending ? "Saving…" : product ? "Save changes" : "Add product"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}

// ─── Storage locations ──────────────────────────────────────────────────────

export function LocationsTab() {
  const { data: locations = [], isLoading } = useStorageLocations({ all: true });
  const save = useSaveLocation();
  const [draft, setDraft] = useState({ name: "", kind: "Rickhouse", bonded: true });
  const [editing, setEditing] = useState<StorageLocation | null>(null);
  const sorted = useMemo(() => locations, [locations]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return;
    try {
      await save.mutateAsync({ name: draft.name.trim(), kind: draft.kind, bonded: draft.bonded });
      toast.success(`${draft.name.trim()} added`);
      setDraft((d) => ({ ...d, name: "" }));
    } catch (err: any) {
      toast.error(err.message || "Could not add location");
    }
  }

  return (
    <Shell
      title="Storage Locations"
      description="Rickhouses, racks, tanks and rooms. Barrels and batches pick their location from this list. Use whatever naming your warehouse uses, e.g. “Rickhouse A · Rack 3 · Tier 2”."
    >
      <form onSubmit={add} className="px-5 py-4 border-b border-[#f0f0f0] grid grid-cols-1 sm:grid-cols-[1fr_160px_auto_auto] gap-2 items-center">
        <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="New location name" />
        <Select value={draft.kind} onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}>
          {LOCATION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </Select>
        <label className="flex items-center gap-1.5 text-xs text-[#525252] px-1">
          <input type="checkbox" checked={draft.bonded} onChange={(e) => setDraft((d) => ({ ...d, bonded: e.target.checked }))} /> Bonded
        </label>
        <Button type="submit" size="md" disabled={save.isPending || !draft.name.trim()}><Plus size={13} className="mr-1" /> Add</Button>
      </form>
      {isLoading ? (
        <p className="px-5 py-10 text-sm text-[#a3a3a3]">Loading…</p>
      ) : sorted.length === 0 ? (
        <Empty icon={MapPin} title="No locations yet" text="Add the places you store barrels and spirits. They'll appear in the location picker on barrels and batches." action={null} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-[#a3a3a3] border-b border-[#f0f0f0]">
              <th className="px-5 py-2.5 font-semibold">Location</th>
              <th className="px-3 py-2.5 font-semibold">Type</th>
              <th className="px-3 py-2.5 font-semibold">Bonded</th>
              <th className="px-5 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((l) => (
              <tr key={l.id} onClick={() => setEditing(l)} className="border-b border-[#f5f5f5] last:border-0 hover:bg-[#fafafa] cursor-pointer">
                <td className="px-5 py-3 font-medium text-[#0a0a0a]">{l.name}</td>
                <td className="px-3 py-3 text-[#525252]">{l.kind || "—"}</td>
                <td className="px-3 py-3 text-[#525252]">{l.bonded ? "Yes" : "No"}</td>
                <td className="px-5 py-3"><StatusPill status={l.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && <LocationEditor location={editing} onClose={() => setEditing(null)} />}
    </Shell>
  );
}

function LocationEditor({ location, onClose }: { location: StorageLocation; onClose: () => void }) {
  const save = useSaveLocation();
  const del = useDeleteLocation();
  const [f, setF] = useState({ name: location.name, kind: location.kind ?? "", bonded: location.bonded, status: location.status, notes: location.notes ?? "" });
  const renaming = f.name.trim() !== location.name;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await save.mutateAsync({ id: location.id, name: f.name.trim(), kind: f.kind || null, bonded: f.bonded, status: f.status as "active" | "retired", notes: f.notes.trim() || null });
      toast.success("Location saved");
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Could not save location");
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Edit ${location.name}`} size="sm">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={label}>Name</label>
          <Input required value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} />
          {renaming && <p className="text-[11px] text-[#b45309] mt-1">Barrels stored at “{location.name}” will move to the new name.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Type</label>
            <Select value={f.kind} onChange={(e) => setF((x) => ({ ...x, kind: e.target.value }))}>
              <option value="">—</option>
              {LOCATION_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </div>
          <div>
            <label className={label}>Status</label>
            <Select value={f.status} onChange={(e) => setF((x) => ({ ...x, status: e.target.value as "active" | "retired" }))}>
              <option value="active">Active</option>
              <option value="retired">Retired</option>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.bonded} onChange={(e) => setF((x) => ({ ...x, bonded: e.target.checked }))} /> Bonded premises</label>
        <div>
          <label className={label}>Notes</label>
          <Input value={f.notes} onChange={(e) => setF((x) => ({ ...x, notes: e.target.value }))} placeholder="Optional" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[#f0f0f0]">
          <Button type="button" variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" disabled={del.isPending}
            onClick={async () => { try { await del.mutateAsync(location.id); toast.success("Location deleted"); onClose(); } catch (err: any) { toast.error(err.message); } }}>
            <Archive size={13} className="mr-1" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
