# Operations Hub Revamp Implementation Backlog

## Document Control
- Source PRD: `/Users/davidselva/Desktop/V1 LeanOps-Pro-MVP/docs/operations-platform-rebrand-prd.md`
- Last Updated: February 11, 2026
- Intended Tracker: Jira/Linear (ticket-ready format)
- Scope: Full Operations Hub genericization with robust Accounts model

## 1. Planning Assumptions
1. Existing API contracts remain backward compatible in this phase.
2. Persisted role enum value `cleaner` is retained for compatibility; UI label is `Operator`.
3. Google Sheets-backed and in-memory storage both remain supported.
4. Current branch already includes major portions of Epics 1 and 2; tickets below can be marked `Done` where already shipped.

## 2. Epic Summary
| Epic ID | Epic Name | Outcome | Priority |
| --- | --- | --- | --- |
| OPH-E1 | Brand and Terminology Foundation | Platform reads as generic Operations Hub across core flows | P0 |
| OPH-E2 | Accounts Domain Standardization | Enterprise-ready account model and workflows | P0 |
| OPH-E3 | Cross-Module Operations UX | Consistent multi-industry language across all modules | P1 |
| OPH-E4 | API/Data Compatibility and Migration Prep | Safe compatibility now, clean migration path next | P1 |
| OPH-E5 | Quality, UAT, and Release | Low-regression release with measurable adoption signals | P0 |

## 3. Detailed Ticket Breakdown

## OPH-E1 Brand and Terminology Foundation

### OPH-101 Remove legacy brand strings
- Priority: P0
- Estimate: S
- Story: As an operations user, I want all active UI and server defaults to use Operations Hub language so the product fits non-cleaning businesses.
- Dependencies: None
- Acceptance Criteria:
1. No visible `CleanOps` or cleaning-only branding appears in active user flows.
2. Navigation labels and page titles use generic operations terminology.
3. `rg -n "CleanOps|cleanops"` only returns archived docs or intentionally retained compatibility notes.

### OPH-102 Preserve compatibility aliases and role label mapping
- Priority: P0
- Estimate: S
- Story: As an admin, I need compatibility preserved for existing user records and bookmarked routes so upgrades are non-breaking.
- Dependencies: OPH-101
- Acceptance Criteria:
1. Stored role value `cleaner` continues to work without data migration.
2. UI consistently displays `Operator` for stored `cleaner` users.
3. Legacy route alias behavior remains available where defined.

### OPH-103 Align metadata and authentication copy
- Priority: P1
- Estimate: S
- Story: As a user, I want login and browser metadata to reflect Operations Hub so branding is consistent end-to-end.
- Dependencies: OPH-101
- Acceptance Criteria:
1. Browser title and app metadata reflect Operations Hub naming.
2. Login page copy, placeholders, and labels are industry-neutral.
3. Default admin onboarding copy uses operations terminology.

### OPH-104 Update seeds and defaults to neutral operations examples
- Priority: P0
- Estimate: M
- Story: As a new tenant, I want seed data that looks relevant to operations in any industry.
- Dependencies: OPH-101
- Acceptance Criteria:
1. Seeded clients, locations, services, and compliance examples are multi-industry.
2. No cleaning-specific sample data appears in seeded records.
3. Fresh environment boot creates fully coherent operations sample data.

## OPH-E2 Accounts Domain Standardization

### OPH-201 Expand account schema and storage mappings
- Priority: P0
- Estimate: M
- Story: As an operations manager, I want standardized account fields stored consistently so account records support real operational use.
- Dependencies: OPH-104
- Acceptance Criteria:
1. Shared schema includes legal, contact, ownership, support, billing, and governance fields.
2. In-memory and sheet storage can read/write all expanded fields.
3. `/api/clients` and `/api/clients/:id` return expanded fields without breaking existing consumers.

### OPH-202 Build robust “New Account” form sections
- Priority: P0
- Estimate: M
- Story: As a dispatcher/admin, I want a structured account intake form so data is complete at onboarding time.
- Dependencies: OPH-201
- Acceptance Criteria:
1. Form contains sections for Profile, Contact, Support/Billing, Requirements/Notes.
2. Required fields enforced: account name, type, contact name, contact email, contact phone.
3. Email and website validation errors are shown inline.
4. Payload normalizes optional values to null-safe backend values.

