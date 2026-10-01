# Migration V1 → V2

Script one-shot rejouable qui lit la DB MariaDB de V1 (`gc`, en local) et
insère les données réelles dans la DB Postgres de V2 (Neon, `DATABASE_URL`).

## Prérequis

- `V1_DATABASE_URL` et `DATABASE_URL` dans `packages/db/.env`.
- La DB V1 accessible (MariaDB local, `mysql -h127.0.0.1 -uroot -p0 gc`).

## Via Docker

`docker compose run --rm -e V1_DATABASE_URL=mysql://root:password@host.docker.internal:3306/gc migrate-v1`
(service `migrate-v1` du `docker-compose.yml` racine, profile `tools`, jamais
lancé par `docker compose up`) — `host.docker.internal` pour joindre une DB V1
qui tourne sur l'hôte depuis le conteneur.

## Idempotence

Chaque ligne migrée est enregistrée dans `migration_id_map`
(`entity_type`, `legacy_id` V1 -> `new_id` V2). Relancer une phase déjà
appliquée ne duplique rien : elle est skip via ce mapping. Cette table est un
outil de migration, pas un objet du domaine métier — ne pas y faire
référence ailleurs dans l'app.

## Ordre des phases (dépendances)

1. `00-reset-demo-data.ts` — **destructif** : wipe les données factices de
   démo (teams/people/organizations/tournaments/news_*/point_types +
   migration_id_map) avant de lancer une migration propre. À lancer une
   seule fois, pas idempotent au sens "sans danger à rejouer" (efface tout
   ce qui a déjà été migré aussi).
2. `01-organizations.ts` — organizations + news_publishers (mirror 1:1,
   voir note dans le fichier) + point_types.
3. `02-people-teams.ts` — teams + team_name_history, puis people (fusion
   players+staff, voir DATABASES.MD §3.2).
4. `03-roster.ts` — roster_memberships (player_team + staff_teams).
5. `04-tournaments.ts` — tournaments, puis stages+stage_containers. Seule
   une phase de premier niveau (`parent_id IS NULL`) devient un `stage` ;
   toute phase (à n'importe quelle profondeur, jusqu'à 3 niveaux réels)
   qui porte des matchs devient un `stage_container` rattaché à ce stage —
   voir `phase-tree.ts` (résolveur partagé, aussi utilisé par
   `repair-stage-hierarchy.ts`) pour la logique et le commentaire d'en-tête
   qui documente la forme réelle des données V1 vérifiée le 2026-09-12
   (avant ce fix : chaque phase devenait À LA FOIS son propre stage ET son
   propre container, la hiérarchie parent_id était totalement ignorée —
   un tournoi avec des phases imbriquées ressortait avec des dizaines de
   "stages" en trop, cf. SUIVI.md).
6. `05-entrants-matches.ts` — entrants (tournament_teams), puis matches
   (table `matches` V1 legacy, pas `bracket_matches` qui n'a que 22 lignes
   de test).
6bis. `13-bracket-edges.ts` — backfill de `bracket_edges` (graphe de
   progression, absent de V1) en comparant round_number/match_order par
   container, mais seulement quand le ratio de comptage entre 2 rounds
   consécutifs est sans ambiguïté (halving propre 2x, ou chaînage 1x1) —
   le reste (double/triple élim avec drop-ins, swiss/round robin) est
   volontairement laissé vide plutôt que deviné, voir commentaire du
   fichier.
7. `06-vetos-streams.ts` — match_vetos, stream_channels, match_streams,
   vods.
8. `07-news.ts` — news_authors, news, news_relations.
9. `08-finance-qualifications.ts` — finance_entries, stage_qualifications
   + qualification_results (team seulement, voir note), point_entries.
10. `09-game-maps-rounds.ts` — couche raw des stats de jeu : `maps` (nom de
    map stocké tel quel en texte sur `map_name`, pas de table de référence —
    voir décision ci-dessous), `map_rounds_raw`, `map_round_kills_raw`,
    `map_round_damages_raw`, `map_round_alive_states_raw`,
    `map_round_player_positions_raw` (heatmap), `map_round_player_loadouts_raw`
    (depuis `game_map_round_player_stats`).
11. `10-game-stats-aggregated.ts` — couche agrégée : `map_player_stats`
    (fusion `game_player_stats` + `game_player_advanced_stats`, `weaponKills`/
    `fallDeaths` recalculés depuis les kills raw fraîchement migrées — V1 ne
    les avait pas en agrégat) et `map_team_round_summary` (pas de table
    source V1 — entièrement recalculée depuis `map_rounds_raw`, wipe+reinsert
    à chaque run, voir commentaire dans le fichier).
12. `11-community-content.ts` — about_sections/about_projects, emotes (lignes
    seulement, pas les fichiers images — même limite que logos/news_images
    ci-dessous), forum_threads/forum_messages, change_requests/
    change_request_items/change_request_messages, user_reports, sanctions/
    sanction_identities, moderation_suspects, activity_log. Toutes les
    colonnes `user_id`/`requested_by`/`reviewed_by`/etc. de ces tables sont
    laissées `null` (comptes utilisateurs non migrés, voir plus bas) — un
    `resolveMorph()` partagé retraduit les types polymorphes Laravel
    (`'team'`, `'App\Models\Matchs'`, ...) vers les entityType de
    `migration_id_map` pour `forum_threads.subject`/`activity_log.subject`+
    `causer`, voir le fichier pour la table de correspondance complète.
