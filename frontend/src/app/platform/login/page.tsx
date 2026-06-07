"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { api, getApiError } from "@/lib/api";
import { toast } from "sonner";

export default function PlatformLoginPage() {
  const [email, setEmail] = useState("admin@labmaster.eg");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.clear();
    try {
      const { data } = await api.post("/auth/platform/login", { email, password });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("is_platform_admin", "true");
      await api.get("/auth/platform/me");
      toast.success("Welcome, Platform Admin!");
      router.push("/platform");
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-slate-700/50 bg-slate-900/80 text-white shadow-2xl backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-teal-500/20">
              <Shield className="h-7 w-7 text-teal-400" />
            </div>
            <CardTitle className="text-2xl">SaaS Owner Portal</CardTitle>
            <CardDescription className="text-slate-400">منصة مالك لاب ماستر مصر</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-11 border-slate-700 bg-slate-800" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-11 border-slate-700 bg-slate-800" placeholder="Admin@123" />
              </div>
              <Button type="submit" className="h-11 w-full bg-teal-600 hover:bg-teal-500" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs text-slate-500">Demo: admin@labmaster.eg / Admin@123</p>
            <p className="mt-2 text-center text-sm">
              <Link href="/" className="text-teal-400 hover:underline">← Back to home</Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
