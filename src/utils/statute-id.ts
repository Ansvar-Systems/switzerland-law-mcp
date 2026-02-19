/**
 * Statute ID resolution for Switzerland Law MCP.
 *
 * Resolves fuzzy document references (titles, SR numbers) to database document IDs.
 */

import type Database from '@ansvar/mcp-sqlite';

/**
 * Resolve a document identifier to a database document ID.
 * Supports:
 * - Direct ID match (e.g., "sr-235-1")
 * - SR number match (e.g., "SR 235.1", "235.1")
 * - Title substring match (e.g., "Data Protection", "Datenschutzgesetz")
 */
export function resolveDocumentId(
  db: InstanceType<typeof Database>,
  input: string,
): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Direct ID match
  const directMatch = db.prepare(
    'SELECT id FROM legal_documents WHERE id = ?'
  ).get(trimmed) as { id: string } | undefined;
  if (directMatch) return directMatch.id;

  // SR number match (e.g., "SR 235.1" or just "235.1")
  const srMatch = trimmed.match(/(?:SR\s*)?(\d+(?:\.\d+)*)/i);
  if (srMatch) {
    const srNumber = srMatch[1];
    const srResult = db.prepare(
      "SELECT id FROM legal_documents WHERE id LIKE ? OR short_name LIKE ? LIMIT 1"
    ).get(`%sr-${srNumber.replace(/\./g, '-')}%`, `%${srNumber}%`) as { id: string } | undefined;
    if (srResult) return srResult.id;
  }

  // Title/short_name fuzzy match
  const titleResult = db.prepare(
    "SELECT id FROM legal_documents WHERE title LIKE ? OR short_name LIKE ? OR title_en LIKE ? LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (titleResult) return titleResult.id;

  // Case-insensitive fallback
  const lowerResult = db.prepare(
    "SELECT id FROM legal_documents WHERE LOWER(title) LIKE LOWER(?) OR LOWER(short_name) LIKE LOWER(?) OR LOWER(title_en) LIKE LOWER(?) LIMIT 1"
  ).get(`%${trimmed}%`, `%${trimmed}%`, `%${trimmed}%`) as { id: string } | undefined;
  if (lowerResult) return lowerResult.id;

  return null;
}
