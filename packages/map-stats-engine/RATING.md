# GCS Rating: design document

Status: implemented (formula version 2) in `src/rating/`. Decisions: HLTV style display, one global baseline pool, full recompute on every model rebuild.
Scope: a single per-map player rating (plus its career aggregate), computed in `packages/map-stats-engine` from the Riot match-v1 payload we already ingest (`match.json` shape, see `src/types.ts`).

---

## 1. Goals

1. **One number, readable like HLTV/VLR**: `1.00` is the average player, `1.20` is clearly good, `0.80` is clearly bad.
2. **Fair across roles and agents**: a Controller at `1.15` and a Duelist at `1.15` must mean the same thing: "performed as well above what is expected from their job". A Duelist must not be rated higher just because Duelists get more kills.
3. **Context over volume**: a kill that opens a 5v4 is worth more than an exit frag on a lost round; a kill on a full buy with a Sheriff is worth more than a kill on an eco with a Vandal.
4. **Explainable**: every map rating can be broken down into components that we can show on the match page ("why is this player 1.32").
5. **Built only from data we actually have**, with honest proxies where Riot does not give us the information directly.

Non goals: predicting future performance, ranking players by raw talent independently of their role.

---

## 2. What the data gives us (and what it does not)

Checked against `match.json` (Duality, 19 rounds, custom game).

| Data | Available | Used for |
|---|---|---|
| Kills with `timeSinceRoundStartMillis`, killer, victim, `assistants[]` | yes, per round | alive states, opening duels, trades, clutches, win probability transitions |
| Damage per round, per receiver (with HS/body/leg) | yes | ADR, **splitting assists into damage assists and utility assists** (see 2.1) |
| Loadout value per player per round | yes | economy context of each kill |
| Plant (planter, time, site), defuse (defuser, time) | yes | objective events in the win probability model |
| `winningTeamRole`, `roundResultCode` | yes | side per round, round outcome |
| Agent (`characterId`) | yes | role and agent baselines (role comes from the content client, e.g. valorant-api `role.displayName`) |
| Player positions at each kill | yes | not used in v1 |
| `abilityCasts` | match totals only | **not used in the rating** (a cast count says nothing about impact and is trivially farmable); displayed separately |
| `ability*Effects` (flash hits, reveals...) | **null** in practice | not available |

### 2.1 Utility assists, the key proxy for Initiators

Riot does not tell us *why* a player got an assist. But a victim dies at most once per round, so every damage entry against that victim in that round happened before the kill. Therefore:

- assistant **dealt damage** to the victim this round: **damage assist**
- assistant **dealt no damage** to the victim this round: **utility assist** (flash, reveal, stun, debuff, suppression...)

On `match.json`: 64 assists, **27 utility (42%)** and 37 damage. The signal behaves as expected: both Razes have 0 utility assists, the Controller Miks has 10 of 12. This is what lets us value an Initiator's reveal without inventing data.

### 2.2 Data quality notes

- Round logs and match totals can disagree slightly (in `match.json`, one player has 18 kills in round logs vs 17 in `players[].stats`). The engine already treats round logs as the source of truth; the rating does the same.
- Observers (`isObserver`) and coaches are excluded everywhere.

---

## 3. Overview

The rating has two layers, and the distinction matters:

```
            ┌──────────────────────── per map, per player ────────────────────────┐
 Layer 1    │  Round Impact (WPA): each event moves the round win probability,     │
 (context)  │  the change is credited to the players who caused it                 │
            └──────────────────────────────────────────────────────────────────────┘
                                     │  IMP (one of 7 components)
                                     ▼
            ┌──────────────────────────────────────────────────────────────────────┐
 Layer 2    │  7 components → each compared to what is EXPECTED from this agent,   │
 (fairness) │  on these sides (z-score) → weighted by ROLE → calibrated to 1.00    │
            └──────────────────────────────────────────────────────────────────────┘
```

- **Baselines** answer "what is normal for this job" (a Controller is not expected to entry).
- **Weights** answer "what matters most for this job" (opening duels matter more for a Duelist).

They are two separate knobs. Mixing them is the classic mistake: if you only weight (no baseline), Duelists dominate because their raw numbers are bigger; if you only use baselines (same weights), you lose the "this stat is what the role is for" aspect the rating should reflect.

---

## 4. Layer 1: Round Impact (Win Probability Added)

### 4.1 Why

