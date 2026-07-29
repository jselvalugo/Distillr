#!/usr/bin/env node
// One-shot script to import excise tax data into the deployed app.
// Usage: COOKIE="your-session-cookie" node import-excise-data.js [base-url]
// Example: COOKIE="connect.sid=s%3A..." node import-excise-data.js https://distillrsoftware.com
//
// To get your session cookie: open the app, DevTools → Application → Cookies → copy connect.sid value

const BASE_URL = process.argv[2] || "https://distillrsoftware.com";

const records = [
  // ── June 2025 ──────────────────────────────────────────────────────────────
  { month:"2025-06", productName:"Original Pitorro",       abv:45,   distCases:173, retailCases:2,  totalCases:175, proofGallons:187.425,               exciseTax:506.0475 },
  { month:"2025-06", productName:"Coconut Pitorro",        abv:45,   distCases:180, retailCases:2,  totalCases:182, proofGallons:194.922,               exciseTax:526.2894 },
  { month:"2025-06", productName:"Citrus Pitorro",         abv:45,   distCases:173, retailCases:2,  totalCases:175, proofGallons:187.425,               exciseTax:506.0475 },
  { month:"2025-06", productName:"Café Pitorro",           abv:45,   distCases:173, retailCases:2,  totalCases:175, proofGallons:187.425,               exciseTax:506.0475 },
  { month:"2025-06", productName:"Libertalia",             abv:42.5, distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.023,                 exciseTax:5.462 },
  { month:"2025-06", productName:"Oak Aged Libertalia",    abv:42.5, distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.023,                 exciseTax:5.462 },
  { month:"2025-06", productName:"Riskey",                 abv:47,   distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.237,                 exciseTax:6.040 },
  { month:"2025-06", productName:"Riskey Barrel Strength", abv:60.1, distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.861,                 exciseTax:7.724 },
  { month:"2025-06", productName:"Yo-Ho Spiced Rum",       abv:40,   distCases:6,   retailCases:0,  totalCases:6,   proofGallons:5.712,                 exciseTax:15.422 },

  // ── July 2025 ──────────────────────────────────────────────────────────────
  { month:"2025-07", productName:"Original Pitorro",       abv:45,   distCases:100, retailCases:80, totalCases:180, proofGallons:192.78,                exciseTax:520.506 },
  { month:"2025-07", productName:"Coconut Pitorro",        abv:45,   distCases:100, retailCases:0,  totalCases:100, proofGallons:107.1,                 exciseTax:289.17 },
  { month:"2025-07", productName:"Citrus Pitorro",         abv:45,   distCases:100, retailCases:0,  totalCases:100, proofGallons:107.1,                 exciseTax:289.17 },
  { month:"2025-07", productName:"Café Pitorro",           abv:45,   distCases:100, retailCases:0,  totalCases:100, proofGallons:107.1,                 exciseTax:289.17 },
  { month:"2025-07", productName:"Libertalia",             abv:42.5, distCases:10,  retailCases:0,  totalCases:10,  proofGallons:10.115,                exciseTax:27.310 },
  { month:"2025-07", productName:"Oak Aged Libertalia",    abv:42.5, distCases:10,  retailCases:4,  totalCases:14,  proofGallons:14.161,                exciseTax:38.235 },
  { month:"2025-07", productName:"Riskey Barrel Strength", abv:64.1, distCases:0,   retailCases:2,  totalCases:2,   proofGallons:3.051,                 exciseTax:8.238 },

  // ── November 2025 ──────────────────────────────────────────────────────────
  { month:"2025-11", productName:"Original Pitorro",       abv:45,   distCases:0,   retailCases:1,  totalCases:1,   proofGallons:1.071,                 exciseTax:2.892 },
  { month:"2025-11", productName:"Coconut Pitorro",        abv:45,   distCases:0,   retailCases:1,  totalCases:1,   proofGallons:1.071,                 exciseTax:2.892 },
  { month:"2025-11", productName:"Citrus Pitorro",         abv:45,   distCases:0,   retailCases:1,  totalCases:1,   proofGallons:1.071,                 exciseTax:2.892 },
  { month:"2025-11", productName:"Café Pitorro",           abv:45,   distCases:0,   retailCases:1,  totalCases:1,   proofGallons:1.071,                 exciseTax:2.892 },
  { month:"2025-11", productName:"Libertalia",             abv:42.5, distCases:11,  retailCases:1,  totalCases:12,  proofGallons:12.138,                exciseTax:32.773 },
  { month:"2025-11", productName:"Oak Aged Libertalia",    abv:42.5, distCases:0,   retailCases:1,  totalCases:1,   proofGallons:1.011,                 exciseTax:2.731 },
  { month:"2025-11", productName:"Riskey",                 abv:47,   distCases:0,   retailCases:1,  totalCases:1,   proofGallons:1.119,                 exciseTax:3.020 },
  { month:"2025-11", productName:"Riskey Barrel Strength", abv:52.2, distCases:33,  retailCases:0,  totalCases:33,  proofGallons:40.998,                exciseTax:110.694 },

  // ── December 2025 ─────────────────────────────────────────────────────────
  { month:"2025-12", productName:"Original Pitorro",       abv:45,   distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.142,                 exciseTax:5.783 },
  { month:"2025-12", productName:"Coconut Pitorro",        abv:45,   distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.142,                 exciseTax:5.783 },
  { month:"2025-12", productName:"Citrus Pitorro",         abv:45,   distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.142,                 exciseTax:5.783 },
  { month:"2025-12", productName:"Café Pitorro",           abv:45,   distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.142,                 exciseTax:5.783 },
  { month:"2025-12", productName:"Libertalia",             abv:42.5, distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.023,                 exciseTax:5.462 },
  { month:"2025-12", productName:"Oak Aged Libertalia",    abv:42.5, distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.023,                 exciseTax:5.462 },
  { month:"2025-12", productName:"Riskey",                 abv:47,   distCases:0,   retailCases:3,  totalCases:3,   proofGallons:3.356,                 exciseTax:9.061 },
  { month:"2025-12", productName:"Riskey Barrel Strength", abv:52.6, distCases:33,  retailCases:0,  totalCases:33,  proofGallons:41.312,                exciseTax:111.543 },

  // ── January 2026 ──────────────────────────────────────────────────────────
  { month:"2026-01", productName:"Original Pitorro",       abv:45,   distCases:200, retailCases:2,  totalCases:202, proofGallons:216.342,               exciseTax:584.123 },
  { month:"2026-01", productName:"Coconut Pitorro",        abv:45,   distCases:200, retailCases:2,  totalCases:202, proofGallons:216.342,               exciseTax:584.123 },
  { month:"2026-01", productName:"Café Pitorro",           abv:45,   distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.142,                 exciseTax:5.783 },
  { month:"2026-01", productName:"Libertalia",             abv:42.5, distCases:10,  retailCases:2,  totalCases:12,  proofGallons:12.138,                exciseTax:32.773 },
  { month:"2026-01", productName:"Oak Aged Libertalia",    abv:42.5, distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.023,                 exciseTax:5.462 },
  { month:"2026-01", productName:"Riskey",                 abv:47,   distCases:40,  retailCases:2,  totalCases:42,  proofGallons:46.981,                exciseTax:126.849 },

  // ── February 2026 ─────────────────────────────────────────────────────────
  { month:"2026-02", productName:"Riskey",                 abv:47,   distCases:30,  retailCases:0,  totalCases:30,  proofGallons:33.558,                exciseTax:90.607 },
  { month:"2026-02", productName:"Riskey Barrel Strength", abv:52.6, distCases:6,   retailCases:0,  totalCases:6,   proofGallons:7.511,                 exciseTax:20.280 },

  // ── March 2026 ────────────────────────────────────────────────────────────
  { month:"2026-03", productName:"Original Pitorro",       abv:45,   distCases:0,   retailCases:5,  totalCases:5,   proofGallons:5.355,                 exciseTax:14.459 },
  { month:"2026-03", productName:"Riskey",                 abv:47,   distCases:0,   retailCases:2,  totalCases:2,   proofGallons:2.237,                 exciseTax:6.040 },
  { month:"2026-03", productName:"Riskey Barrel Strength", abv:52.6, distCases:0,   retailCases:3,  totalCases:3,   proofGallons:3.756,                 exciseTax:10.140 },

  // ── April 2026 ────────────────────────────────────────────────────────────
  { month:"2026-04", productName:"Original Pitorro",       abv:45,   distCases:245, retailCases:0,  totalCases:245, proofGallons:262.395,               exciseTax:708.467 },
  { month:"2026-04", productName:"Libertalia",             abv:42.5, distCases:3,   retailCases:0,  totalCases:3,   proofGallons:3.035,                 exciseTax:8.193 },
];

async function main() {
  const cookie = process.env.COOKIE;
  if (!cookie) {
    console.error("ERROR: Set the COOKIE env var to your session cookie (connect.sid=...)");
    process.exit(1);
  }

  console.log(`Importing ${records.length} excise product records to ${BASE_URL}...`);

  const res = await fetch(`${BASE_URL}/api/admin/import-excise-product-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookie,
    },
    body: JSON.stringify({ records }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("FAILED:", json.error);
    process.exit(1);
  }

  console.log(`✓ Done — inserted: ${json.inserted}, updated: ${json.updated}, skipped: ${json.skipped}`);
}

main().catch(err => { console.error(err); process.exit(1); });
