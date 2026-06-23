# Grantfinder

A platform for finding external grant and RFP programs, keeping them verified
and current, and coordinating how organizations apply—via research, in-house
pursuit, and an optional specialist marketplace.

## Language

**Opportunity**:
An external grant or RFP program an organization may pursue—the durable record
the platform maintains, usually from research; an organization MAY also create
one manually (e.g. an RFP received offline).
_Avoid_: Catalog entry (implementation), funding target, funding program

**Funding program** (deferred):
What a funder publishes for others to apply to when the organization acts as
sponsor rather than pursuer; out of v1 scope—use a separate model later, not an
**Opportunity**.
_Avoid_: Opportunity (v1 pursuit target)

**Opportunity kind**:
Whether an **Opportunity** is e.g. a grant, an RFP, or another funding
instrument type; used for filtering and workflow, not for separate persistence.
_Avoid_: Opportunity (the record itself)

**Opportunity match**:
The platform’s decision that a discovered or submitted record refers to an
existing **Opportunity**—by strong external identifier when present, else by
high-confidence heuristic, else kept separate with possible-duplicate hints.
_Avoid_: Tracked grant (per-run observation only)

**Opportunity verification**:
Review that confirms an **Opportunity** (especially a manual or org-submitted
one) is fit to become a **Public opportunity**; in v1 this is the only
platform verification gate. MAY be performed by platform agents or outsourced
via a **Job**.
_Avoid_: Published enrichment (single-field share), research request

**Scenario verification** (v2):
Review for **Public scenario** quality and safety; deferred in v1—public
scenarios MAY publish under org attestation until a separate pipeline exists.
_Avoid_: Opportunity verification (v1 uses this instead)

**Public opportunity**:
An **Opportunity** listed on the platform-wide catalog after **Opportunity
verification**; distinct from org-private records and per-field **Published
enrichment**.
_Avoid_: Organization opportunity context, tracked grant

**Tracked grant**:
A single research run’s observation of a funding source, including queue state,
request-level history, and raw findings for that run.
_Avoid_: Opportunity (the durable record), catalog grant

**Organization opportunity context**:
An organization’s private view of an **Opportunity**—pursuit notes, tags, fit
reasoning, feasibility, contacts, and research enrichment that belong to that
org until explicitly published field-by-field.
_Avoid_: Opportunity (the platform record), proposal workspace

**Published enrichment**:
A single org-authored field or fact an organization chooses to contribute to the
platform **Opportunity** (e.g. a deadline update) while keeping other fields
private.
_Avoid_: Sharing the whole opportunity, publishing the org context

**Proposal workspace**:
An organization’s pursuit control room for one **Opportunity**—qualification,
drafting coordination, outreach, submission, and outcome. At most one per
organization per **Opportunity** may be **Active**; older workspaces remain as
archives or drafts.
_Avoid_: Opportunity, organization opportunity context, application workspace

**Active proposal workspace**:
The single proposal workspace an organization treats as the current pursuit for
an **Opportunity**; only one may be active per organization per opportunity in
v1.
_Avoid_: Archived proposal workspace, organization opportunity context

**Archived proposal workspace**:
A non-active proposal workspace retained for history; may be reactivated or left
read-only while a new active workspace is created.
_Avoid_: Active proposal workspace

**Application workspace**:
The canonical draft surface for a grant or RFP application (sections, content,
funder schema alignment); MAY exist on its own before a **Proposal workspace**
is opened.
_Avoid_: Proposal workspace, opportunity

**Repository binding**:
An organization's linked GitHub repository (and root path, default
`grantfinder/`) where pursuit artifacts are written; scoped to pursuit, not to
the platform **Opportunity**.
_Avoid_: Opportunity, published enrichment

**Job**:
A marketplace posting where a **Requester** asks **Specialists** to perform
scoped grant-application work, optionally linked to a **Proposal workspace** and
**Opportunity**.
_Avoid_: Proposal workspace, engagement, research request

**Offer**:
A **Specialist**’s proposal to perform work described in a **Job**.
_Avoid_: Engagement, job

**Engagement**:
The accepted working relationship between **Requester** and **Specialist** after
an **Offer** is accepted, including funding state until paid via x402.
_Avoid_: Job, offer, proposal workspace

**Organization**:
The tenant that owns org-scoped research, opportunities, and pursuit; in v1 each
user belongs to exactly one **Organization** (multi-org membership planned for v2).
_Avoid_: User, account, workspace

**Requester**:
An authenticated party acting on behalf of an **Organization** to seek funding
or post marketplace work.
_Avoid_: User, operator

