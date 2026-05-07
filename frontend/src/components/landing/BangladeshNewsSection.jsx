import React, { useEffect, useState } from "react";
import axios from "axios";

const BangladeshNewsSection = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    axios
      .get(`${process.env.REACT_APP_BACKEND_URL}/api/public/cars-news/bangladesh`)
      .then((r) => {
        if (mounted) setItems(r.data?.items || []);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !items.length) return null;

  const hero = items[0];
  const rest = items.slice(1, 7);

  return (
    <section
      id="bd-news"
      className="bg-white dark:bg-zinc-950 border-y border-zinc-200 dark:border-white/10 scroll-mt-28"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 reveal">
        <div className="flex items-end justify-between flex-wrap gap-3 mb-6 sm:mb-8">
          <div>
            <div className="inline-flex items-center gap-2 font-mono text-[10px] sm:text-[11px] uppercase tracking-[0.22em] text-[#E11D48] font-bold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E11D48] animate-pulse" />
              Bangladesh Auto Pulse · Updated hourly
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight text-zinc-900 dark:text-white">
              Local headlines. Local intelligence.
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2 max-w-xl">
              Real-time Dhaka & Bangladesh automotive news — sales, fuel pricing, BRTA regulation, dealer movements.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          <a
            href={hero.link || "#"}
            target="_blank"
            rel="noreferrer"
            data-testid="bd-news-hero"
            className="lg:col-span-7 group block bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-md p-5 sm:p-7 hover:border-[#E11D48] transition-colors"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#E11D48] mb-3">
              FEATURED · {hero.source || "BD"}
            </div>
            <h3 className="font-display text-xl sm:text-2xl lg:text-3xl tracking-tight text-zinc-900 dark:text-white group-hover:text-[#E11D48] transition-colors leading-tight">
              {hero.title}
            </h3>
            <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 inline-flex items-center gap-2">
              {hero.pub_date
                ? new Date(hero.pub_date).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : null}
              <span className="text-[#E11D48]">→ Read on {hero.source || "source"}</span>
            </div>
          </a>

          <ul className="lg:col-span-5 grid grid-cols-1 gap-3" data-testid="bd-news-list">
            {rest.map((n, i) => (
              <li key={i}>
                <a
                  href={n.link || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="group block bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-md p-3 sm:p-4 hover:border-[#E11D48] transition-colors"
                  data-testid={`bd-news-item-${i}`}
                >
                  <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400 mb-1">
                    {n.source || "BD news"}
                    {n.pub_date && (
                      <span>
                        {" · "}
                        {new Date(n.pub_date).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-zinc-900 dark:text-white group-hover:text-[#E11D48] transition-colors line-clamp-2">
                    {n.title}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default BangladeshNewsSection;
