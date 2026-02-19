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
 * Pre-configured list of key Swiss federal acts to ingest.
 * These are the most important federal acts for cybersecurity, data protection,
 * and compliance use cases.
 *
 * ELI paths are used to query the Fedlex SPARQL endpoint for the latest
 * consolidated version. The `url` field points to the human-readable Fedlex page.
 */
export const KEY_SWISS_ACTS: ActIndexEntry[] = [
  {
    id: 'sr-235-1',
    srNumber: '235.1',
    title: 'Bundesgesetz über den Datenschutz (Datenschutzgesetz, DSG)',
    titleEn: 'Federal Act on Data Protection (FADP)',
    abbreviation: 'DSG',
    status: 'in_force',
    issuedDate: '2020-09-25',
    inForceDate: '2023-09-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/2022/491/en',
  },
  {
    id: 'sr-128-1',
    srNumber: '128.1',
    title: 'Bundesgesetz über die Informationssicherheit beim Bund (Informationssicherheitsgesetz, ISG)',
    titleEn: 'Federal Act on Information Security (ISA)',
    abbreviation: 'ISG',
    status: 'in_force',
    issuedDate: '2020-12-18',
    inForceDate: '2024-01-01',
    // Correct ELI: cc/2022/232 (not cc/2023/483)
    url: 'https://www.fedlex.admin.ch/eli/cc/2022/232/de',
  },
  {
    id: 'sr-784-10',
    srNumber: '784.10',
    title: 'Fernmeldegesetz (FMG)',
    titleEn: 'Telecommunications Act (TCA)',
    abbreviation: 'FMG',
    status: 'in_force',
    issuedDate: '1997-04-30',
    inForceDate: '1998-01-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/1997/2187_2187_2187/en',
  },
  {
    id: 'sr-220',
    srNumber: '220',
    title: 'Bundesgesetz betreffend die Ergänzung des Schweizerischen Zivilgesetzbuches (Obligationenrecht)',
    titleEn: 'Federal Act on the Amendment of the Swiss Civil Code (Part Five: The Code of Obligations)',
    abbreviation: 'OR',
    status: 'in_force',
    issuedDate: '1911-03-30',
    inForceDate: '1912-01-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/27/317_321_377/en',
  },
  {
    id: 'sr-311-0',
    srNumber: '311.0',
    title: 'Schweizerisches Strafgesetzbuch',
    titleEn: 'Swiss Criminal Code',
    abbreviation: 'StGB',
    status: 'in_force',
    issuedDate: '1937-12-21',
    inForceDate: '1942-01-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/54/757_781_799/en',
  },
  {
    id: 'sr-943-03',
    srNumber: '943.03',
    title: 'Bundesgesetz über Zertifizierungsdienste im Bereich der elektronischen Signatur und anderer Anwendungen digitaler Zertifikate (Bundesgesetz über die elektronische Signatur, ZertES)',
    titleEn: 'Federal Act on Electronic Signatures (ZertES)',
    abbreviation: 'ZertES',
    status: 'in_force',
    issuedDate: '2016-03-18',
    inForceDate: '2017-01-01',
    // No English translation available; use German
    url: 'https://www.fedlex.admin.ch/eli/cc/2016/752/de',
  },
  {
    id: 'sr-780-1',
    srNumber: '780.1',
    title: 'Bundesgesetz betreffend die Überwachung des Post- und Fernmeldeverkehrs (BÜPF)',
    titleEn: 'Federal Act on the Surveillance of Post and Telecommunications (SPTA)',
    abbreviation: 'BÜPF',
    status: 'in_force',
    issuedDate: '2016-03-18',
    inForceDate: '2018-03-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/2018/31/en',
  },
  {
    id: 'sr-101',
    srNumber: '101',
    title: 'Bundesverfassung der Schweizerischen Eidgenossenschaft',
    titleEn: 'Federal Constitution of the Swiss Confederation',
    abbreviation: 'BV',
    status: 'in_force',
    issuedDate: '1999-04-18',
    inForceDate: '2000-01-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/1999/404/en',
  },
  {
    id: 'sr-235-11',
    srNumber: '235.11',
    title: 'Verordnung über den Datenschutz (Datenschutzverordnung, DSV)',
    titleEn: 'Ordinance on Data Protection (DPO)',
    abbreviation: 'DSV',
    status: 'in_force',
    issuedDate: '2022-08-31',
    inForceDate: '2023-09-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/2022/568/en',
  },
  {
    id: 'sr-161-1',
    srNumber: '161.1',
    title: 'Bundesgesetz über das Öffentlichkeitsprinzip der Verwaltung (Öffentlichkeitsgesetz, BGÖ)',
    titleEn: 'Federal Act on Freedom of Information in the Administration (FoIA)',
    abbreviation: 'BGÖ',
    status: 'in_force',
    issuedDate: '2004-12-17',
    inForceDate: '2006-07-01',
    url: 'https://www.fedlex.admin.ch/eli/cc/2006/355/en',
  },
];
