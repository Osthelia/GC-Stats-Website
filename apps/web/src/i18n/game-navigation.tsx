"use client";

/**
 * GC-Stats - game-navigation
 *
 * Link and router that complete per-game paths with the game of the current
 * route: `<Link href="/team/3/foo">` on a LoL page goes to `/lol/team/3/foo`.
 * Paths that already carry a game, or that are not per-game, are untouched.
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { forwardRef, useMemo, type ComponentProps } from "react";
import { Link as IntlLink, useRouter as useIntlRouter } from "./intl-navigation";
import { withGame } from "@/lib/game-href";
import { useRouteGame } from "@/lib/use-game";

function resolveHref<H>(href: H, game: ReturnType<typeof useRouteGame>): H {
  if (!game) return href;
  if (typeof href === "string") return withGame(href, game) as H;
  if (typeof href === "object" && href !== null && "pathname" in href && typeof href.pathname === "string") {
    return { ...href, pathname: withGame(href.pathname, game) } as H;
  }
  return href;
}

export const Link = forwardRef<HTMLAnchorElement, ComponentProps<typeof IntlLink>>(function Link({ href, ...props }, ref) {
  const game = useRouteGame();
  return <IntlLink ref={ref} href={resolveHref(href, game)} {...props} />;
});

export function useRouter() {
  const router = useIntlRouter();
  const game = useRouteGame();
  return useMemo(() => {
    return {
      ...router,
      push: (href: Parameters<typeof router.push>[0], options?: Parameters<typeof router.push>[1]) => router.push(resolveHref(href, game) as typeof href, options),
      replace: (href: Parameters<typeof router.replace>[0], options?: Parameters<typeof router.replace>[1]) => router.replace(resolveHref(href, game) as typeof href, options),
      prefetch: (href: Parameters<typeof router.prefetch>[0], options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(resolveHref(href, game) as typeof href, options),
    };
  }, [router, game]);
}
