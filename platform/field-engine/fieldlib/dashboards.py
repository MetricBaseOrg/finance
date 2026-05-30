"""Per-user custom dashboard layouts for the widget builder.

One row per user in `user_dashboards`. `layout_json` is the entire layout
serialised as JSON — Gridstack widget positions plus per-widget config
(viz type, metric / formula, node selection, date range, options).

Schema of layout_json:

    {
      "widgets": [
        {
          "id":      "w-<short-uuid>",
          "type":    "kpi" | "line" | "bar" | "pie" | "donut" | "table" | "sankey",
          "title":   "...",
          "x": 0, "y": 0, "w": 4, "h": 3,
          "nodes":   [<node_id>, ...],
          "metric":  "<metric_id>"   | null,
          "formula": "<expression>"  | null,
          "period":  { "type": "7d" | "mtd" | "qtd" | "ytd" | "custom",
                       "from": "YYYY-MM-DD" | null,
                       "to":   "YYYY-MM-DD" | null },
          "options": { ... }   // viz-specific (stacked, show_legend, ...)
        }
      ]
    }
"""
import json
from .core import get_db

EMPTY_LAYOUT = {"widgets": []}


def _ensure_default_dashboard(user_id):
    """Ensure user has at least one dashboard (My Dashboard)."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM user_dashboards WHERE user_id=? LIMIT 1",
            (user_id,),
        ).fetchone()
        if not row:
            conn.execute(
                """INSERT INTO user_dashboards (user_id, name, layout_json, active)
                   VALUES (?, 'My Dashboard', ?, 1)""",
                (user_id, json.dumps(EMPTY_LAYOUT, separators=(",", ":"))),
            )


def get_active_dashboard_id(user_id):
    """Get currently active dashboard ID for user."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM user_dashboards WHERE user_id=? AND active=1 LIMIT 1",
            (user_id,),
        ).fetchone()
        if row:
            return row["id"]
        row = conn.execute(
            "SELECT id FROM user_dashboards WHERE user_id=? ORDER BY id LIMIT 1",
            (user_id,),
        ).fetchone()
        if row:
            conn.execute(
                "UPDATE user_dashboards SET active=1 WHERE id=?", (row["id"],)
            )
            return row["id"]
    return None


def list_dashboards(user_id):
    """List all dashboards for user: [{id, name, active}, ...]."""
    _ensure_default_dashboard(user_id)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, active FROM user_dashboards WHERE user_id=? ORDER BY id",
            (user_id,),
        ).fetchall()
    return [
        {"id": r["id"], "name": r["name"], "active": bool(r["active"])}
        for r in rows
    ]


def get_layout(user_id, dashboard_id=None):
    """Get layout for a dashboard. Uses active dashboard if not specified."""
    _ensure_default_dashboard(user_id)
    if dashboard_id is None:
        dashboard_id = get_active_dashboard_id(user_id)
    if not dashboard_id:
        return dict(EMPTY_LAYOUT)
    with get_db() as conn:
        row = conn.execute(
            "SELECT layout_json FROM user_dashboards WHERE user_id=? AND id=?",
            (user_id, dashboard_id),
        ).fetchone()
    if not row:
        return dict(EMPTY_LAYOUT)
    try:
        layout = json.loads(row["layout_json"])
    except (TypeError, ValueError):
        return dict(EMPTY_LAYOUT)
    if not isinstance(layout, dict) or "widgets" not in layout:
        return dict(EMPTY_LAYOUT)
    return layout


def save_layout(user_id, layout, dashboard_id=None):
    """Save layout to a dashboard. Uses active dashboard if not specified."""
    if not isinstance(layout, dict) or not isinstance(layout.get("widgets"), list):
        raise ValueError("layout must be {'widgets': [...]}.")
    if dashboard_id is None:
        dashboard_id = get_active_dashboard_id(user_id)
    payload = json.dumps(layout, separators=(",", ":"))
    with get_db() as conn:
        conn.execute(
            """UPDATE user_dashboards
               SET layout_json = ?, updated_at = datetime('now')
               WHERE user_id=? AND id=?""",
            (payload, user_id, dashboard_id),
        )
    return layout


def create_dashboard(user_id, name):
    """Create a new dashboard for the user."""
    if not name or not isinstance(name, str):
        raise ValueError("name required.")
    name = name.strip()[:80]
    with get_db() as conn:
        try:
            cursor = conn.execute(
                """INSERT INTO user_dashboards (user_id, name, layout_json, active)
                   VALUES (?, ?, ?, 0)""",
                (user_id, name, json.dumps(EMPTY_LAYOUT, separators=(",", ":"))),
            )
            return {"id": cursor.lastrowid, "name": name, "active": False}
        except Exception as e:
            raise ValueError(f"Dashboard '{name}' already exists.") from e


def rename_dashboard(user_id, dashboard_id, name):
    """Rename a dashboard."""
    if not name or not isinstance(name, str):
        raise ValueError("name required.")
    name = name.strip()[:80]
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM user_dashboards WHERE user_id=? AND name=? AND id!=?",
            (user_id, name, dashboard_id),
        ).fetchone()
        if existing:
            raise ValueError(f"Dashboard '{name}' already exists.")
        conn.execute(
            "UPDATE user_dashboards SET name=? WHERE user_id=? AND id=?",
            (name, user_id, dashboard_id),
        )


def select_dashboard(user_id, dashboard_id):
    """Make a dashboard the active one for the user."""
    with get_db() as conn:
        conn.execute(
            "UPDATE user_dashboards SET active=0 WHERE user_id=?", (user_id,)
        )
        conn.execute(
            "UPDATE user_dashboards SET active=1 WHERE user_id=? AND id=?",
            (user_id, dashboard_id),
        )


def delete_dashboard(user_id, dashboard_id):
    """Delete a dashboard (cannot delete if it's the only one)."""
    with get_db() as conn:
        count = conn.execute(
            "SELECT COUNT(*) as cnt FROM user_dashboards WHERE user_id=?",
            (user_id,),
        ).fetchone()
        if count["cnt"] <= 1:
            raise ValueError("Cannot delete the last dashboard.")
        conn.execute(
            "DELETE FROM user_dashboards WHERE user_id=? AND id=?",
            (user_id, dashboard_id),
        )


def delete_layout(user_id):
    """Deprecated: kept for backwards compatibility."""
    pass


def get_all_kpi_widgets(user_id):
    """Return every KPI widget across all of the user's dashboards.

    Each entry is the raw widget dict from layout_json, augmented with
    `_dashboard_id` and `_dashboard_name` so callers can group by source
    dashboard (used for cross-dashboard formula references and the chip
    picker). Non-KPI widgets and widgets without a title are skipped.
    """
    _ensure_default_dashboard(user_id)
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, layout_json FROM user_dashboards WHERE user_id=? ORDER BY id",
            (user_id,),
        ).fetchall()

    out = []
    for r in rows:
        try:
            layout = json.loads(r["layout_json"])
        except (TypeError, ValueError):
            continue
        widgets = (layout or {}).get("widgets") or []
        for w in widgets:
            if not isinstance(w, dict):
                continue
            if w.get("type") != "kpi":
                continue
            if not (w.get("title") or "").strip():
                continue
            entry = dict(w)
            entry["_dashboard_id"] = r["id"]
            entry["_dashboard_name"] = r["name"]
            out.append(entry)
    return out
