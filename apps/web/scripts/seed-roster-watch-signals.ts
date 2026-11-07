/**
 * GC-Stats - seed-roster-watch-signals
 *
 * Inserts fake pending signals (15 roster, 15 to check) to try the review page.
 * They use tweet ids starting with "test-" and a disabled test account, so they are
 * never polled and can be removed with --clean.
 *
 * Usage (from apps/web): npm run seed:roster-signals [-- --clean]
 *
 * @copyright Copyright (c) 2026 Osthelia - GC-Stats-Website
 * @license   https://github.com/Osthelia/GC-Stats-Website/blob/main/LICENSE.md Osthelia Limited Commercial License v2.0
 * @link      https://github.com/Osthelia/GC-Stats-Website
 */

import { asc, eq, like } from "drizzle-orm";
import { adminDb as db } from "@gc-stats/db/client";
import { xMonitoredAccounts, xRosterSignals, type XSignalMedia, valorantTables } from "@gc-stats/db";

const { teams } = valorantTables;

const TEST_HANDLE = "gcs_roster_watch_test";
const TWEET_PREFIX = "test-";

type Fake = { text: string; textEn: string | null; topic: string; players: string[]; reason: string; media?: XSignalMedia[] };

const photo = (seed: string): XSignalMedia[] => [{ type: "photo", url: `https://picsum.photos/seed/${seed}/900/600`, previewUrl: null }];
const video = (seed: string): XSignalMedia[] => [{ type: "video", url: "https://example.invalid/video.mp4", previewUrl: `https://picsum.photos/seed/${seed}/900/500` }];
const brokenPhoto: XSignalMedia[] = [{ type: "photo", url: "https://example.invalid/missing.png", previewUrl: null }];

const ROSTER: Fake[] = [
  { text: "Bienvenue à Nyx dans notre roster ! 💜", textEn: "Welcome Nyx to our roster! 💜", topic: "roster_join", players: ["Nyx"], reason: "Announces a new player joining.", media: photo("r1") },
  { text: "Welcome Kira to the team, she joins as our new duelist.", textEn: null, topic: "roster_join", players: ["Kira"], reason: "New player announcement.", media: photo("r2") },
  { text: "Nous disons au revoir à Lune. Merci pour tout, bonne continuation.", textEn: "We say goodbye to Lune. Thank you for everything, good luck.", topic: "roster_leave", players: ["Lune"], reason: "Farewell message to a player." },
  { text: "Gracias por todo, Vega. Te deseamos lo mejor en tu próxima etapa.", textEn: "Thank you for everything, Vega. We wish you the best in your next chapter.", topic: "roster_leave", players: ["Vega"], reason: "Farewell message.", media: photo("r4") },
  { text: "Mika is moving to the bench for the rest of the split.", textEn: null, topic: "roster_bench", players: ["Mika"], reason: "Player benched." },
  { text: "Bem-vinda à equipe, Luna! Nossa nova coach chegou. 🎉", textEn: "Welcome to the team, Luna! Our new coach has arrived. 🎉", topic: "staff_change", players: ["Luna"], reason: "New coach joins.", media: photo("r6") },
  { text: "Our analyst Theo is stepping down after two great seasons.", textEn: null, topic: "staff_change", players: ["Theo"], reason: "Staff member leaving." },
  { text: "Retour d'Aiko dans l'équipe, ravis de la retrouver !", textEn: "Aiko is back in the team, delighted to have her again!", topic: "roster_join", players: ["Aiko"], reason: "Player returns.", media: video("r8") },
  { text: "New era, new faces. Meet our 2026 lineup 🔥", textEn: null, topic: "roster_join", players: [], reason: "Lineup reveal.", media: photo("r9") },
  { text: "Hoy se une a nosotros Sol como sustituta. ¡Bienvenida!", textEn: "Today Sol joins us as a substitute. Welcome!", topic: "roster_join", players: ["Sol"], reason: "Substitute joins." },
  { text: "Wir trennen uns von Jonas. Danke für die Zeit mit uns.", textEn: "We are parting ways with Jonas. Thanks for the time with us.", topic: "roster_leave", players: ["Jonas"], reason: "Parting ways." },
  { text: "Please welcome Rei, our new manager.", textEn: null, topic: "staff_change", players: ["Rei"], reason: "New manager.", media: brokenPhoto },
  { text: "Yuki rejoint officiellement le roster principal.", textEn: "Yuki officially joins the main roster.", topic: "roster_join", players: ["Yuki"], reason: "Promotion to the main roster.", media: photo("r13") },
  { text: "Farewell Nova. It was a pleasure.", textEn: null, topic: "roster_leave", players: ["Nova"], reason: "Farewell." },
  { text: "Annuncio: Giulia lascia il team. Grazie di tutto!", textEn: "Announcement: Giulia is leaving the team. Thanks for everything!", topic: "roster_leave", players: ["Giulia"], reason: "Player leaves.", media: photo("r15") },
];

