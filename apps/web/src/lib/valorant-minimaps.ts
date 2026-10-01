/**
 * GC-Stats - valorant-minimaps
 *
 * Per-map coefficients for converting Riot's raw in-game x/y position
 * (stored on mapRoundPlayerPositionsRaw) into a normalized 0-1 position on
 * the map's square tactical minimap image. Sourced from valorant-api.com's
 * /v1/maps endpoint (xMultiplier, yMultiplier, xScalarToAdd, yScalarToAdd),
 * the same coefficients Riot's own tooling and every community stats
 * tracker use. Ported from V1's config/valorant_minimaps.php.
 *
 * The raw axes are cross-wired (verified empirically against known bomb
 * site plant coordinates in V1):
 *   xMap = xMultiplier * riotY + xScalar
 *   yMap = yMultiplier * riotX + yScalar
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */
export type MinimapCalibration = {
  xMultiplier: number;
  yMultiplier: number;
  xScalar: number;
  yScalar: number;
  image: string;
};

export const VALORANT_MINIMAPS: Record<string, MinimapCalibration> = {
  ascent: { xMultiplier: 0.00007, yMultiplier: -0.00007, xScalar: 0.813895, yScalar: 0.573242, image: "/valorant/maps/tactical/ascent.webp" },
  split: { xMultiplier: 0.000078, yMultiplier: -0.000078, xScalar: 0.842188, yScalar: 0.697578, image: "/valorant/maps/tactical/split.webp" },
  fracture: { xMultiplier: 0.000078, yMultiplier: -0.000078, xScalar: 0.556952, yScalar: 1.155886, image: "/valorant/maps/tactical/fracture.webp" },
  bind: { xMultiplier: 0.000059, yMultiplier: -0.000059, xScalar: 0.576941, yScalar: 0.967566, image: "/valorant/maps/tactical/bind.webp" },
  breeze: { xMultiplier: 0.00007, yMultiplier: -0.00007, xScalar: 0.465123, yScalar: 0.833078, image: "/valorant/maps/tactical/breeze.webp" },
  abyss: { xMultiplier: 0.000081, yMultiplier: -0.000081, xScalar: 0.5, yScalar: 0.5, image: "/valorant/maps/tactical/abyss.webp" },
  lotus: { xMultiplier: 0.000072, yMultiplier: -0.000072, xScalar: 0.454789, yScalar: 0.917752, image: "/valorant/maps/tactical/lotus.webp" },
  sunset: { xMultiplier: 0.000078, yMultiplier: -0.000078, xScalar: 0.5, yScalar: 0.515625, image: "/valorant/maps/tactical/sunset.webp" },
  pearl: { xMultiplier: 0.000078, yMultiplier: -0.000078, xScalar: 0.480469, yScalar: 0.916016, image: "/valorant/maps/tactical/pearl.webp" },
  summit: { xMultiplier: 0.000075, yMultiplier: -0.000075, xScalar: 0.047401, yScalar: 0.978891, image: "/valorant/maps/tactical/summit.webp" },
  icebox: { xMultiplier: 0.000072, yMultiplier: -0.000072, xScalar: 0.460214, yScalar: 0.304687, image: "/valorant/maps/tactical/icebox.webp" },
  corrode: { xMultiplier: 0.00007, yMultiplier: -0.00007, xScalar: 0.526158, yScalar: 0.5, image: "/valorant/maps/tactical/corrode.webp" },
  haven: { xMultiplier: 0.000075, yMultiplier: -0.000075, xScalar: 1.09345, yScalar: 0.642728, image: "/valorant/maps/tactical/haven.webp" },
};

export const VALORANT_MAP_KEYS = Object.keys(VALORANT_MINIMAPS);

export function isValorantMapKey(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(VALORANT_MINIMAPS, value);
}

export function projectToMinimap(calibration: MinimapCalibration, riotX: number, riotY: number): { x: number; y: number } {
  return {
    x: calibration.xMultiplier * riotY + calibration.xScalar,
    y: calibration.yMultiplier * riotX + calibration.yScalar,
  };
}