**Specialist**:
An authenticated party offering grant-application services on the marketplace.
_Avoid_: Contractor, vendor

**Platform administrator**:
An in-house staff identity with platform-wide capability to manage **Feature
flags**; authenticated through the same Privy login as any user but recognized as
staff only when its Privy user ID is in the configured administrator allowlist.
Orthogonal to a user's **Requester**/**Specialist** role and not stored on the
user record.
_Avoid_: operator, product manager, user, role

**Research scenario**:
A reusable research configuration describing who the organization is and what
funding it seeks; shared among members of that **Organization** by default.
_Avoid_: Research request, opportunity

**Public scenario**:
A **Research scenario** an organization publishes for any platform user to run—e.g.
when the org no longer pursues it privately or wishes to contribute it as
something worth pursuing in the open.
_Avoid_: Built-in scenario (platform-provided), research request

**Research request**:
A single execution of funding research with live progress, steering, and
outputs; may start from a **Research scenario**, from an **Opportunity**, or
ad hoc.
_Avoid_: Research scenario, tracked grant

**Feature flag**:
A named platform toggle that shows or hides a single new frontend feature for a
chosen audience; it does not affect the rest of the application. Each flag
carries a default state the **Platform administrator** sets at creation (off for
a new feature, on when the flag instead restricts an existing one) plus
**Feature targeting** entries, and is resolved per user at session bootstrap.
Managed only by a **Platform administrator**.
_Avoid_: experiment, A/B test, rollout percentage

**Feature targeting**:
The audience rules on a **Feature flag**—per **Organization**, per user, or per
**Requester**/**Specialist** role—each setting the feature on or off; the most
specific match wins (user over organization over role over the flag default).
_Avoid_: cohort assignment, rollout bucket, variant

## Relationships

- A **Research request** produces one or more **Tracked grants**
- Each **Tracked grant** links to at most one **Opportunity** when a canonical
  match exists
- Many **Tracked grants** (across runs and users) MAY link to the same
  **Opportunity** when matching identifies the same funding source
- The platform **Opportunity** holds normalized public funding facts (title,
  sponsor, deadlines, eligibility summary, source citations, freshness) plus
  **Published enrichment** from any organization
- Each **Organization** MAY maintain **Organization opportunity context** on
  opportunities it researches or pursues
- Publishing is **per field**: an organization MAY promote individual facts
  (e.g. a deadline change) without publishing fit notes or other private fields
- An **Organization** MAY hold **Organization opportunity context** without a
  **Proposal workspace** while watching or researching (e.g. bookmarks, fit
  notes, queue state)
- A **Proposal workspace** belongs to one **Organization** and one **Opportunity**;
  an organization MAY have many proposal workspaces for the same opportunity
  over time, but at most one **Active proposal workspace** at a time; others are
  archives or drafts and are not discarded when a new pursuit starts
- A **Proposal workspace** layers on that org’s **Organization opportunity context**
  when pursuit becomes active
- A **Proposal workspace** coordinates full pursuit; draft document content lives
  in a linked **Application workspace** (not inside the proposal workspace itself)
- An **Application workspace** MAY start with no **Opportunity** (standalone draft)
- When pursuit begins, the user picks or creates an **Opportunity**, MAY open a
  **Proposal workspace**, and links the existing **Application workspace** to
  that pursuit
- A **Proposal workspace** SHOULD have at most one primary **Application workspace**
  for v1
- An organization MAY pursue entirely in-house: **Proposal workspace** and
  platform tools without any **Job**
- A **Job** is an outsourcing slice of pursuit work, not a substitute for the
  **Proposal workspace**; zero or more **Jobs** MAY link to one **Proposal workspace**
- A **Job** receives one or more **Offers**; accepting one **Offer** creates an
  **Engagement**
- An **Engagement** remains open until completed or withdrawn; reactivating an
  **Archived proposal workspace** SHALL reattach existing engagements rather than
  create duplicates
- Resuming pursuit is the organization's choice: **reactivate** an archived
  workspace to continue the same effort, or start a new active workspace as a new
  generation (default for a fresh pursuit)
- A **Research scenario** is a template; each run creates a **Research request**
- **Research scenarios** are visible to all members of the owning **Organization**;
  an organization MAY publish one as a **Public scenario** for platform-wide use
- A **Research request** produces **Tracked grants**; each follow-up research
  run on an **Opportunity** creates a new linked **Research request** (never
  appends to an in-flight request); opportunity detail groups linked runs
- An **Organization** MAY create a manual **Opportunity** (e.g. an RFP received
  offline); it remains org-visible until **Opportunity verification** makes it a
  **Public opportunity**
- **Opportunity verification** MAY use platform tools/agents or a marketplace
  **Job** assigned to a **Specialist** or agent
- A **Repository binding** lives on **Organization opportunity context** while
  watching and follows the **Proposal workspace** when pursuit is active; the
  **Application workspace** inherits the effective binding for generated artifacts
- A **Tracked grant** MAY record the binding snapshot from its research run
- On research upsert, the platform SHALL match by strong external ID (program ID,
  notice number, canonical URL) when present; MAY merge on sponsor + title +
  deadline only above a confidence threshold; otherwise create a separate
  **Opportunity** and MAY surface possible-duplicate hints for manual review
- A **Platform administrator** is the only actor who may create, modify, or
  delete **Feature flags**; the capability is additive and does not alter the
  **Requester**/**Specialist** identity model
