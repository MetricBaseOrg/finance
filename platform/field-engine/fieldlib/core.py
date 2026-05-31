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
import threading
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


# Reuse one Postgres connection per worker thread. Opening a fresh connection
# per request means a full TLS handshake to Neon every time (~seconds from a
# distant client); keeping a warm per-thread connection removes that cost. The
# engine is read-only, so the connection runs in autocommit mode. waitress
# serves requests on a thread pool and psycopg connections are not safe to share
# across threads, hence thread-local rather than a single global.
_local = threading.local()


def _get_conn():
    conn = getattr(_local, "conn", None)
    if conn is None or conn.closed:
        conn = psycopg.connect(_DSN, row_factory=dict_row, autocommit=True)
        _local.conn = conn
    return conn


class _ConnShim:
    def execute(self, sql, params=()):
        tsql = _translate(sql)
        p = tuple(params) if params else None
        try:
            return _get_conn().execute(tsql, p)
        except (psycopg.OperationalError, psycopg.InterfaceError):
            # Stale/dropped connection (e.g. Neon idle timeout) — reset and retry once.
            try:
                if getattr(_local, "conn", None):
                    _local.conn.close()
            except Exception:
                pass
            _local.conn = None
            return _get_conn().execute(tsql, p)

    def commit(self):
        pass  # autocommit

    def rollback(self):
        try:
            _get_conn().rollback()
        except Exception:
            pass


@contextmanager
def get_db():
    yield _ConnShim()


def init_db():
    # No-op: Prisma owns DDL. Present so imports don't break.
    pass
