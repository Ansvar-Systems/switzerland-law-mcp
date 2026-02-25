#!/usr/bin/env tsx
/**
 * Switzerland Law MCP — Census Script
 *
 * Enumerates ALL federal acts in the Swiss Classified Compilation (SR)
 * via the Fedlex SPARQL endpoint. Produces data/census.json in golden
 * standard format.
 *
 * The census lists every ConsolidationAbstract with an SR number from
 * the Fedlex Linked Data endpoint. This includes both domestic federal
 * legislation (SR 1xx–9xx) and international treaties (SR 0.xxx).
 *
 * Strategy: The Fedlex SPARQL endpoint cannot handle large OFFSET values
 * (times out at ~10K). Instead, we partition queries by SR number prefix
 * (0.1, 0.2, ..., 1, 2, ..., 9), with further sub-partitioning for
 * prefixes that exceed 1000 results. This ensures each query returns
 * under 1000 results and avoids the pagination limit.
 *
 * Usage:
 *   npx tsx scripts/census.ts
 *
 * Output: data/census.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SPARQL_ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint';
const USER_AGENT = 'Switzerland-Law-MCP/1.0 (https://github.com/Ansvar-Systems/switzerland-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;
const MAX_PER_QUERY = 950; // Safe threshold below 1000

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

interface SparqlBinding {
  [key: string]: { type: string; value: string; datatype?: string };
}

interface CensusEntry {
  id: string;
  sr_number: string;
  title: string;
  title_en: string;
  eli_uri: string;
  classification: 'ingestable' | 'inaccessible';
}

interface CensusResult {
  schema_version: string;
  jurisdiction: string;
  portal: string;
  generated: string;
  total_acts: number;
  ingestable: number;
  inaccessible: number;
  acts: CensusEntry[];
}

/**
 * Execute a SPARQL query against the Fedlex endpoint with rate limiting.
 */
