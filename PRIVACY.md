# Privacy & Client Confidentiality

**IMPORTANT READING FOR LEGAL PROFESSIONALS**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Swiss legal professional rules.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- Swiss Bar Association (SAV/FSA) and cantonal bar rules require strict confidentiality (Berufsgeheimnis / Secret professionnel) and data handling controls

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/switzerland-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/switzerland-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://switzerland-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text, provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Switzerland)

### Federal Act on the Freedom of Movement for Lawyers (BGFA/LLCA) and SAV Rules

Swiss lawyers (Rechtsanwälte / Avocats) are bound by strict confidentiality rules under the Federal Act on the Freedom of Movement for Lawyers (BGFA/LLCA, Article 13) and cantonal bar rules.

#### Berufsgeheimnis / Secret Professionnel (Professional Secrecy)

- All attorney-client communications are protected by professional secrecy under BGFA Article 13
- Professional secrecy is also protected under the Swiss Criminal Code (Article 321)
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected
- Information that could identify clients or matters must be safeguarded
- Professional secrecy cannot be waived without client consent and bar authority approval

### nDSG and Client Data Processing

Under the **nDSG (New Federal Act on Data Protection, nFADP, in force since September 1, 2023)**:

- You are the **Controller** (Verantwortlicher) when processing client personal data
- AI service providers (Anthropic, Vercel) may be **Processors** (Auftragsbearbeiter)
- A **data processing agreement** is required under nDSG Article 9
- Cross-border data transfers must comply with nDSG Article 16 requirements (adequate country list or appropriate safeguards)
- The **Federal Data Protection and Information Commissioner (FDPIC / EDÖB)** oversees compliance

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does the Obligationenrecht say about contractual liability?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties for insider trading under Swiss financial market law?"
```

- Query pattern may reveal you are working on a FINMA-related matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases with proper DPAs
- Swiss banking secrecy and professional secrecy impose particularly strict requirements

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (Swisslex, Weblaw, Schulthess)

### For Large Firms / Corporate Legal

1. Negotiate DPAs with AI service providers under nDSG Article 9
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns

### For Government / Public Sector

1. Use self-hosted deployment, no external APIs
2. Follow Swiss government information security requirements (NCSC guidelines)
3. Air-gapped option available for classified matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/switzerland-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **SAV/FSA Guidance**: Consult Swiss Bar Association (SAV/FSA) or cantonal bar ethics guidance

---

**Last Updated**: 2026-02-22
**Tool Version**: 1.0.0
