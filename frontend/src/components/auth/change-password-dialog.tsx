"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, getApiError } from "@/lib/api";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: "lab" | "platform";
  locale: "ar" | "en";
  onChanged?: () => void;
}

const empty = { current: "", next: "", confirm: "" };

export function ChangePasswordDialog({ open, onOpenChange, variant, locale, onChanged }: ChangePasswordDialogProps) {
  const isAr = locale === "ar";
  const [form, setForm] = useState(empty);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const mismatch = form.confirm.length > 0 && form.next !== form.confirm;
  const tooShort = form.next.length > 0 && form.next.length < 8;

  const close = (value: boolean) => {
    onOpenChange(value);
    if (!value) {
      setForm(empty);
      setShow(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mismatch || tooShort) return;
    setSaving(true);
    try {
      await api.post(variant === "platform" ? "/auth/platform/change-password" : "/auth/change-password", {
        current_password: form.current,
        new_password: form.next,
      });
      toast.success(isAr ? "تم تغيير كلمة المرور" : "Password changed");
      onChanged?.();
      close(false);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const type = show ? "text" : "password";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md" dir={isAr ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {isAr ? "تغيير كلمة المرور" : "Change password"}
          </DialogTitle>
          <DialogDescription>
            {isAr ? "استخدم 8 أحرف على الأقل." : "Use at least 8 characters."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cp-current">{isAr ? "كلمة المرور الحالية" : "Current password"}</Label>
            <Input
              id="cp-current"
              type={type}
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => setForm({ ...form, current: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-new">{isAr ? "كلمة المرور الجديدة" : "New password"}</Label>
            <div className="relative">
              <Input
                id="cp-new"
                type={type}
                autoComplete="new-password"
                value={form.next}
                onChange={(e) => setForm({ ...form, next: e.target.value })}
                aria-invalid={tooShort}
                className="pe-10"
                required
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute inset-y-0 end-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                aria-label={show ? (isAr ? "إخفاء" : "Hide") : (isAr ? "إظهار" : "Show")}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {tooShort && (
              <p className="text-xs text-destructive">{isAr ? "8 أحرف على الأقل" : "At least 8 characters"}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cp-confirm">{isAr ? "تأكيد كلمة المرور" : "Confirm new password"}</Label>
            <Input
              id="cp-confirm"
              type={type}
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              aria-invalid={mismatch}
              required
            />
            {mismatch && (
              <p className="text-xs text-destructive">{isAr ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={saving || mismatch || tooShort}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isAr ? "حفظ كلمة المرور" : "Save password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
