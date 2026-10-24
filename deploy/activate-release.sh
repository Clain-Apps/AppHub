#!/usr/bin/env bash
# Switches /apps/<app>/current to a release that is already on disk, restarts
# that app's systemd service, and rolls back if the new process does not become healthy.
# The workflow pipes this script to the server. It never deletes another application's directory.
set -euo pipefail

: "${APP_NAME:?APP_NAME is required}"
: "${DEPLOY_ROOT:?DEPLOY_ROOT is required}"
: "${RELEASE_ID:?RELEASE_ID is required}"
: "${SERVICE_NAME:?SERVICE_NAME is required}"
: "${HEALTH_URL:?HEALTH_URL is required}"

if [[ ! "$APP_NAME" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  echo "APP_NAME must be a single directory name." >&2
  exit 1
fi
if [[ ! "$DEPLOY_ROOT" =~ ^(/[A-Za-z0-9._-]+)+$ ]]; then
  echo "DEPLOY_ROOT must be an absolute directory path." >&2
  exit 1
fi
if [[ ! "$RELEASE_ID" =~ ^[0-9a-f]+-[0-9]+-[0-9]+$ ]]; then
  echo "RELEASE_ID is not a release directory name from GitHub Actions." >&2
  exit 1
fi
if [[ ! "$SERVICE_NAME" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  echo "SERVICE_NAME must be a single systemd unit name." >&2
  exit 1
fi
if [[ ! "$HEALTH_URL" =~ ^http://127\.0\.0\.1:[0-9]+/[A-Za-z0-9._/-]*$ ]]; then
  echo "HEALTH_URL must be a loopback HTTP address." >&2
  exit 1
fi

application_directory="${DEPLOY_ROOT}/${APP_NAME}"
releases_directory="${application_directory}/releases"
release_directory="${releases_directory}/${RELEASE_ID}"
current_link="${application_directory}/current"
previous=""

if [[ ! -d "$release_directory" ]]; then
  echo "Release directory does not exist: ${release_directory}" >&2
  exit 1
fi

resolved_release="$(readlink -f "$release_directory")"
resolved_releases="$(readlink -f "$releases_directory")"
case "$resolved_release" in
  "$resolved_releases"/*) ;;
  *)
    echo "Refusing to activate a directory outside ${releases_directory}." >&2
    exit 1
    ;;
esac

if [[ -L "$current_link" ]]; then
  previous="$(readlink -f "$current_link" || true)"
elif [[ -e "$current_link" ]]; then
  echo "Refusing to replace ${current_link} because it is not a symlink." >&2
  exit 1
fi

switch_to() {
  local target="$1"
  rm -f "${current_link}.next"
  ln -s "$target" "${current_link}.next"
  mv -Tf "${current_link}.next" "$current_link"
}

rollback() {
  if [[ -n "$previous" && -d "$previous" ]]; then
    switch_to "$previous"
    sudo --non-interactive /usr/bin/systemctl restart "$SERVICE_NAME" || true
  else
    rm -f "$current_link"
    sudo --non-interactive /usr/bin/systemctl stop "$SERVICE_NAME" || true
  fi
}

wait_until_healthy() {
  local attempt
  for attempt in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if /usr/bin/node -e 'fetch(process.argv[1]).then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))' "$HEALTH_URL"; then
      return 0
    fi
    sleep 1
  done
  return 1
}

prune_old_releases() {
  local live_release="" directory resolved keeper is_kept
  if [[ -L "$current_link" ]]; then
    live_release="$(readlink -f "$current_link")"
  fi
  local -a newest=()
  mapfile -t newest < <(find "$releases_directory" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -nr | cut -d' ' -f2- | head -n 3)
  shopt -s nullglob
  for directory in "$releases_directory"/*; do
    [[ -d "$directory" ]] || continue
    resolved="$(readlink -f "$directory")"
    if [[ -n "$live_release" && "$resolved" == "$live_release" ]]; then
      continue
    fi
    is_kept=0
    for keeper in "${newest[@]}"; do
      if [[ "$(readlink -f "$keeper")" == "$resolved" ]]; then
        is_kept=1
      fi
    done
    if [[ "$is_kept" -eq 0 ]]; then
      case "$resolved" in
        "$resolved_releases"/*) rm -rf -- "$resolved" ;;
      esac
    fi
  done
}

switch_to "$resolved_release"

if ! sudo --non-interactive /usr/bin/systemctl restart "$SERVICE_NAME"; then
  echo "systemctl restart ${SERVICE_NAME} failed. The previous release stays live." >&2
  rollback
  exit 1
fi

if ! wait_until_healthy; then
  echo "Health check failed for ${HEALTH_URL}. Restoring the previous release." >&2
  rollback
  exit 1
fi

prune_old_releases
echo "Activated ${resolved_release}"
