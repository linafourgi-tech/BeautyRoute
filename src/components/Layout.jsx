import Sidebar from "./Sidebar";
import { TrialBanner } from "./subscription/TrialBanner";

export default function Layout({ title, titleAr, subtitle, children }) {
  return (
    <div className="min-h-screen bg-ink">
      <TrialBanner />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 min-w-0">
          <div className="max-w-6xl mx-auto px-6 md:px-14 py-10 md:py-16">
            {(title || subtitle) && (
              <header className="mb-10 md:mb-12">
                {title && (
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <h1 className="font-display text-3xl md:text-[2.75rem] text-ivory tracking-tight leading-tight">
                      {title}
                    </h1>
                    {titleAr && (
                      <span className="font-display text-lg md:text-xl text-muted">{titleAr}</span>
                    )}
                  </div>
                )}
                {subtitle && (
                  <p className="text-muted mt-3 max-w-xl text-[15px] leading-relaxed">{subtitle}</p>
                )}
              </header>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
