"""Postgres connection shim for the ported FieldFlow compute modules.

The original FieldFlow code targets sqlite3: `with get_db() as conn:
conn.execute(sql, params).fetchall()`, `?` placeholders, and a handful of
sqlite-only SQL functions. This shim runs that code against the shared Postgres
(read-only) by:

  * exposing a sqlite3-like connection (`.execute(...)` returns a cursor whose
    rows are dict-like — keys match the @map-ped snake_case columns),
  * rewriting `?` → `%s`,
  * translating the sqlite SQL functions the engine uses (strftime, date(),
    date('now', …)) to their Postgres equivalents.

NOTE: this is the hybrid boundary. Prisma owns the schema + all writes; this
shim only ever SELECTs. The @map directives in schema.prisma make the physical
tables/columns identical to FieldFlow's, so the ported SQL matches.
"""
import os
import re
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

DB_PATH = None  # unused (kept so `from .core import DB_PATH` still imports)

_DSN = os.getenv("DATABASE_URL", "")


# ── sqlite → postgres SQL translation ───────────────────────────────────────

def _translate(sql: str) -> str:
    # strftime('%Y-%m', X) / '%Y' / '%m' / '%d' on ISO 'YYYY-MM-DD' text cols.
    sql = re.sub(r"strftime\(\s*'%Y-%m'\s*,\s*([^)]+?)\s*\)", r"substr(\1,1,7)", sql)
    sql = re.sub(r"strftime\(\s*'%Y'\s*,\s*([^)]+?)\s*\)", r"substr(\1,1,4)", sql)
    sql = re.sub(r"strftime\(\s*'%m'\s*,\s*([^)]+?)\s*\)", r"substr(\1,6,2)", sql)
    sql = re.sub(r"strftime\(\s*'%d'\s*,\s*([^)]+?)\s*\)", r"substr(\1,9,2)", sql)
    # date('now', <param>)  → relative date as 'YYYY-MM-DD' text
    sql = re.sub(
        r"date\(\s*'now'\s*,\s*\?\s*\)",
        "to_char((now() + (?)::interval), 'YYYY-MM-DD')",
        sql,
    )
    sql = re.sub(r"date\(\s*'now'\s*\)", "to_char(now(), 'YYYY-MM-DD')", sql)
    # date(<col>) on a text date → normalise to first 10 chars.
    sql = re.sub(r"\bdate\(\s*([A-Za-z_][\w.]*)\s*\)", r"substr(\1,1,10)", sql)
    # IFNULL → COALESCE (sqlite alias)
    sql = re.sub(r"\bIFNULL\b", "COALESCE", sql, flags=re.IGNORECASE)
    # sqlite stores booleans as 0/1; Prisma maps `active` to a real Postgres
    # boolean, which rejects `active=1`. Normalise the integer-boolean idiom.
    sql = re.sub(r"\bactive\s*=\s*1\b", "active=true", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\bactive\s*=\s*0\b", "active=false", sql, flags=re.IGNORECASE)
    # positional placeholders
    sql = sql.replace("?", "%s")
    return sql


class _ConnShim:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        # psycopg's Connection.execute returns a Cursor (rows are dicts here).
        return self._conn.execute(_translate(sql), tuple(params) if params else None)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


@contextmanager
def get_db():
    conn = psycopg.connect(_DSN, row_factory=dict_row)
    try:
        yield _ConnShim(conn)
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    # No-op: Prisma owns DDL. Present so imports don't break.
    pass