async function fetchSparql(query: string): Promise<SparqlBinding[]> {
  await rateLimit();

  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query.trim())}`;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/sparql-results+json',
        },
      });

      if (response.status === 429 || response.status >= 500) {
        const backoff = Math.pow(2, attempt + 1) * 2000;
        console.log(`    SPARQL HTTP ${response.status}, retrying in ${backoff / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }

      if (response.status !== 200) {
        throw new Error(`SPARQL query failed: HTTP ${response.status}`);
      }

      const text = await response.text();
      try {
        const json = JSON.parse(text);
        return json.results?.bindings ?? [];
      } catch {
        throw new Error(`SPARQL response parse error (${text.substring(0, 200)}...)`);
      }
    } catch (err) {
      if (attempt < 4 && (err instanceof TypeError || (err as Error).message.includes('fetch'))) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`    Network error, retrying in ${backoff / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw err;
    }
  }

  throw new Error('SPARQL query failed after 5 retries');
}

/**
 * Count acts matching a given SR number prefix.
 */
async function countByPrefix(prefix: string): Promise<number> {
  const filter = prefix
    ? `FILTER(STRSTARTS(STR(?srNumber), "${prefix}"))`
    : '';

  const query = `
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    SELECT (COUNT(DISTINCT ?work) AS ?total)
    WHERE {
      ?work a jolux:ConsolidationAbstract .
      ?work jolux:classifiedByTaxonomyEntry ?entry .
      ?entry skos:notation ?srNumber .
      ${filter}
    }
  `;

  const bindings = await fetchSparql(query);
  return parseInt(bindings[0]?.total?.value ?? '0', 10);
}

/**
 * Fetch acts matching a given SR number prefix.
 */
async function fetchByPrefix(prefix: string): Promise<SparqlBinding[]> {
  const filter = prefix
    ? `FILTER(STRSTARTS(STR(?srNumber), "${prefix}"))`
    : '';

  const query = `
    PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

    SELECT ?work ?srNumber (SAMPLE(?tDe) AS ?titleDe) (SAMPLE(?tEn) AS ?titleEn)
    WHERE {
      ?work a jolux:ConsolidationAbstract .
      ?work jolux:classifiedByTaxonomyEntry ?entry .
      ?entry skos:notation ?srNumber .
      ${filter}
      OPTIONAL {
        ?work jolux:isRealizedBy ?exprDe .
        ?exprDe jolux:language <http://publications.europa.eu/resource/authority/language/DEU> .
        ?exprDe jolux:title ?tDe .
      }
      OPTIONAL {
        ?work jolux:isRealizedBy ?exprEn .
        ?exprEn jolux:language <http://publications.europa.eu/resource/authority/language/ENG> .
        ?exprEn jolux:title ?tEn .
      }
    }
    GROUP BY ?work ?srNumber
    ORDER BY ?srNumber
  `;

  return fetchSparql(query);
}

/**
 * Recursively split a prefix into sub-prefixes if it has too many results.
 * Returns an array of prefixes that each have <= MAX_PER_QUERY results.
 */
async function partitionPrefix(prefix: string, depth = 0): Promise<string[]> {
  const count = await countByPrefix(prefix);

  if (count <= MAX_PER_QUERY) {
    return [prefix];
  }

  // Generate sub-prefixes.
  // SR numbers use dots as separators (e.g., "916.01", "916.101.1").
  // When a prefix like "916" needs splitting, we must generate both
  // "916." (for "916.xxx" sub-numbers) and "9160"-"9169" (for longer
  // integer prefixes like "9161" which is SR 916.1xx).
  const subPrefixes: string[] = [];
  if (prefix === '') {
    // Top-level: split into 0., 1, 2, ..., 9
    subPrefixes.push('0.');
    for (let i = 1; i <= 9; i++) subPrefixes.push(String(i));
  } else if (prefix === '0.') {
    // International treaties: split into 0.1, 0.2, ..., 0.9
    for (let i = 1; i <= 9; i++) subPrefixes.push(`0.${i}`);
  } else if (!prefix.endsWith('.')) {
    // For a prefix like "916", split into "916." (covers "916.xxx")
    // plus "9160"-"9169" (covers any hypothetical 4-digit SR numbers)
    subPrefixes.push(`${prefix}.`);
    for (let i = 0; i <= 9; i++) subPrefixes.push(`${prefix}${i}`);
  } else {
    // For a prefix ending in "." like "916.", split into "916.0"-"916.9"
    for (let i = 0; i <= 9; i++) subPrefixes.push(`${prefix}${i}`);
  }

  console.log(`  Prefix "${prefix}" has ${count} acts, splitting into ${subPrefixes.length} sub-ranges (depth ${depth})...`);

  const result: string[] = [];
  for (const sub of subPrefixes) {
    const subResult = await partitionPrefix(sub, depth + 1);
    result.push(...subResult);
  }

  return result;
}

/**
 * Fetch all acts from Fedlex using prefix-based partitioning.
 */
async function fetchAllActs(): Promise<Map<string, { work: string; srNumber: string; titleDe: string; titleEn: string }>> {
  // Step 1: Determine the set of prefixes that each fit under MAX_PER_QUERY
  console.log('  Phase 1: Determining query partitions...\n');
  const prefixes = await partitionPrefix('');
  console.log(`\n  Partitioned into ${prefixes.length} query ranges.\n`);

  // Step 2: Fetch each partition
  console.log('  Phase 2: Fetching acts per partition...\n');
  const acts = new Map<string, { work: string; srNumber: string; titleDe: string; titleEn: string }>();

  for (let i = 0; i < prefixes.length; i++) {
    const prefix = prefixes[i];
    process.stdout.write(`  [${i + 1}/${prefixes.length}] SR "${prefix}"*...`);

    const bindings = await fetchByPrefix(prefix);

    let added = 0;
    for (const binding of bindings) {
      const work = binding.work.value;
      const srNumber = binding.srNumber.value;
      const titleDe = binding.titleDe?.value ?? '';
      const titleEn = binding.titleEn?.value ?? '';

      if (!acts.has(work)) {
        acts.set(work, { work, srNumber, titleDe, titleEn });
        added++;
      }
    }

    console.log(` ${bindings.length} results (${added} new, ${acts.size} total)`);
  }

  return acts;
}

/**
 * Generate a stable ID from an SR number.
 * E.g., "235.1" -> "sr-235-1", "0.101" -> "sr-0-101"
 */
function srNumberToId(srNumber: string): string {
  return 'sr-' + srNumber.replace(/\./g, '-');
}

async function main(): Promise<void> {
  console.log('Switzerland Law MCP — Census');
  console.log('============================\n');
  console.log(`  Source: Fedlex SPARQL endpoint (fedlex.data.admin.ch)`);
  console.log(`  Strategy: Prefix-partitioned SPARQL queries (all ConsolidationAbstract)\n`);

  const actMap = await fetchAllActs();
  console.log(`\n  Total unique acts (by work URI): ${actMap.size}`);

  // Build census entries, deduplicating by SR number
  const entries: CensusEntry[] = [];
  const seenIds = new Set<string>();

  for (const [, act] of actMap) {
    const id = srNumberToId(act.srNumber);

    // Skip duplicate SR numbers (same SR may map to multiple work URIs)
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const title = act.titleDe || `SR ${act.srNumber}`;
    const titleEn = act.titleEn || '';

    entries.push({
      id,
      sr_number: act.srNumber,
      title,
      title_en: titleEn,
      eli_uri: act.work,
      classification: 'ingestable',
    });
  }

  // Sort by SR number (hierarchical numeric sort)
  entries.sort((a, b) => {
    const partsA = a.sr_number.split('.').map(s => {
      const n = Number(s);
      return isNaN(n) ? 0 : n;
    });
    const partsB = b.sr_number.split('.').map(s => {
      const n = Number(s);
      return isNaN(n) ? 0 : n;
    });
    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
      const valA = partsA[i] ?? 0;
      const valB = partsB[i] ?? 0;
      if (valA !== valB) return valA - valB;
    }
    return 0;
  });

  const ingestable = entries.filter(e => e.classification === 'ingestable').length;
  const inaccessible = entries.filter(e => e.classification === 'inaccessible').length;

  const census: CensusResult = {
    schema_version: '1.0',
    jurisdiction: 'CH',
    portal: 'fedlex.admin.ch',
    generated: new Date().toISOString().split('T')[0],
    total_acts: entries.length,
    ingestable,
    inaccessible,
    acts: entries,
  };

  // Write census
  const outputPath = path.resolve(__dirname, '../data/census.json');
  fs.writeFileSync(outputPath, JSON.stringify(census, null, 2));

  // Report
  console.log(`\n${'='.repeat(60)}`);
  console.log('CENSUS REPORT');
  console.log('='.repeat(60));
  console.log(`  Total acts:    ${entries.length}`);
  console.log(`  Ingestable:    ${ingestable}`);
  console.log(`  Inaccessible:  ${inaccessible}`);

  const domestic = entries.filter(e => !e.sr_number.startsWith('0.'));
  const international = entries.filter(e => e.sr_number.startsWith('0.'));
  console.log(`  Domestic (SR): ${domestic.length}`);
  console.log(`  Treaties (SR 0.xxx): ${international.length}`);

  const withEnTitle = entries.filter(e => e.title_en !== '').length;
  console.log(`  With English title: ${withEnTitle}`);
  console.log(`\n  Output: ${outputPath}`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
