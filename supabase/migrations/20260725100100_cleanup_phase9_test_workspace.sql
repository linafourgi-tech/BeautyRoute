-- Removes the Phase 9 test-only second workspace (and its membership/client
-- row) created in 20260725100000, now that live multi-workspace switching
-- has been verified.
--
-- NOTE: a first attempt at this (plain `DELETE FROM workspaces WHERE id =
-- ...`, relying on ON DELETE CASCADE to workspace_staff/clients) failed with
-- a foreign-key violation on audit_logs. Root cause, confirmed, is a real
-- pre-existing bug independent of this cleanup: clients/appointments/
-- services/visits each have an AFTER DELETE audit trigger that INSERTs a new
-- audit_logs row referencing workspace_id. When a workspace delete cascades
-- into deleting those child rows, that trigger fires while the parent
-- workspaces row is mid-deletion in the same statement, so the audit_logs
-- insert's own FK to workspaces(id) fails. Nothing in this project has ever
-- deleted a workspace before, so this never surfaced until now. Not fixed
-- here -- out of Phase 9's scope, reported separately -- worked around for
-- this one-off cleanup by deleting child rows as their own prior statements,
-- while the workspace (and thus the audit insert's FK target) still exists.
DELETE FROM public.clients WHERE workspace_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM public.workspace_staff WHERE workspace_id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
DELETE FROM public.workspaces WHERE id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
