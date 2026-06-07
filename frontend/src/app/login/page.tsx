"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Microscope, Loader2 } from "lucide-react";
import { api, getApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";

function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser, setTenantCode: setStoreTenant } = useAuthStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    localStorage.removeItem("is_platform_admin");
    try {
      const { data: tokens } = await api.post("/auth/login", {
        username,
        password,
        tenant_code: tenantCode,
      });
      localStorage.setItem("access_token", tokens.access_token);
      localStorage.setItem("refresh_token", tokens.refresh_token);
      const { data: user } = await api.get("/auth/me");
      setUser(user);
      setStoreTenant(tenantCode);
      if (user.tenant_id) localStorage.setItem("tenant_id", user.tenant_id);
      toast.success("Welcome back!");
      router.push(redirect);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass border-white/10 shadow-2xl">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/15 ring-1 ring-primary/20">
          <Microscope className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-2xl font-semibold tracking-tight">LabMaster Egypt</CardTitle>
        <CardDescription>Laboratory Login / تسجيل دخول المختبر</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tenant">Laboratory Code</Label>
            <Input
              id="tenant"
              value={tenantCode}
              onChange={(e) => setTenantCode(e.target.value)}
              required
              className="h-11"
              autoComplete="organization"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="h-11"
              autoComplete="username"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign In"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link href="/platform/login" className="text-primary hover:underline">
            Platform admin portal →
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen gradient-hero items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <Suspense fallback={<Loader2 className="mx-auto h-8 w-8 animate-spin text-white" />}>
          <LoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
