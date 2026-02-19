#!/usr/bin/env tsx
/**
 * Switzerland Law MCP — Ingestion Pipeline
 *
 * Fetches Swiss federal legislation from Fedlex (fedlex.admin.ch).
 * Fedlex provides Open Government Data for all Swiss federal legislation.
 *
 * Strategy:
 * 1. For each act, use SPARQL to discover the latest HTML file URL
 * 2. Fetch the actual HTML from the Fedlex filestore (not the SPA)
 * 3. Parse articles from the structured HTML
 * 4. Write seed JSON files for the database builder
 *
 * Usage:
 *   npm run ingest                    # Full ingestion
 *   npm run ingest -- --limit 5       # Test with 5 acts
 *   npm run ingest -- --skip-fetch    # Reuse cached pages
 *
 * Data is sourced under Open Government Data principles.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchActHtml, type ResolvedHtmlUrl } from './lib/fetcher.js';
import { parseFedlexHtml, KEY_SWISS_ACTS, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');

function parseArgs(): { limit: number | null; skipFetch: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    }
  }

  return { limit, skipFetch };
}

interface IngestionResult {
  act: ActIndexEntry;
  provisions: number;
  definitions: number;
  language: string;
  consolidationDate: string;
  status: 'success' | 'skipped' | 'failed';
  error?: string;
}

async function fetchAndParseActs(acts: ActIndexEntry[], skipFetch: boolean): Promise<IngestionResult[]> {
  console.log(`\nProcessing ${acts.length} federal acts...\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  const results: IngestionResult[] = [];

  for (const act of acts) {
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    // Skip if seed already exists and we're in skip-fetch mode
    if (skipFetch && fs.existsSync(seedFile)) {
      console.log(`  SKIP ${act.abbreviation} (SR ${act.srNumber}) — cached`);
      // Read existing seed to report stats
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
        results.push({
          act,
          provisions: existing.provisions?.length ?? 0,
          definitions: existing.definitions?.length ?? 0,
          language: 'cached',
          consolidationDate: 'cached',
          status: 'skipped',
        });
      } catch {
        results.push({
          act,
          provisions: 0,
          definitions: 0,
          language: 'cached',
          consolidationDate: 'cached',
          status: 'skipped',
        });
      }
      continue;
    }

    try {
      let html: string;
      let language = 'en';
      let consolidationDate = 'unknown';

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
      } else {
        process.stdout.write(`  Fetching ${act.abbreviation} (SR ${act.srNumber})...`);

        const fetchResult = await fetchActHtml(act.url);
        if (!fetchResult) {
          console.log(` FAILED (no HTML found via SPARQL)`);
          results.push({
            act,
            provisions: 0,
            definitions: 0,
            language: 'none',
            consolidationDate: 'none',
            status: 'failed',
            error: 'No HTML file URL found via SPARQL for English or German',
          });
          continue;
        }

        html = fetchResult.result.body;
        language = fetchResult.resolved.language;
        consolidationDate = fetchResult.resolved.consolidationDate;

        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB, ${language}, ${consolidationDate})`);
      }

      const parsed = parseFedlexHtml(html, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);

      results.push({
        act,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        language,
        consolidationDate,
        status: 'success',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR ${act.abbreviation}: ${msg}`);
      results.push({
        act,
        provisions: 0,
        definitions: 0,
        language: 'error',
        consolidationDate: 'error',
        status: 'failed',
        error: msg,
      });
    }
  }

  return results;
}

function printReport(results: IngestionResult[]): void {
  console.log(`\n${'='.repeat(72)}`);
  console.log('INGESTION REPORT');
  console.log('='.repeat(72));

  const succeeded = results.filter(r => r.status === 'success');
  const skipped = results.filter(r => r.status === 'skipped');
  const failed = results.filter(r => r.status === 'failed');
  const totalProvisions = results.reduce((sum, r) => sum + r.provisions, 0);
  const totalDefinitions = results.reduce((sum, r) => sum + r.definitions, 0);

  console.log(`\nSuccessfully ingested: ${succeeded.length}`);
  for (const r of succeeded) {
    console.log(`  ${r.act.abbreviation.padEnd(8)} (SR ${r.act.srNumber.padEnd(8)}) ${r.provisions.toString().padStart(4)} provisions, ${r.definitions.toString().padStart(3)} definitions [${r.language}, ${r.consolidationDate}]`);
  }

  if (skipped.length > 0) {
    console.log(`\nSkipped (cached): ${skipped.length}`);
    for (const r of skipped) {
      console.log(`  ${r.act.abbreviation.padEnd(8)} (SR ${r.act.srNumber.padEnd(8)}) ${r.provisions.toString().padStart(4)} provisions`);
    }
  }

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}`);
    for (const r of failed) {
      console.log(`  ${r.act.abbreviation.padEnd(8)} (SR ${r.act.srNumber.padEnd(8)}) — ${r.error}`);
    }
  }

  console.log(`\nTotal provisions: ${totalProvisions}`);
  console.log(`Total definitions: ${totalDefinitions}`);
  console.log('='.repeat(72));
}

async function main(): Promise<void> {
  const { limit, skipFetch } = parseArgs();

  console.log('Switzerland Law MCP — Ingestion Pipeline');
  console.log('=========================================\n');
  console.log(`  Source: Fedlex (fedlex.admin.ch) via SPARQL + Filestore`);
  console.log(`  License: Open Government Data`);
  console.log(`  Strategy: SPARQL -> resolve latest HTML -> parse articles`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);

  const acts = limit ? KEY_SWISS_ACTS.slice(0, limit) : KEY_SWISS_ACTS;
  const results = await fetchAndParseActs(acts, skipFetch);
  printReport(results);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
