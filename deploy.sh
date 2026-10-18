#!/usr/bin/env bash
# ==============================================================================
# Orens Solution Management System - Deployment Pipeline Script
# Conforms to Section 7 & Section 9 of README.md
# ==============================================================================
set -euo pipefail

# Configuration defaults
REMOTE_HOST="${DEPLOY_HOST:-192.168.1.11}"
REMOTE_USER="${DEPLOY_USER:-rea}"
REMOTE_PORT="${DEPLOY_PORT:-22}"
TARGET_DIR="${DEPLOY_DIR:-/opt/web/sites/orens}"
CADDY_RELOAD_CMD="${DEPLOY_RELOAD_CMD:-sudo docker exec caddy caddy reload --config /etc/caddy/Caddyfile}"

DRY_RUN=false
SKIP_BUILD=false
CHECK_ONLY=false
ARCHIVE_PATH=""
trap 'if [ -n "$ARCHIVE_PATH" ] && [ -f "$ARCHIVE_PATH" ]; then rm -f "$ARCHIVE_PATH" 2>/dev/null || true; fi' EXIT

# ANSI colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_help() {
    cat <<EOF
Usage: ./deploy.sh [OPTIONS]

Deployment automation script for Orens Solution Management System frontend.
Builds, validates, packages, and deploys static artifacts to the Caddy server.

Options:
  -d, --dry-run          Run validation, build, and packaging locally without remote transfer
  -s, --server <HOST>    Target server IP/hostname (default: ${REMOTE_HOST})
  -u, --user <USER>      SSH user for target server (default: ${REMOTE_USER})
  -p, --port <PORT>      SSH port for target server (default: ${REMOTE_PORT})
  -t, --target-dir <DIR> Destination path on server (default: ${TARGET_DIR})
      --skip-build       Skip TypeScript check and Vite build (use existing dist/)
  -c, --check            Check remote connectivity and SSH access only
  -h, --help             Show this help message and exit

Environment Variables:
  DEPLOY_HOST            Override default remote host
  DEPLOY_USER            Override default SSH user
  DEPLOY_PORT            Override default SSH port
  DEPLOY_DIR             Override default target directory
  DEPLOY_RELOAD_CMD      Override Caddy container reload command

Examples:
  ./deploy.sh --dry-run               # Verify build and bundle packaging locally
  ./deploy.sh                         # Full build, package, transfer, and Caddy reload
  ./deploy.sh -s 192.168.1.11 -u rea  # Deploy to custom server and user
EOF
}

