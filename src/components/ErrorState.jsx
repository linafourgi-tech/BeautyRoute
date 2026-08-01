import { EmptyState, Button } from "./ui";
import "../styles/beautyroute/styles.css";

// Shared error + retry UI for real-data pages (Appointments, RouteEngine,
// StylistDashboard, ...) so each one doesn't hand-roll its own error markup.
// Scoped in its own .beautyroute-ds island since the pages that use it are
// NOT beautyroute-ds pages themselves -- see the Phase 7 report for the
// tradeoff this implies (a small island of BeautyRoute typography/color
// inside an otherwise Playfair/Manrope-themed page).
export function ErrorState({ message, onRetry }) {
  return (
    <div className="beautyroute-ds">
      <EmptyState
        title="Something went wrong"
        description={message || "Please try again."}
        action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
      />
    </div>
  );
}
