import { useCurrentWorkspace } from "./useCurrentWorkspace";
import { resolveWorkspaceLang } from "../lib/locale";
import { dirFor } from "../lib/i18n";

// Single place every page/component reads "which language is the product
// showing right now, and which direction does that imply." Backed by the
// same useCurrentWorkspace() hook every page already calls (no extra
// network request -- workspace.locale rides along with the existing
// workspace row), so this is safe to call from as many components as need
// it, including ones that already call useCurrentWorkspace() for other
// reasons.
export function useAppLang() {
  const { workspace } = useCurrentWorkspace();
  const lang = resolveWorkspaceLang(workspace);
  return { lang, dir: dirFor(lang) };
}
