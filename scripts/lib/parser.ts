/**
 * HTML parser for Swiss legislation from Fedlex.
 *
 * Parses the static HTML served from the Fedlex filestore into structured
 * seed JSON. The HTML structure uses:
 *
 * - <section id="chap_N"> or <section id="tit_N"> for chapters/titles
 * - <article id="art_N"> for individual articles
 * - <h6 class="heading"> inside articles for article number + title
 * - <div class="collapseable"> for article content
 * - <h1 class="heading">, <h2 class="heading"> etc. for section headings
 *
 * German-language acts use "Art." numbering, same structure.
 */

export interface ActIndexEntry {
  id: string;
  srNumber: string;
  title: string;
  titleEn: string;
  abbreviation: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Decode HTML entities and strip tags to get plain text.
 */
function stripHtml(html: string): string {
  return html
    // Remove <tmp:inl> tags (Fedlex-specific XML namespace leaks)
    .replace(/<tmp:inl[^>]*>[^<]*<\/tmp:inl>/gi, '')
    .replace(/<tmp:inl[^>]*>/gi, '')
    .replace(/<inl>[^<]*<\/inl>/gi, '')
    // Remove footnote references (superscript links like [1], [2])
    .replace(/<sup><a[^>]*>\d+<\/a><\/sup>/gi, '')
    // Remove all remaining HTML tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '\u201C')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ndash;/g, '\u2013')
    .replace(/&mdash;/g, '\u2014')
    .replace(/&#\d+;/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract the chapter/section heading from the nearest parent <section>.
 * We look backwards from the article position to find the enclosing section heading.
 */
function findChapterHeading(html: string, articlePos: number): string {
  // Look backwards for the nearest section heading
  const beforeArticle = html.substring(Math.max(0, articlePos - 5000), articlePos);

  // Find the last h1/h2 heading before this article
  const headingMatches = [...beforeArticle.matchAll(/<h[12] class="heading[^"]*"[^>]*>.*?<a[^>]*>([^<]+(?:<br\s*\/?>([^<]+))?)<\/a>/gi)];

  if (headingMatches.length > 0) {
    const lastHeading = headingMatches[headingMatches.length - 1];
    let heading = stripHtml(lastHeading[1]);
    if (lastHeading[2]) {
      heading += ' ' + stripHtml(lastHeading[2]);
    }
    return heading.trim();
  }

  return '';
}

/**
 * Parse Fedlex HTML to extract provisions from a statute page.
 *
 * The HTML has a predictable structure:
 * <main id="maintext">
 *   <section id="chap_1">
 *     <h1 class="heading">Chapter 1 Title</h1>
 *     <div class="collapseable">
 *       <article id="art_1">
 *         <h6 class="heading"><a><b>Art. 1</b> Title</a></h6>
 *         <div class="collapseable">content...</div>
 *       </article>
 *     </div>
 *   </section>
 * </main>
 */
export function parseFedlexHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions: ParsedProvision[] = [];
  const definitions: ParsedDefinition[] = [];

  // Find all <article> elements by splitting at article boundaries
  const articleRegex = /<article id="art_([^"]+)">/gi;
  const articleMatches: { id: string; pos: number }[] = [];

  let match: RegExpExecArray | null;
  while ((match = articleRegex.exec(html)) !== null) {
    articleMatches.push({ id: match[1], pos: match.index });
  }

  for (let i = 0; i < articleMatches.length; i++) {
    const articleMatch = articleMatches[i];
    const startPos = articleMatch.pos;

    // Extract the article content (up to the next article or end of main)
    const endPos = i + 1 < articleMatches.length
      ? articleMatches[i + 1].pos
      : html.indexOf('</main>', startPos);
    const actualEnd = endPos > startPos ? endPos : html.length;
    const articleHtml = html.substring(startPos, actualEnd);

    // Extract the article number and title from the heading
    // Pattern: <h6 class="heading"...><a href="..."><b>Art. N</b> Title</a></h6>
    const headingMatch = articleHtml.match(
      /<h6[^>]*class="heading[^"]*"[^>]*>.*?<a[^>]*>(.*?)<\/a>\s*<\/h6>/si
    );

    let articleNum = articleMatch.id;
    let title = '';

    if (headingMatch) {
      const headingContent = headingMatch[1];

      // Extract article number from <b>Art. N</b> or <b>Art. Nbis</b>
      const artNumMatch = headingContent.match(/<b>\s*Art\.?\s*&nbsp;?(\d+[a-z]*)\s*<\/b>/i);
      if (artNumMatch) {
        articleNum = artNumMatch[1];
      }

      // Extract title: everything after the closing </b> tag
      const titleMatch = headingContent.match(/<\/b>\s*(.*)/si);
      if (titleMatch) {
        title = stripHtml(titleMatch[1]).trim();
      }
    }

    // Extract the content from the <div class="collapseable"> inside the article
    // There are typically two collapseable divs: one wrapping the article, one with content
    const contentMatch = articleHtml.match(
      /<div class="collapseable">\s*([\s\S]*?)(?:<\/article>|$)/i
    );

    let content = '';
    if (contentMatch) {
      content = stripHtml(contentMatch[1]);
    } else {
      // Fallback: strip the entire article HTML
      content = stripHtml(articleHtml);
    }

    // Skip articles with very little content (just headers)
    if (content.length < 5) continue;

    // Cap content at 8K characters
    if (content.length > 8000) {
      content = content.substring(0, 8000);
    }

    // Find the chapter heading for context
    const chapter = findChapterHeading(html, startPos);

    // Normalize provision_ref: use "art" prefix with the article ID
    // Convert underscore-separated variants like "5_a" to "5a"
    const normalizedNum = articleNum.replace(/_/g, '');
    const provisionRef = `art${normalizedNum}`;

    provisions.push({
      provision_ref: provisionRef,
      chapter: chapter || undefined,
      section: normalizedNum,
      title,
      content,
    });

    // Extract definitions if this is a definitions article
    if (title.toLowerCase().includes('definition') || title.toLowerCase().includes('begriffe')) {
      extractDefinitions(articleHtml, provisionRef, definitions);
    }
  }

