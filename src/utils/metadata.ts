/**
 * Response metadata utilities for Switzerland Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'Fedlex (fedlex.admin.ch) — Swiss Federal Chancellery',
    jurisdiction: 'CH',
    disclaimer:
      'This data is sourced from Fedlex under Open Government Data principles. ' +
      'The authoritative versions are in German, French, and Italian. ' +
      'English translations are unofficial. Always verify with the official Fedlex portal.',
    freshness,
  };
}
