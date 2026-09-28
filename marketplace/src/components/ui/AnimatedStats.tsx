"use client";

import CountUp from "react-countup";
import { useInView } from "framer-motion";
import { useRef } from "react";

interface AnimatedStatsProps {
  stats: {
    offerings: number;
    categories: number;
    features: number;
  };
}

export function AnimatedStats({ stats }: AnimatedStatsProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="grid grid-cols-3 gap-8 max-w-2xl mx-auto pt-8 sm:pt-12">
      <div className="text-center">
        <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent drop-shadow-sm">
          {isInView ? <CountUp end={stats.offerings} duration={2.5} /> : "0"}+
        </div>
        <div className="text-sm font-medium text-[var(--muted-foreground)] mt-2 uppercase tracking-widest">
          Solutions
        </div>
      </div>

      <div className="text-center">
        <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-br from-[var(--accent-green)] to-[var(--primary)] bg-clip-text text-transparent drop-shadow-sm">
          {isInView ? <CountUp end={stats.categories} duration={2} /> : "0"}+
        </div>
        <div className="text-sm font-medium text-[var(--muted-foreground)] mt-2 uppercase tracking-widest">
          Categories
        </div>
      </div>

      <div className="text-center">
        <div className="text-4xl sm:text-5xl font-bold bg-gradient-to-br from-[var(--accent)] to-[var(--error)] bg-clip-text text-transparent drop-shadow-sm">
          {isInView ? <CountUp end={stats.features} duration={3} /> : "0"}+
        </div>
        <div className="text-sm font-medium text-[var(--muted-foreground)] mt-2 uppercase tracking-widest">
          Features
        </div>
      </div>
    </div>
  );
}
