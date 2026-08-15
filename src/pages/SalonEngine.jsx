import { Lock, Users, Boxes, Percent, Receipt } from "lucide-react";
import Layout from "../components/Layout";
import { useAppLang } from "../hooks/useAppLang";
import { t } from "../lib/i18n";

// Design migration (full-product-design-migration): fully re-skinned onto
// beautyroute-ds. Purely presentational -- no data, no functionality.

const MODULE_KEYS = [
  { icon: Users, labelKey: "salon.module.staff", descKey: "salon.module.staffDesc" },
  { icon: Receipt, labelKey: "salon.module.pos", descKey: "salon.module.posDesc" },
  { icon: Boxes, labelKey: "salon.module.inventory", descKey: "salon.module.inventoryDesc" },
  { icon: Percent, labelKey: "salon.module.commission", descKey: "salon.module.commissionDesc" },
];

export default function SalonEngine() {
  const { lang } = useAppLang();

  return (
    <Layout title={t("salon.title", lang)} subtitle={t("salon.subtitle", lang)}>
      <div style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--accent-gold)", background: "var(--surface-card)", padding: "var(--space-6)", marginBottom: "var(--space-6)", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ height: 44, width: 44, borderRadius: "50%", background: "var(--bg-sunken)", border: "1px solid var(--accent-gold-strong)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Lock size={18} color="var(--accent-gold-strong)" />
        </div>
        <div>
          <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500 }}>{t("salon.activatesTitle", lang)}</p>
          <p style={{ margin: "3px 0 0", color: "var(--text-tertiary)", fontSize: 14 }}>
            {t("salon.activatesDescription", lang)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULE_KEYS.map((m) => (
          <div key={m.labelKey} style={{ borderRadius: "var(--radius-lg)", border: "1px solid var(--border-subtle)", background: "var(--surface-card)", padding: "var(--space-5)", opacity: 0.7 }}>
            <m.icon size={18} color="var(--accent-gold-strong)" style={{ marginBottom: 10 }} />
            <p style={{ margin: 0, color: "var(--text-primary)", fontWeight: 500, fontSize: 14 }}>{t(m.labelKey, lang)}</p>
            <p style={{ margin: "4px 0 0", color: "var(--text-tertiary)", fontSize: 14 }}>{t(m.descKey, lang)}</p>
          </div>
        ))}
      </div>
    </Layout>
  );
}
