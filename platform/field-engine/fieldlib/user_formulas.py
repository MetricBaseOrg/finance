"""Per-user saved formula library.

A saved formula is a named reusable expression — same dialect as a widget's
custom formula (plain metric ids, NODECODE_metric refs, and `[Widget Title]`
bracket refs). Saved formulas themselves are reachable via the same bracket
syntax: `[%PEP-STN]` resolves to a widget if one exists with that title,
otherwise falls back to the saved-formula library.

`ref_series_mode` ('auto' | 'daily' | 'cumulative') picks how widget refs
inside this saved formula resolve their per-day series — same semantic as
the per-widget option, but scoped to this saved formula.

Cycle detection (across widget refs + saved-formula refs) lives in
`api/dashboards.py` `_build_widget_context()`.
"""
from .core import get_db


ALLOWED_REF_MODES = ('auto', 'daily', 'cumulative')


def list_user_formulas(user_id):
    """Return every saved formula for the user, ordered by name."""
    with get_db() as conn:
        rows = conn.execute(
            """SELECT id, name, expr, description, ref_series_mode,
                      created_at, updated_at
               FROM user_formulas
               WHERE user_id = ?
               ORDER BY name COLLATE NOCASE""",
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


def get_user_formula(user_id, formula_id):
    """Fetch a single formula by id (scoped to the owner)."""
    with get_db() as conn:
        row = conn.execute(
            """SELECT id, name, expr, description, ref_series_mode,
                      created_at, updated_at
               FROM user_formulas
               WHERE user_id = ? AND id = ?""",
            (user_id, formula_id),
        ).fetchone()
    return dict(row) if row else None


def get_user_formula_by_name(user_id, name):
    """Case-insensitive whitespace-collapsed lookup, mirroring widget refs."""
    if not name:
        return None
    key = ' '.join(name.split()).lower()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, expr, description, ref_series_mode FROM user_formulas WHERE user_id = ?",
            (user_id,),
        ).fetchall()
    for r in rows:
        if ' '.join((r['name'] or '').split()).lower() == key:
            return dict(r)
    return None


def create_user_formula(user_id, name, expr, description=None, ref_series_mode='auto'):
    """Insert a new saved formula. Returns the new row dict."""
    name = (name or '').strip()
    expr = (expr or '').strip()
    if not name:
        raise ValueError("Formula name required.")
    if not expr:
        raise ValueError("Formula expression required.")
    if ref_series_mode not in ALLOWED_REF_MODES:
        ref_series_mode = 'auto'
    with get_db() as conn:
        existing = conn.execute(
            "SELECT id FROM user_formulas WHERE user_id = ? AND name = ?",
            (user_id, name),
        ).fetchone()
        if existing:
            raise ValueError(f"A saved formula named '{name}' already exists.")
        cur = conn.execute(
            """INSERT INTO user_formulas (user_id, name, expr, description, ref_series_mode)
               VALUES (?, ?, ?, ?, ?)""",
            (user_id, name, expr, description, ref_series_mode),
        )
        new_id = cur.lastrowid
    return get_user_formula(user_id, new_id)


def update_user_formula(user_id, formula_id, *, name=None, expr=None,
                        description=None, ref_series_mode=None):
    """Partially update a saved formula. Only the supplied fields change."""
    fields, params = [], []
    if name is not None:
        n = name.strip()
        if not n:
            raise ValueError("Formula name cannot be empty.")
        fields.append("name = ?")
        params.append(n)
    if expr is not None:
        e = expr.strip()
        if not e:
            raise ValueError("Formula expression cannot be empty.")
        fields.append("expr = ?")
        params.append(e)
    if description is not None:
        fields.append("description = ?")
        params.append(description)
    if ref_series_mode is not None:
        m = ref_series_mode if ref_series_mode in ALLOWED_REF_MODES else 'auto'
        fields.append("ref_series_mode = ?")
        params.append(m)
    if not fields:
        return get_user_formula(user_id, formula_id)
    fields.append("updated_at = datetime('now')")
    params.extend([user_id, formula_id])
    with get_db() as conn:
        try:
            conn.execute(
                f"UPDATE user_formulas SET {', '.join(fields)} "
                f"WHERE user_id = ? AND id = ?",
                params,
            )
        except Exception as e:
            # UNIQUE(user_id, name) violation = name collision
            raise ValueError(f"Cannot rename: '{name}' is already taken.") from e
    return get_user_formula(user_id, formula_id)


def delete_user_formula(user_id, formula_id):
    """Delete a saved formula. Returns True if a row was removed."""
    with get_db() as conn:
        cur = conn.execute(
            "DELETE FROM user_formulas WHERE user_id = ? AND id = ?",
            (user_id, formula_id),
        )
    return cur.rowcount > 0
