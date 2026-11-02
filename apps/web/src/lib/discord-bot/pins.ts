/**
 * GC-Stats - pins
 *
 * Fingerprints of the external images a template draws, taken when it is saved so a later swap of the picture is noticed.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { hashExternalImage } from "./image";
import { externalImageUrls, type AlertTemplate } from "./template";

/** SHA-256 per external image of the template, and the addresses that could not be downloaded. */
export async function pinExternalImages(template: AlertTemplate): Promise<{ pins: Record<string, string>; unreachable: string[] }> {
  const urls = externalImageUrls(template);
  const hashes = await Promise.all(urls.map((url) => hashExternalImage(url)));
  const pins: Record<string, string> = {};
  const unreachable: string[] = [];
  urls.forEach((url, i) => {
    const hash = hashes[i];
    if (hash) pins[url] = hash;
    else unreachable.push(url);
  });
  return { pins, unreachable };
}