- A **Feature flag** governs only its own feature; absent any matching **Feature
  targeting**, a user falls back to the flag default and the rest of the
  application is unaffected
- A **Feature flag** is resolved per user at session load: **Feature targeting**
  is evaluated most-specific-first (user, then **Organization**, then role, then
  the flag default) and only the resolved set of enabled features reaches the
  browser—never the targeting rules
- **Feature flags** carry no percentage rollout and persist no per-user
  assignment; because targeting is explicit, each user resolves the same way on
  every load

## Example dialogue

> **Dev:** "The same NIH grant showed up in three research requests — how many
> records do we store?"
> **Domain expert:** "One **Opportunity**. Three **Tracked grants** linked to
> it, each preserving what that run found."

> **Dev:** "Org A says the deadline moved but they're not pursuing — what can Org
> B see?"
> **Domain expert:** "Only what A **published** — e.g. the new deadline on the
> platform **Opportunity**. A's fit notes and no-bid decision stay in A's
> **Organization opportunity context**."

> **Dev:** "They bookmarked a grant but haven't decided to bid — is that a
> proposal workspace?"
> **Domain expert:** "No — that's **Organization opportunity context** only.
> Open a **Proposal workspace** when they're actively pursuing."

> **Dev:** "Can they pursue without hiring anyone on the marketplace?"
> **Domain expert:** "Yes — **Proposal workspace** and in-house drafting are
> enough. A **Job** is only when they want a **Specialist** to take a scoped
> slice of the work."

> **Dev:** "They ran the logistics scenario three times this month — how many
> objects?"
> **Domain expert:** "One **Research scenario**, three **Research requests**,
> each with its own **Tracked grants**."

> **Dev:** "They pasted in an RFP from email — is it on the public catalog?"
> **Domain expert:** "Not until **Opportunity verification**. Until then it's
> their manual **Opportunity** and **Organization opportunity context**."

> **Dev:** "Where do they edit Section 3 of the application?"
> **Domain expert:** "In the **Application workspace**. The **Proposal workspace**
> is where they track outreach, stage, and whether they're still pursuing."

> **Dev:** "They started drafting before the RFP was in the catalog — how do we
> link it later?"
> **Domain expert:** "Create or pick an **Opportunity**, open **Proposal workspace**
> if they're pursuing for real, and attach the standalone **Application workspace**."

> **Dev:** "Where is the GitHub repo configured — on the public Opportunity?"
> **Domain expert:** "No — **Repository binding** is org pursuit config on
> **Organization opportunity context** or **Proposal workspace**, inherited by
> the **Application workspace**."

> **Dev:** "They gave up last year and started again — do we delete the old
> pursuit?"
> **Domain expert:** "No — archive it. One **Active proposal workspace**; the old
> one stays readable with its drafts and jobs."

> **Dev:** "They re-open last year's workspace but the specialist engagement is
> still funded — what happens?"
> **Domain expert:** "Reactivate the archive and reattach the same **Engagement**.
> It stays open until completed or withdrawn — no duplicate job."

> **Dev:** "We turned the new catalog panel on for a beta **Organization**, but
> one teammate there shouldn't see it yet — can we do both?"
> **Domain expert:** "Yes. One **Feature flag** with **Feature targeting** on for
> that **Organization** and a user-level override hiding it for that person. Most
> specific wins, so the user rule beats the org rule."

## Flagged ambiguities

- Measuring **Feature flag** impact is out of scope for v1: the platform has no
  analytics or event pipeline today, so flags ship without built-in measurement.
- Deferred past v1: **Funding program** (funder-as-sponsor), **Scenario
  verification**, multi-org membership (v1: one **Organization** per user).
