# LabMaster — program review notes

Last updated: 2026-06-13

## Thermal kit labels (new)

- PDF labels **38×25 mm** with Code128 barcode (`ORD-#####-TESTCODE`)
- Layouts: **single** (one label per row) or **double** (two labels per 76×25 mm row)
- API: `GET /results/orders/{order_id}/labels?layout=single|double`
- API: `GET /results/{result_id}/label?layout=single|double`
- UI: Results table **Label** menu; Patients quick-visit dialog after registration

## Strengths

- Multi-tenant architecture with per-lab databases
- Patient quick-visit (register + order + invoice + payment in one step)
- Arabic daily operations Excel report
- Host cron backups to Docker volume `labmaster_backups`
- Platform admin: subscriptions, revenue dashboard, tenant provisioning

## Known gaps / bugs

| Area | Issue | Severity |
|------|--------|----------|
| Sample workflow | `collected_at` / `OrderStatus.COLLECTED` never set — no collection desk step | Medium |
| Results API | `create_order` silently skips invalid `test_id` instead of failing | Medium |
| Orders UI | `GET /results/orders` exists but no dedicated orders list page | Low |
| Billing ↔ Orders | Invoice has `order_id` but billing UI does not link to sample labels | Low |
| Dashboard export | Daily Excel export button only (PDF removed by design) | Info |
| Tests catalog | No date filter by design — differs from other modules | Info |
| Barcode scan | Labels generated; no inbound scan workflow to mark collected/in_lab | Medium |
| Offline backup | Backups on VPS volume only — off-site copy still manual | High (ops) |

## Recommended next steps

1. Add **Collect sample** action that sets `collected_at` and offers label print
2. Validate all `test_ids` on order create (fail if any missing)
3. Optional ZPL/TSPL raw output for direct thermal drivers (beyond PDF)
4. Scheduled off-site backup sync (rsync/S3)