const UNSURE: Fake[] = [
  { text: "Something is coming... 👀", textEn: null, topic: "other", players: [], reason: "Teaser with no clear meaning.", media: photo("u1") },
  { text: "Une nouvelle ère commence demain.", textEn: "A new era starts tomorrow.", topic: "other", players: [], reason: "Teaser, could be a roster reveal." },
  { text: "", textEn: null, topic: "other", players: [], reason: "Image only, no text.", media: photo("u3") },
  { text: "Tryouts are open! Apply with the link below.", textEn: null, topic: "tryouts", players: [], reason: "Tryouts call." },
  { text: "Gracias por el apoyo esta temporada. ¡Nos vemos pronto!", textEn: "Thanks for the support this season. See you soon!", topic: "other", players: [], reason: "Could be a farewell or a season wrap up." },
  { text: "Big announcement Friday 18:00 CET.", textEn: null, topic: "other", players: [], reason: "Unclear announcement.", media: photo("u6") },
  { text: "Chapter closed. Thank you, Ash.", textEn: null, topic: "other", players: ["Ash"], reason: "Ambiguous thanks to a person.", media: photo("u7") },
  { text: "Qui sera la prochaine ? 🤔", textEn: "Who will be next? 🤔", topic: "other", players: [], reason: "Teaser." },
  { text: "Meet the squad", textEn: null, topic: "other", players: [], reason: "Short text with a video.", media: video("u9") },
  { text: "Ceci n'est que le début.", textEn: "This is only the beginning.", topic: "other", players: [], reason: "Vague teaser.", media: brokenPhoto },
  { text: "Bootcamp week with the whole team and staff 💪", textEn: null, topic: "other", players: [], reason: "Could include a new member.", media: photo("u11") },
  { text: "Hoje é um dia especial para a nossa família.", textEn: "Today is a special day for our family.", topic: "other", players: [], reason: "Vague announcement." },
  { text: "Mia x Team, officially.", textEn: null, topic: "other", players: ["Mia"], reason: "Could be a signing or a sponsor.", media: photo("u13") },
  { text: "Danke an alle, die uns begleitet haben.", textEn: "Thanks to everyone who accompanied us.", topic: "other", players: [], reason: "Possible farewell." },
  { text: "New content dropping soon, stay tuned.", textEn: null, topic: "other", players: [], reason: "Unclear teaser.", media: photo("u15") },
];

async function clean() {
  const removed = await db.delete(xRosterSignals).where(like(xRosterSignals.tweetId, `${TWEET_PREFIX}%`)).returning({ id: xRosterSignals.id });
  await db.delete(xMonitoredAccounts).where(eq(xMonitoredAccounts.xHandle, TEST_HANDLE));
  console.log("[seed-roster-signals] %d fake signal(s) removed", removed.length);
}

async function seed() {
  const teamRows = await db.select({ id: teams.id }).from(teams).orderBy(asc(teams.id)).limit(5);
  if (teamRows.length === 0) throw new Error("No team in the database");

  await db.insert(xMonitoredAccounts).values({ teamId: teamRows[0]!.id, xHandle: TEST_HANDLE, enabled: false }).onConflictDoNothing({ target: xMonitoredAccounts.xHandle });
  const [account] = await db.select({ id: xMonitoredAccounts.id }).from(xMonitoredAccounts).where(eq(xMonitoredAccounts.xHandle, TEST_HANDLE)).limit(1);
  if (!account) throw new Error("Test account missing");

  const now = Date.now();
  const rows = [...ROSTER.map((fake) => ({ fake, verdict: "roster" as const })), ...UNSURE.map((fake) => ({ fake, verdict: "unsure" as const }))].map(({ fake, verdict }, index) => {
    const id = `${TWEET_PREFIX}${verdict}-${index}`;
    return {
      tweetId: id,
      accountId: account.id,
      teamId: teamRows[index % teamRows.length]!.id,
      tweetUrl: `https://x.com/${TEST_HANDLE}/status/${id}`,
      text: fake.text,
      textEn: fake.textEn,
      media: fake.media ?? [],
      tweetedAt: new Date(now - index * 3_600_000),
      stage: "classified",
      verdict,
      topic: fake.topic,
      players: fake.players,
      llmReason: fake.reason,
      llmModel: "test",
    };
  });

  const inserted = await db.insert(xRosterSignals).values(rows).onConflictDoNothing({ target: xRosterSignals.tweetId }).returning({ id: xRosterSignals.id });
  console.log("[seed-roster-signals] %d fake signal(s) added, %d already there", inserted.length, rows.length - inserted.length);
}

(process.argv.includes("--clean") ? clean() : seed())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[seed-roster-signals] failed", error);
    process.exit(1);
  });