  return {
    id: `sr-${act.srNumber.replace(/\./g, '-')}`,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.abbreviation,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    provisions,
    definitions,
  };
}

/**
 * Extract term definitions from definition list (<dl>) elements.
 *
 * Fedlex uses <dl><dt>a.</dt><dd><i>term</i> definition...</dd></dl>
 */
function extractDefinitions(
  articleHtml: string,
  sourceProvision: string,
  definitions: ParsedDefinition[],
): void {
  // Find <dt>/<dd> pairs (Fedlex adds CSS classes to dt/dd elements)
  const dtDdRegex = /<dt[^>]*>\s*([a-z]\w*\.?)\s*<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let match: RegExpExecArray | null;

  while ((match = dtDdRegex.exec(articleHtml)) !== null) {
    const ddContent = match[2];

    // The term is typically in <i>term</i> at the start of the <dd>
    const termMatch = ddContent.match(/<i>\s*(.*?)\s*<\/i>/i);
    if (termMatch) {
      const term = stripHtml(termMatch[1]).trim();
      const definition = stripHtml(ddContent).trim();

      if (term && definition) {
        definitions.push({
          term,
          definition,
          source_provision: sourceProvision,
        });
      }
    }
  }
}

/**
 * Build an ActIndexEntry from census data.
 *
 * The census provides ELI URIs in data.admin.ch format; this converts
 * them to www.fedlex.admin.ch browsable URLs for the fetcher.
 */
export function censusEntryToAct(entry: {
  id: string;
  sr_number: string;
  title: string;
  title_en: string;
  eli_uri: string;
}): ActIndexEntry {
  // Convert data URI to browsable URL:
  // "https://fedlex.data.admin.ch/eli/cc/2022/491" -> "https://www.fedlex.admin.ch/eli/cc/2022/491/en"
  const url = entry.eli_uri.replace('fedlex.data.admin.ch', 'www.fedlex.admin.ch') + '/en';

  return {
    id: entry.id,
    srNumber: entry.sr_number,
    title: entry.title,
    titleEn: entry.title_en,
    abbreviation: extractAbbreviation(entry.title),
    status: 'in_force',
    issuedDate: '',
    inForceDate: '',
    url,
  };
}

/**
 * Extract abbreviation from a German law title.
 * E.g., "Bundesgesetz über den Datenschutz (Datenschutzgesetz, DSG)" -> "DSG"
 * Falls back to the SR number-based ID if no abbreviation is found.
 */
function extractAbbreviation(title: string): string {
  // Look for abbreviation in parentheses: "(Datenschutzgesetz, DSG)" or "(DSG)"
  const match = title.match(/\((?:[^,]+,\s*)?([A-ZÄÖÜ][A-Za-zäöüÄÖÜ]{1,10})\)\s*$/);
  if (match) return match[1];

  // Look for abbreviation pattern: "XYZ)" at end
  const match2 = title.match(/,\s*([A-ZÄÖÜ]{2,10})\)\s*$/);
  if (match2) return match2[1];

  return '';
}
