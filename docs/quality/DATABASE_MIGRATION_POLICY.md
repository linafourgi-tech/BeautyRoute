# Database Migration Policy

**Document type:** Process rule, adopted 2026-08-03 as part of the Phase 12 Security Review (finding H-2). Governs how future `supabase/migrations/*.sql` files may be written — not a record of a specific incident (see the Security Review report for that).

## Rule: dev/test identity data must never reach a migration that targets a real, shared workspace

Migrations in this repository are applied directly to the one real, linked Supabase project (there is no separate staging project — see the Phase 12 Security Review's H-2 finding for why that matters). A migration that inserts a `workspace_staff` row, seeds an auth profile, or grants membership for local-development or testing convenience must follow **both** of these rules:

1. **Prefer a local-only mechanism over a migration entirely.** Local dev-auth bootstrapping (e.g. `src/lib/devAuth.js`, gated behind `import.meta.env.DEV`) should seed whatever it needs via a script the developer runs against their own local Supabase instance (`supabase start`), or via the Supabase Studio UI locally — not via a file that gets applied to the shared project the moment it's pushed.
2. **If a migration-based seed is unavoidable** (e.g. it must run against the shared project for a specific, time-boxed verification purpose — the pattern already used correctly by the Phase 9 and Phase 11 test-data migrations), it **must** ship with a matching cleanup migration in the same change, or in a follow-up committed before the branch is considered done. A seed migration with no corresponding revocation is exactly the gap that produced H-2: a permanent, unexpiring grant into a real workspace with no record of when — or whether — it should ever be removed.

## What this does not change

- Genuine test/verification data migrations (seed + cleanup pairs) remain an accepted pattern for live-verifying a feature against the real backend, as already practiced in this project's history — this rule targets *unpaired* seeds, not the pattern itself.
- This does not retroactively touch any already-applied migration file (migration history is never rewritten — see the repository's general git-history discipline).

## Enforcement

There is no automated CI check for this yet (adding one — e.g. a lint pass that flags any migration inserting into `workspace_staff`/`profiles` without a same-PR or logged follow-up cleanup — is a reasonable future improvement, not implemented as part of this policy's adoption). Until then, this is a review-time rule: a migration adding dev/test membership without a paired cleanup should be blocked at review.
