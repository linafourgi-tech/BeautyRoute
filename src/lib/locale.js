// Which language the app's chrome (nav, placeholders, static UI copy) should
// display for the current workspace. Both languages' strings stay available
// wherever they're used (e.g. Sidebar's nav array) -- this only decides
// which one is shown, driven by the workspace's real `locale` column (see
// services/workspaces.ts / supabase-types.ts). "ar" and regional Arabic tags
// such as "ar-SA" are Arabic; anything else -- unset, invalid, "en", or the
// column's "en-SA" default -- falls back to English, matching the app's
// existing predominantly-English UI. Keep in sync with
// resolveResponseLanguage() in supabase/functions/ai-assistant/index.ts,
// which picks the AI Assistant's response language from the same column.
export function resolveWorkspaceLang(workspace) {
  const locale = typeof workspace?.locale === "string" ? workspace.locale.trim().toLowerCase() : "";
  return locale === "ar" || locale.startsWith("ar-") ? "ar" : "en";
}
