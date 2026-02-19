# Switzerland Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/switzerland-law-mcp)](https://www.npmjs.com/package/@ansvar/switzerland-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/switzerland-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/switzerland-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/switzerland-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/switzerland-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Swiss federal legislation, including the new Federal Act on Data Protection (nFADP/DSG), information security, telecommunications, code of obligations, criminal code cybercrime provisions, and electronic signatures with full-text search in German, French, Italian, and English.

## Deployment Tier

**SMALL** -- Single tier, bundled SQLite database shipped with the npm package.

**Estimated database size:** ~100-180 MB (full corpus of Swiss federal legislation via Fedlex)

## Key Legislation Covered

| Law | SR Number | Significance |
|-----|-----------|-------------|
| **Federal Act on Data Protection (nFADP/DSG)** | SR 235.1 | New data protection law effective Sep 1, 2023; replaces 1992 DPA; aligns with GDPR with Swiss-specific features (fines on individuals, no DPO requirement) |
| **Federal Act on Information Security (ISA)** | SR 128.1 | Federal information security framework for government and critical infrastructure |
| **Telecommunications Act (TCA)** | SR 784.10 | Regulates telecommunications services and infrastructure |
| **Code of Obligations (OR)** | SR 220 | Core contract and company law; contains corporate governance provisions |
| **Swiss Criminal Code (StGB)** | SR 311.0 | Art. 143bis criminalizes unauthorized computer access; Art. 143 covers data theft; Art. 144bis covers data damage |
| **Federal Act on Electronic Signatures (ZertES)** | SR 943.03 | Electronic signatures and certification services framework |
| **Federal Act on Surveillance of Post and Telecommunications (BÜPF)** | SR 780.1 | Lawful interception and telecommunications surveillance framework |
| **Federal Constitution** | SR 101 | Art. 13 guarantees the right to privacy; foundational for all data protection law |

## Regulatory Context

- **Supervisory Authority:** FDPIC (Federal Data Protection and Information Commissioner / Eidgenössischer Datenschutz- und Öffentlichkeitsbeauftragter)
- **nFADP (new Federal Act on Data Protection)** replaced the 1992 DPA effective September 1, 2023
- **Swiss-GDPR alignment:** nFADP closely aligns with GDPR but has key differences: fines on individuals (not companies, max CHF 250,000), no DPO requirement, no one-stop-shop mechanism
- **EU adequacy decision:** Switzerland has an active EU adequacy decision, recognizing adequate data protection for EU-CH transfers
- **Three official legal languages:** German (de), French (fr), Italian (it) -- all equally authoritative for federal law
- **Fedlex** provides excellent structured data (XML, RDF, SPARQL endpoint) for automated ingestion
- Switzerland is not an EU member but participates in EU frameworks through bilateral agreements

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [Fedlex](https://www.fedlex.admin.ch) | Swiss Federal Chancellery | API (XML/RDF/SPARQL) | Daily | Open Government Data | All federal legislation in the Classified Compilation (SR/RS), ordinances, and implementing regulations |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/switzerland-law-mcp
```

## Usage

### As stdio MCP server

```bash
switzerland-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "switzerland-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/switzerland-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific article from a Swiss federal law by SR number or law name |
| `search_legislation` | Full-text search across all Swiss federal legislation (supports German, French, Italian, English) |
| `get_provision_eu_basis` | Cross-reference lookup for EU framework relationships (GDPR adequacy, eIDAS, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 3 article retrieval tests (nFADP Art. 1, ISA Art. 1, Criminal Code Art. 143bis)
- 3 search tests (Personendaten/German, donnees personnelles/French, data protection/English)
- 2 citation roundtrip tests (fedlex.admin.ch URL patterns)
- 2 cross-reference tests (nFADP to GDPR adequacy, ZertES to eIDAS)
- 2 negative tests (non-existent law, malformed article)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/switzerland-law-mcp/issues/new?template=data-error.md)

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
