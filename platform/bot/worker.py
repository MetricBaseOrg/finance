"""MetricBase Telegram bot — thin worker.

Phase 0 skeleton. The bot holds NO business logic: every read/write goes
through the platform API at PLATFORM_API_BASE (/api/bot/*) authenticated with
BOT_SERVICE_TOKEN. Field-ops commands and the reminder scheduler are wired up
in Phase 4.
"""
import logging
import os

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("mb-bot")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
API_BASE = os.getenv("PLATFORM_API_BASE", "http://web:3000")
SERVICE_TOKEN = os.getenv("BOT_SERVICE_TOKEN")


def main() -> None:
    if not TOKEN:
        log.warning("TELEGRAM_BOT_TOKEN not set — bot idle. (Phase 4 wires this up.)")
        # Keep the container alive without crash-looping in Phase 0.
        import time

        while True:
            time.sleep(3600)

    # Phase 4: build the python-telegram-bot Application here, register handlers
    # that call f"{API_BASE}/api/bot/..." with the BOT_SERVICE_TOKEN header,
    # and start the reminder job queue.
    log.info("Bot token present; handlers land in Phase 4. API base: %s", API_BASE)
    import time

    while True:
        time.sleep(3600)


if __name__ == "__main__":
    main()
