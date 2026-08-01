-- Data-only cleanup: removes two test service rows created while verifying
-- import_service_templates()/updateService() during Phase 5 testing. Run as
-- a migration (not through the authenticated client) because a normal
-- authenticated DELETE on "services" currently fails -- see the audit_logs
-- RLS finding reported alongside this migration.
DELETE FROM public.services
WHERE id IN ('faa3673d-529e-4726-bf92-12abb8402496', 'dc216471-5dbf-4e3c-8234-10783998456f');
