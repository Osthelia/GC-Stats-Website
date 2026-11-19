import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const rows = vi.fn();

vi.mock("@/lib/session", () => ({ getSession: () => getSession() }));
vi.mock("@/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@gc-stats/db/client", () => ({
  db: { select: () => ({ from: () => ({ innerJoin: () => ({ leftJoin: () => ({ leftJoin: () => ({ where: () => rows() }) }) }) }) }) },
}));

import { canViewGame, isGamePreview } from "./rbac";

const adminRow = (assignedGame: string | null) => ({ isSuperAdmin: false, permissionName: "admin.access", assignedGame });

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("PUBLIC_GAMES", "valorant");
  getSession.mockReset();
  rows.mockReset();
});

describe("canViewGame", () => {
  it("lets everyone see a public game without asking for the session", async () => {
    expect(await canViewGame("valorant")).toBe(true);
    expect(getSession).not.toHaveBeenCalled();
  });

  it("hides a hidden game from a signed-out visitor", async () => {
    getSession.mockResolvedValue(null);
    expect(await canViewGame("lol")).toBe(false);
  });

  it("hides a hidden game from a user without admin access", async () => {
    getSession.mockResolvedValue({ user: { id: "u1" } });
    rows.mockResolvedValue([]);
    expect(await canViewGame("lol")).toBe(false);
  });

  it("shows a hidden game to an admin of that game", async () => {
    getSession.mockResolvedValue({ user: { id: "u2" } });
    rows.mockResolvedValue([adminRow("lol")]);
    expect(await canViewGame("lol")).toBe(true);
  });

  it("shows a hidden game to a global admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u3" } });
    rows.mockResolvedValue([adminRow(null)]);
    expect(await canViewGame("lol")).toBe(true);
  });

  it("shows a hidden game to a super admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u4" } });
    rows.mockResolvedValue([{ isSuperAdmin: true, permissionName: null, assignedGame: null }]);
    expect(await canViewGame("lol")).toBe(true);
  });

  it("hides a hidden game from a Valorant-only admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u7" } });
    rows.mockResolvedValue([adminRow("valorant")]);
    expect(await canViewGame("lol")).toBe(false);
  });

  it("hides a hidden game from a Valorant-only super admin", async () => {
    getSession.mockResolvedValue({ user: { id: "u8" } });
    rows.mockResolvedValue([{ isSuperAdmin: true, permissionName: null, assignedGame: "valorant" }]);
    expect(await canViewGame("lol")).toBe(false);
  });

  it("hides a hidden game from a role with other permissions only", async () => {
    getSession.mockResolvedValue({ user: { id: "u6" } });
    rows.mockResolvedValue([{ isSuperAdmin: false, permissionName: "tournaments.manage", assignedGame: null }]);
    expect(await canViewGame("lol")).toBe(false);
  });
});

describe("isGamePreview", () => {
  it("is false for a public game", async () => {
    expect(await isGamePreview("valorant")).toBe(false);
  });

  it("is true for a hidden game an admin may open", async () => {
    getSession.mockResolvedValue({ user: { id: "u5" } });
    rows.mockResolvedValue([adminRow("lol")]);
    expect(await isGamePreview("lol")).toBe(true);
  });
});
