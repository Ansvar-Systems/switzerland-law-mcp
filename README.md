# Swiss Law MCP Server

**The Fedlex alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fswitzerland-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/switzerland-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/switzerland-law-mcp?style=social)](https://github.com/Ansvar-Systems/switzerland-law-mcp)
[![CI](https://github.com/Ansvar-Systems/switzerland-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/switzerland-law-mcp/actions/workflows/ci.yml)
[![Provisions](https://img.shields.io/badge/provisions-102%2C864-blue)]()

Query **4,873 Swiss federal laws** -- from Datenschutzgesetz (DSG/nFADP) and Strafgesetzbuch to Obligationenrecht, Fernmeldegesetz, and more -- directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Swiss legal research, this is your verified reference database -- the entire Systematische Rechtssammlung (SR), machine-readable.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Swiss legal research means navigating Fedlex, admin.ch, and scattered cantonal portals -- in three official languages. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking if a statute is still in force or how it aligns with EU law
- A **legal tech developer** building tools on Swiss federal law
- A **researcher** tracing legislative provisions across the SR numbering system

...you shouldn't need dozens of browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Swiss federal law **searchable, cross-referenceable, and AI-readable** -- covering the full accessible SR corpus from Fedlex.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version -- zero dependencies, nothing to install.

**Endpoint:** `https://switzerland-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add switzerland-law --transport http https://switzerland-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** -- add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "switzerland-law": {
      "type": "url",
      "url": "https://switzerland-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** -- add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "switzerland-law": {
      "type": "http",
      "url": "https://switzerland-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/switzerland-law-mcp
```

**Claude Desktop** -- add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "switzerland-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/switzerland-law-mcp"]
    }
  }
}
```

---

## Example Queries

Once connected, just ask naturally:

- *"What does the nFADP Art. 6 say about data processing principles?"*
- *"Is the old DSG still in force?"*
- *"Find provisions about Datenschutz in Swiss law"*
- *"Which Swiss laws align with the GDPR?"*
- *"What does Art. 143bis StGB say about computer crime?"*
- *"Search for cybersecurity requirements in Swiss legislation"*
- *"What are the consent requirements under the new Swiss data protection law?"*
- *"Find provisions about Obligationenrecht and corporate governance"*
- *"Validate the citation SR 235.1 Art. 6"*
- *"Build a legal stance on data breach notification requirements under Swiss law"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Federal Laws** | 4,873 statutes | Full accessible SR corpus from Fedlex |
| **Provisions** | 102,864 sections | Full-text searchable with FTS5 |
| **Legal Definitions** | 931 definitions | Extracted from statute text |
| **EU Cross-References** | 170 references | 64 EU directives and regulations |
| **Database Size** | ~141 MB | Optimized SQLite, portable |
| **SR Census** | 9,022 total entries | 4,873 ingestable + 4,149 PDF-only (documented) |
| **Weekly Drift Detection** | Automated | Freshness checks against Fedlex SPARQL |

**Verified data only** -- every provision is sourced from Fedlex (Swiss Federal Chancellery). Zero LLM-generated content.

### Key Legislation Covered

| Law | SR Number | Short Name | Significance |
|-----|-----------|------------|-------------|
| **Federal Act on Data Protection** | SR 235.1 | DSG | New data protection law (nFADP) effective Sep 1, 2023; replaces 1992 DPA; aligns with GDPR with Swiss-specific features |
| **Data Protection Ordinance** | SR 235.11 | DSV | Implementing ordinance for the DSG |
| **Federal Constitution** | SR 101 | BV | Art. 13 guarantees the right to privacy; foundational for all data protection law |
| **Code of Obligations** | SR 220 | OR | Core contract and company law; corporate governance provisions |
| **Swiss Criminal Code** | SR 311.0 | StGB | Art. 143bis criminalizes unauthorized computer access; Art. 143 covers data theft |
| **Telecommunications Act** | SR 784.10 | FMG | Regulates telecommunications services and infrastructure |
| **Administrative Procedure Act** | SR 172.021 | VwVG | Federal administrative procedure framework |
| **Public Procurement Act** | SR 172.056.1 | BoeB | Federal public procurement rules |

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from Fedlex official publications
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing -- the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by SR number + chapter/section
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
Fedlex SPARQL --> HTML Fetch --> Parse --> SQLite --> FTS5 snippet() --> MCP response
      ^                           ^                        ^
  Census discovery         Provision parser         Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search Fedlex by SR number | Search by plain language: *"Datenschutz Einwilligung"* |
| Navigate multi-chapter statutes manually | Get the exact provision with context |
| Manual cross-referencing between laws | `build_legal_stance` aggregates across sources |
| "Is this statute still in force?" -- check manually | `check_currency` tool -- answer in seconds |
| Find EU basis -- dig through EUR-Lex | `get_eu_basis` -- linked EU directives instantly |
| No API, no integration | MCP protocol -- AI-native |

**Traditional:** Search Fedlex -- Download PDF -- Ctrl+F -- Cross-reference with EU law -- Check three language versions -- Repeat

**This MCP:** *"What EU directives does the DSG implement?"* -- Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across 102,864 provisions with BM25 ranking |
| `get_provision` | Retrieve specific provision by SR number + chapter/section |
| `check_currency` | Check if statute is in force, amended, or repealed |
| `validate_citation` | Validate citation against database (zero-hallucination check) |
| `build_legal_stance` | Aggregate citations from statutes for a legal topic |
| `format_citation` | Format citations per Swiss conventions (full/short/pinpoint) |
| `list_sources` | List all available statutes with metadata |
| `about` | Server info, capabilities, and coverage summary |

### EU/International Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations linked to a Swiss statute |
| `get_swiss_implementations` | Find Swiss laws implementing a specific EU act |
| `search_eu_implementations` | Search EU documents with Swiss implementation counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check implementation status of EU directives in Swiss law |

---

## EU Law Integration

Switzerland is not an EU member state, but autonomously aligns with significant portions of EU law through bilateral agreements (notably the Bilateral I and II agreements with the EU) and voluntary adoption. This server tracks those relationships.

**170 cross-references** linking 23 Swiss statutes to EU law, covering 64 unique EU directives and regulations -- with bi-directional lookup.

| Metric | Value |
|--------|-------|
| **EU References** | 170 cross-references |
| **EU Documents** | 64 unique directives and regulations |
| **Swiss Statutes with EU Refs** | 23 statutes |
| **Directives** | 30 |
| **Regulations** | 34 |

### Most Referenced EU Acts

1. **Law Enforcement Directive** (2016/680) - 15 references
2. **Firearms Directive** (2017/853) - 14 references
3. **Lawyers Services Directive** (1998/5) - 12 references
4. **Professional Qualifications Directive** (2005/36) - 10 references
5. **Drone Regulation** (2019/947) - 9 references

### Swiss-EU Relationship Context

Unlike EU/EEA member states, Switzerland's relationship with EU law is based on:
- **Bilateral Agreements** -- Sectoral treaties covering free movement, air transport, research, Schengen/Dublin
- **Autonomous Adoption** -- Switzerland often voluntarily aligns domestic law with EU standards (e.g., nFADP aligns with GDPR)
- **Equivalence Decisions** -- EU adequacy decisions recognizing Swiss data protection standards
- **Schengen Association** -- Switzerland participates in Schengen, requiring adoption of related EU acquis

The EU tools help trace these alignment relationships -- essential for cross-border compliance work.

---

## Data Sources & Freshness

All content is sourced from the authoritative Swiss federal legal database:

- **[Fedlex](https://www.fedlex.admin.ch)** -- Official publication platform of the Swiss Federal Chancellery (Bundeskanzlei)
- **Data Discovery:** Fedlex SPARQL endpoint for systematic enumeration of the entire SR collection
- **HTML Fetching:** Individual act provisions retrieved from Fedlex HTML renderings

### Census Methodology

The database is built using a **census-first approach**:

1. **SPARQL Discovery** -- Query the Fedlex SPARQL endpoint to enumerate all 9,022 SR entries
2. **Classification** -- 4,873 entries have accessible HTML provisions; 4,149 are PDF-only (documented as inaccessible in `data/census.json`)
3. **Full Ingestion** -- All 4,873 accessible acts ingested with complete provision text
4. **Drift Detection** -- Weekly automated checks against Fedlex for new or amended legislation

### Language Note

Swiss federal law is published in three official languages: **German (DE)**, **French (FR)**, and **Italian (IT)** -- all three are equally authoritative. English translations exist for selected acts but are unofficial. This database primarily contains the German-language versions as published on Fedlex. For authoritative text in French or Italian, consult the corresponding Fedlex language version.

**Verified data only** -- every citation is validated against official Fedlex publications. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from official Fedlex publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Database covers German-language versions** -- for authoritative French or Italian text, verify against the corresponding Fedlex version
> - **4,149 SR entries are PDF-only** and not included -- verify coverage for your specific statute
> - **Verify critical citations** against the official SR text for court filings and formal legal work
> - **EU cross-references** reflect alignment relationships, not binding EU membership obligations
> - **Court case coverage is not included** -- do not rely on this for case law research

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [PRIVACY.md](PRIVACY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment (local npm install).

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/switzerland-law-mcp
cd switzerland-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run census                    # Run census against Fedlex SPARQL endpoint
npm run ingest                    # Ingest provisions from Fedlex
npm run build:db                  # Rebuild SQLite database
npm run drift:detect              # Check for new/amended legislation
npm run check-updates             # Check for amendments
npm run test:contract             # Run MCP contract tests
npm run validate                  # Lint + test + contract tests
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** ~141 MB (efficient, portable)
- **Coverage:** 54% of SR entries (4,873 of 9,022) -- remainder are PDF-only

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** -- MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** -- GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** -- HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** -- ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

### [@ansvar/automotive-cybersecurity-mcp](https://github.com/Ansvar-Systems/Automotive-MCP)
**Query UNECE R155/R156 and ISO 21434** -- Automotive cybersecurity compliance. `npx @ansvar/automotive-cybersecurity-mcp`

**70+ national law MCPs** covering Australia, Austria, Belgium, Brazil, Canada, China, Croatia, Czech Republic, Denmark, Finland, France, Germany, Ghana, Hungary, Iceland, India, Indonesia, Ireland, Israel, Italy, Japan, Kenya, Latvia, Lithuania, Luxembourg, Malaysia, Mexico, Netherlands, New Zealand, Nigeria, Norway, Philippines, Poland, Portugal, Romania, Russia, Singapore, Slovakia, Slovenia, South Africa, South Korea, Spain, Sweden, Switzerland, Thailand, Turkey, UAE, UK, US, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- French and Italian language version ingestion
- Court case law integration (BGE/ATF decisions)
- EU cross-reference expansion (bilateral agreement tracking)
- Historical statute versions and amendment tracking
- Cantonal law integration

---

## Roadmap

- [x] Census-first full corpus ingestion (4,873 laws, 102,864 provisions)
- [x] Fedlex SPARQL-based data discovery
- [x] EU/international law cross-references (170 references)
- [x] Legal definitions extraction (931 definitions)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [x] Weekly drift detection
- [ ] French (FR) and Italian (IT) language versions
- [ ] Court case law (BGE/ATF decisions)
- [ ] Historical statute versions (amendment tracking)
- [ ] Cantonal law integration
- [ ] Preparatory works (Botschaften)

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{switzerland_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Swiss Law MCP Server: AI-Powered Federal Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/switzerland-law-mcp},
  note = {Comprehensive Swiss federal legal database with 4,873 statutes, 102,864 provisions, and EU cross-references}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Statutes & Legislation:** Swiss Confederation (public domain under Swiss federal law)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server started as our internal reference tool for Swiss law -- turns out everyone building compliance tools has the same research frustrations.

So we're open-sourcing it. Navigating 4,873 federal statutes across three languages shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
