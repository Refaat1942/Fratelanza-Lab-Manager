"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Microscope, ArrowRight, Shield, FlaskConical, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: FlaskConical, title: "LIMS Core", desc: "Patients, tests, results, billing" },
  { icon: BarChart3, title: "ERP Suite", desc: "Inventory, accounting, CRM, reports" },
  { icon: Shield, title: "Multi-Tenant SaaS", desc: "Subscriptions, branches, white-label" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen gradient-hero overflow-hidden">
      {/* Animated background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-cyan-400/15 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative container mx-auto flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="mb-8"
        >
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 backdrop-blur animate-float">
            <Microscope className="h-10 w-10 text-teal-300" />
          </div>
          <h1 className="mb-3 text-5xl font-bold tracking-tight md:text-6xl">
            LabMaster <span className="text-teal-300">Egypt</span>
          </h1>
          <p className="mb-2 text-2xl text-teal-100/90">لاب ماستر مصر</p>
          <p className="mx-auto max-w-2xl text-lg text-teal-50/80">
            Complete SaaS ERP + LIMS for medical laboratories across Egypt and the Middle East
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mb-16 flex flex-wrap justify-center gap-4"
        >
          <Button
            render={<Link href="/login" />}
            size="lg"
            className="bg-teal-500 px-8 shadow-lg shadow-teal-500/30 hover:bg-teal-400 hover:shadow-teal-400/40 transition-all"
          >
            Laboratory Login
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            render={<Link href="/platform/login" />}
            size="lg"
            variant="outline"
            className="border-white/30 bg-white/10 px-8 text-white backdrop-blur hover:bg-white/20"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            SaaS Owner Portal
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid w-full max-w-3xl gap-4 sm:grid-cols-3"
        >
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition hover:bg-white/10 hover:border-teal-400/30"
            >
              <f.icon className="mx-auto mb-3 h-8 w-8 text-teal-300" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-teal-100/70">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
