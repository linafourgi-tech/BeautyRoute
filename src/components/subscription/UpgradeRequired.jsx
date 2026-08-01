import { useNavigate } from "react-router-dom";
import { EmptyState, Button } from "../ui";
import "../../styles/beautyroute/styles.css";

// Full replacement view shown by ProtectedRoute when canAccessApplication()
// is false. Standalone .beautyroute-ds page rather than reusing the app's
// Sidebar/Layout chrome, matching the same pattern as Pricing/Login/Signup --
// an expired workspace isn't meant to keep browsing the working app.
export function UpgradeRequired() {
  const navigate = useNavigate();

  return (
    <div
      className="beautyroute-ds"
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-body)",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ maxWidth: 420, textAlign: "center" }}>
        <EmptyState
          title="Your trial has ended"
          description="Upgrade to keep using BeautyRoute — your data is safe and waiting for you."
          action={
            <Button variant="gold" size="lg" onClick={() => navigate("/pricing")}>
              Upgrade Now
            </Button>
          }
        />
      </div>
    </div>
  );
}
