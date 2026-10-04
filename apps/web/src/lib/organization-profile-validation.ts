/**
 * GC-Stats - organization-profile-validation
 *
 * Field-shape validation for an organization's profile form, shared between
 * admin and /dashboard editors since both edit the same fields under
 * different permission systems. Slug uniqueness stays with each caller.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { isValidCountryCode } from "@/lib/countries";
import { ORGANIZATION_TAGS } from "@/lib/organization-tags";

// Shared between admin (actions/admin-organizations.ts) and /dashboard
// (actions/dashboard-organizations.ts): both edit the exact same
// `organizations` row/fields, just gated by a different permission system —
// duplicating this validation would let the two drift out of sync.
export const ORGANIZATION_SOCIAL_KEYS = ["twitter", "twitch", "instagram", "youtube", "tiktok", "discord", "website"] as const;

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type OrganizationProfileInput = {
  name: string;
  slug: string;
  countryCode: string;
  secondaryCountryCode: string;
  bio: string;
  socials: Partial<Record<(typeof ORGANIZATION_SOCIAL_KEYS)[number], string>>;
  tags: string[];
};

export type OrganizationProfileField = "name" | "slug" | "countryCode" | "secondaryCountryCode" | "bio" | "tags";
export type OrganizationProfileFieldErrors = Partial<Record<OrganizationProfileField, string>> & {
  socials?: Partial<Record<(typeof ORGANIZATION_SOCIAL_KEYS)[number], string>>;
};

export type ValidatedOrganizationProfile = {
  fieldErrors: OrganizationProfileFieldErrors;
  name: string;
  slug: string;
  countryCode: string;
  secondaryCountryCode: string;
  bio: string;
  socials: Record<string, string>;
  tags: string[];
};

/** Field-shape validation only — slug-uniqueness (needs a DB lookup scoped to the organization being edited) stays with each caller. */
export function validateOrganizationProfileInput(input: OrganizationProfileInput): ValidatedOrganizationProfile {
  const fieldErrors: OrganizationProfileFieldErrors = {};

  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  const countryCode = input.countryCode.trim();
  const secondaryCountryCode = input.secondaryCountryCode.trim();
  const bio = input.bio.trim();

  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  if (!slug) fieldErrors.slug = "required";
  else if (slug.length > 100) fieldErrors.slug = "tooLong";
  else if (!SLUG_RE.test(slug)) fieldErrors.slug = "invalid";

  if (countryCode && !isValidCountryCode(countryCode)) fieldErrors.countryCode = "invalid";
  if (secondaryCountryCode && !isValidCountryCode(secondaryCountryCode)) fieldErrors.secondaryCountryCode = "invalid";

  if (bio.length > 2000) fieldErrors.bio = "tooLong";

  const tags = [...new Set(input.tags)];
  if (tags.some((tag) => !(ORGANIZATION_TAGS as readonly string[]).includes(tag))) fieldErrors.tags = "invalid";

  const socials: Record<string, string> = {};
  const socialErrors: Partial<Record<(typeof ORGANIZATION_SOCIAL_KEYS)[number], string>> = {};
  for (const key of ORGANIZATION_SOCIAL_KEYS) {
    const value = input.socials[key]?.trim();
    if (!value) continue;
    if (value.length > 2000) socialErrors[key] = "tooLong";
    else if (!isValidUrl(value)) socialErrors[key] = "invalid";
    else socials[key] = value;
  }
  if (Object.keys(socialErrors).length > 0) fieldErrors.socials = socialErrors;

  return { fieldErrors, name, slug, countryCode, secondaryCountryCode, bio, socials, tags };
}
