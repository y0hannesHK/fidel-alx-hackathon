#!/usr/bin/env bash
# One-time setup of an Ubuntu server for Fidel (run with sudo).
#
#   sudo bash server-setup.sh fidel.example.org youruser
#
# It:
#   1. installs Docker and Docker Compose (from Ubuntu's own packages),
#   2. lets YOURUSER run Docker without sudo,
#   3. adds an HTTPS site for the domain to an existing Caddy web server,
#      forwarding to Fidel on 127.0.0.1:8000 (other Caddy sites are kept).
# Run it again safely: each step is skipped if already done.
set -euo pipefail

DOMAIN="${1:?Give the domain, e.g. fidel-alx-hack.duckdns.org}"
DEPLOY_USER="${2:?Give the user who will run Fidel, e.g. yoha}"
CADDYFILE=/etc/caddy/Caddyfile

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run with sudo." >&2
  exit 1
fi

echo "== 1. Docker"
if ! command -v docker >/dev/null; then
  apt-get update
  apt-get install -y docker.io docker-compose-v2
fi
systemctl enable --now docker
docker --version
docker compose version

echo "== 2. Docker access for $DEPLOY_USER"
# Note: members of the docker group can control Docker, which is as
# powerful as root on this server. Remove with: gpasswd -d $DEPLOY_USER docker
usermod -aG docker "$DEPLOY_USER"

echo "== 3. Caddy site for $DOMAIN"
if ! command -v caddy >/dev/null; then
  echo "Caddy is not installed. Install it first: https://caddyserver.com/docs/install" >&2
  exit 1
fi
if grep -q "^$DOMAIN " "$CADDYFILE"; then
  echo "Site already in $CADDYFILE, not changed."
else
  cp "$CADDYFILE" "$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
  cat >> "$CADDYFILE" <<SITE

# Fidel (accessible learning media)
$DOMAIN {
	encode zstd gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains"
		-Server
	}
	request_body {
		max_size 1100MB
	}
	reverse_proxy 127.0.0.1:8000
}
SITE
fi
caddy validate --config "$CADDYFILE" --adapter caddyfile
systemctl reload caddy

echo
echo "Done. Log out and back in once, so '$DEPLOY_USER' can use Docker."
echo "Make sure $DOMAIN points to this server's IP: $(curl -s -4 --max-time 5 ifconfig.me || echo '?')"
