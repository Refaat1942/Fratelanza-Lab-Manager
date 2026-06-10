#!/usr/bin/env python3
"""End-to-end health check for LabMaster Egypt — run before customer go-live."""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from typing import Any

import httpx

BASE = "http://localhost:8000"
LAB_LOGIN = {"username": "labadmin", "password": "Demo@123", "tenant_code": "demo-lab"}
PLATFORM_LOGIN = {"username": "superadmin", "password": "Admin@123"}


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str = ""


@dataclass
class Report:
    results: list[CheckResult] = field(default_factory=list)

    def add(self, name: str, ok: bool, detail: str = "") -> None:
        self.results.append(CheckResult(name, ok, detail))

    def print_summary(self) -> int:
        passed = sum(1 for r in self.results if r.ok)
        failed = len(self.results) - passed
        print("\n=== LabMaster Health Check ===\n")
        for r in self.results:
            icon = "PASS" if r.ok else "FAIL"
            line = f"[{icon}] {r.name}"
            if r.detail:
                line += f" — {r.detail}"
            print(line)
        print(f"\nTotal: {passed} passed, {failed} failed\n")
        return 1 if failed else 0


def get_json(client: httpx.Client, method: str, path: str, **kwargs: Any) -> tuple[int, Any]:
    r = client.request(method, f"{BASE}{path}", timeout=30, **kwargs)
    try:
        body = r.json()
    except Exception:
        body = r.text
    return r.status_code, body


def main() -> int:
    report = Report()

    with httpx.Client() as client:
        code, body = get_json(client, "GET", "/health")
        report.add("API health", code == 200 and body.get("status") == "healthy", str(body))

        code, body = get_json(client, "POST", "/api/v1/auth/login", json=LAB_LOGIN)
        lab_token = body.get("access_token") if code == 200 else None
        report.add("Lab login", code == 200 and bool(lab_token), f"HTTP {code}")

        code, body = get_json(client, "POST", "/api/v1/auth/platform/login", json=PLATFORM_LOGIN)
        plat_token = body.get("access_token") if code == 200 else None
        report.add("Platform login", code == 200 and bool(plat_token), f"HTTP {code}")

        if not lab_token:
            print("Cannot continue lab module checks without token.")
            return report.print_summary()

        lab_headers = {"Authorization": f"Bearer {lab_token}"}
        modules = [
            ("Dashboard stats", "GET", "/api/v1/dashboard/stats"),
            ("Patients", "GET", "/api/v1/patients"),
            ("Doctors", "GET", "/api/v1/doctors"),
            ("Tests", "GET", "/api/v1/tests"),
            ("Results", "GET", "/api/v1/results"),
            ("Billing invoices", "GET", "/api/v1/billing/invoices"),
            ("Billing summary", "GET", "/api/v1/billing/summary"),
            ("Inventory", "GET", "/api/v1/inventory"),
            ("Suppliers", "GET", "/api/v1/suppliers"),
            ("Branches", "GET", "/api/v1/branches"),
            ("Users", "GET", "/api/v1/users"),
            ("Expenses", "GET", "/api/v1/expenses"),
            ("Referrals", "GET", "/api/v1/referrals"),
            ("CRM contacts", "GET", "/api/v1/crm/contacts"),
            ("Purchasing", "GET", "/api/v1/purchasing/orders"),
            ("Settings limits", "GET", "/api/v1/settings/limits"),
            ("Settings branding", "GET", "/api/v1/settings/branding"),
            ("Auth me", "GET", "/api/v1/auth/me"),
        ]
        for name, method, path in modules:
            code, body = get_json(client, method, path, headers=lab_headers)
            ok = code == 200
            detail = f"HTTP {code}"
            if ok and path.endswith("/patients") and isinstance(body, dict):
                detail += f", total={body.get('total', '?')}"
            report.add(f"Lab: {name}", ok, detail)

        if plat_token:
            plat_headers = {"Authorization": f"Bearer {plat_token}"}
            platform_checks = [
                ("Platform me", "GET", "/api/v1/auth/platform/me"),
                ("Dashboard", "GET", "/api/v1/platform/dashboard"),
                ("Tenants", "GET", "/api/v1/platform/tenants"),
                ("Plans", "GET", "/api/v1/platform/plans"),
                ("Subscriptions", "GET", "/api/v1/platform/subscriptions"),
                ("Audit logs", "GET", "/api/v1/platform/audit-logs"),
            ]
            for name, method, path in platform_checks:
                code, _ = get_json(client, method, path, headers=plat_headers)
                report.add(f"Platform: {name}", code == 200, f"HTTP {code}")

        code, body = get_json(client, "GET", "/api/v1/public/branding/demo-lab")
        report.add("Public branding", code == 200, f"HTTP {code}")

    return report.print_summary()


if __name__ == "__main__":
    sys.exit(main())