13. `12-logos.ts` — lignes de la table `logos` (team/player/tournament/
    author/publisher, via `Relation::morphMap` V1). Suppose que les fichiers
    ont déjà été transférés bucket à bucket par
    `packages/storage/scripts/migrate-old-storage.ts` (même clé source →
    destination) — ce script ne fait que créer les lignes DB `logos` (jamais
    fait avant, cf. section "Hors scope" plus bas) et, pour player/author/
    publisher dont le nom de dossier de stockage diffère entre V1
    (`players`/`authors`/`publishers`) et V2 (`people`/`news-authors`/
    `news-publishers`, cf. `packages/storage/src/logos.ts::LOGO_FOLDERS`),
    renomme les 2 fichiers déjà transférés vers le bon dossier via une copie
    serveur-à-serveur (`copyObjectWithinBucket`, pas de re-upload). L'`id`
    (uuid) de chaque ligne V1 est conservé tel quel côté V2 — c'est le nom du
    dossier de stockage, donc le seul moyen que le fichier déjà transféré
    reste trouvable. Les 2 lignes réelles d'`entity_type='organization'` en
    V1 sont volontairement ignorées (aucun morphMap, aucun modèle
    `HasLogo` ne renvoie `'organization'`, aucun contrôleur ne les écrit —
    données mortes, inatteignables par l'appli V1 elle-même).

## Réparation ponctuelle (déjà exécutée sur Neon, 2026-09-12)

`repair-stage-hierarchy.ts` n'est pas dans la liste ci-dessus et ne tourne
jamais via `index.ts` : c'est une correction ponctuelle pour les tournois
migrés avec l'ancienne version de `04-tournaments.ts` (avant le fix
parent_id, voir plus haut), pas une étape que redemande une migration
repartant de zéro (qui passe directement par la version corrigée). Repointe/
renomme en place les containers déjà migrés (aucun churn sur matches/maps/
game-stats), supprime les stages/containers erronés devenus vides après
coup, et laisse en place les rares cas encore référencés ailleurs
(`stage_qualifications` notamment) plutôt que de les supprimer à l'aveugle.
Déjà exécutée avec succès contre Neon (784 containers repointés, 340 stages
+ 127 containers vides supprimés, 6 containers conservés car référencés,
0 perte de données vérifiée avant écriture) — ne pas la relancer sans
nouvelle analyse si l'ancien mapping `phase_as_stage`/`phase_as_container`
a depuis changé.

## Hors scope de cette passe

- **Comptes utilisateurs** (`users`, `social_accounts`) — décision explicite
  de l'utilisateur : on ne migre pas les comptes V1, ils seront recréés à
  neuf. `people.userId` reste donc null pour tout le monde après migration,
  et toute autre colonne FK vers `users` migrée par ce script (forum,
  change_requests, user_reports, sanctions, activity_log...) aussi.
- **`entrant_members`** (roster figé par tournoi, voir DATABASES.MD
  §2.3bis) — V1 n'a jamais tracké cette info séparément du roster permanent
  de l'équipe ; une reconstruction heuristique (roster actif à la date du
  tournoi) donnerait un résultat non fiable. Pas fait.
- **`news_images`/fichiers `emotes.image_path`** — nécessite de rapatrier des
  fichiers vers S3/R2 (`S3_*` dans `packages/storage/.env`), pas juste une
  ligne DB. Les lignes `emotes` sont migrées (nom/chemin/source), pas les
  fichiers eux-mêmes tant que ce pipeline n'existe pas. **`logos` n'est plus
  dans cette liste** (2026-08-31) : les fichiers sont transférés par
  `packages/storage/scripts/migrate-old-storage.ts` et les lignes DB par la
  phase `12-logos.ts` ci-dessus.
- **`reactions`** — bloqué structurellement, pas juste hors scope : `userId`
  est `NOT NULL` côté V2 et aucun utilisateur n'est migré, impossible
  d'insérer les 2 lignes V1 sans fabriquer un compte fictif. Non migré.
- **`api_key`, `roles`/`permissions`/`role_permissions`** — décision
  explicite de l'utilisateur : configuration manuelle, pas de migration
  automatique depuis les 4/145/110 lignes V1 correspondantes.
- **`discord_role_mappings`** — retiré du schéma V2 (décision explicite de
  l'utilisateur, migration `0013`), pas juste non migré.
- **`user_reports.organizationId`** — l'équivalent V1 est `team_id`
  (concept différent : équipe, pas organisation/publisher) ; les 2 lignes
  V1 réelles sont migrées avec cette colonne à `null` plutôt qu'un mapping
  team→org qui n'a pas de sens.
- **`phase_qualification_results` avec `entity_type='player'`** (406/476
  lignes) — ne correspond pas à un entrant (toujours `kind='team'` côté
  GC-Stats) ; échantillon vérifié = classement individuel par phase sans
  rapport avec l'avancement du tournoi. Non migré, voir commentaire dans
  `08-finance-qualifications.ts`.
- **`tournaments.organized_by`** — pas de colonne équivalente côté V2
  `tournaments` (pas de FK organizer). Perte de donnée assumée (aucun champ
  cible propre pour l'instant).
- **Timestamps `created_at`/`updated_at`** sur `change_requests`,
  `user_reports`, `emotes`, `about_sections`/`about_projects` — ces tables
  V2 n'ont tout simplement pas de colonne timestamp (décision de schéma
  antérieure à cette passe, pas quelque chose que ce script a tranché) ;
  la date de création V1 de ces lignes n'est donc pas conservée.

## Décision — pas de table de référence pour maps/armes/agents

`valorant_maps` (comme `valorant_weapons`/`valorant_agents` avant elle, cf.
migrations `0008`/`0009`) a été retirée du schéma : pas une métrique utile à
normaliser derrière une table dédiée. `maps.map_name` stocke directement le
nom affiché (ex. "Ascent", "Corrode") en texte, tel que lu dans
`game_maps.map_name` côté V1 — aucune résolution vers un id Riot.
