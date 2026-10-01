/**
 * GC-Stats - geo
 *
 * Maps ISO 3166-1 alpha-2 country codes to GC-Stats geographic regions. Used
 * by the page-view tracker (lib/track-page-view.ts) to bucket traffic for
 * /admin/analytics.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export const REGIONS = ["EURO", "AMER", "APAC", "OTHE"] as const;
export type Region = (typeof REGIONS)[number];

const COUNTRY_TO_REGION: Record<string, Region> = {
  // EURO
  AD: "EURO", AL: "EURO", AT: "EURO", AX: "EURO", BA: "EURO",
  BE: "EURO", BG: "EURO", BY: "EURO", CH: "EURO", CZ: "EURO",
  DE: "EURO", DK: "EURO", EE: "EURO", ES: "EURO", FI: "EURO",
  FO: "EURO", FR: "EURO", GB: "EURO", GG: "EURO", GI: "EURO",
  GR: "EURO", HR: "EURO", HU: "EURO", IE: "EURO", IM: "EURO",
  IS: "EURO", IT: "EURO", JE: "EURO", LI: "EURO", LT: "EURO",
  LU: "EURO", LV: "EURO", MC: "EURO", MD: "EURO", ME: "EURO",
  MK: "EURO", MT: "EURO", NL: "EURO", NO: "EURO", PL: "EURO",
  PT: "EURO", RO: "EURO", RS: "EURO", RU: "EURO", SE: "EURO",
  SI: "EURO", SK: "EURO", SM: "EURO", UA: "EURO", VA: "EURO",
  XK: "EURO",

  // AMER
  AG: "AMER", AI: "AMER", AR: "AMER", AW: "AMER", BB: "AMER",
  BL: "AMER", BM: "AMER", BO: "AMER", BR: "AMER", BS: "AMER",
  BZ: "AMER", CA: "AMER", CL: "AMER", CO: "AMER", CR: "AMER",
  CU: "AMER", CW: "AMER", DM: "AMER", DO: "AMER", EC: "AMER",
  FK: "AMER", GD: "AMER", GF: "AMER", GL: "AMER", GP: "AMER",
  GT: "AMER", GY: "AMER", HN: "AMER", HT: "AMER", JM: "AMER",
  KN: "AMER", KY: "AMER", LC: "AMER", MF: "AMER", MQ: "AMER",
  MS: "AMER", MX: "AMER", NI: "AMER", PA: "AMER", PE: "AMER",
  PM: "AMER", PR: "AMER", PY: "AMER", SR: "AMER", SV: "AMER",
  SX: "AMER", TC: "AMER", TT: "AMER", US: "AMER", UY: "AMER",
  VC: "AMER", VE: "AMER", VG: "AMER", VI: "AMER",

  // APAC
  AE: "APAC", AF: "APAC", AM: "APAC", AS: "APAC", AU: "APAC",
  AZ: "APAC", BD: "APAC", BH: "APAC", BN: "APAC", BT: "APAC",
  CK: "APAC", CN: "APAC", CY: "APAC", FJ: "APAC", FM: "APAC",
  GE: "APAC", GU: "APAC", HK: "APAC", ID: "APAC", IL: "APAC",
  IN: "APAC", IQ: "APAC", IR: "APAC", JO: "APAC", JP: "APAC",
  KG: "APAC", KH: "APAC", KI: "APAC", KP: "APAC", KR: "APAC",
  KW: "APAC", KZ: "APAC", LA: "APAC", LB: "APAC", LK: "APAC",
  MH: "APAC", MM: "APAC", MN: "APAC", MO: "APAC", MP: "APAC",
  MV: "APAC", MY: "APAC", NC: "APAC", NF: "APAC", NP: "APAC",
  NR: "APAC", NU: "APAC", NZ: "APAC", OM: "APAC", PF: "APAC",
  PG: "APAC", PH: "APAC", PK: "APAC", PS: "APAC", PW: "APAC",
  QA: "APAC", SA: "APAC", SB: "APAC", SG: "APAC", SY: "APAC",
  TH: "APAC", TJ: "APAC", TK: "APAC", TL: "APAC", TM: "APAC",
  TO: "APAC", TR: "APAC", TV: "APAC", TW: "APAC", UZ: "APAC",
  VN: "APAC", VU: "APAC", WF: "APAC", WS: "APAC", YE: "APAC",
};

export function regionFromCountry(countryCode: string): Region {
  return COUNTRY_TO_REGION[countryCode.toUpperCase()] ?? "OTHE";
}
