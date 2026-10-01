/**
 * GC-Stats — gsl-group.test module
 *
 * Tests generateGslGroup's match count, labels, and edge wiring.
 *
 * @copyright Copyright (c) 2026 Osthelia — GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia License v1.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { describe, expect, it } from "vitest";
import { generateGslGroup } from "./gsl-group";
import { validateGraph } from "../graph/validate";

describe("generateGslGroup", () => {
  it("produces a valid DAG with no orphans", () => {
    const graph = generateGslGroup({ containerId: "g" });
    const result = validateGraph(graph);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("has exactly 5 matches: 2 openers, winners match, elimination match, decider", () => {
    const graph = generateGslGroup({ containerId: "g" });
    expect(graph.matches).toHaveLength(5);
    expect(graph.matches.map((m) => m.label).sort()).toEqual([
      "Decider",
      "Elimination Match",
      "Opener A",
      "Opener B",
      "Winners Match",
    ]);
  });

  it("has exactly 2 qualifying (terminal) matches: Winners Match and Decider", () => {
    const graph = generateGslGroup({ containerId: "g" });
    const withOutgoingWinnerEdge = new Set(
      graph.edges.filter((e) => e.fromResult === "winner").map((e) => e.fromMatchId)
    );
    const terminal = graph.matches.filter((m) => !withOutgoingWinnerEdge.has(m.id));
    expect(terminal.map((m) => m.label).sort()).toEqual(["Decider", "Winners Match"]);
  });

  it("elimination match is fed by the loser of both openers", () => {
    const graph = generateGslGroup({ containerId: "g" });
    const elim = graph.matches.find((m) => m.label === "Elimination Match")!;
    const incoming = graph.edges.filter((e) => e.toMatchId === elim.id);
    expect(incoming).toHaveLength(2);
    expect(incoming.every((e) => e.fromResult === "loser")).toBe(true);
    const openerIds = graph.matches.filter((m) => m.label?.startsWith("Opener")).map((m) => m.id);
    expect(incoming.every((e) => openerIds.includes(e.fromMatchId))).toBe(true);
  });

  it("decider is fed by the Winners Match loser and the Elimination Match winner", () => {
    const graph = generateGslGroup({ containerId: "g" });
    const decider = graph.matches.find((m) => m.label === "Decider")!;
    const elim = graph.matches.find((m) => m.label === "Elimination Match")!;
    const winnersMatch = graph.matches.find((m) => m.label === "Winners Match")!;
    const incoming = graph.edges.filter((e) => e.toMatchId === decider.id);
    expect(incoming).toHaveLength(2);
    expect(incoming.some((e) => e.fromMatchId === winnersMatch.id && e.fromResult === "loser")).toBe(true);
    expect(incoming.some((e) => e.fromMatchId === elim.id && e.fromResult === "winner")).toBe(true);
  });

  it("openers each feed the winners match with their winner", () => {
    const graph = generateGslGroup({ containerId: "g" });
    const winnersMatch = graph.matches.find((m) => m.label === "Winners Match")!;
    const incoming = graph.edges.filter((e) => e.toMatchId === winnersMatch.id);
    expect(incoming).toHaveLength(2);
    expect(incoming.every((e) => e.fromResult === "winner")).toBe(true);
  });
});