### OPH-203 Upgrade account detail and edit experience
- Priority: P0
- Estimate: M
- Story: As an account owner, I want to edit and review full account context in one place.
- Dependencies: OPH-201
- Acceptance Criteria:
1. Edit mode supports full field set parity with create form.
2. Read mode displays key profile/support/billing/governance details.
3. Save and cancel correctly preserve/reset form state.

### OPH-204 Improve accounts list for operational triage
- Priority: P0
- Estimate: M
- Story: As an operations coordinator, I want richer account list columns and search so I can quickly triage account readiness.
- Dependencies: OPH-201
- Acceptance Criteria:
1. List includes owner, payment terms, and contact channels.
2. Search filters by key fields (name/type/contact/owner/status/terms).
3. Empty-search-result state is shown clearly.
4. Status chips support Active/Prospective/Inactive display states.

### OPH-205 Add account-focused test coverage
- Priority: P1
- Estimate: M
- Story: As a maintainer, I need tests for account create/update/list behavior so future changes do not regress key workflows.
- Dependencies: OPH-202, OPH-203, OPH-204
- Acceptance Criteria:
1. API tests cover create/update with expanded fields.
2. Frontend tests cover required-field validation and error display.
3. Search/filter behavior is tested for list page.
4. CI fails when account validation contracts are broken.

## OPH-E3 Cross-Module Operations UX

### OPH-301 Genericize jobs and service terminology
- Priority: P1
- Estimate: M
- Story: As a user, I want job types and service labels to be industry-neutral so workflows fit my business context.
- Dependencies: OPH-101
- Acceptance Criteria:
1. Job create/edit/detail flows use generic service terminology.
2. No cleaning-only service names in settings catalogs.
3. Seed/mock job data reflects multiple operations contexts.

### OPH-302 Align locations and requirements terminology
- Priority: P1
- Estimate: S
- Story: As a supervisor, I want consistent naming between Accounts, Locations, and Requirements so the model is intuitive.
- Dependencies: OPH-101
- Acceptance Criteria:
1. “Properties” and “Compliance” are surfaced with chosen operations-friendly terms where intended.
2. Cross-page labels and helper text are consistent.
3. Links between Accounts, Locations, and Requirements remain intact.

### OPH-303 Refresh dashboard and schedule wording
- Priority: P1
- Estimate: S
- Story: As an operations lead, I want dashboard/schedule summaries worded for general operations rather than cleaning.
- Dependencies: OPH-101
- Acceptance Criteria:
1. Dashboard cards and schedule labels are operations-generic.
2. Status and KPI labels remain meaningful and consistent.
3. No cleaning-specific terms remain in these views.

### OPH-304 Standardize settings and admin copy
- Priority: P2
- Estimate: S
- Story: As an admin, I want settings language to match the new product positioning.
- Dependencies: OPH-101
- Acceptance Criteria:
1. Settings sections use generic operations terms.
2. Help text and placeholders are aligned with Operations Hub.
3. Existing settings behavior remains unchanged.

### OPH-305 Finalize operator portal naming and routing
- Priority: P1
- Estimate: S
- Story: As an operator user, I want a clearly named operator portal and stable login redirect behavior.
- Dependencies: OPH-102
- Acceptance Criteria:
1. Operator-role users land on `/operator` after login.
2. Existing route alias behavior does not break old bookmarks.
3. Operator portal copy is fully generic.

## OPH-E4 API/Data Compatibility and Migration Prep

### OPH-401 Lock API compatibility contract for revamp phase
- Priority: P1
- Estimate: S
- Story: As an integrator, I want stable API endpoints and response shapes during the rebrand phase.
- Dependencies: OPH-201
- Acceptance Criteria:
1. Existing route paths (`/api/clients`, `/api/jobs`, etc.) remain unchanged.
2. Added fields are non-breaking and optional for older consumers.
3. Backward-compatibility notes are documented in docs.

