# Product Requirements Document (PRD)
## Operations Hub Revamp (Generic, Multi-Industry)

### Document Control
- Version: 2.0
- Last Updated: February 11, 2026
- Product: Operations Hub
- Status: Ready for implementation and iterative release

### 1. Summary
This PRD defines the revamp from a cleaning-specific application into a generic operations platform that supports multiple business types (field services, logistics, healthcare ops, retail operations, manufacturing support, and professional services). The objective is to preserve existing workflows while broadening terminology, data capture, and usability for any operations team.

### 2. Problem Statement
The current platform originally reflects a cleaning-only business context. This creates adoption friction for non-cleaning operations teams due to:
- Narrow branding and language.
- Limited account data capture for enterprise operations.
- Perceived mismatch between platform capability and industry use.

### 3. Product Vision
Operations Hub should be the default daily control plane for operational teams, regardless of industry, by providing:
- Neutral, professional operations terminology.
- Flexible account and location management.
- Assignment, scheduling, compliance/requirements, and team visibility workflows.
- Strong compatibility with existing seeded/runtime behavior.

### 4. Goals
1. Replace legacy cleaning-specific language and branding with generic operations language across frontend and backend defaults.
2. Preserve compatibility for existing runtime routes, auth role values, and data contracts.
3. Upgrade the Accounts area to a robust standard enterprise model with structured fields.
4. Keep implementation low-risk with clear acceptance criteria and backward compatibility.

### 5. Non-Goals
1. Full persistence-layer enum migration in this phase (stored `cleaner` role value remains for compatibility).
2. Historical tenant data rewrite or forced migration.
3. Full visual redesign or theme replacement.
4. New modules outside current operational scope (billing engine, CRM, invoicing, etc.).

### 6. Primary Users
- Operations Manager
- Dispatcher / Coordinator
- Supervisor / Team Lead
- Operator / Field Worker
- System Administrator

### 7. Scope
#### In Scope
1. Platform-wide terminology and brand update to Operations Hub.
2. Navigation and route updates reflecting generic operations language.
3. Role label mapping from stored `cleaner` to displayed `Operator`.
4. Accounts model expansion and UX hardening:
   - Legal identity fields.
   - Contact and ownership fields.
   - Support, billing, and payment fields.
   - Requirement date tracking and internal notes.
5. Seed data and mock data updates to industry-neutral examples.
6. Compatibility aliasing (`/cleaner` route alias behavior retained where applicable).

#### Out of Scope (This Release)
1. Breaking API contract changes.
2. Multi-tenant schema redesign.
3. Automated migration scripts for existing production spreadsheets/datastores.

### 8. Functional Requirements
#### 8.1 Platform Rebrand and Genericization
1. No active UI should show legacy CleanOps naming.
2. Metadata, login copy, navigation labels, and key page headers must reflect operations-generic language.
3. Seed/admin defaults should use operations-generic credentials and labels.

#### 8.2 Account Data Model (Standard Fields)
Each account record should support:
1. Core identity:
   - `name` (required)
   - `legalName` (optional)
   - `dba` (optional)
   - `type` (required)
   - `status` (required)
2. Primary contact:
   - `contact` (required)
   - `contactTitle` (optional)
   - `contactEmail` (required)
   - `contactPhone` (required)
3. Ownership and support:
   - `accountOwner` (optional)
   - `website` (optional)
   - `supportEmail` (optional)
   - `supportPhone` (optional)
4. Address and billing:
   - `headquartersAddress` (optional)
   - `billingAddress` (optional)
   - `paymentTerms` (optional)
   - `taxId` (optional)
5. Operational governance:
   - `coiExpiresOn` (optional date; currently surfaced as “Credential Expires On”)
   - `serviceAgreementExpiresOn` (optional date; currently surfaced as “Master Agreement Expires On”)
   - `notes` (optional)

#### 8.3 Accounts UX Requirements
1. Account Create page must capture all standard fields with clear grouped sections.
2. Account Edit page must support complete update of the same field set.
3. Account List page must expose high-value operational fields (owner, contact channels, payment terms, status).
4. Accounts search must support filtering by key business fields (name, type, contact, owner, status, terms).
5. Validation must enforce required fields and basic format checks:
   - Required: `name`, `type`, `contact`, `contactEmail`, `contactPhone`
   - Email format for email fields
   - URL format for website

#### 8.4 Compatibility Requirements
1. Existing API endpoints remain stable (`/api/clients`, etc.).
2. Existing role persistence remains unchanged (`cleaner` stored enum) while UI displays “Operator”.
3. Legacy route aliases remain available where already used.

### 9. Technical Requirements
1. Shared schema, storage layer, and sheet mappings must support expanded account columns.
2. In-memory and sheet-backed storage must both read/write expanded account fields.
3. Build and type-check must pass without introducing regressions.
4. Existing seeded environments should remain bootable.

### 10. Acceptance Criteria
1. Branding/terminology:
   - No visible legacy brand copy in active pages.
2. Accounts create/edit/list:
   - All new standard fields available and persisted.
   - Required field and format validation enforced.
   - List includes richer operational context.
3. Backend compatibility:
   - `/api/clients` returns expanded account fields.
   - Existing auth and role routing behavior still works.
4. Quality gates:
   - `npm run check` passes.
   - `npm run build` passes.
   - Basic authenticated API smoke checks succeed.

### 11. Success Metrics
1. 100% removal of legacy branding in active user flows.
2. 0 critical auth/routing regressions after release.
3. >90% of newly created accounts include complete core contact fields (name/email/phone).
4. Reduction in manual follow-up required for account onboarding completeness.

### 12. Rollout Plan
1. Phase 1 (Completed/Current):
   - Generic terminology and brand rollout.
   - Seed and metadata genericization.
2. Phase 2 (Current):
   - Robust Accounts model and UX.
   - Validation hardening and list/detail enrichment.
3. Phase 3 (Next):
   - Optional persisted enum migration planning (`cleaner` -> `operator`) with migration scripts.
   - Historical data normalization utilities.

### 13. Risks and Mitigations
1. Risk: Existing environments with old schema-like assumptions may show partial account fields.
   - Mitigation: keep fields optional and backward-compatible, default to safe null handling.
2. Risk: Confusion between displayed Operator label and stored `cleaner` role.
   - Mitigation: document compatibility mapping and plan explicit migration phase.
3. Risk: Inconsistent account data quality across teams.
   - Mitigation: required fields and front-end validation for core contact profile.

### 14. Open Questions
1. Should `coiExpiresOn` and `serviceAgreementExpiresOn` be renamed at API level now, or deferred to migration phase?
2. Should account status options be centrally configurable by admins?
3. Do we need per-industry templates that prefill account type, required documents, and standard services?
