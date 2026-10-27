import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import type { Product } from "@shared/reference";
import { SPIRIT_CLASSES, SPIRIT_TYPES, ALL_SPIRIT_CLASSES, spiritTypeForClass, type SpiritType } from "@shared/spirits";
import { Select } from "../ui/select";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { findProduct, useProducts, useSaveLocation, useSaveProduct, useStorageLocations } from "../../lib/reference";
import { useAuth } from "../../hooks/use-auth";

const ADD = "__add__";

/**
 * Product dropdown fed by the workspace catalog (Settings → Reference Data).
 * Keeps a value that isn't in the catalog (older records) visible as-is, and
 * offers "+ Add product…" so a missing product can be created without leaving
 * the form. `onChange` gets the name and, when known, the catalog entry, so a
 * form can pre-fill class, proof and recipe.
 */
export function ProductSelect({
  value,
  onChange,
  placeholder = "— Select product —",
  className,
  required,
  id,
}: {
  value: string | null | undefined;
  onChange: (name: string, product: Product | undefined) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
}) {
  const { data: products = [], isLoading } = useProducts();
  const [adding, setAdding] = useState(false);
  const current = value ?? "";
  const known = !current || !!findProduct(products, current);

  return (
    <>
      <Select
        id={id}
        className={className}
        required={required}
        value={current}
        onChange={(e) => {
          if (e.target.value === ADD) { setAdding(true); return; }
          onChange(e.target.value, findProduct(products, e.target.value));
        }}
      >
        <option value="">{isLoading ? "Loading products…" : products.length ? placeholder : "No products yet — add one"}</option>
        {!known && <option value={current}>{current} (not in catalog)</option>}
        {products.map((p) => (
          <option key={p.id} value={p.name}>{p.name}</option>
        ))}
        <option value={ADD}>+ Add product…</option>
      </Select>
      <QuickAddProduct
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(p) => { setAdding(false); onChange(p.name, p); }}
      />
    </>
  );
}

