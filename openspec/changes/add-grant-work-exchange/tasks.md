## 1. Domain and persistence groundwork

- [ ] 1.1 Add persistent organization, personnel, invite, and organization-prefill models to the platform types and store layer
- [x] 1.2 Add durable grant report, grant catalog entry, and bookmark models with promotion paths from research output
- [x] 1.3 Add application workspace, workspace section, and document-type models with draft/proposal lifecycle state
- [x] 1.4 Add funder-schema, custom-template, and agent-provider-connection models with ownership and audit fields

## 2. Organization knowledge base

- [x] 2.1 Add service-layer APIs for organization profile read/write, structured field validation, and notification preferences
- [ ] 2.2 Add personnel and invite-link workflows with permission-gated access rules
- [ ] 2.3 Feed organization prefills into new workspace creation and eligible research/scout requests

## 3. Grant intelligence hub

- [x] 3.1 Separate report views from durable catalog views in the service layer and browser data contracts
- [x] 3.2 Add promotion flows from tracked research results into catalog entries
- [x] 3.3 Add catalog search, bookmark, and grant-detail endpoints for curated and promoted grants

## 4. Application workspaces

- [x] 4.1 Add workspace creation flows for curated grants and generic document-type entry points
- [x] 4.2 Add structured section persistence, section editing, and draft/proposal lifecycle transitions
- [x] 4.3 Add organization-prefilled sections and section-level AI generation/revision actions

## 5. Funder schemas and templates

- [x] 5.1 Add curated funder-specific schema support to grant catalog entries
- [x] 5.2 Render per-section prompts, examples, and validation metadata in the application workspace UI
- [x] 5.3 Add the first user-created custom template flow without making it a dependency for curated grants

## 6. Marketplace exchange integration

- [x] 6.1 Extend marketplace request types so a service request can target a grant, workspace, or workspace section
- [x] 6.2 Add specialist role targeting for researcher, writer, reviewer, and submission-specialist work
- [x] 6.3 Attach offers and funded engagements to the targeted artifact scope in browser, REST, and JSON-RPC flows

## 7. Agent provider connections

- [x] 7.1 Add organization- and user-scoped BYOK / OAuth provider connection management
- [x] 7.2 Add policy checks and auditable execution records for agent-backed actions on reports and workspaces
- [x] 7.3 Expose provider-aware research and section-generation actions in the browser and API surfaces

## 8. Validation

- [ ] 8.1 Add tests for organization persistence, prefills, personnel, and invite permissions
- [x] 8.2 Add tests for report-to-catalog promotion, bookmarks, and grant-detail retrieval
- [x] 8.3 Add tests for structured workspace lifecycle, section generation, and schema-driven validation
- [x] 8.4 Add tests for artifact-scoped marketplace requests and provider-connection audit trails
- [x] 8.5 Run full checks and validate the OpenSpec change
