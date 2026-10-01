/**
 * GC-Stats - admin-about
 *
 * Admin queries for the /about page content: editable sections and
 * showcased projects.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { aboutSections, aboutProjects } from "@gc-stats/db";

export { ABOUT_PROJECT_TYPES, type AboutProjectType } from "@/lib/about-project-types";

export type AboutSectionRow = {
  id: number;
  key: string;
  title: Record<string, string>;
  content: Record<string, string>;
  order: number;
};

export type AboutProjectRow = {
  id: number;
  name: string;
  type: string;
  description: Record<string, string>;
  url: string | null;
  logoUrl: string | null;
  order: number;
  isActive: boolean;
};

export async function listAboutSections(): Promise<AboutSectionRow[]> {
  const rows = await db.select().from(aboutSections).orderBy(asc(aboutSections.order), asc(aboutSections.id));
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    title: (r.title as Record<string, string>) ?? {},
    content: (r.content as Record<string, string>) ?? {},
    order: r.order,
  }));
}

export async function listAboutProjects(): Promise<AboutProjectRow[]> {
  const rows = await db.select().from(aboutProjects).orderBy(asc(aboutProjects.order), asc(aboutProjects.id));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    description: (r.description as Record<string, string>) ?? {},
    url: r.url,
    logoUrl: r.logoUrl,
    order: r.order,
    isActive: r.isActive,
  }));
}
