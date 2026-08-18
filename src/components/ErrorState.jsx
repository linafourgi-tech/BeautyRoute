import { EmptyState, Button } from "./ui";
import "../styles/beautyroute/styles.css";

// Shared error + retry UI for real-data pages (Appointments, RouteEngine,
// StylistDashboard, ...). Design migration (full-product-design-migration):
// previously wrapped itself in its own `.beautyroute-ds` island since the
// pages using it were NOT beautyroute-ds pages themselves (see the Phase 7
// report for that original tradeoff). Now that every authenticated page
// renders inside Layout's `.beautyroute-ds[data-theme="dark"]` root, that
// wrapper became actively harmful: re-declaring the bare `.beautyroute-ds`
// class on a nested element matches the *light* token rule (data-theme
// isn't present on that inner element) and silently overrides every
// inherited dark-mode token back to light -- the same cascade bug fixed in
// Sidebar.jsx. Custom properties inherit fine through a plain wrapper, so
// none is needed here anymore.
export function ErrorState({ message, onRetry }) {
  return (
    <EmptyState
      title="Something went wrong"
      description={message || "Please try again."}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    />
  );
}
