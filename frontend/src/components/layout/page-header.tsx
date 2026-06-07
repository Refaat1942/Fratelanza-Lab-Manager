"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn("mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight gradient-brand-text sm:text-3xl">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground sm:text-base">{description}</p>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </motion.div>
  );
}
