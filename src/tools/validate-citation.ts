/**
 * validate_citation — Validate a Swiss legal citation against the database.
 */

import type Database from '@ansvar/mcp-sqlite';
import { resolveDocumentId } from '../utils/statute-id.js';
import { generateResponseMetadata, type ToolResponse } from '../utils/metadata.js';

export interface ValidateCitationInput {
  citation: string;
}

export interface ValidateCitationResult {
  valid: boolean;
  citation: string;
  normalized?: string;
  document_id?: string;
  document_title?: string;
  provision_ref?: string;
  status?: string;
  warnings: string[];
}

/**
 * Parse a Swiss legal citation.
 * Supports:
 * - "Art. 1 DSG" / "Art. 143bis StGB"
 * - "SR 235.1 Art. 1"
 * - Document title with article reference
 */
function parseCitation(citation: string): { documentRef: string; articleRef?: string } | null {
  const trimmed = citation.trim();

  // "Art. N <law>" or "Art. Nbis <law>"
  const artFirst = trimmed.match(/^Art\.?\s*(\d+(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies)?[a-z]*)\s+(.+)$/i);
  if (artFirst) {
    return { documentRef: artFirst[2].trim(), articleRef: artFirst[1] };
  }

  // "<law> Art. N" or "<law>, Art. N"
  const artLast = trimmed.match(/^(.+?)[,;]?\s*Art\.?\s*(\d+(?:bis|ter|quater|quinquies|sexies|septies|octies|novies|decies)?[a-z]*)$/i);
  if (artLast) {
    return { documentRef: artLast[1].trim(), articleRef: artLast[2] };
  }

  // "SR NNN.N Art. N"
  const srWithArt = trimmed.match(/^SR\s*([\d.]+)\s*[,;]?\s*Art\.?\s*(\d+[a-z]*)$/i);
  if (srWithArt) {
    return { documentRef: `SR ${srWithArt[1]}`, articleRef: srWithArt[2] };
  }

  // Just a document reference
  return { documentRef: trimmed };
}

export async function validateCitationTool(
  db: InstanceType<typeof Database>,
  input: ValidateCitationInput,
): Promise<ToolResponse<ValidateCitationResult>> {
  const warnings: string[] = [];
  const parsed = parseCitation(input.citation);

  if (!parsed) {
    return {
      results: {
        valid: false,
        citation: input.citation,
        warnings: ['Could not parse citation format'],
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  const docId = resolveDocumentId(db, parsed.documentRef);
  if (!docId) {
    return {
      results: {
        valid: false,
        citation: input.citation,
        warnings: [`Document not found: "${parsed.documentRef}"`],
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  const doc = db.prepare(
    'SELECT id, title, status FROM legal_documents WHERE id = ?'
  ).get(docId) as { id: string; title: string; status: string };

  if (doc.status === 'repealed') {
    warnings.push(`WARNING: This statute has been repealed.`);
  } else if (doc.status === 'amended') {
    warnings.push(`Note: This statute has been amended. Verify you are referencing the current version.`);
  }

  if (parsed.articleRef) {
    const provision = db.prepare(
      "SELECT provision_ref FROM legal_provisions WHERE document_id = ? AND (provision_ref = ? OR provision_ref = ? OR section = ?)"
    ).get(docId, parsed.articleRef, `art${parsed.articleRef}`, parsed.articleRef) as { provision_ref: string } | undefined;

    if (!provision) {
      return {
        results: {
          valid: false,
          citation: input.citation,
          document_id: docId,
          document_title: doc.title,
          warnings: [...warnings, `Provision "${parsed.articleRef}" not found in ${doc.title}`],
        },
        _metadata: generateResponseMetadata(db),
      };
    }

    return {
      results: {
        valid: true,
        citation: input.citation,
        normalized: `Art. ${parsed.articleRef} ${doc.title}`,
        document_id: docId,
        document_title: doc.title,
        provision_ref: provision.provision_ref,
        status: doc.status,
        warnings,
      },
      _metadata: generateResponseMetadata(db),
    };
  }

  return {
    results: {
      valid: true,
      citation: input.citation,
      normalized: doc.title,
      document_id: docId,
      document_title: doc.title,
      status: doc.status,
      warnings,
    },
    _metadata: generateResponseMetadata(db),
  };
}
