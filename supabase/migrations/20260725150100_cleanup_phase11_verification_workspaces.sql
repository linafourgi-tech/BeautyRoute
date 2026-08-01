-- Removes the Phase 11 test-only verification workspaces (plan-gate +
-- isolation) created in 20260725150000, now that the server-side AI plan
-- gate and cross-workspace isolation have been verified live.
--
-- Same ordering fix as the Phase 9 cleanup migration: delete child rows
-- (clients, workspace_staff) before the parent workspaces row, so the
-- clients AFTER DELETE audit trigger's insert into audit_logs still has a
-- live workspace_id to reference instead of racing the cascade.
DELETE FROM public.clients WHERE workspace_id IN (
  'c11c11c1-1111-4111-8111-111111111111',
  'c22c22c2-2222-4222-8222-222222222222'
);
DELETE FROM public.workspace_staff WHERE workspace_id IN (
  'c11c11c1-1111-4111-8111-111111111111',
  'c22c22c2-2222-4222-8222-222222222222'
);
DELETE FROM public.workspaces WHERE id IN (
  'c11c11c1-1111-4111-8111-111111111111',
  'c22c22c2-2222-4222-8222-222222222222'
);
