/**
 * GC-Stats - author-profile-validation
 *
 * Field-shape validation for author profile forms. Kept outside
 * actions/dashboard-author.ts ("use server"): a file with that directive can
 * only export async functions, never a plain const/type.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type AuthorProfileField = "name" | "slug" | "bio";
export type AuthorProfileFieldErrors = Partial<Record<AuthorProfileField, string>>;

export type AuthorProfileInput = {
  name: string;
  slug: string;
  bio: string;
};

export type ValidatedAuthorProfile = {
  fieldErrors: AuthorProfileFieldErrors;
  name: string;
  slug: string;
  bio: string;
};

/** Field-shape validation only — slug-uniqueness (needs a DB lookup) stays with the caller. */
export function validateAuthorProfileInput(input: AuthorProfileInput): ValidatedAuthorProfile {
  const fieldErrors: AuthorProfileFieldErrors = {};

  const name = input.name.trim();
  if (!name) fieldErrors.name = "required";
  else if (name.length > 255) fieldErrors.name = "tooLong";

  const slug = input.slug.trim().toLowerCase();
  if (!slug) fieldErrors.slug = "required";
  else if (slug.length > 255) fieldErrors.slug = "tooLong";
  else if (!SLUG_RE.test(slug)) fieldErrors.slug = "invalid";

  const bio = input.bio.trim();
  if (bio.length > 2000) fieldErrors.bio = "tooLong";

  return { fieldErrors, name, slug, bio };
}
