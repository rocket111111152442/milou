/**
 * Politique de conservation des résultats Brave (conditions « Search API Terms of Use », dernière mise à jour 1er sept. 2026,
 * §3(b)(i) : interdiction de « store, cache, or create a database of Search Results, in whole or in part, other than transient
 * storage required for operation » ; §3(b)(xii) : pas de revente ni redistribution ; §13(c) : destruction à la fin du contrat,
 * « except as otherwise provided in an Order Form »).
 *
 * Règle appliquée : SANS confirmation écrite que le plan ou le contrat inclut des droits de stockage
 * (WAVERTI_BRAVE_STORAGE_RIGHTS=granted), aucun contenu issu d'un résultat Brave n'est conservé durablement :
 * ni titre, ni extrait, ni adresse, ni domaine, ni date extraite, ni texte de la requête dans un cache.
 * Restent autorisés : compteurs, durées, codes de statut, coûts estimés (métadonnées techniques), classification et
 * empreintes (hachages à sens unique) servant à ne pas signaler deux fois la même information.
 */
import { sql, type Database } from "@waverti/database";
import type { WebFinding } from "@waverti/types";

export type BraveStorageRights = "none" | "granted";

/** Les droits ne sont jamais présumés : seule la valeur exacte « granted » les active. */
export function braveStorageRightsFromEnv(env: Record<string, string | undefined> = process.env): BraveStorageRights {
  return env.WAVERTI_BRAVE_STORAGE_RIGHTS === "granted" ? "granted" : "none";
}

/** Constat sans aucun contenu issu du résultat : classification, niveau de source et empreinte seulement. */
export function redactFinding(f: WebFinding): WebFinding {
  return {
    url: null,
    redacted: true,
    title: "",
    snippet: "",
    domain: "",
    publishedAt: null,
    classification: f.classification,
    sourceTier: f.sourceTier,
    extractedDate: null,
    reasons: f.reasons.slice(0, 3),
    fingerprint: f.fingerprint,
  };
}

export interface EnforcementCounts {
  searchCacheRows: number;
  seenItemsScrubbed: number;
  resultsScrubbed: number;
  notificationsScrubbed: number;
  emailsScrubbed: number;
}

/**
 * Neutralise ce qui a déjà été conservé de résultats Brave. Sans droits de stockage :
 *  - supprime les caches de résultats (`search_cache`, fournisseurs brave et brave_products) ;
 *  - vide l'adresse et le titre des éléments déjà vus (la clé de déduplication, un hachage, reste) ;
 *  - remplace, dans l'historique des recherches de sujets, les constats par leur version masquée ;
 *  - avec `scrubHistory` : remplace titres, textes et adresses des alertes et des e-mails de recherche de sujets
 *    (historique visible de l'abonné) par un texte générique. Étape à part : elle modifie ce que l'abonné a déjà lu.
 * Avec droits confirmés, ne fait rien. `dryRun` compte sans modifier.
 */
export async function enforceBraveStoragePolicy(
  db: Database,
  rights: BraveStorageRights,
  opts: { scrubHistory?: boolean; dryRun?: boolean } = {},
): Promise<EnforcementCounts> {
  const zero: EnforcementCounts = { searchCacheRows: 0, seenItemsScrubbed: 0, resultsScrubbed: 0, notificationsScrubbed: 0, emailsScrubbed: 0 };
  if (rights === "granted") return zero;
  const dry = Boolean(opts.dryRun);
  const n = async (q: ReturnType<typeof sql>) => {
    const rows = await db.execute<{ n: string }>(q);
    return Number(rows[0]?.n ?? 0);
  };

  const out = { ...zero };
  out.searchCacheRows = dry
    ? await n(sql`select count(*)::text as n from search_cache where provider in ('brave', 'brave_products')`)
    : await n(sql`with d as (delete from search_cache where provider in ('brave', 'brave_products') returning 1) select count(*)::text as n from d`);

  out.seenItemsScrubbed = dry
    ? await n(sql`select count(*)::text as n from monitoring_seen_items s join monitoring_tasks t on t.id = s.task_id where t.kind = 'web_topic' and (s.url <> '' or s.title is not null)`)
    : await n(sql`with u as (
        update monitoring_seen_items s set url = '', title = null from monitoring_tasks t
        where t.id = s.task_id and t.kind = 'web_topic' and (s.url <> '' or s.title is not null) returning 1)
        select count(*)::text as n from u`);

  const findingsRedactedSql = sql`(
    select coalesce(jsonb_agg(jsonb_build_object(
      'url', null, 'redacted', true, 'title', '', 'snippet', '', 'domain', '', 'publishedAt', null,
      'classification', f -> 'classification', 'sourceTier', f -> 'sourceTier', 'extractedDate', null,
      'reasons', coalesce(f -> 'reasons', '[]'::jsonb), 'fingerprint', f -> 'fingerprint')), '[]'::jsonb)
    from jsonb_array_elements(r.observation -> 'findings') f)`;
  const needsResultScrub = sql`r.observation ->> 'kind' = 'web_topic'
    and exists (select 1 from jsonb_array_elements(coalesce(r.observation -> 'findings', '[]'::jsonb)) f where coalesce((f ->> 'redacted')::boolean, false) = false)`;
  out.resultsScrubbed = dry
    ? await n(sql`select count(*)::text as n from monitoring_results r where ${needsResultScrub}`)
    : await n(sql`with u as (
        update monitoring_results r set
          observation = jsonb_set(r.observation, '{findings}', ${findingsRedactedSql}),
          change_summary = case when r.change_summary is null then null else jsonb_build_object('redacted', true) end
        where ${needsResultScrub} returning 1)
        select count(*)::text as n from u`);

  if (opts.scrubHistory) {
    const GENERIC_TITLE = "Nouvelle information détectée";
    const GENERIC_BODY = "Le détail de ce résultat de recherche n'est pas conservé, conformément aux conditions du fournisseur de recherche.";
    out.notificationsScrubbed = dry
      ? await n(sql`select count(*)::text as n from notifications where type = 'web_topic' and (source_url is not null or title <> ${GENERIC_TITLE})`)
      : await n(sql`with u as (
          update notifications set title = ${GENERIC_TITLE}, body = ${GENERIC_BODY}, source_url = null
          where type = 'web_topic' and (source_url is not null or title <> ${GENERIC_TITLE}) returning 1)
          select count(*)::text as n from u`);
    out.emailsScrubbed = dry
      ? await n(sql`select count(*)::text as n from email_outbox e join notifications nt on nt.id = e.notification_id where nt.type = 'web_topic' and e.status in ('sent', 'canceled', 'failed') and e.payload <> '{"redacted": true}'::jsonb`)
      : await n(sql`with u as (
          update email_outbox e set subject = ${GENERIC_TITLE}, payload = jsonb_build_object('redacted', true)
          from notifications nt where nt.id = e.notification_id and nt.type = 'web_topic' and e.status in ('sent', 'canceled', 'failed') and e.payload <> '{"redacted": true}'::jsonb returning 1)
          select count(*)::text as n from u`);
  }
  return out;
}
