/**
 * Spirit categories and class designations, shared by every distillery.
 *
 * Spirit types follow the product categories on the TTB Monthly Report of
 * Production / Storage / Processing (F 5110.40). Class designations follow the
 * Standards of Identity (27 CFR 5, Subpart I). These are regulatory, not a
 * customer's data, so they ship with the app; a product can still use a
 * free-text class when it doesn't fit one of these.
 */

export type SpiritType = "whiskey" | "brandy" | "rum" | "gin" | "vodka" | "neutral" | "agave" | "liqueur" | "other";

export const SPIRIT_TYPES: { value: SpiritType; label: string }[] = [
  { value: "whiskey", label: "Whisky" },
  { value: "brandy", label: "Brandy" },
  { value: "rum", label: "Rum" },
  { value: "gin", label: "Gin" },
  { value: "vodka", label: "Vodka" },
  { value: "neutral", label: "Alcohol / neutral spirits (190° and over)" },
  { value: "agave", label: "Agave spirits" },
  { value: "liqueur", label: "Liqueurs & cordials" },
  { value: "other", label: "Other" },
];

export const SPIRIT_CLASSES: Record<SpiritType, string[]> = {
  whiskey: [
    "Bourbon Whiskey", "Straight Bourbon Whiskey", "Bottled-in-Bond Bourbon Whiskey",
    "Rye Whiskey", "Straight Rye Whiskey", "Wheat Whiskey", "Straight Wheat Whiskey",
    "Malt Whiskey", "Straight Malt Whiskey", "American Single Malt Whiskey", "Rye Malt Whiskey",
    "Corn Whiskey", "Straight Corn Whiskey", "Light Whiskey", "Blended Whiskey", "Blended Bourbon Whiskey",
    "Whiskey Distilled from Bourbon Mash", "Spirit Whiskey", "Flavored Whiskey",
  ],
  brandy: ["Brandy", "Fruit Brandy", "Apple Brandy", "Grape Brandy", "Grappa", "Pomace Brandy", "Dried Fruit Brandy", "Flavored Brandy"],
  rum: ["Rum", "Spiced Rum", "Flavored Rum", "Cane Spirit"],
  gin: ["Distilled Gin", "Gin", "Redistilled Gin", "Compounded Gin", "Flavored Gin"],
  vodka: ["Vodka", "Flavored Vodka"],
  neutral: ["Neutral Spirits", "Grain Neutral Spirits", "Cane Neutral Spirits", "Grape Neutral Spirits", "Grain Spirits"],
  agave: ["Agave Spirits", "Tequila", "Mezcal", "Flavored Agave Spirits"],
  liqueur: ["Liqueur", "Cordial", "Cream Liqueur", "Sloe Gin", "Rock and Rye"],
  other: ["Distilled Spirits Specialty", "Aquavit", "Absinthe", "Bitters", "Other"],
};

export const ALL_SPIRIT_CLASSES: string[] = Array.from(
  new Set(Object.keys(SPIRIT_CLASSES).reduce<string[]>((acc, k) => acc.concat(SPIRIT_CLASSES[k as SpiritType]), [])),
);

export function spiritTypeLabel(value: string | null | undefined): string {
  if (!value) return "";
  const v = value.toLowerCase() === "whisky" ? "whiskey" : value.toLowerCase();
  const hit = SPIRIT_TYPES.find((t) => t.value === v);
  return hit ? hit.label : value.charAt(0).toUpperCase() + value.slice(1);
}

/** Best-guess spirit type for a class designation ("Straight Rye Whisky" → whisky). */
export function spiritTypeForClass(cls: string | null | undefined): SpiritType | null {
  if (!cls) return null;
  const norm = (x: string) => x.toLowerCase().replace(/whisky/g, "whiskey").trim();
  const c = norm(cls);
  for (const t of Object.keys(SPIRIT_CLASSES) as SpiritType[]) {
    if (SPIRIT_CLASSES[t].some((x) => norm(x) === c)) return t;
  }
  if (/whiske?y|bourbon|scotch/.test(c)) return "whiskey";
  if (/brandy|cognac|armagnac|grappa|pisco|calvados/.test(c)) return "brandy";
  if (/\brum\b|cachaça|cachaca|cane spirit/.test(c)) return "rum";
  if (/\bgin\b/.test(c)) return "gin";
  if (/vodka/.test(c)) return "vodka";
  if (/tequila|mezcal|agave/.test(c)) return "agave";
  if (/liqueur|cordial|cream/.test(c)) return "liqueur";
  if (/neutral|grain spirits/.test(c)) return "neutral";
  return null;
}

export const BOTTLE_SIZES: { value: string; label: string }[] = [
  { value: "50ml", label: "50 mL" },
  { value: "200ml", label: "200 mL" },
  { value: "375ml", label: "375 mL" },
  { value: "750ml", label: "750 mL" },
  { value: "1000ml", label: "1 L" },
  { value: "1750ml", label: "1.75 L" },
];

export const TAX_CLASSES: { value: string; label: string }[] = [
  { value: "craft_tier1", label: "Craft Tier 1 — first 100,000 PG ($2.70/PG)" },
  { value: "craft_tier2", label: "Craft Tier 2 — 100,001–22.23M PG ($13.34/PG)" },
  { value: "standard", label: "Standard rate ($13.50/PG)" },
];

export const INGREDIENT_UNITS = ["lb", "gal", "kg", "L", "bu", "packets", "g", "oz"];

export type Ingredient = { name: string; quantity: number | null; unit: string };

export const US_STATES: { code: string; name: string }[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"],
  ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["PR", "Puerto Rico"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([code, name]) => ({ code, name }));
