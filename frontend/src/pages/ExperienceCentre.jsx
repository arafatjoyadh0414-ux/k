import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ExperienceCentreContent from "../components/ExperienceCentreContent";

const ExperienceCentre = () => {
  useEffect(() => {
    document.title = "Experience Centre — JOY Automart";
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Sticky breadcrumb header */}
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-300 hover:text-white" data-testid="ec-back-link">
            <ArrowLeft className="w-4 h-4" /> Back to JOY Automart
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">Experience Centre</div>
        </div>
      </header>
      <ExperienceCentreContent />
    </div>
  );
};

export default ExperienceCentre;
