#!/bin/sh
# MetricBase in-cluster scheduler. A tiny busybox-crond container that calls the
# platform's /api/cron/* routes on a schedule over the internal compose network.
# No Docker socket, no app code — auth is the shared CRON_SECRET bearer token.
set -eu

: "${CRON_SECRET:?CRON_SECRET must be set (put it in .env)}"
BASE="${PLATFORM_API_BASE:-http://web:3000}"

# Schedules are UTC. The org default timezone is Asia/Jakarta (UTC+7), so
# 00:00 UTC = 07:00 WIB — a morning digest. Adjust the minutes/hours as needed.
cat > /etc/crontabs/root <<EOF
# Daily 07:00 WIB — unread-notification digest email.
0 0 * * * wget -q -O- --header="Authorization: Bearer ${CRON_SECRET}" "${BASE}/api/cron/email-digest" >> /proc/1/fd/1 2>&1
# Daily 07:05 WIB — spawn overdue recurring tasks/transactions.
5 0 * * * wget -q -O- --header="Authorization: Bearer ${CRON_SECRET}" "${BASE}/api/cron/recurring-rollover" >> /proc/1/fd/1 2>&1
# Hourly backstop — dispatch agent-directed work.
0 * * * * wget -q -O- --header="Authorization: Bearer ${CRON_SECRET}" "${BASE}/api/cron/agent-sweep" >> /proc/1/fd/1 2>&1
EOF

echo "[cron] schedules installed (BASE=${BASE}); starting crond"
exec crond -f -l 8