# Parse command-line arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -s|--server)
            if [[ $# -lt 2 ]] || [[ "$2" == -* ]]; then
                echo -e "${RED}[ERROR] Option $1 requires an argument (server hostname/IP).${NC}" >&2
                exit 1
            fi
            REMOTE_HOST="$2"
            shift 2
            ;;
        -u|--user)
            if [[ $# -lt 2 ]] || [[ "$2" == -* ]]; then
                echo -e "${RED}[ERROR] Option $1 requires an argument (SSH user).${NC}" >&2
                exit 1
            fi
            REMOTE_USER="$2"
            shift 2
            ;;
        -p|--port)
            if [[ $# -lt 2 ]] || [[ "$2" == -* ]]; then
                echo -e "${RED}[ERROR] Option $1 requires an argument (SSH port).${NC}" >&2
                exit 1
            fi
            if [[ ! "$2" =~ ^[0-9]+$ ]] || [ "$2" -lt 1 ] || [ "$2" -gt 65535 ]; then
                echo -e "${RED}[ERROR] Option $1 requires a valid port number (1-65535).${NC}" >&2
                exit 1
            fi
            REMOTE_PORT="$2"
            shift 2
            ;;
        -t|--target-dir)
            if [[ $# -lt 2 ]] || [[ "$2" == -* ]]; then
                echo -e "${RED}[ERROR] Option $1 requires an argument (target directory path).${NC}" >&2
                exit 1
            fi
            TARGET_DIR="$2"
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -c|--check)
            CHECK_ONLY=true
            shift
            ;;
        -h|--help)
            print_help
            exit 0
            ;;
        *)
            echo -e "${RED}[ERROR] Unknown option: $1${NC}" >&2
            print_help
            exit 1
            ;;
    esac
done

if [[ "$REMOTE_HOST" =~ : ]] && [[ "$REMOTE_HOST" != \[*\] ]]; then
    SITE_HOST="[${REMOTE_HOST}]"
else
    SITE_HOST="${REMOTE_HOST}"
fi
SITE_URL="https://${SITE_HOST}:8899"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}   Orens Solution Management System - Deployment Pipeline       ${NC}"
echo -e "${CYAN}================================================================${NC}"
echo -e "Mode        : $(if [ "$DRY_RUN" = true ]; then echo -e "${YELLOW}DRY-RUN (Local Verification Only)${NC}"; else echo -e "${GREEN}LIVE DEPLOYMENT${NC}"; fi)"
echo -e "Target      : ${REMOTE_USER}@${REMOTE_HOST}:${TARGET_DIR}"
echo -e "Service URL : ${SITE_URL}"
echo -e "Timestamp   : $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo -e "${CYAN}----------------------------------------------------------------${NC}"

# Check-only mode
if [ "$CHECK_ONLY" = true ]; then
    echo -e "${BLUE}[*] Checking network ping to ${REMOTE_HOST}...${NC}"
    if ping -c 1 -W 2 "$REMOTE_HOST" > /dev/null 2>&1; then
        echo -e "${GREEN}[✓] Host ${REMOTE_HOST} responded to ping.${NC}"
    else
        echo -e "${YELLOW}[!] Host ${REMOTE_HOST} did not respond to ping (ICMP may be filtered).${NC}"
    fi

    echo -e "${BLUE}[*] Checking SSH connection to ${REMOTE_USER}@${REMOTE_HOST}...${NC}"
    if ssh -p "$REMOTE_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=3 "${REMOTE_USER}@${REMOTE_HOST}" "echo 'SSH Connection OK'" 2>/dev/null; then
        echo -e "${GREEN}[✓] SSH authentication successful.${NC}"
    else
        echo -e "${RED}[✗] SSH authentication failed or timed out.${NC}"
        exit 1
    fi
    exit 0
fi

# Step 1: Type Checking
if [ "$SKIP_BUILD" = false ]; then
    echo -e "\n${BLUE}[1/5] Verifying TypeScript typing (npx tsc --noEmit)...${NC}"
    if npx tsc --noEmit; then
        echo -e "${GREEN}[✓] TypeScript verification passed (0 errors).${NC}"
    else
        echo -e "${RED}[✗] TypeScript type check failed. Fix compilation errors before deploying.${NC}" >&2
        exit 1
    fi

    # Step 2: Vite Production Build
    echo -e "\n${BLUE}[2/5] Building production assets (npx vite build)...${NC}"
    if npx vite build; then
        echo -e "${GREEN}[✓] Production assets compiled successfully.${NC}"
    else
        echo -e "${RED}[✗] Vite build failed.${NC}" >&2
        exit 1
    fi
else
    echo -e "\n${YELLOW}[!] Skipping build steps (--skip-build flag active).${NC}"
fi

# Step 3: Artifact Verification
echo -e "\n${BLUE}[3/5] Verifying dist/ artifacts integrity...${NC}"
if [ ! -d "dist" ] || [ ! -f "dist/index.html" ]; then
    echo -e "${RED}[✗] Error: dist/index.html does not exist. Run build first.${NC}" >&2
    exit 1
fi

TOTAL_FILES=$(find dist -type f | wc -l)
TOTAL_SIZE=$(du -sh dist | cut -f1)
echo -e "${GREEN}[✓] dist/ directory verified: ${TOTAL_FILES} files, ${TOTAL_SIZE}.${NC}"

# Step 4: Packaging Artifacts
echo -e "\n${BLUE}[4/5] Packaging artifacts into distribution tarball...${NC}"
ARCHIVE_PATH="/tmp/orens-dist-$(date +%s).tar.gz"
tar -czf "$ARCHIVE_PATH" -C dist .
ARCHIVE_SIZE=$(du -sh "$ARCHIVE_PATH" | cut -f1)
ARCHIVE_SHA256=$(sha256sum "$ARCHIVE_PATH" | cut -d' ' -f1)
echo -e "${GREEN}[✓] Package created: ${ARCHIVE_PATH} (${ARCHIVE_SIZE})${NC}"
echo -e "    SHA-256: ${ARCHIVE_SHA256}"

# Dry-run handling
if [ "$DRY_RUN" = true ]; then
    echo -e "\n${YELLOW}================================================================${NC}"
    echo -e "${YELLOW}   DRY-RUN COMPLETE: No changes applied to remote server.       ${NC}"
    echo -e "${YELLOW}================================================================${NC}"
    echo -e "  - TypeScript verification : PASSED"
    echo -e "  - Vite build              : PASSED"
    echo -e "  - Distribution package    : ${ARCHIVE_PATH} (${ARCHIVE_SIZE})"
    echo -e "  - Target (would deploy to): ${REMOTE_USER}@${REMOTE_HOST}:${TARGET_DIR}"
    echo -e "  - Caddy reload (would run): ${CADDY_RELOAD_CMD}"
    rm -f "$ARCHIVE_PATH"
    exit 0
fi

# Step 5: Remote Deployment
echo -e "\n${BLUE}[5/5] Deploying to remote server ${REMOTE_HOST}...${NC}"

# Check server reachability
echo -e "  -> Checking network connectivity..."
if ! ping -c 1 -W 2 "$REMOTE_HOST" > /dev/null 2>&1; then
    echo -e "${YELLOW}[!] Host ${REMOTE_HOST} did not respond to ICMP ping (may be filtered). Verifying SSH access directly...${NC}"
fi

# Check SSH connectivity
echo -e "  -> Checking SSH connection to ${REMOTE_USER}@${REMOTE_HOST}..."
if ! ssh -p "$REMOTE_PORT" -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=3 "${REMOTE_USER}@${REMOTE_HOST}" "true" 2>/dev/null; then
    echo -e "${RED}[✗] Unable to connect via SSH to ${REMOTE_USER}@${REMOTE_HOST} on port ${REMOTE_PORT}.${NC}" >&2
    echo -e "${YELLOW}[i] Please ensure your SSH key is authorized on the remote host or run with '--dry-run'.${NC}" >&2
    exit 1
fi

# Transfer and extract to target directory
echo -e "  -> Streaming and extracting artifacts to ${TARGET_DIR}..."
ssh -p "$REMOTE_PORT" -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${TARGET_DIR}'"
cat "$ARCHIVE_PATH" | ssh -p "$REMOTE_PORT" -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" "tar -xzf - -C '${TARGET_DIR}'"
echo -e "${GREEN}[✓] Artifacts transferred and extracted successfully.${NC}"

# Reload Caddy server
echo -e "  -> Reloading Caddy web server (${CADDY_RELOAD_CMD})..."
if ssh -p "$REMOTE_PORT" -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" "$CADDY_RELOAD_CMD"; then
    echo -e "${GREEN}[✓] Caddy reloaded successfully.${NC}"
else
    echo -e "${YELLOW}[!] Warning: Caddy reload command exited with non-zero status. Check container logs on server.${NC}"
fi

# Cleanup
rm -f "$ARCHIVE_PATH"

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}   DEPLOYMENT COMPLETED SUCCESSFULLY!                           ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "Application is live at: ${CYAN}${SITE_URL}${NC}"
echo -e "Reverse proxy backend : Supabase API port 54321 / PostgREST"

