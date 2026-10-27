import { z } from "zod";

/** A product the distillery makes. Each workspace has its own catalog. */
export const ingredientSchema = z.object({
  name: z.string().trim().min(1),
  quantity: z.number().nonnegative().nullable(),
  unit: z.string().trim().default(""),
});

export const productSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Name is required").max(120),
  spiritType: z.string().nullable().optional(),
  spiritClass: z.string().nullable().optional(),
  bottlingProof: z.number().min(0).max(200).nullable().optional(),
  sizes: z.array(z.string()).default([]),
  sku: z.string().nullable().optional(),
  taxClass: z.string().nullable().optional(),
  labelsPerBottle: z.number().int().min(0).max(20).nullable().optional(),
  /** Styles of the same product, e.g. flavors or finishes; chosen per batch. */
  variants: z.array(z.string().trim().min(1)).default([]),
  /** Barreled and aged in one step (e.g. infused in the barrel); the batch form merges those stages. */
  combineBarrelAging: z.boolean().default(false),
  /** Default mash bill / ingredients that pre-fill a new production record. */
  recipe: z.array(ingredientSchema).default([]),
  status: z.enum(["active", "retired"]).default("active"),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof productSchema>;

export const productInputSchema = productSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial().extend({
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type ProductInput = z.infer<typeof productInputSchema>;

/** A place spirits are stored: a rickhouse rack, tank, room or bay. */
export const storageLocationSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "Name is required").max(120),
  kind: z.string().nullable().optional(),
  propertyId: z.string().nullable().optional(),
  bonded: z.boolean().default(true),
  status: z.enum(["active", "retired"]).default("active"),
  notes: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StorageLocation = z.infer<typeof storageLocationSchema>;

export const storageLocationInputSchema = storageLocationSchema.omit({ id: true, createdAt: true, updatedAt: true }).partial().extend({
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type StorageLocationInput = z.infer<typeof storageLocationInputSchema>;

export const LOCATION_KINDS = ["Rickhouse", "Rack", "Warehouse", "Tank", "Room", "Bay", "Other"];
