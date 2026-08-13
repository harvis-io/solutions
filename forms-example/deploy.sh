#!/usr/bin/env bash
#
# Publish a folder to harvis.dev with an account API key.
#
# The GitHub Action (harvis-io/static-deploy-action) takes a *deploy token*: a
# credential scoped to one site that can do nothing but replace its files. This
# script takes an *account key* instead — `hvs_…` from /dashboard/keys — which
# stands for the whole account. That buys two things a deploy token cannot:
#
#   1. The site is created here on the first run, and given a fixed address, so
#      there is nothing to set up by hand before CI works.
#   2. The same credential reads what the forms collected — see the summary step
#      in ../.github/workflows/forms-example.yml.
#
# Everything below is curl against the documented account API, so it also runs
# on a laptop:  HARVIS_API_KEY=hvs_… ./deploy.sh public
#
set -euo pipefail

DIR="${1:-${HARVIS_DIR:-public}}"
API="${HARVIS_API_URL:-https://harvis.dev}"
SUBDOMAIN="${HARVIS_SUBDOMAIN:-}"
SITE_NAME="${HARVIS_SITE_NAME:-Forms example}"

: "${HARVIS_API_KEY:?set HARVIS_API_KEY to an account key from https://harvis.dev/dashboard/keys}"
[ -d "$DIR" ] || { echo "no such directory: $DIR" >&2; exit 1; }

# One call, one place that knows how a failure looks. The API answers every
# error with {"error":{"code","message"}}, and the code is the stable half — so
# the log gets both and a reader gets something to grep for.
call() {
  local method="$1" path="$2"
  shift 2
  local response status body
  response=$(curl -sS -X "$method" "$API$path" \
    -H "Authorization: Bearer $HARVIS_API_KEY" \
    -H "X-Harvis-Client: github-action-api-key" \
    -w $'\n%{http_code}' "$@")
  status="${response##*$'\n'}"
  body="${response%$'\n'*}"

  if [ "$status" -ge 400 ]; then
    echo "harvis $method $path — HTTP $status: $(
      printf '%s' "$body" | jq -r '"\(.error.code) — \(.error.message)"' 2>/dev/null || printf '%s' "$body"
    )" >&2
    return 1
  fi
  printf '%s' "$body"
}

# multipart/form-data with one `files` part per file and one `paths` part in the
# same order. The paths array is the source of truth: multipart strips directory
# separators from a filename, so `assets/app.css` would arrive as `app.css`.
upload_args=()
count=0
while IFS= read -r rel; do
  upload_args+=(-F "files=@$DIR/$rel" -F "paths=$rel")
  count=$((count + 1))
done < <(cd "$DIR" && find . -type f ! -name '.DS_Store' | sed 's|^\./||' | sort)

[ "$count" -gt 0 ] || { echo "$DIR holds no files" >&2; exit 1; }
echo "Uploading $count files from $DIR"

# Which site to replace. An account key sees the whole account, so the address
# itself is the identifier — no site id to store between runs, and nothing to
# configure the first time.
site_id=""
if [ -n "$SUBDOMAIN" ]; then
  site_id=$(call GET /api/v1/sites | jq -r --arg s "$SUBDOMAIN" 'first(.sites[] | select(.subdomain == $s) | .id) // ""')
fi

if [ -n "$site_id" ]; then
  echo "Redeploying $SUBDOMAIN ($site_id)"
  # Replaces the whole file list: paths absent from this upload are deleted.
  # Form submissions belong to the site rather than to the deploy, and survive.
  result=$(call POST "/api/v1/sites/$site_id/deploy" -F "name=$SITE_NAME" "${upload_args[@]}")
else
  echo "Creating a new site"
  result=$(call POST /api/v1/sites -F "name=$SITE_NAME" "${upload_args[@]}")
  site_id=$(printf '%s' "$result" | jq -r '.site.id')

  if [ -n "$SUBDOMAIN" ]; then
    # A new site gets a random address; move it to the one this workflow looks
    # up, or the next run would create a second site instead of finding this
    # one. Addresses are unique service-wide, so this is also where a name
    # someone else already holds is refused.
    if ! result=$(call PATCH "/api/v1/sites/$site_id" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg s "$SUBDOMAIN" '{subdomain: $s}')"); then
      echo "Rolling back the site just created — leaving it would strand an unnamed site per run." >&2
      call DELETE "/api/v1/sites/$site_id" > /dev/null || true
      exit 1
    fi
  fi
fi

url=$(printf '%s' "$result" | jq -r '.site.url')
subdomain=$(printf '%s' "$result" | jq -r '.site.subdomain')
files=$(printf '%s' "$result" | jq -r '.site.fileCount')

echo "Live at $url ($files files)"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "url=$url"
    echo "subdomain=$subdomain"
    echo "site-id=$site_id"
  } >> "$GITHUB_OUTPUT"
fi
