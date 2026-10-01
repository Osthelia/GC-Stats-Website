/**
 * GC-Stats - role-name-badge
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STYLES = {
  superAdmin: "bg-violet-400/10 text-violet-300 border-violet-400/20",
  regular: "bg-sky-400/10 text-sky-300 border-sky-400/20",
} as const;

/** Global role chip, shared by the users list and a user's own roles panel. Super admin gets a distinct color, same idea as the "protected" badge on /admin/roles. */
export function RoleNameBadge({ name, isSuperAdmin }: { name: string; isSuperAdmin: boolean }) {
  return <Badge variant="outline" className={cn(isSuperAdmin ? STYLES.superAdmin : STYLES.regular)}>{name}</Badge>;
}
