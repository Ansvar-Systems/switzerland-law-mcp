/**
 * format_citation — Format a Swiss legal citation per standard conventions.
 */

import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';
import type Database from '@ansvar/mcp-sqlite';

export interface FormatCitationInput {
  citation: string;
  format?: 'full' | 'short' | 'pinpoint';
}

export interface FormatCitationResult {
  original: string;
  formatted: string;
  format: string;
}

export async function formatCitationTool(
  input: FormatCitationInput,
): Promise<FormatCitationResult> {
  const format = input.format ?? 'full';
  const trimmed = input.citation.trim();

  // Parse "Art. N <law>" or "<law> Art. N"
  const artFirst = trimmed.match(/^Art\.?\s*(\d+[a-z]*(?:bis|ter)?)\s+(.+)$/i);
  const artLast = trimmed.match(/^(.+?)[,;]?\s*Art\.?\s*(\d+[a-z]*(?:bis|ter)?)$/i);

  const article = artFirst?.[1] ?? artLast?.[2];
  const law = artFirst?.[2] ?? artLast?.[1] ?? trimmed;

  let formatted: string;
  switch (format) {
    case 'short':
      formatted = article ? `Art. ${article} ${law.split('(')[0].trim()}` : law;
      break;
    case 'pinpoint':
      formatted = article ? `Art. ${article}` : law;
      break;
    case 'full':
    default:
      formatted = article ? `Art. ${article} ${law}` : law;
      break;
  }

  return { original: input.citation, formatted, format };
}
