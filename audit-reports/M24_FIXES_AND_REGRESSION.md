# M24 Fixes and Regression

## Focused fix

- `apps/api/app/main.py`: added admin-scoped, read-only refund and payment-event detail to reconciliation.
- `apps/web/components/AdminConsole.tsx`: replaced raw JSON-only payment output with summary facts and attention tables.
- `tests/test_api.py`: added assertions for empty and reconciliation-required detail payloads.

## Validation

- Backend full suite: `160 passed, 1 warning`.
- Focused refund/reconciliation tests: `2 passed`.
- Web lint: PASS.
- Web typecheck: PASS.
- Web production build: PASS; 24 routes generated.
- Extension check: PASS.
- Extension tests: `12 passed`.
- Extension build: PASS.
- `git diff --check`: PASS; only CRLF normalization warnings.

## Warning

The only test warning is the existing Pydantic deprecation at `apps/api/app/schemas.py:108`.
