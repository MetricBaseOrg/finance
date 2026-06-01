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

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

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


# Pooled Postgres connections. Opening a connection means a full TLS handshake
# to Neon (~seconds from a distant client). A pool keeps a set of connections
# warm and pre-opened at startup, so no request — not even the first — pays that
# cost, and the engine never holds more than `max_size` connections open. The
# engine is read-only, so connections run in autocommit mode. `check` validates
# a connection on checkout and transparently recycles ones Neon dropped while
# idle. waitress serves on a thread pool; the pool hands each request its own
# connection for the duration of the `with get_db()` block.
_POOL_MIN = int(os.getenv("FIELD_ENGINE_POOL_MIN", "2"))
_POOL_MAX = int(os.getenv("FIELD_ENGINE_POOL_MAX", "8"))


def _configure(conn):
    conn.autocommit = True


_pool = ConnectionPool(
    _DSN,
    min_size=_POOL_MIN,
    max_size=_POOL_MAX,
    kwargs={"row_factory": dict_row},
    configure=_configure,
    check=ConnectionPool.check_connection,
    name="field-engine",
    open=False,
)


def _ensure_open():
    # Lazy, idempotent open. wait=True pre-warms `min_size` connections so the
    # first analytics call is already fast; tolerant if Neon is briefly slow.
    if _pool.closed:
        _pool.open(wait=True, timeout=30)


class _ConnShim:
    """sqlite3-like wrapper over a pooled connection, with SQL translation."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, sql, params=()):
        return self._conn.execute(_translate(sql), tuple(params) if params else None)

    def commit(self):
        pass  # autocommit

    def rollback(self):
        try:
            self._conn.rollback()
        except Exception:
            pass


@contextmanager
def get_db():
    _ensure_open()
    # Borrow a connection for the whole `with get_db()` block; callers run all
    # their .execute().fetch*() within it, then it returns to the pool.
    with _pool.connection() as conn:
        yield _ConnShim(conn)


def init_db():
    # No-op: Prisma owns DDL. Present so imports don't break.
    pass
