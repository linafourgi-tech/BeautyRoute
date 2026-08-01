import { hasFeature } from "../../services/subscription";

// Reusable feature gate so pages never hardcode plan checks inline.
// Usage: <FeatureGate subscription={sub} feature="ai">{...gated UI...}</FeatureGate>
export function FeatureGate({ subscription, feature, children, fallback = null }) {
  return hasFeature(subscription, feature) ? children : fallback;
}
