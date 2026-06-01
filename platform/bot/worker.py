"""MetricBase Telegram bot — thin worker.

The bot holds NO business logic: every read/write goes through the platform API
at PLATFORM_API_BASE (/api/bot/*), authenticated with BOT_SERVICE_TOKEN. The
acting person is identified by their Telegram user id, which the platform maps
to a linked account (Settings → Telegram). Permissions are enforced server-side
by the user's workspace role:

  • Viewers  — /summary /recap /stock /liftings (read only)
  • Members  — the above + /addflow (add records)
  • Admins / Owners — full access
"""
import logging
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv
from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import Application, CommandHandler, ContextTypes

# Load env the same way prisma.config.ts does: .env.local first (Next.js
# convention), then .env as fallback. These live in the platform root — one
# level up from this bot/ folder — so resolve paths relative to this file
# rather than the current working directory.
_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env.local")
load_dotenv(_ROOT / ".env")
# Also honour a .env in the bot dir / cwd if present (no-op otherwise).
load_dotenv()

logging.basicConfig(
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    level=logging.INFO,
)
log = logging.getLogger("mb-bot")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
API_BASE = os.getenv("PLATFORM_API_BASE", "http://web:3000").rstrip("/")
SERVICE_TOKEN = os.getenv("BOT_SERVICE_TOKEN", "")

NOT_LINKED = (
    "🔗 Your Telegram isn't linked yet.\n"
    "Open MetricBase → Settings → Telegram, tap *Connect Telegram*, and send the "
    "code it gives you here as `/start <code>`."
)


async def call_api(path: str, user: Update, extra: dict | None = None) -> tuple[int, dict]:
    """POST to /api/bot/<path> with the service token and the caller's tg id."""
    payload = {"telegram_user_id": user.effective_user.id}
    if user.effective_chat:
        payload["chat_id"] = user.effective_chat.id
    if extra:
        payload.update(extra)
    headers = {"Authorization": f"Bearer {SERVICE_TOKEN}"}
    async with httpx.AsyncClient(timeout=15) as client:
        try:
            res = await client.post(f"{API_BASE}/api/bot/{path}", json=payload, headers=headers)
        except httpx.HTTPError as e:
            log.warning("API call failed: %s", e)
            return 503, {"error": "The platform is unreachable right now. Try again shortly."}
    try:
        return res.status_code, res.json()
    except ValueError:
        return res.status_code, {}


def guard_message(status: int, data: dict) -> str | None:
    """Map common error statuses to a friendly reply; None means OK to proceed."""
    if status == 200 or status == 201:
        return None
    if status == 401 and data.get("error") in ("not_linked", "no_membership"):
        return NOT_LINKED if data.get("error") == "not_linked" else (
            "You're linked but not a member of any workspace yet."
        )
    if status == 403:
        return "🔒 Your role doesn't allow that. Viewers can view reports; ask an admin for access."
    return f"⚠️ {data.get('error', 'Something went wrong.')}"


# ── Commands ──────────────────────────────────────────────────────────────────

async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    args = ctx.args or []
    if args:  # /start <code> — finish linking
        status, data = await call_api("link", update, {"code": args[0],
                                                        "username": update.effective_user.username,
                                                        "full_name": update.effective_user.full_name})
        if status == 200 and data.get("ok"):
            ws = data.get("workspace")
            await update.message.reply_text(
                f"✅ Linked{' as ' + data['name'] if data.get('name') else ''}!"
                + (f" Active workspace: *{ws}*." if ws else "")
                + "\n\nTry /summary, /liftings or /help.",
                parse_mode=ParseMode.MARKDOWN,
            )
        else:
            await update.message.reply_text(data.get("error", "Could not link. Generate a fresh code in Settings."))
        return
    await update.message.reply_text(
        "👋 *MetricBase bot*\n\n" + NOT_LINKED + "\n\nThen use /help to see commands.",
        parse_mode=ParseMode.MARKDOWN,
    )


async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "*Commands*\n"
        "/summary — today's production\n"
        "/recap — this month's recap\n"
        "/stock — current stock balance\n"
        "/liftings — active & tentative liftings\n"
        "/addflow `<node> <inflow|outflow|stock> <volume> [YYYY-MM-DD]` — log a flow (members+)\n"
        "/workspace `[n]` — show or switch active workspace\n"
        "/whoami — your linked account & role",
        parse_mode=ParseMode.MARKDOWN,
    )


