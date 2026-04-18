---
name: prd-ai-agents
description: >
  Create comprehensive Product Requirements Documents (PRDs) for AI agent systems,
  multi-agent platforms, and autonomous workflow applications. Use this skill whenever
  the user wants to document an AI-powered product with agents, tools, memory systems,
  orchestrators, or autonomous workflows. Triggers on: create a PRD, write requirements,
  document my AI platform, spec my agent system, PRD for my app, or any request to
  produce technical documentation for a system involving LLMs, agents, or automation
  pipelines. Always use this skill when the product involves Claude API, multi-agent
  orchestration, or agentic workflows, even if the user does not explicitly say PRD.
---

# PRD for AI Agent Systems

A skill for creating complete, unambiguous Product Requirements Documents for platforms built on AI agents, orchestrators, and autonomous workflows. The output must be detailed enough for a developer to build the system in Cursor or Windsurf without needing additional clarification.

---

## PRD Structure

Always produce the PRD in this exact order. Never skip sections.

### 1. Executive Summary
- Product name and tagline
- Problem it solves
- Target user (personal use, SaaS, enterprise)
- Core value proposition in 3 sentences max

### 2. Product Overview
- What the product does end-to-end
- Primary workflow narrative (user journey from input to output)
- What the product does NOT do (explicit scope boundaries)
- Current version scope vs future versions

### 3. Technical Architecture
- Frontend stack with justification
- Backend stack with justification
- Database and storage solutions
- Real-time communication layer
- Queue and async processing
- External APIs and integrations
- Deployment environment

### 4. Agent System Design
For each agent, document:
- **Name and role**: What this agent is responsible for
- **Trigger condition**: When it activates in the flow
- **Input**: Exactly what data it receives (field names and types)
- **Tools available**: List of tools/functions it can call
- **Processing logic**: How it reasons and what decisions it makes
- **Output**: Exactly what data it produces (field names and types)
- **Auto-evaluation criteria**: How it validates its own output
- **Max retry attempts**: Number of automatic retries before escalating
- **Context fields consumed**: Which fields from shared state it reads
- **Context fields written**: Which fields it writes to shared state

### 5. Tool Definitions
For each tool available to agents:
- **Tool name**: snake_case identifier
- **Description**: What it does in one sentence
- **Input parameters**: Name, type, required/optional, description
- **Output**: Return type and structure
- **External API called**: If applicable, which API and endpoint
- **Error handling**: What happens on failure
- **Rate limiting**: If applicable

### 6. Shared State Schema (Context Document)
The JSON structure passed between agents:
- All top-level keys with types and descriptions
- Which agent writes each key
- Which agents read each key
- Required vs optional fields
- Example populated document

### 7. Database Schema
For each table:
- **Table name**: snake_case, plural
- **Purpose**: One sentence description
- **Columns**: name, type, nullable, default, description
- **Indexes**: Which columns are indexed and why
- **Foreign keys**: Relationships to other tables
- **RLS policies**: Row-level security rules if applicable

Reference the database-schema skill for detailed PostgreSQL conventions.

### 8. API Endpoints
For each endpoint:
- Method and path
- Authentication required
- Request body schema
- Response schema (success and error)
- Which agent or service handles it

### 9. Orchestration Flow
- Visual representation of the full flow (described in text)
- Sequential vs parallel execution rules
- How parallelism is triggered (multiple outputs from one node)
- Checkpoint and approval logic
- Error handling and retry behavior
- State persistence between nodes

### 10. User Interface Specifications
For each screen/view:
- Screen name and purpose
- Components and their behavior
- Data displayed and its source
- User actions available
- State transitions

### 11. Memory and Knowledge System
- What gets stored in long-term memory
- Schema for memory records
- How agents query memory
- How memory is updated after each execution
- Confidence scoring system
- Approval workflow for new knowledge entries

### 12. Security Requirements
- Authentication and authorization model
- Credential encryption standards
- Data isolation between users
- LGPD/GDPR compliance requirements
- API key management
- Audit logging

### 13. Non-Functional Requirements
- Performance targets (response times, throughput)
- Scalability approach
- Availability requirements
- Cost constraints and optimization
- Monitoring and observability

### 14. Open Decisions
List any architectural decisions still pending with:
- Decision title
- Options considered
- Recommendation
- Blocking dependency

---

## Writing Standards

**Be specific, never vague.** "The agent analyzes the product" is wrong. "The agent calls `search_web(query)` and `read_page(url)` tools, extracts structured data matching the ProductAnalysis schema, and writes results to `state.product_analysis`" is correct.

**Use exact field names.** Every reference to data must use the actual field name that will appear in code. No generic references like "the product data" — always `state.product.name`, `state.product.affiliate_link`, etc.

**Document every edge case.** For each agent and each tool: what happens when it fails? What happens when input is missing? What happens when the output doesn't meet quality criteria?

**Separate concerns clearly.** Frontend never contains business logic. Agents never directly access the database — they read/write shared state. Tools are stateless functions. Orchestrator only coordinates — it doesn't process data.

**Version everything.** The PRD must specify which version of each external dependency is used: Claude model version, library versions, API versions.

---

## Context Gathering

Before writing the PRD, extract or ask for:

1. Complete list of agents and their roles
2. All external APIs and integrations
3. Database entities and relationships
4. User interface screens and flows
5. Authentication model
6. Deployment target
7. Performance requirements
8. Any decisions still pending

If the conversation already contains this information, extract it directly — do not ask questions that were already answered.

---

## Output Format

Produce the PRD as a structured Markdown document with:
- H1 for the product name
- H2 for each major section
- H3 for subsections
- Code blocks for schemas, JSON examples, and SQL
- Tables for database columns and API parameters
- Bullet lists for enumerated items

If producing a .docx file, follow the docx skill conventions.

---

## References

Read these reference files when needed:
- `references/agent-patterns.md` — Common agent design patterns and anti-patterns
- `references/state-schema-examples.md` — Example shared state documents for different system types
