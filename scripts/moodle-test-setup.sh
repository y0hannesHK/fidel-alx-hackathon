#!/usr/bin/env sh
# Prepare the test Moodle (docker-compose.lti-test.yml) for Fidel's LTI test:
#  - let Moodle call addresses on this computer (it blocks private addresses
#    and ports other than 80/443 by default; a real Moodle reaching Fidel over
#    https on the internet does not need this);
#  - a course "fidel-lti" with the student student1 / Student-1234!.
# Safe to run again. Run from anywhere:  sh scripts/moodle-test-setup.sh
set -e
cd "$(dirname "$0")/.."
# Git Bash on Windows would turn /opt/... into C:/Program Files/Git/opt/...
export MSYS_NO_PATHCONV=1
moodle() { docker compose -f docker-compose.lti-test.yml exec -T moodle "$@"; }
moodle php /opt/bitnami/moodle/admin/cli/cfg.php --name=curlsecurityblockedhosts --set=""
moodle php /opt/bitnami/moodle/admin/cli/cfg.php --name=curlsecurityallowedport --set=""
# This test Moodle runs on plain http: a "secure only" session cookie would be
# dropped and every login would fail ("Invalid login").
moodle php /opt/bitnami/moodle/admin/cli/cfg.php --name=cookiesecure --set=0
moodle php < scripts/moodle-test-setup.php
echo "Moodle ready: http://host.docker.internal:8081 (admin / Admin-1234!, student1 / Student-1234!)"
