"""FieldFlow compute engine — Phase 3b.

Runs the proven FieldFlow analytics / metrics / formula-DSL code READ-ONLY
against the shared Postgres. The Next.js app owns the schema and all writes via
Prisma; its /api/field/analytics/* and /api/field/formula-eval handlers proxy
here with the org id (as `company_id`) and a shared X-Engine-Token.

The @map directives in schema.prisma make the physical Postgres tables/columns
identical to FieldFlow's sqlite schema, and fieldlib/core.py translates the
remaining sqlite SQL dialect — so the ported modules run largely unchanged.

NOTE: this needs validation against a live Postgres with seeded field data
(no DB is available at port time). Iterate here if a query errors.
"""
import os

from flask import Flask, jsonify, request
from waitress import serve

from fieldlib import analytics, formula

app = Flask(__name__)
TOKEN = os.getenv("FIELD_ENGINE_TOKEN", "")


@app.before_request
def _auth():
    if request.path == "/health":
        return None
    if TOKEN and request.headers.get("X-Engine-Token") != TOKEN:
        return jsonify({"error": "forbidden"}), 403
    return None


@app.get("/health")
def health():
    return jsonify({"status": "ok", "phase": "3b"})


def _company():
    cid = request.args.get("company_id")
    if not cid:
        raise ValueError("company_id required")
    return cid


def _int(name):
    v = request.args.get(name)
    return int(v) if v not in (None, "") else None


# ── Analytics dispatch ──────────────────────────────────────────────────────
# Maps /compute/analytics/<name> to a FieldFlow analytics function. Each lambda
# pulls the query params that function accepts.

_ANALYTICS = {
    "summary": lambda c: analytics.get_today_summary(c),
    "ops-kpis": lambda c: analytics.get_ops_kpis(c, spark_days=_int("spark_days") or 14),
    "monthly-summary": lambda c: analytics.get_monthly_summary(c, _int("year"), _int("month")),
    "sankey": lambda c: analytics.get_flow_sankey(
        c, year=_int("year"), date_from=request.args.get("date_from"), date_to=request.args.get("date_to")
    ),
    "inflow-series": lambda c: analytics.get_node_inflow_series(
        c, date_from=request.args.get("date_from"), date_to=request.args.get("date_to"), days=_int("days") or 365
    ),
    "stock-balance": lambda c: analytics.get_stock_balance(
        c, node_id=request.args.get("node_id"),
        date_from=request.args.get("date_from"), date_to=request.args.get("date_to")
    ),
    "stock-history": lambda c: analytics.get_calculated_stock_history(
        c, date_from=request.args.get("date_from"), date_to=request.args.get("date_to"),
        days=_int("days") or 90, node_id=request.args.get("node_id")
    ),
    "monthly-inflow": lambda c: analytics.get_monthly_inflow_totals(c, _int("year")),
    "monthly-lifting": lambda c: analytics.get_monthly_lifting_totals(c, _int("year")),
}


@app.get("/compute/analytics/<name>")
def compute_analytics(name):
    fn = _ANALYTICS.get(name)
    if not fn:
        return jsonify({"error": f"unknown analytics '{name}'"}), 404
    try:
        return jsonify(fn(_company()))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:  # surface the failing query during 3b validation
        app.logger.exception("analytics %s failed", name)
        return jsonify({"error": f"{type(e).__name__}: {e}"}), 500


@app.post("/compute/formula/eval")
def compute_formula():
    body = request.get_json(silent=True) or {}
    expr = (body.get("expr") or "").strip()
    cid = request.args.get("company_id") or body.get("company_id")
    if not expr or not cid:
        return jsonify({"error": "expr and company_id required"}), 400
    try:
        result = formula.evaluate(
            expr, cid,
            node_ids=body.get("node_ids"),
            date_from=body.get("date_from"),
            date_to=body.get("date_to"),
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": f"{type(e).__name__}: {e}"}), 400


if __name__ == "__main__":
    serve(app, host="0.0.0.0", port=5001)
