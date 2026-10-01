/**
 * GC-Stats — country-code
 *
 * V1 stores lowercase ISO 3166-1 alpha-2 codes, with the synthetic 'inter'
 * sentinel for international/no-fixed-country entities. V2's country_code
 * columns are alpha-3, with "INT" as the equivalent sentinel. This table is
 * the alpha-2 -> alpha-3 mapping, mirroring apps/web/src/lib/countries.ts'
 * COUNTRIES list (kept as its own copy here since packages/db has no
 * dependency on apps/web).
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const ALPHA2_TO_ALPHA3: Record<string, string> = {
  af: "AFG", al: "ALB", dz: "DZA", ad: "AND", ao: "AGO", ar: "ARG", am: "ARM",
  au: "AUS", at: "AUT", az: "AZE", bs: "BHS", bh: "BHR", bd: "BGD", bb: "BRB",
  by: "BLR", be: "BEL", bz: "BLZ", bj: "BEN", bt: "BTN", bo: "BOL", ba: "BIH",
  bw: "BWA", br: "BRA", bn: "BRN", bg: "BGR", bf: "BFA", bi: "BDI", kh: "KHM",
  cm: "CMR", ca: "CAN", cv: "CPV", cf: "CAF", td: "TCD", cl: "CHL", cn: "CHN",
  co: "COL", km: "COM", cg: "COG", cd: "COD", cr: "CRI", ci: "CIV", hr: "HRV",
  cu: "CUB", cy: "CYP", cz: "CZE", dk: "DNK", dj: "DJI", dm: "DMA", do: "DOM",
  ec: "ECU", eg: "EGY", sv: "SLV", gq: "GNQ", er: "ERI", ee: "EST", sz: "SWZ",
  et: "ETH", eu: "EUR", fj: "FJI", fi: "FIN", fr: "FRA", ga: "GAB", gm: "GMB",
  ge: "GEO", de: "DEU", gh: "GHA", gr: "GRC", gd: "GRD", gt: "GTM", gn: "GIN",
  gw: "GNB", gy: "GUY", ht: "HTI", hn: "HND", hk: "HKG", hu: "HUN", is: "ISL",
  in: "IND", id: "IDN", ir: "IRN", iq: "IRQ", ie: "IRL", il: "ISR", it: "ITA",
  jm: "JAM", jp: "JPN", jo: "JOR", kz: "KAZ", ke: "KEN", ki: "KIR", kw: "KWT",
  kg: "KGZ", la: "LAO", lv: "LVA", lb: "LBN", ls: "LSO", lr: "LBR", ly: "LBY",
  li: "LIE", lt: "LTU", lu: "LUX", mo: "MAC", mg: "MDG", mw: "MWI", my: "MYS",
  mv: "MDV", ml: "MLI", mt: "MLT", mh: "MHL", mr: "MRT", mu: "MUS", mx: "MEX",
  fm: "FSM", md: "MDA", mc: "MCO", mn: "MNG", me: "MNE", ma: "MAR", mz: "MOZ",
  mm: "MMR", na: "NAM", nr: "NRU", np: "NPL", nl: "NLD", nz: "NZL", ni: "NIC",
  ne: "NER", ng: "NGA", kp: "PRK", mk: "MKD", no: "NOR", om: "OMN", pk: "PAK",
  pw: "PLW", ps: "PSE", pa: "PAN", pg: "PNG", py: "PRY", pe: "PER", ph: "PHL",
  pl: "POL", pt: "PRT", qa: "QAT", ro: "ROU", ru: "RUS", rw: "RWA", kn: "KNA",
  lc: "LCA", vc: "VCT", ws: "WSM", sm: "SMR", st: "STP", sa: "SAU", sn: "SEN",
  rs: "SRB", sc: "SYC", sl: "SLE", sg: "SGP", sk: "SVK", si: "SVN", sb: "SLB",
  so: "SOM", za: "ZAF", kr: "KOR", ss: "SSD", es: "ESP", lk: "LKA", sd: "SDN",
  sr: "SUR", se: "SWE", ch: "CHE", sy: "SYR", tw: "TWN", tj: "TJK", tz: "TZA",
  th: "THA", tl: "TLS", tg: "TGO", to: "TON", tt: "TTO", tn: "TUN", tr: "TUR",
  tm: "TKM", tv: "TUV", ug: "UGA", ua: "UKR", ae: "ARE", gb: "GBR", us: "USA",
  uy: "URY", uz: "UZB", vu: "VUT", va: "VAT", ve: "VEN", vn: "VNM", ye: "YEM",
  zm: "ZMB", zw: "ZWE",
};

const INTERNATIONAL_V1 = "inter";
const INTERNATIONAL_V2 = "INT";

/**
 * Converts a V1 country_code (lowercase alpha-2, or 'inter') to its V2
 * alpha-3 equivalent ('INT' for international). Passes through unknown/
 * already-alpha-3 values unchanged (data already migrated by hand, or a
 * code missing from the map) rather than dropping them silently.
 */
export function convertCountryCode(v1Code: string | null | undefined): string | null {
  if (!v1Code) return null;
  const trimmed = v1Code.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === INTERNATIONAL_V1) return INTERNATIONAL_V2;
  if (trimmed.length === 3) return trimmed.toUpperCase();
  return ALPHA2_TO_ALPHA3[trimmed.toLowerCase()] ?? trimmed.toUpperCase();
}
