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
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.clear();
    try {
      const { data } = await api.post("/auth/platform/login", { username, password });
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
    <div className="flex min-h-screen items-center justify-center gradient-hero-animated p-4" dir="rtl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="border-border/60 bg-card shadow-card-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">SaaS Owner Portal</CardTitle>
            <CardDescription>منصة مالك لاب ماستر مصر</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-11 bg-background"
                  autoComplete="username"
                  placeholder="superadmin"
                />
                <p className="text-xs text-muted-foreground">Default owner account: superadmin / Admin@123</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-background"
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="h-11 w-full font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              <Link href="/login" className="font-medium text-primary hover:underline">
                ← Laboratory login
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