Kills/deaths/assists counted flat ignore *when* and *in what situation* they happen. Win Probability Added (used in most modern sports analytics, and the idea behind the impact parts of HLTV 3.0 and VLR's current rating) solves this in one model:

- opening kills are naturally worth a lot (5v5 → 5v4 is a big swing),
- clutches and multikills are naturally rewarded (every kill of a 1v3 moves the probability a lot), and won clutches also get a bonus on top of the rating (section 7),
- exit frags and kills after the round is decided are worth ~0,
- eco context comes for free if the economy is part of the state.

So we do **not** need separate hand-made bonuses for clutches, multikills or eco kills in this layer.

### 4.2 Round state and win probability table

A round state is:

```
s = (atkAlive ∈ 0..5, defAlive ∈ 0..5, planted ∈ {0,1}, econ ∈ {atkAdv, even, defAdv})
```

- `econ` is derived from the team loadout totals at round start, using the existing tiers (`TEAM_ECO_MAX_LOADOUT`, `TEAM_FORCE_MAX_LOADOUT` in `advanced-stats.ts`): same tier is `even`, otherwise the side with the higher tier has the advantage. Pistol rounds are `even`.
- `planted` flips at `plantRoundTime`, interleaved with kills by time.

`P(s)` = probability that the **attackers** win from state `s`. It is learned from **our own database** (every stored map): for every round, walk its timeline, record each state visited and whether the attackers won that round.

Sparse states are smoothed by backoff toward coarser states (planted only, then alive difference, then alive counts, then the full state):

```
P(level) = (atkWins(level) + α · P(coarser level)) / (visits(level) + α)        α = 20, starting from 0.5
```

Terminal states are fixed: attackers eliminated = 0 (with or without a plant, so the defuse itself carries no value and the kill that wipes the attackers takes it all), defenders eliminated = 1, detonation = 1, time out without plant = 0.

The table is versioned (see 9) and recomputed when we bump the rating version, not on every new match, so ratings stay stable.

v2 candidate: add a coarse time bucket (a 1v1 with 5 s left and no plant is nearly lost for the attackers). Kept out of v1 to keep the table dense.

### 4.3 Events and credit

For each event, `Δ = P(after) − P(before)` seen from the team that benefits.

| Event | Credit |
|---|---|
| Kill, no assistant | killer `+Δ` |
| Kill with assistants | each utility assistant `+0.25·Δ`, each damage assistant `+0.15·Δ`, assistants share capped at `0.5·Δ`; killer gets the rest |
| Death (victim) | `−Δ` if not traded, `−0.5·Δ` if traded (trade window = existing `TRADE_WINDOW_MS`, 3 s): a traded death still gave the team something (space, info, the trade itself) |
| Team kill | killer `−Δ`, victim `0` |
| Death to one's own utility or weapon | victim `−Δ` |
| Fall caused by an enemy (Riot gives a killer, e.g. a knockback) | a normal kill |
| Environment death (fall without a killer, spike explosion, map damage such as crush) | **neutral**: no credit, no survival cost, no KAST loss. It is rarely a real mistake (often a deliberate jump or a save near the spike). |
| Plant | planter `+Δ` (planted 0 → 1) |
| Defuse | **no value** |
| Detonation, time out | no player credit (already credited through the plant and the kills that led there) |

Why the assist shares: a utility assist is the Initiator's actual contribution to a kill (without the flash the duel may not be won), so it gets more than a damage assist, which is already partly rewarded through ADR in layer 2. The killer still keeps at least half: they converted.

```
IMP = Σ credits over the map / roundsPlayed
```

### 4.4 Worked example (illustrative probabilities)

Full buy vs full buy, 5v5 no plant, `P = 0.50`.

1. Attacking Neon kills a defender after a Breach flash (utility assist). State 5v4, `P = 0.64`, `Δ = 0.14`.
   Breach `+0.035`, Neon `+0.105`, victim `−0.14` (not traded).
2. Same round, an attacker with an eco Sheriff kills a full buy defender: the state already accounted for the economy, so the jump is bigger than the same kill made by a full buy team, without any special rule.
3. Attackers are up 5v1 post plant, `P = 0.98`. The fifth kill: `Δ = 0.02`. That exit-ish frag is worth almost nothing, as it should.

---

## 5. Layer 2: the seven components

All components are per round so maps of different lengths compare.

| Code | Component | Formula (per map) | Why it exists |
|---|---|---|---|
| `IMP` | Impact | WPA credits / rounds (section 4) | context: who actually moved rounds |
| `KIL` | Eco-adjusted kills | `Σ ecoFactor / rounds`, `ecoFactor = clamp(√(victimLoadout / killerLoadout), 0.6, 1.4)` | volume of kills, discounted when the killer had the gun advantage |
| `SRV` | Survival | `1 − (untradedDeaths + 0.5·tradedDeaths) / rounds` | dying is a cost; a traded death costs less |
| `DMG` | ADR | damage dealt / rounds | damage that did not convert still weakens the opponent |
| `KST` | KAST | existing `kastPercentage` | round to round consistency |
| `AST` | Weighted assists | `(utilityAssists + 0.5·damageAssists) / rounds` | team play; damage assists are half because `DMG` already rewards that damage |
| `OPN` | Opening duels | `(FK − untradedFD − 0.5·tradedFD) / rounds` | entry: winning or losing the first duel decides a large share of rounds |

`IMP` and `KIL`/`OPN` overlap on purpose: `IMP` measures the context, the others measure the raw output, and the role weights decide how much each matters.

---

## 6. Fairness: compare each player to what is expected from their agent

### 6.1 Expected value

For each component `c`, we compute from the database the mean `μ` and standard deviation `σ` of the per-map value, for each **(agent, side)** and each **(role, side)**.

**Agent level, shrunk to role level.** Agents inside one role are not equal: Chamber frags like a Duelist, Cypher does not; Skye has more utility assists than Sova. Using the agent baseline is fairer, but a new or rarely picked agent has too few rounds, so we shrink toward the role:

```
μ*_agent = (n · μ_agent + M · μ_role) / (n + M)        n = rounds on that agent, M = 2000 rounds
```

(same for σ). A popular agent quickly uses its own baseline, a fresh release starts as "average of its role".

**Side mix.** Attack and defense produce different numbers (defenders get more opening kills on holds, attackers more plants, etc.). The expected value of a player is the mix of the sides they actually played:

```
μ_exp = (atkRounds · μ*_atk + defRounds · μ*_def) / (atkRounds + defRounds)
```

This keeps a player whose overtime was mostly on attack from being penalized.

### 6.2 Standardization

```
z_c = clamp((x_c − μ_exp,c) / σ_exp,c, −3, 3)
```

The clamp prevents one absurd stat (e.g. 0 deaths on a 13-round stomp) from taking over the whole rating.

Consequence worth stating: on `match.json`, Viper TaZ has 25 kills and 6 first kills. Compared to a Controller baseline, those are huge positive `z`, so they get a very high rating. That is the intended behaviour: they outperformed what a Controller is expected to do, by a lot.

### 6.3 Role weights

Weights sum to 1 for every role. `IMP` is the same for all roles (winning rounds is everyone's job); the other 0.70 is distributed by what the role is for.

| Component | Duelist | Initiator | Controller | Sentinel |
|---|---:|---:|---:|---:|
| `IMP` Impact | 0.30 | 0.30 | 0.30 | 0.30 |
| `KIL` Kills | 0.18 | 0.12 | 0.14 | 0.14 |
| `SRV` Survival | 0.07 | 0.08 | 0.16 | 0.16 |
| `DMG` ADR | 0.10 | 0.08 | 0.08 | 0.08 |
| `KST` KAST | 0.07 | 0.13 | 0.18 | 0.16 |
| `AST` Assists | 0.03 | 0.20 | 0.10 | 0.06 |
| `OPN` Opening | 0.25 | 0.09 | 0.04 | 0.10 |

Reasoning per role:

- **Duelist**: the job is to create space by taking the first duel and converting. `OPN` and `KIL` carry the most weight. `SRV` and `KST` are light: a Duelist who dies entering and gets traded did their job (and the traded death already costs half). `AST` is nearly irrelevant.
- **Initiator**: the job is to make teammates' duels easier. `AST` is the heaviest (with utility assists counting double damage assists, section 5), then `KST` for consistency. `OPN` keeps some weight because initiators often take the second contact or the opening with their own info.
- **Controller**: the job is to be alive and present every round (smokes for the execute, the post plant, the retake). `KST` and `SRV` are the heaviest: a dead Controller is lost utility for the rest of the round. `OPN` is minimal: an entering Controller is usually a mistake, and we do not want to reward it by design (if it works, `IMP` and `KIL` already reward it).
- **Sentinel**: the job is to anchor and hold. `SRV` and `KST` are heavy, `OPN` moderate (anchors often get the first kill on a defended site and losing that first duel gives the site away).

Remember the weights act on **deviations from the agent norm**, not on raw numbers: a Duelist with an average opening record for a Duelist gets `z_OPN ≈ 0`, the 0.25 weight only amplifies how much being better or worse than other Duelists at entering matters.

These are expert starting weights (v1). Section 10 explains how we check and tune them.

---

## 7. Final formula and calibration

```
S       = Σ_c  w[role][c] · z_c
Rating  = max(0, 1 + k · S + clutchBonus)
clutchBonus = Σ won clutches bonus(1vX) · 20 / roundsPlayed        bonus = 0.03, 0.06, 0.10, 0.15, 0.20 for 1v1 to 1v5
```

`k` is calibrated once per version so that the standard deviation of per-map ratings over the whole database is **0.40**, so ratings span roughly 0 to 2: about 98% of maps between 0.1 and 2.0, a one sided map shows its best player near 1.8 and its worst near 0.25. A first calibration at 0.25 was too narrow (0.4 to 1.6) to tell a dominant performance from a good one. Components are correlated (kills, ADR, impact go together), so `k` cannot be derived theoretically and is measured on the data.

By construction, the mean rating of each role over the dataset is 1.00. This is the fairness guarantee we test (section 10).

### Role of a player on a map

The role is the role of the agent picked on that map. A flex player is compared, map by map, to the job they actually played.

---

## 8. Aggregation (player page, tournament, career)

- **Multi-map rating** = round-weighted mean of the per-map ratings (`Σ rating·rounds / Σ rounds`). A 26-round map counts double a 13-round map.
- Components are aggregated the same way so the breakdown stays available on the player page.
- Minimum sample to show a rating on leaderboards: configurable constant (suggested default 100 rounds). Per-map ratings are always shown.

---

## 9. Versioning and storage

Ratings must not change silently when a new match is ingested.

- `rating_models`: one row per recompute, holding the whole model as jsonb (win probability counts, raw baselines, calibration `k`), the validation report and `is_active`. It is always loaded as a whole, so one row is simpler than one table per part.
- `map_player_stats` gains `rating`, `rating_rounds` (weight for aggregation), `rating_components` (value and z per component) and `rating_model_id`.
- `RATING_FORMULA_VERSION` (code constant) bumps when the formula itself changes; a model built by another formula version is ignored at ingestion.

`npm run ratings:recompute` (apps/web, `-- --dry-run` to only print the report) learns a new model from every map with RAW data, activates it and rewrites every rating. Newly ingested maps are rated with the active model.

Maps without usable RAW data (no rounds, or no side information at all, mostly old imported maps without spike data) are not rated: their rating is null and displayed as "-". Imported maps without stored sides get them inferred from the planter's team and the half/overtime rules.

### First recompute (local database)

| | Value |
|---|---|
| Rated maps | 3405 of 3776 with RAW data |
| `k` | 0.510 |
| Mean / SD, Duelist | 1.011 / 0.425 |
| Mean / SD, Controller | 1.017 / 0.408 |
| Mean / SD, Initiator | 1.016 / 0.384 |
| Mean / SD, Sentinel | 1.015 / 0.409 |
| Percentiles p1 / p50 / p99 | 0.09 / 1.01 / 2.02 |
| Maps won by 8+ rounds: average best / worst rating | 1.85 / 0.26 |
| Team with the higher average rating wins the map | 95.9% |
| Clutch bonus: player-maps with one / mean / max | 28% / +0.055 / +0.39 |

The clutch bonus is a pure bonus, not recentered: it lifts every role by about +0.015 on average, the same for all roles.
| Correlation with ACS | 0.81 |

---

## 10. Validation plan (before we ship the number)

1. **Role parity**: mean rating per role in `[0.98, 1.02]`, and the spread (SD) per role within ±15% of each other. If one role has a much wider spread, its weights over-reward a noisy stat.
2. **Agent parity**: same check per agent with at least 2000 rounds.
3. **Outcome sanity**: the team with the higher average rating wins the map in most cases (target > 80%), but not all (the best player of a losing team must still be able to top the server).
4. **Stability**: split each player's maps in two random halves; ratings of both halves must correlate (it measures skill, not noise).
5. **Weight sensitivity**: ±20% on each weight must not reshuffle the top 10 of a tournament by more than a couple of places.
6. **Eye test**: export the top and bottom 10 per role on a few known tournaments and review them with people who watched those matches.

Possible v2: fit the weights instead of hand-setting them (logistic regression of round wins on team component sums, constrained per role), keeping the hand-set weights as a prior so the model stays explainable.

---

## 11. Why not simpler options

- **ACS**: it is Riot's combat score, damage and kill heavy with a multikill bonus. It structurally favors Duelists and ignores context, deaths and trades.
- **HLTV 1.0 style** (fixed formula on KPR, survival, multikills, same for everyone): CS has no roles comparable to Valorant agents; applied to Valorant, it repeats the ACS bias.
- **Role weights without baselines**: Duelists still win because their raw numbers are bigger.
- **Baselines without WPA**: fair across roles, but a kill at 5v5 and an exit frag still count the same.

---

## 12. Decisions

1. **Baseline pool**: one global pool, so a rating means the same thing everywhere on the site.
2. **Display**: HLTV style `1.00` scale, green from 1.10, red up to 0.90.
3. **Recompute policy**: every model rebuild recomputes every map.
4. **Custom / non official matches**: included in the references like any other stored map.
5. **Environment deaths** (fall without a killer, spike explosion, map damage) are neutral, a fall with a killer is that player's kill; deaths to one's own utility stay penalized.
6. **Defuse** has no value.
7. **Clutches** give a bonus on top of the rating.
