#!/bin/bash
# Wait until LabMaster backend responds (migrations + seed run before uvicorn).
# Usage: wait_for_api 18000

wait_for_api() {
  local port="${1:-18000}"
  local max_attempts="${2:-40}"
  local attempt=1

  echo "Waiting for API on port ${port} (migrations/seed may take 1–2 min)..."
  while [ "$attempt" -le "$max_attempts" ]; do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      echo "API ready (attempt ${attempt}/${max_attempts})"
      curl -fsS "http://127.0.0.1:${port}/health" && echo ""
      curl -fsS "http://127.0.0.1:${port}/api/v1/public/version" && echo ""
      return 0
    fi
    printf "  [%s/%s] backend starting...\n" "$attempt" "$max_attempts"
    sleep 3
    attempt=$((attempt + 1))
  done

  echo ""
  echo "WARNING: API did not respond in time. Check backend logs:"
  echo "  docker logs labmaster-backend --tail 100"
  return 1
}