### OPH-402 Harden Google Sheets column/version handling
- Priority: P1
- Estimate: M
- Story: As an operator of sheet-backed environments, I want safe handling of expanded account columns so environments do not drift.
- Dependencies: OPH-201
- Acceptance Criteria:
1. Client sheet headers include all expected columns in correct order.
2. Read/write operations tolerate missing trailing columns in older sheets.
3. Initialization scripts create headers for fresh sheets accurately.

### OPH-403 Create migration design for role enum rename (future phase)
- Priority: P2
- Estimate: M
- Story: As a platform owner, I want a migration design from `cleaner` to `operator` so we can remove legacy values safely later.
- Dependencies: OPH-102
- Acceptance Criteria:
1. Technical design document defines migration steps, rollback, and compatibility window.
2. Impacted modules and risks are explicitly listed.
3. Cutover plan includes data migration and dual-read/dual-write strategy if needed.

### OPH-404 Document account field rename strategy for governance dates
- Priority: P2
- Estimate: S
- Story: As an API maintainer, I want a rename strategy for `coiExpiresOn` and `serviceAgreementExpiresOn` so naming stays domain-neutral long term.
- Dependencies: OPH-201
- Acceptance Criteria:
1. Decision recorded: keep names now or introduce versioned aliases.
2. Consumer impact and migration timeline documented.
3. Any aliasing plan includes acceptance tests.

## OPH-E5 Quality, UAT, and Release

### OPH-501 Enforce build and typecheck gates
- Priority: P0
- Estimate: S
- Story: As an engineering lead, I want mandatory quality gates so regressions are caught before release.
- Dependencies: All dev tickets
- Acceptance Criteria:
1. `npm run check` passes in CI.
2. `npm run build` passes in CI.
3. Merge blocked if either gate fails.

### OPH-502 Add smoke test script for critical workflows
- Priority: P0
- Estimate: M
- Story: As QA, I want a repeatable smoke suite for login, accounts CRUD, jobs, and requirements navigation.
- Dependencies: OPH-202, OPH-203, OPH-204, OPH-305
- Acceptance Criteria:
1. Smoke checklist or scripted flow covers admin login and operator login.
2. Accounts create/edit/list path validated end-to-end.
3. API auth and core page rendering checks included.

### OPH-503 Execute UAT and sign-off checklist
- Priority: P0
- Estimate: S
- Story: As product owner, I want UAT sign-off criteria so release confidence is explicit.
- Dependencies: OPH-502
- Acceptance Criteria:
1. UAT checklist completed for all key personas.
2. Any blockers are triaged and resolved or deferred with owner/date.
3. Sign-off recorded by product and engineering owners.

### OPH-504 Publish release notes and internal enablement brief
- Priority: P1
- Estimate: S
- Story: As customer-facing teams, we need concise release notes explaining terminology changes and compatibility behavior.
- Dependencies: OPH-503
- Acceptance Criteria:
1. Release notes summarize what changed, what stayed compatible, and known limitations.
2. Internal brief includes support FAQs for role label and terminology changes.
3. Documentation links are included in release comms.

### OPH-505 Define rollback and post-release monitoring plan
- Priority: P1
- Estimate: S
- Story: As operations and engineering, we need a rollback/monitoring plan for rapid response if issues appear after release.
- Dependencies: OPH-503
- Acceptance Criteria:
1. Rollback triggers and owner responsibilities are documented.
2. Post-release checks include auth success, accounts CRUD health, and error rate monitoring.
3. First 48-hour stabilization checklist is available.

## 4. Suggested Execution Order (One-Pass Plan)
1. Ship/verify all P0 tickets in OPH-E1 and OPH-E2.
2. Complete OPH-E5 quality gates and smoke coverage.
3. Address remaining P1 cross-module and compatibility tasks.
4. Create P2 migration-design artifacts for future schema cleanup.

## 5. Definition of Done (Program Level)
1. All P0 tickets accepted with evidence.
2. Build/typecheck green on mainline.
3. UAT sign-off complete.
4. Release notes published.
5. No Sev-1/Sev-2 regressions in first stabilization window.
