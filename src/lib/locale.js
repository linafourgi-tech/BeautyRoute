// Which language the app's chrome (nav, placeholders, static UI copy) should
// display for the current workspace. Both languages' strings stay available
// wherever they're used (e.g. Sidebar's nav array) -- this only decides
// which one is shown, driven by the workspace's real `locale` column (see
// services/workspaces.ts / supabase-types.ts). Defaults to English when the
// column is unset, matching the app's existing predominantly-English UI.
export function resolveWorkspaceLang(workspace) {
  return workspace?.locale === "ar" ? "ar" : "en";
}