async def cmd_whoami(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    status, data = await call_api("whoami", update)
    msg = guard_message(status, data)
    if msg:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return
    await update.message.reply_text(
        f"*{data.get('name') or data.get('email')}*\n"
        f"Workspace: *{data['workspace']}*  ·  Role: *{data['role']}*",
        parse_mode=ParseMode.MARKDOWN,
    )


def _num(v) -> str:
    """Human number: thousands separators, trim noisy float tails."""
    if isinstance(v, bool) or v is None:
        return str(v)
    if isinstance(v, int):
        return f"{v:,}"
    if isinstance(v, float):
        return f"{round(v, 2):,}"
    return str(v)


def _fmt_summary(resp: dict) -> str:
    b = resp.get("data") or {}
    lines = [f"📊 Today's production — {resp.get('workspace', '')} · {b.get('date', '')}", ""]
    lines.append(f"Inflow today: {_num(b.get('total_inflow', 0))} bbl")
    lines.append(f"YTD: inflow {_num(b.get('ytd_inflow', 0))} · lifting {_num(b.get('ytd_lifting', 0))}")

    stocks = b.get("stocks") or []
    if stocks:
        lines += ["", "🛢 Stocks"]
        for s in stocks:
            cap = f" / {_num(s['capacity'])}" if s.get("capacity") else ""
            lines.append(f"• {s.get('name')}: {_num(s.get('volume', 0))}{cap} bbl")

    al = b.get("active_lifting")
    if al:
        lines += ["", "🚢 Active lifting",
                  f"• {al.get('tanker_name')}: {al.get('from_code')} → {al.get('buyer_code')}, "
                  f"nom {_num(al.get('nominated', 0))}, laycan {al.get('laycan_start')}→{al.get('laycan_end')}"]

    sw = b.get("sw_readings") or []
    if sw:
        lines += ["", "💧 Water cut",
                  "  " + " · ".join(f"{r.get('name')} {round((r.get('sw_pct') or 0) * 100, 1)}%" for r in sw)]

    tr = b.get("transfers_today") or []
    if tr:
        lines += ["", "🔄 Transfers today"]
        for t in tr[:8]:
            lines.append(f"• {t.get('from_name')} → {t.get('to_name')}: "
                         f"{_num(t.get('sent', 0))} → {_num(t.get('received', 0))} (Δ {_num(t.get('loss_gain', 0))})")
    return "\n".join(lines)


def _fmt_recap(resp: dict) -> str:
    b = resp.get("data") or {}
    y, m = resp.get("year"), resp.get("month")
    lines = [f"📅 Monthly recap — {resp.get('workspace', '')} · {y}-{str(m).zfill(2)}", ""]

    tmap = b.get("target_map") or {}

    def target_for(node_id: str):
        for k, v in tmap.items():
            if node_id and node_id in k and "production" in k:
                return v
        return None

    inflows = b.get("inflows") or []
    if inflows:
        lines.append("Production (inflow)")
        for r in inflows:
            sw = r.get("avg_sw")
            sw_txt = f", S&W {round(sw * 100, 1)}%" if sw is not None else ""
            tgt = target_for(r.get("node_id", ""))
            tgt_txt = f" — target {_num(tgt)}" if tgt else ""
            lines.append(f"• {r.get('name')}: {_num(r.get('total_vol', 0))} bbl ({r.get('days', 0)}d{sw_txt}){tgt_txt}")
    else:
        lines.append("No inflow recorded this month.")

    lf = b.get("liftings") or {}
    lines += ["", f"Completed liftings: {lf.get('cnt') or 0} ({_num(lf.get('total_bl') or 0)} bbl)"]
    return "\n".join(lines)


def _fmt_stock(resp: dict) -> str:
    rows = resp.get("data") or []
    lines = [f"🛢 Stock balance — {resp.get('workspace', '')}", ""]
    if not rows:
        lines.append("No stock data.")
        return "\n".join(lines)
    for s in rows:
        ms, cs = s.get("measured_stock"), s.get("calculated_stock")
        if ms is not None:
            stock = f"{_num(ms)} bbl"
        elif cs is not None:
            stock = f"{_num(cs)} bbl (calc)"
        else:
            stock = "n/a"
        lg, lgp = s.get("loss_gain"), s.get("loss_gain_pct")
        loss = f" · loss {_num(lg)}" + (f" ({lgp}%)" if lgp is not None else "") if lg else ""
        lines.append(f"• {s.get('node_name')}: {stock}{loss}")
    return "\n".join(lines)


async def cmd_summary(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    status, data = await call_api("summary", update)
    msg = guard_message(status, data)
    if msg:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return
    # Plain text (no Markdown): analytics values contain '_' which Markdown mangles.
    await update.message.reply_text(_fmt_summary(data))


async def cmd_recap(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    status, data = await call_api("recap", update)
    msg = guard_message(status, data)
    if msg:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return
    await update.message.reply_text(_fmt_recap(data))


async def cmd_stock(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    status, data = await call_api("stock", update)
    msg = guard_message(status, data)
    if msg:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return
    await update.message.reply_text(_fmt_stock(data))


async def cmd_liftings(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    status, data = await call_api("liftings", update)
    msg = guard_message(status, data)
    if msg:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return
    liftings = data.get("liftings", [])
    if not liftings:
        await update.message.reply_text("No active or tentative liftings.")
        return
    lines = [f"*Liftings* — {data.get('workspace', '')}".strip()]
    for l in liftings:
        lines.append(
            f"• *{l['tanker']}* [{l['status']}] {l.get('from') or '?'} → {l.get('buyer') or '?'}"
            + (f", BL {l['blVolume']}" if l.get("blVolume") else "")
            + (f", ETA {l['eta']}" if l.get("eta") else "")
        )
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def cmd_workspace(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    args = ctx.args or []
    extra = {"set": args[0]} if args else None
    status, data = await call_api("workspace", update, extra)
    msg = guard_message(status, data)
    if msg:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return
    active = data["active"]
    lines = [f"Active: *{active['name']}* ({active['role']})", "", "Workspaces:"]
    for i, w in enumerate(data["workspaces"], 1):
        mark = " ←" if w["id"] == active["id"] else ""
        lines.append(f"{i}. {w['name']} ({w['role']}){mark}")
    lines.append("\nSwitch with `/workspace <n>`.")
    await update.message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)


async def cmd_addflow(update: Update, ctx: ContextTypes.DEFAULT_TYPE) -> None:
    args = ctx.args or []
    if len(args) < 3:
        await update.message.reply_text(
            "Usage: `/addflow <node> <inflow|outflow|stock> <volume> [YYYY-MM-DD]`\n"
            "e.g. `/addflow WELL-1 inflow 1200`",
            parse_mode=ParseMode.MARKDOWN,
        )
        return
    node_code, flow_type, volume = args[0], args[1].lower(), args[2]
    extra = {"node_code": node_code, "flowType": flow_type, "volume": volume}
    if len(args) >= 4:
        extra["date"] = args[3]
    status, data = await call_api("flow", update, extra)
    msg = guard_message(status, data)
    if msg:
        await update.message.reply_text(msg, parse_mode=ParseMode.MARKDOWN)
        return
    f = data["flow"]
    await update.message.reply_text(
        f"✅ Logged {f['flowType']} {f['volume']} on {f['date']} for {node_code}.")


def main() -> None:
    if not TOKEN:
        log.warning("TELEGRAM_BOT_TOKEN not set — bot idle.")
        import time
        while True:
            time.sleep(3600)

    app = Application.builder().token(TOKEN).build()
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("whoami", cmd_whoami))
    app.add_handler(CommandHandler("summary", cmd_summary))
    app.add_handler(CommandHandler("recap", cmd_recap))
    app.add_handler(CommandHandler("stock", cmd_stock))
    app.add_handler(CommandHandler("liftings", cmd_liftings))
    app.add_handler(CommandHandler("workspace", cmd_workspace))
    app.add_handler(CommandHandler("addflow", cmd_addflow))

    log.info("Bot starting (long polling). API base: %s", API_BASE)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
