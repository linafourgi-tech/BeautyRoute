import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OnboardingShell } from "../components/onboarding/OnboardingShell";
import { OnboardingProgress } from "../components/onboarding/OnboardingProgress";
import { WelcomeStep } from "../components/onboarding/steps/WelcomeStep";
import { BusinessStep } from "../components/onboarding/steps/BusinessStep";
import { ServicesStep } from "../components/onboarding/steps/ServicesStep";
import { AvailabilityStep } from "../components/onboarding/steps/AvailabilityStep";
import { ReadyStep } from "../components/onboarding/steps/ReadyStep";
import { useSession } from "../hooks/useSession";
import { updateProfile } from "../services/profiles";
import { bootstrapWorkspace, updateWorkspaceSettings } from "../services/workspaces";
import { getServices, importServiceTemplates, updateService } from "../services/services";
import "../styles/beautyroute/styles.css";

const DEFAULT_BUSINESS = { businessType: "freelancer", fullName: "", businessName: "", phone: "", city: "", avatarFile: null, avatarPreviewUrl: "" };
const DEFAULT_AVAILABILITY = {
  days: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false },
  startTime: "09:00",
  endTime: "18:00",
};

export default function Onboarding() {
  const navigate = useNavigate();
  // Whether this page should even be rendered (signed in? already onboarded?)
  // is OnboardingRoute's job now, not this component's. We only still need
  // the session here to know the user's id and prefill their name/phone.
  const { user, profile, loading: sessionLoading } = useSession();

  const [step, setStep] = useState(0);
  const [business, setBusiness] = useState(DEFAULT_BUSINESS);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState(DEFAULT_AVAILABILITY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile) {
      setBusiness((b) => ({ ...b, fullName: profile.full_name || "", phone: profile.phone || "" }));
    }
  }, [profile]);

  async function handleFinish() {
    setError("");
    setSaving(true);
    try {
      const workspaceId = await bootstrapWorkspace(business.businessName, business.businessType, business.city);

      await updateProfile(user.id, {
        full_name: business.fullName,
        phone: business.phone || null,
      });

      if (services.length > 0) {
        await importServiceTemplates(workspaceId, services.map((s) => s.templateId));
        const created = await getServices(workspaceId);
        for (const selected of services) {
          // Match by the template's original name (what the RPC actually
          // inserted), not selected.name, which may have been edited above.
          const target = created.find((c) => c.name === selected.originalName);
          if (!target) continue;
          const nameChanged = selected.name !== selected.originalName;
          const durationChanged = target.duration_minutes !== selected.duration;
          const priceChanged = Number(target.price) !== Number(selected.price);
          if (nameChanged || durationChanged || priceChanged) {
            await updateService(target.id, {
              name: selected.name,
              duration_minutes: selected.duration,
              price: selected.price,
            });
          }
        }
      }

      const activeDays = Object.entries(availability.days).filter(([, on]) => on).map(([key]) => key);
      await updateWorkspaceSettings(workspaceId, {
        business_hours: { days: activeDays, start: availability.startTime, end: availability.endTime },
      });

      navigate("/dashboard");
    } catch (err) {
      setError(err.message || "Something went wrong while setting up your workspace.");
    } finally {
      setSaving(false);
    }
  }

  if (sessionLoading) return null;

  return (
    <OnboardingShell>
      <OnboardingProgress step={step} />
      {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}
      {step === 1 && (
        <BusinessStep value={business} onChange={setBusiness} onNext={() => setStep(2)} onBack={() => setStep(0)} />
      )}
      {step === 2 && (
        <ServicesStep value={services} onChange={setServices} onNext={() => setStep(3)} onBack={() => setStep(1)} />
      )}
      {step === 3 && (
        <AvailabilityStep value={availability} onChange={setAvailability} onNext={() => setStep(4)} onBack={() => setStep(2)} />
      )}
      {step === 4 && (
        <ReadyStep
          business={business}
          services={services}
          availability={availability}
          onFinish={handleFinish}
          onBack={() => setStep(3)}
          saving={saving}
          error={error}
        />
      )}
    </OnboardingShell>
  );
}
