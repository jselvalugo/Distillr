# n8n Workflow Architecture (Operations Hub)

## Goal
Provide full-lifecycle management of n8n workflows from the Automations module with admin-managed connection governance: register, configure, sync state, activate/pause, run, and monitor.

## Architecture Layers
1. Control Plane (Operations Hub)
- Source of truth for workflow metadata, ownership, and operational status.
- Persists records in `Automations` sheet (and in-memory fallback for local mode).
- Persists n8n connections in `N8NConnections` sheet, scoped per environment.
- Exposes authenticated APIs for UI and downstream automation governance.

2. Integration Layer
- `server/n8n-client.ts`: typed n8n API client with auth, timeout, error handling, and endpoint fallbacks.
- `server/automation-orchestrator.ts`: business orchestration between local records and remote n8n state.

3. Execution Plane (n8n)
- Actual workflow execution runtime.
- Trigger and run history owned by n8n; surfaced into Operations Hub through sync and execution APIs.

## API Contracts Implemented
- `GET /api/integrations/n8n/connections`
- `GET /api/integrations/n8n/connections/:environment`
- `PUT /api/integrations/n8n/connections/:environment`
- `POST /api/integrations/n8n/connections/:environment/test`
- `GET /api/automations/connection/health`
- `POST /api/automations/:id/sync`
- `POST /api/automations/:id/activate`
- `POST /api/automations/:id/pause`
- `POST /api/automations/:id/run`
- `GET /api/automations/:id/executions?limit=20`

## Data Model
Current local model (`AutomationWorkflow`) stores:
- identity: `id`, `name`, `n8nWorkflowId`, `n8nInstanceUrl` (deprecated override field)
- runtime config: `triggerType`, `environment`, `webhookPath`, `schedule`
- governance: `status`, `owner`, `tags`, `notes`
- observability: `lastRunAt`, `lastRunStatus`, `createdAt`, `updatedAt`

n8n connection model (`N8NConnection`) stores:
- identity: `environment`, `baseUrl`
- credentials: `encryptedApiKey`, `keyLastFour`, `hasApiKey`
- governance: `updatedByUserId`, `updatedAt`
- validation: `lastValidatedAt`, `lastValidationStatus`, `lastValidationMessage`

## Security Model
- API access requires authenticated session.
- Admin-only users can create/update n8n credentials; all authenticated users can read status and operate workflows.
- n8n credentials are encrypted at rest using `N8N_CONNECTION_SECRET` (AES-256-GCM).
- API key plaintext is never returned by API; only masked key metadata (`keyLastFour`) is exposed.
- Runtime resolves connection by workflow environment from managed records first.
- Environment variable fallback (`N8N_BASE_URL` + `N8N_API_KEY`) is used only when no managed connection exists.
- Per-workflow `n8nInstanceUrl` is deprecated and ignored by runtime orchestration.

## Operational Flow
1. Create workflow record in Automations.
2. Admin configures environment-specific n8n connection in Settings > Integrations.
3. Workflow environment resolves to managed connection at runtime.
4. Sync from n8n to align name/status/tags.
5. Activate/Pause from Operations Hub.
6. Trigger run from Operations Hub.
7. Inspect execution list and run status.

## Next Build Steps (to reach full platform coverage)
1. Add workflow versioning snapshots (definition JSON + diff history).
2. Add role-based permissions (`view`, `operate`, `admin`) for workflow actions.
3. Add deployment environments with promotion gates (`dev -> staging -> prod`).
4. Add alerting policies (failure thresholds, escalation routing).
5. Add audit log stream for every control-plane action.
6. Add typed input/output schemas per workflow for safer triggering.
