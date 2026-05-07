import React from "react";

const TechCard = ({ status, statusClass, icon, title, body, tags }) => (
  <div
    className={`border border-zinc-200 rounded-sm ${
      status === "Roadmap" ? "bg-zinc-50" : "bg-white"
    } p-6 sm:p-7 relative overflow-hidden`}
  >
    <div className={`absolute top-0 right-0 ${statusClass} text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-sm`}>
      {status}
    </div>
    <div className="w-10 h-10 grid place-items-center bg-zinc-900 text-white rounded-sm mb-4">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        {icon}
      </svg>
    </div>
    <div className="font-display text-lg text-zinc-900">{title}</div>
    <p className="text-sm text-zinc-600 mt-2 leading-relaxed">{body}</p>
    <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-wider text-zinc-500">
      {tags.map((tag) => (
        <span key={tag} className="border border-zinc-200 px-2 py-1 rounded-sm">
          {tag}
        </span>
      ))}
    </div>
  </div>
);

const TechStackSection = () => (
  <section id="tech-stack" className="bg-white border-b hairline relative overflow-hidden scroll-mt-28">
    <div className="absolute inset-0 grid-bg" aria-hidden="true" />
    <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-14 sm:pt-20 pb-8 sm:pb-12 relative z-10 reveal">
      <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500 mb-2">
        The technology stack
      </div>
      <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl tracking-tighter leading-[1.05] max-w-3xl mb-2">
        The smartest auto-parts experience in Bangladesh.
      </h2>
      <p className="text-zinc-600 max-w-2xl text-sm sm:text-base mb-10">
        Every part of our platform is engineered to remove friction, surface the right answer instantly, and learn
        from every transaction — for both B2B workshops and B2C car owners.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
        <TechCard
          status="Live"
          statusClass="bg-emerald-100 text-emerald-800"
          icon={<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>}
          title="VIN Parts Finder"
          body={
            <>
              Scan or paste any 17-character VIN — we decode the make, model, year, trim and engine, then surface every
              compatible part in stock with OEM cross-references. Available in the
              <strong className="text-zinc-900"> B2B portal</strong> and the
              <strong className="text-zinc-900"> B2C retail store</strong>.
            </>
          }
          tags={["NHTSA + WMI", "Catalogue match", "VIN history"]}
        />
        <TechCard
          status="Live"
          statusClass="bg-emerald-100 text-emerald-800"
          icon={
            <>
              <path d="M12 8V4M8 12H4M16 12h4M12 16v4" />
              <rect x="8" y="8" width="8" height="8" rx="1" />
            </>
          }
          title="JOY AI Assistant"
          body="Powered by Claude. Diagnose symptoms, recommend the right part, build a full order in chat, cross-reference OEM numbers, and answer fitment questions — for the bay-floor mechanic and the home car owner alike."
          tags={["Diagnostics", "Smart reorder", "Cross-ref"]}
        />
        <TechCard
          status="Roadmap"
          statusClass="bg-amber-100 text-amber-800"
          icon={
            <>
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <path d="M10 6.5h4M6.5 10v4M17.5 10v4M10 17.5h4" />
            </>
          }
          title="Blockchain Provenance"
          body="Coming soon. Tamper-proof part-history and ownership records on-chain — every genuine part stamped with a verifiable origin trail. Anti-counterfeit, fleet-grade auditability, and fraud-resistant resale value."
          tags={["Provenance", "Anti-counterfeit", "2026 roadmap"]}
        />
      </div>
    </div>
  </section>
);

export default TechStackSection;
