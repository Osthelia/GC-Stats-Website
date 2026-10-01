// One-off backfill (2026-09-12): adds the missing "type" discriminant to
// `stage_containers.config` for every group container migrated from V1 with
// a bare `{}` config — parseGroupConfig() (apps/web) throws without it,
// which was 500ing the public page for 34 real tournaments. Classification
// verified against each container's actual match/round data (round-robin
// count = C(n,2) for its entrant count; Swiss containers matched their
// known entrant-count/round-count shape) before this script was written —
// see the conversation this shipped in for the query outputs. Only adds the
// "type" key; every other field of the existing config (already `{}` here)
// is left alone.
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SWISS_NAMES = ["Swiss Stage", "Open Qualifier", "Qualifier"];

async function main() {
  const rrCandidates = await pool.query(
    `select sc.id from stage_containers sc
     where sc.container_type = 'group' and (sc.config is null or sc.config->>'type' is null)
       and not (sc.name = any($1))`,
    [SWISS_NAMES]
  );
  const swissCandidates = await pool.query(
    `select sc.id from stage_containers sc
     where sc.container_type = 'group' and (sc.config is null or sc.config->>'type' is null)
       and sc.name = any($1)`,
    [SWISS_NAMES]
  );
  console.log("round_robin candidates:", rrCandidates.rows.length, "swiss candidates:", swissCandidates.rows.length);

  const rrRes = await pool.query(
    `update stage_containers set config = config || '{"type":"round_robin"}'::jsonb
     where id = any($1) and (config is null or config->>'type' is null)`,
    [rrCandidates.rows.map((r) => r.id)]
  );
  const swissRes = await pool.query(
    `update stage_containers set config = config || '{"type":"swiss"}'::jsonb
     where id = any($1) and (config is null or config->>'type' is null)`,
    [swissCandidates.rows.map((r) => r.id)]
  );
  console.log("round_robin updated:", rrRes.rowCount, "swiss updated:", swissRes.rowCount);

  const remaining = await pool.query(
    `select count(*) from tournaments t
     join stages s on s.tournament_id = t.id and s.active
     join stage_containers sc on sc.stage_id = s.id
     where sc.container_type = 'group' and (sc.config is null or sc.config->>'type' is null)`
  );
  console.log("remaining broken (active stages):", remaining.rows[0].count);

  await pool.end();
}

main();
