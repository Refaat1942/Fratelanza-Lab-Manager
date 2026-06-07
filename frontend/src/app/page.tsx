import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Microscope, ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-900 text-white">
      <div className="container mx-auto flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <Microscope className="mb-6 h-20 w-20 text-teal-300" />
        <h1 className="mb-4 text-5xl font-bold tracking-tight">LabMaster Egypt</h1>
        <p className="mb-2 text-2xl text-teal-200">لاب ماستر مصر</p>
        <p className="mb-10 max-w-2xl text-lg text-teal-100">
          Complete SaaS ERP + LIMS for medical laboratories across Egypt and the Middle East.
          Multi-tenant, multi-branch, Arabic & English support.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button render={<Link href="/login" />} size="lg" className="bg-teal-500 hover:bg-teal-400">
            Laboratory Login
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button render={<Link href="/platform/login" />} size="lg" variant="outline" className="border-teal-400 text-teal-100 hover:bg-teal-800">
            SaaS Owner Portal
          </Button>
        </div>
      </div>
    </div>
  );
}