function QuickAddProduct({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (p: Product) => void }) {
  const save = useSaveProduct();
  const [name, setName] = useState("");
  const [spiritType, setSpiritType] = useState<string>("");
  const [spiritClass, setSpiritClass] = useState("");
  const [proof, setProof] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const p = await save.mutateAsync({
        name: name.trim(),
        spiritType: spiritType || null,
        spiritClass: spiritClass || null,
        bottlingProof: proof ? Number(proof) : null,
        sizes: ["750ml"],
      });
      toast.success(`${p.name} added to your products`);
      setName(""); setSpiritType(""); setSpiritClass(""); setProof("");
      onCreated(p);
    } catch (err: any) {
      toast.error(err.message || "Could not add product");
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add a product" size="sm">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Product name</label>
          <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Small Batch Bourbon" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Spirit type</label>
            <SpiritTypeSelect value={spiritType} onChange={(v) => { setSpiritType(v); setSpiritClass(""); }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Bottling proof</label>
            <Input type="number" step="0.1" min="0" max="200" value={proof} onChange={(e) => setProof(e.target.value)} placeholder="e.g. 90" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#737373] mb-1">Class designation</label>
          <SpiritClassSelect spiritType={spiritType} value={spiritClass} onChange={(v) => { setSpiritClass(v); if (!spiritType) setSpiritType(spiritTypeForClass(v) ?? ""); }} />
        </div>
        <p className="text-[11px] text-[#a3a3a3]">Add sizes, variants and a recipe later under Settings → Reference Data → Products.</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={save.isPending || !name.trim()}>{save.isPending ? "Adding…" : "Add product"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

/** TTB product category (whiskey, rum, gin…). */
export function SpiritTypeSelect({ value, onChange, className, id }: { value: string | null | undefined; onChange: (v: string) => void; className?: string; id?: string }) {
  const v = value ?? "";
  const known = !v || SPIRIT_TYPES.some((t) => t.value === v.toLowerCase());
  return (
    <Select id={id} className={className} value={v.toLowerCase() === "whisky" ? "whiskey" : v} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Select —</option>
      {!known && <option value={v}>{v}</option>}
      {SPIRIT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
    </Select>
  );
}

/**
 * Class designation from the Standards of Identity, narrowed by spirit type
 * when one is chosen. "Other…" lets the user type a designation.
 */
export function SpiritClassSelect({
  spiritType,
  value,
  onChange,
  className,
  id,
}: {
  spiritType?: string | null;
  value: string | null | undefined;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
}) {
  const t = (spiritType ?? "").toLowerCase() === "whisky" ? "whiskey" : (spiritType ?? "").toLowerCase();
  const list = (SPIRIT_CLASSES as Record<string, string[]>)[t as SpiritType] ?? ALL_SPIRIT_CLASSES;
  const v = value ?? "";
  const inList = !v || list.some((c) => c.toLowerCase() === v.toLowerCase());
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <div className="flex gap-2">
        <Input id={id} className={className} autoFocus value={v} onChange={(e) => onChange(e.target.value)} placeholder="Class designation" />
        <Button type="button" variant="outline" size="sm" onClick={() => setCustom(false)}>List</Button>
      </div>
    );
  }
  return (
    <Select
      id={id}
      className={className}
      value={v}
      onChange={(e) => {
        if (e.target.value === "__custom__") { setCustom(true); return; }
        onChange(e.target.value);
      }}
    >
      <option value="">— Select —</option>
      {!inList && <option value={v}>{v}</option>}
      {list.map((c) => <option key={c} value={c}>{c}</option>)}
      <option value="__custom__">Other…</option>
    </Select>
  );
}

/** One of a product's variants (flavor, finish…), or free text if the product has none. */
export function VariantSelect({ product, value, onChange, className }: { product: Product | undefined; value: string | null | undefined; onChange: (v: string) => void; className?: string }) {
  const options = product?.variants ?? [];
  const v = value ?? "";
  if (!options.length) {
    return <Input className={className} value={v} onChange={(e) => onChange(e.target.value)} placeholder="Optional — e.g. Cask Strength" />;
  }
  return (
    <Select className={className} value={v} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Standard —</option>
      {v && !options.includes(v) && <option value={v}>{v}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </Select>
  );
}

/** Storage location from the workspace's list, with inline "+ Add location…". */
export function LocationSelect({ value, onChange, className, id, placeholder = "— Select location —" }: { value: string | null | undefined; onChange: (v: string) => void; className?: string; id?: string; placeholder?: string }) {
  const { data: locations = [], isLoading } = useStorageLocations();
  const save = useSaveLocation();
  const { user } = useAuth();
  const v = value ?? "";
  const known = !v || locations.some((l) => l.name.toLowerCase() === v.toLowerCase());
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      const loc = await save.mutateAsync({ name: name.trim() });
      toast.success(`${loc.name} added`);
      setName(""); setAdding(false); onChange(loc.name);
    } catch (err: any) {
      toast.error(err.message || "Could not add location");
    }
  }

  return (
    <>
      <Select
        id={id}
        className={className}
        value={v}
        onChange={(e) => {
          if (e.target.value === ADD) { setAdding(true); return; }
          onChange(e.target.value);
        }}
      >
        <option value="">{isLoading ? "Loading…" : locations.length ? placeholder : "No locations yet — add one"}</option>
        {!known && <option value={v}>{v}</option>}
        {locations.map((l) => <option key={l.id} value={l.name}>{l.name}{l.kind ? ` · ${l.kind}` : ""}</option>)}
        <option value={ADD}>+ Add location…</option>
      </Select>
      <Dialog open={adding} onClose={() => setAdding(false)} title="Add a storage location" size="sm">
        <form onSubmit={add} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[#737373] mb-1">Location name</label>
            <Input autoFocus required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rickhouse A · Rack 3 · Tier 2" />
          </div>
          {user?.role === "admin" && (
            <p className="text-[11px] text-[#a3a3a3]">
              Manage the full list under <Link href="/settings?tab=locations" className="underline">Settings → Reference Data</Link>.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={save.isPending || !name.trim()}>{save.isPending ? "Adding…" : "Add location"}</Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
