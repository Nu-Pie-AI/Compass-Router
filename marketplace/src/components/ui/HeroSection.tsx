"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SearchBar } from "@/components/ui/SearchBar";
import { AnimatedStats } from "./AnimatedStats";

interface HeroSectionProps {
  stats: {
    offerings: number;
    categories: number;
    features: number;
  };
}

export function HeroSection({ stats }: HeroSectionProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
  };

  return (
    <section className="relative flex flex-col items-center justify-start pt-2 sm:pt-6 lg:pt-8 pb-6 overflow-hidden">
      {/* Animated Mesh Background applied globally, but we can add an extra glow behind the text */}
      <div className="absolute inset-0 bg-mesh opacity-50 -z-10 pointer-events-none mix-blend-screen mix-blend-multiply dark:mix-blend-screen" />
      
      <motion.div 
        className="text-center max-w-3xl mx-auto space-y-5 sm:space-y-6 z-10"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Badge */}
        <motion.div variants={itemVariants} className="flex justify-center">
          <div className="relative inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface)]/80 backdrop-blur-md border border-[var(--primary)] text-[var(--foreground)] text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.5)]">
            <span className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>
            Powered by AI
            {/* Glowing rotating border effect */}
            <div className="absolute inset-0 rounded-full border border-transparent bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-20 animate-spin-slow pointer-events-none" style={{ animationDuration: '4s' }} />
          </div>
        </motion.div>

        {/* Headline */}
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-[var(--foreground)] drop-shadow-sm">
            Discover the right <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] bg-clip-text text-transparent">solutions</span> for your business
          </h1>
        </motion.div>

        {/* Value Proposition */}
        <motion.div variants={itemVariants}>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] max-w-xl mx-auto leading-relaxed">
            AI-powered discovery to find, compare, and choose the best products, services, and hybrid solutions in seconds.
          </p>
        </motion.div>

        {/* Search Input (Moved higher) */}
        <motion.div variants={itemVariants} className="w-full max-w-2xl mx-auto pt-1 pb-3 relative z-20">
          <SearchBar placeholder="Already know the solution? Find it instantly — e.g., CRM, NetworkPro, HR." />
        </motion.div>

        {/* AI Advisor CTA */}
        <motion.div variants={itemVariants} className="flex justify-center">
          <Link href="/ai-advisor-chat">
            <Button
              variant="outline"
              size="lg"
              className="group relative overflow-hidden rounded-full px-7 py-3 text-base font-medium shadow-sm hover:shadow-md transition-all border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white"
            >
              <div className="relative flex items-center z-10">
                <MessageCircle className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                Or talk to our AI Advisor for recommendations
              </div>
            </Button>
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div variants={itemVariants}>
          <AnimatedStats stats={stats} />
        </motion.div>
      </motion.div>
    </section>
  );
}
