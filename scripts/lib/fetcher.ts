/**
 * Rate-limited HTTP client for Fedlex (fedlex.admin.ch)
 *
 * Strategy:
 * 1. Use Fedlex SPARQL endpoint to discover the exact HTML file URL
 *    for each consolidated act (latest version, English preferred, German fallback)
 * 2. Fetch the static HTML from the Fedlex filestore (real legislation content)
 * 3. Rate-limit all requests (500ms minimum between requests)
 *
 * The main Fedlex website (www.fedlex.admin.ch/eli/...) is a JS-rendered SPA
 * and returns no legislation content to curl/fetch. The actual content lives in
 * the filestore at fedlex.data.admin.ch/filestore/...
 */

const USER_AGENT = 'Switzerland-Law-MCP/1.0 (https://github.com/Ansvar-Systems/switzerland-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;
const SPARQL_ENDPOINT = 'https://fedlex.data.admin.ch/sparqlendpoint';

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, accept?: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': accept ?? 'text/html, application/xhtml+xml, */*',
      },
      redirect: 'follow',
    });

    if (response.status === 429 || response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const body = await response.text();
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Result from SPARQL-based HTML URL resolution.
 */
export interface ResolvedHtmlUrl {
  url: string;
  language: 'en' | 'de' | 'fr' | 'it';
  consolidationDate: string;
}

/**
 * Extract the ELI path from a Fedlex URL.
 * E.g. "https://www.fedlex.admin.ch/eli/cc/2022/491/en" -> "2022/491"
 *      "https://www.fedlex.admin.ch/eli/cc/54/757_781_799/en" -> "54/757_781_799"
 */
export function extractEliPath(fedlexUrl: string): string {
  const match = fedlexUrl.match(/\/eli\/cc\/(.+?)(?:\/(?:en|de|fr|it))?$/);
  if (!match) {
    throw new Error(`Cannot extract ELI path from URL: ${fedlexUrl}`);
  }
  return match[1];
}

/**
 * Use the Fedlex SPARQL endpoint to find the latest HTML file URL
 * for an act. Tries English first, then falls back to German.
 *
 * Returns the direct filestore URL where the actual legislation HTML lives.
 */
export async function resolveHtmlUrl(fedlexUrl: string): Promise<ResolvedHtmlUrl | null> {
  const eliPath = extractEliPath(fedlexUrl);
  const actUri = `https://fedlex.data.admin.ch/eli/cc/${eliPath}`;

  // Try English first, then German
  for (const [langUri, langCode] of [
    ['http://publications.europa.eu/resource/authority/language/ENG', 'en'],
    ['http://publications.europa.eu/resource/authority/language/DEU', 'de'],
  ] as const) {
    const query = `
      PREFIX jolux: <http://data.legilux.public.lu/resource/ontology/jolux#>
      SELECT ?consolidation ?url WHERE {
        ?consolidation jolux:isMemberOf <${actUri}> .
        ?consolidation jolux:isRealizedBy ?expr .
        ?expr jolux:language <${langUri}> .
        ?expr jolux:isEmbodiedBy ?manif .
        ?manif jolux:userFormat <https://fedlex.data.admin.ch/vocabulary/user-format/html> .
        ?manif jolux:isExemplifiedBy ?url .
      } ORDER BY DESC(?consolidation) LIMIT 1
    `;

    const result = await fetchSparql(query);
    if (result && result.length > 0) {
      const binding = result[0];
      const consolidationUri = binding.consolidation.value;
      // Extract date from consolidation URI (last path segment)
      const consolidationDate = consolidationUri.split('/').pop() ?? '';

      return {
        url: binding.url.value,
        language: langCode as 'en' | 'de',
        consolidationDate,
      };
    }
  }

  return null;
}

interface SparqlBinding {
  [key: string]: { type: string; value: string };
}

/**
 * Execute a SPARQL query against the Fedlex endpoint.
 */
async function fetchSparql(query: string): Promise<SparqlBinding[] | null> {
  const url = `${SPARQL_ENDPOINT}?query=${encodeURIComponent(query.trim())}`;
  const result = await fetchWithRateLimit(url, 'application/sparql-results+json');

  if (result.status !== 200) {
    console.log(`  SPARQL query failed: HTTP ${result.status}`);
    return null;
  }

  try {
    const json = JSON.parse(result.body);
    return json.results?.bindings ?? [];
  } catch {
    console.log(`  SPARQL response parse error`);
    return null;
  }
}

/**
 * Fetch the actual HTML content for a Swiss federal act.
 *
 * 1. Uses SPARQL to discover the exact filestore URL (with correct version suffix)
 * 2. Fetches the HTML from the filestore
 * 3. Validates that the response contains actual legislation content
 *    (not the Angular SPA shell)
 *
 * Returns the FetchResult with the real HTML body, or null if unavailable.
 */
export async function fetchActHtml(fedlexUrl: string): Promise<{
  result: FetchResult;
  resolved: ResolvedHtmlUrl;
} | null> {
  const resolved = await resolveHtmlUrl(fedlexUrl);
  if (!resolved) {
    return null;
  }

  const result = await fetchWithRateLimit(resolved.url);
  if (result.status !== 200) {
    return null;
  }

  // Validate that we got real legislation content, not the SPA shell
  if (!result.body.includes('lawcontent') && !result.body.includes('<article')) {
    console.log(`  WARNING: Response from ${resolved.url} appears to be the SPA shell, not legislation content`);
    return null;
  }

  return { result, resolved };
}
