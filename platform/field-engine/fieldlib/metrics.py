"""Metric catalog for the custom dashboard widget builder.

Each metric exposes a uniform `fetch(company_id, node_ids, date_from, date_to)`
that returns:

    {
        'series':  [{'date': 'YYYY-MM-DD', 'value': float|None}, ...],
        'by_node': {node_id: {'series': [...], 'total': float|None}},
        'total':   float | None,
    }

`series` is the company-level daily aggregate (summed across the selected
nodes). `by_node` is per-node breakdown for the same window. `total` is the
period sum for company-level metrics, or the network average for ratio
metrics.

All metrics are agnostic to the visualisation — the API returns this shape
and the frontend picks how to render it (KPI = total, line/bar = series,
table = series + by_node, pie/donut = by_node totals).

`node_ids` is a list of node IDs to scope the metric to. Empty / None means
"all active nodes". Date strings are inclusive ISO dates; either side can be
omitted (defaults to a reasonable window — typically last 90 days).
"""
from datetime import date, timedelta
from .core import get_db


# ── Period helpers ─────────────────────────────────────────────────────────────

def resolve_period(period_type, date_from=None, date_to=None, anchor=None):
    """Translate a preset period type into concrete (date_from, date_to) ISO strings.

    period_type: '1d' | '7d' | 'mtd' | 'qtd' | 'ytd' | 'custom'
    `custom` keeps the supplied date_from / date_to as-is.
    `anchor` (date) defaults to today and acts as the "now" for rolling windows.
    """
    anchor = anchor or date.today()
    pt = (period_type or 'custom').lower()
    if pt == '1d':
        return anchor.isoformat(), anchor.isoformat()
    if pt == '7d':
        return (anchor - timedelta(days=6)).isoformat(), anchor.isoformat()
    if pt == 'mtd':
        return date(anchor.year, anchor.month, 1).isoformat(), anchor.isoformat()
    if pt == 'qtd':
        q_start_month = ((anchor.month - 1) // 3) * 3 + 1
        return date(anchor.year, q_start_month, 1).isoformat(), anchor.isoformat()
    if pt == 'ytd':
        return date(anchor.year, 1, 1).isoformat(), anchor.isoformat()
    # custom — return as-is (may be None)
    return date_from, date_to


def _date_list(date_from, date_to):
    """Inclusive ISO date list. Empty if either bound is missing."""
    if not date_from or not date_to:
        return []
    a = date.fromisoformat(date_from)
    b = date.fromisoformat(date_to)
    if b < a:
        return []
    return [(a + timedelta(days=i)).isoformat() for i in range((b - a).days + 1)]


def _node_filter(node_ids, alias):
    """Build SQL fragment + params to filter by an optional node id list.

    Returns (sql_fragment, params_list). Empty / None list → no filter.
    """
    if not node_ids:
        return "", []
    placeholders = ",".join("?" for _ in node_ids)
    return f" AND {alias} IN ({placeholders})", list(node_ids)


def _empty_result():
    return {"series": [], "by_node": {}, "total": None}


# ── Daily flow metrics (inflow / outflow / stock + sw_pct) ────────────────────

def _daily_flow(company_id, node_ids, date_from, date_to, flow_type,
                value_col="volume", agg="SUM"):
    """Generic daily aggregation over `flows` for a given flow_type."""
    with get_db() as conn:
        sql_n, p_n = _node_filter(node_ids, "f.node_id")

        # Company-level daily series
        # date(f.date) normalises 'YYYY-MM-DD HH:MM:SS' → 'YYYY-MM-DD' so
        # rows keyed by datetime strings (e.g. from Excel imports) still match
        # the plain-date strings produced by _date_list().
        params = [company_id, date_from, date_to, flow_type] + p_n
        rows = conn.execute(
            f"""SELECT date(f.date) as date, {agg}(f.{value_col}) as v
                  FROM flows f
                 WHERE f.company_id=? AND date(f.date) BETWEEN ? AND ?
                   AND f.flow_type=?{sql_n}
              GROUP BY date(f.date)
              ORDER BY date(f.date)""",
            params).fetchall()
        by_date = {r["date"]: (float(r["v"]) if r["v"] is not None else None) for r in rows}

        # Per-node daily series
        rows_n = conn.execute(
            f"""SELECT date(f.date) as date, f.node_id, {agg}(f.{value_col}) as v
                  FROM flows f
                 WHERE f.company_id=? AND date(f.date) BETWEEN ? AND ?
                   AND f.flow_type=?{sql_n}
              GROUP BY date(f.date), f.node_id
              ORDER BY date(f.date)""",
            params).fetchall()

    dates = _date_list(date_from, date_to)
    # SUM flows densify missing days to 0 (no flow that day == 0 bbl) so line
    # charts render a continuous series rather than a single point. AVG keeps
    # None for missing days — averaging over absent readings would be wrong.
    missing_default = 0.0 if agg == "SUM" else None
    series = [{"date": d, "value": by_date.get(d, missing_default)} for d in dates]
    total_vals = [v for v in by_date.values() if v is not None]
    if agg == "SUM":
        total = sum(total_vals) if total_vals else 0.0
    elif agg == "AVG":
        total = (sum(total_vals) / len(total_vals)) if total_vals else None
    else:
        total = None

    by_node = {}
    for r in rows_n:
        nid = r["node_id"]
        if nid not in by_node:
            by_node[nid] = {"series": {d: missing_default for d in dates}, "total": 0.0, "count": 0}
        v = float(r["v"]) if r["v"] is not None else None
        if v is not None:
            by_node[nid]["series"][r["date"]] = v
            by_node[nid]["total"] += v
            by_node[nid]["count"] += 1

    for nid, slot in by_node.items():
        slot["series"] = [{"date": d, "value": slot["series"][d]} for d in dates]
        if agg == "AVG":
            slot["total"] = (slot["total"] / slot["count"]) if slot["count"] else None
        slot.pop("count", None)

    return {"series": series, "by_node": by_node, "total": total}


def metric_inflow(company_id, node_ids=None, date_from=None, date_to=None):
    return _daily_flow(company_id, node_ids, date_from, date_to, "inflow")


def metric_outflow(company_id, node_ids=None, date_from=None, date_to=None):
    return _daily_flow(company_id, node_ids, date_from, date_to, "outflow")


def metric_stock_snapshots(company_id, node_ids=None, date_from=None, date_to=None):
    """Daily stock readings (taken as the SUM across selected nodes per day)."""
    return _daily_flow(company_id, node_ids, date_from, date_to, "stock")


def metric_sw_avg(company_id, node_ids=None, date_from=None, date_to=None):
    """Per-day average S&W % across the selected nodes."""
    return _daily_flow(company_id, node_ids, date_from, date_to,
                       flow_type="inflow", value_col="sw_pct", agg="AVG")


# ── Transfer metrics (transfers_in / transfers_out) ───────────────────────────

def _daily_transfers(company_id, node_ids, date_from, date_to, side):
    """side='in' → grouped by to_node_id, value=COALESCE(receipt_volume,volume).
       side='out' → grouped by from_node_id, value=volume."""
    with get_db() as conn:
        if side == "in":
            node_col, val_expr = "to_node_id", "COALESCE(receipt_volume, volume)"
        else:
            node_col, val_expr = "from_node_id", "volume"

        sql_n, p_n = _node_filter(node_ids, f"t.{node_col}")
        params = [company_id, date_from, date_to] + p_n

        rows = conn.execute(
            f"""SELECT date(t.date) as date, SUM({val_expr}) as v
                  FROM transfers t
                 WHERE t.company_id=? AND date(t.date) BETWEEN ? AND ?{sql_n}
              GROUP BY date(t.date)
              ORDER BY date(t.date)""",
            params).fetchall()
        rows_n = conn.execute(
            f"""SELECT date(t.date) as date, t.{node_col} as nid, SUM({val_expr}) as v
                  FROM transfers t
                 WHERE t.company_id=? AND date(t.date) BETWEEN ? AND ?{sql_n}
              GROUP BY date(t.date), t.{node_col}
              ORDER BY date(t.date)""",
            params).fetchall()

    dates = _date_list(date_from, date_to)
    by_date = {r["date"]: float(r["v"] or 0.0) for r in rows}
    series = [{"date": d, "value": by_date.get(d, 0.0)} for d in dates]
    total = sum(by_date.values()) if by_date else 0.0

    by_node = {}
    for r in rows_n:
        nid = r["nid"]
        if nid not in by_node:
            by_node[nid] = {"series": {d: 0.0 for d in dates}, "total": 0.0}
        v = float(r["v"] or 0.0)
        by_node[nid]["series"][r["date"]] = v
        by_node[nid]["total"] += v
    for slot in by_node.values():
        slot["series"] = [{"date": d, "value": slot["series"][d]} for d in dates]

    return {"series": series, "by_node": by_node, "total": total}


def metric_transfers_in(company_id, node_ids=None, date_from=None, date_to=None):
    return _daily_transfers(company_id, node_ids, date_from, date_to, side="in")


def metric_transfers_out(company_id, node_ids=None, date_from=None, date_to=None):
    return _daily_transfers(company_id, node_ids, date_from, date_to, side="out")


# ── Lifting metrics (BL volume per day, keyed on start_load) ──────────────────

def metric_lifting_volume(company_id, node_ids=None, date_from=None, date_to=None):
    """Daily lifting BL volume from completed liftings.

    Scoped by `from_node_id` when node_ids is supplied (i.e. lifts dispatched
    from the selected source nodes).
    """
    with get_db() as conn:
        sql_n, p_n = _node_filter(node_ids, "l.from_node_id")
        params = [company_id, date_from, date_to] + p_n
        rows = conn.execute(
            f"""SELECT date(l.start_load) as d, SUM(l.bl_volume) as v
                  FROM liftings l
                 WHERE l.company_id=? AND l.status='completed'
                   AND l.start_load IS NOT NULL
                   AND date(l.start_load) BETWEEN ? AND ?{sql_n}
              GROUP BY date(l.start_load)
              ORDER BY d""",
            params).fetchall()
        rows_n = conn.execute(
            f"""SELECT date(l.start_load) as d, l.from_node_id as nid,
                       SUM(l.bl_volume) as v
                  FROM liftings l
                 WHERE l.company_id=? AND l.status='completed'
                   AND l.start_load IS NOT NULL
                   AND date(l.start_load) BETWEEN ? AND ?{sql_n}
              GROUP BY date(l.start_load), l.from_node_id
              ORDER BY d""",
            params).fetchall()

    dates = _date_list(date_from, date_to)
    by_date = {r["d"]: float(r["v"] or 0.0) for r in rows}
    series = [{"date": d, "value": by_date.get(d, 0.0)} for d in dates]
    total = sum(by_date.values()) if by_date else 0.0

    by_node = {}
    for r in rows_n:
        nid = r["nid"]
        if nid not in by_node:
            by_node[nid] = {"series": {d: 0.0 for d in dates}, "total": 0.0}
        v = float(r["v"] or 0.0)
        by_node[nid]["series"][r["d"]] = v
        by_node[nid]["total"] += v
    for slot in by_node.values():
        slot["series"] = [{"date": d, "value": slot["series"][d]} for d in dates]

    return {"series": series, "by_node": by_node, "total": total}


# ── L/G (throughput Loss/Gain) ────────────────────────────────────────────────

def _lg_per_node_per_day(company_id, node_ids, date_from, date_to):
    """Per-day, per-node inbound source vs destination measurements.

    Returns { (date_iso, node_id): {src, dst} } where:
      - src = source-measured volume dispatched TOWARD this node
              (transfers.volume + liftings.bl_volume, both keyed by destination)
      - dst = destination-measured volume RECEIVED at this node
              (COALESCE(transfers.receipt_volume, transfers.volume) +
               COALESCE(liftings.cqd_volume, liftings.bl_volume))

    Edge L/G per cell = dst − src. Outbound flows are NOT included — L/G is a
    property of inbound edges only in the new custody-transfer model.
    """
    with get_db() as conn:
        sql_in_n,   p_in_n   = _node_filter(node_ids, "t.to_node_id")
        sql_in_l_n, p_in_l_n = _node_filter(node_ids, "l.buyer_node_id")

        recv_x = conn.execute(
            f"""SELECT date(t.date) as d, t.to_node_id as nid,
                       SUM(t.volume) as src,
                       SUM(COALESCE(t.receipt_volume, t.volume)) as dst
                  FROM transfers t
                 WHERE t.company_id=? AND date(t.date) BETWEEN ? AND ?{sql_in_n}
              GROUP BY date(t.date), t.to_node_id""",
            [company_id, date_from, date_to] + p_in_n).fetchall()
        recv_l = conn.execute(
            f"""SELECT date(l.start_load) as d, l.buyer_node_id as nid,
                       SUM(l.bl_volume) as src,
                       SUM(COALESCE(l.cqd_volume, l.bl_volume)) as dst
                  FROM liftings l
                 WHERE l.company_id=? AND l.status='completed'
                   AND l.start_load IS NOT NULL
                   AND date(l.start_load) BETWEEN ? AND ?{sql_in_l_n}
              GROUP BY date(l.start_load), l.buyer_node_id""",
            [company_id, date_from, date_to] + p_in_l_n).fetchall()

    # Aggregate {(date, nid): {src, dst}}
    cells = {}
    for rows in (recv_x, recv_l):
        for r in rows:
            if not r["d"] or r["nid"] is None:
                continue
            k = (r["d"], r["nid"])
            cells.setdefault(k, {"src": 0.0, "dst": 0.0})
            cells[k]["src"] += float(r["src"] or 0.0)
            cells[k]["dst"] += float(r["dst"] or 0.0)
    return cells


def metric_loss_gain(company_id, node_ids=None, date_from=None, date_to=None):
    """Daily custody-transfer L/G in bbl: destination_meter − source_meter on inbound edges.

    Only nodes with inbound flow in the window contribute. Source-only nodes
    (wells/fields with no inbound) are silently skipped.

    Sign convention: positive = gain (measurement anomaly), negative = loss in transit.
    """
    cells = _lg_per_node_per_day(company_id, node_ids, date_from, date_to)
    dates = _date_list(date_from, date_to)

    by_date = {d: 0.0 for d in dates}
    by_node = {}
    total = 0.0
    has_any = False

    for (d, nid), v in cells.items():
        if v["src"] <= 0:
            continue  # node had no inbound this cell
        lg = v["dst"] - v["src"]
        if d in by_date:
            by_date[d] += lg
        if nid not in by_node:
            by_node[nid] = {"series": {dd: 0.0 for dd in dates}, "total": 0.0}
        if d in by_node[nid]["series"]:
            by_node[nid]["series"][d] += lg
        by_node[nid]["total"] += lg
        total += lg
        has_any = True

    series = [{"date": d, "value": by_date[d]} for d in dates]
    for slot in by_node.values():
        slot["series"] = [{"date": d, "value": slot["series"][d]} for d in dates]
    return {"series": series, "by_node": by_node,
            "total": total if has_any else None}


def metric_loss_gain_pct(company_id, node_ids=None, date_from=None, date_to=None):
    """Daily throughput L/G as a percentage (lg / dispatch × 100)."""
    cells = _lg_per_node_per_day(company_id, node_ids, date_from, date_to)
    dates = _date_list(date_from, date_to)

    # Custody-transfer L/G percent: lg / source_dispatched × 100, per inbound cell.
    day_lg  = {d: 0.0 for d in dates}
    day_src = {d: 0.0 for d in dates}
    by_node = {}
    total_lg  = 0.0
    total_src = 0.0

    for (d, nid), v in cells.items():
        if v["src"] <= 0:
            continue
        lg = v["dst"] - v["src"]
        if d in day_lg:
            day_lg[d]  += lg
            day_src[d] += v["src"]
        if nid not in by_node:
            by_node[nid] = {
                "series":    {dd: {"lg": 0.0, "src": 0.0} for dd in dates},
                "total_lg":  0.0, "total_src": 0.0,
            }
        if d in by_node[nid]["series"]:
            by_node[nid]["series"][d]["lg"]  += lg
            by_node[nid]["series"][d]["src"] += v["src"]
        by_node[nid]["total_lg"]  += lg
        by_node[nid]["total_src"] += v["src"]
        total_lg  += lg
        total_src += v["src"]

    series = []
    for d in dates:
        if day_src[d] > 0:
            series.append({"date": d, "value": day_lg[d] / day_src[d] * 100})
        else:
            series.append({"date": d, "value": None})

    by_node_out = {}
    for nid, slot in by_node.items():
        s = []
        for d in dates:
            cell = slot["series"][d]
            if cell["src"] > 0:
                s.append({"date": d, "value": cell["lg"] / cell["src"] * 100})
            else:
                s.append({"date": d, "value": None})
        total = (slot["total_lg"] / slot["total_src"] * 100) if slot["total_src"] > 0 else None
        by_node_out[nid] = {"series": s, "total": total}

    total = (total_lg / total_src * 100) if total_src > 0 else None
    return {"series": series, "by_node": by_node_out, "total": total}


# ── Stock snapshots: latest measured + calculated derived from running ────────

def metric_calculated_stock(company_id, node_ids=None, date_from=None, date_to=None):
    """Daily calculated stock per node (opening + Σ transfers/liftings to-date).

    Returns a per-node series. The aggregate `series` is the SUM across nodes.
    """
    with get_db() as conn:
        sql_n, p_n = _node_filter(node_ids, "id")
        node_rows = conn.execute(
            f"""SELECT id, COALESCE(opening_stock, 0) as opening_stock
                  FROM nodes
                 WHERE company_id=? AND active=1{sql_n}""",
            [company_id] + p_n).fetchall()

        node_ids_resolved = [r["id"] for r in node_rows]
        if not node_ids_resolved:
            return _empty_result()

        ph = ",".join("?" for _ in node_ids_resolved)
        recv_x = conn.execute(
            f"""SELECT to_node_id as nid, date(date) as d,
                       SUM(COALESCE(receipt_volume, volume)) as v
                  FROM transfers
                 WHERE company_id=? AND to_node_id IN ({ph})
              GROUP BY to_node_id, date(date)""",
            [company_id] + node_ids_resolved).fetchall()
        disp_x = conn.execute(
            f"""SELECT from_node_id as nid, date(date) as d, SUM(volume) as v
                  FROM transfers
                 WHERE company_id=? AND from_node_id IN ({ph})
              GROUP BY from_node_id, date(date)""",
            [company_id] + node_ids_resolved).fetchall()
        recv_l = conn.execute(
            f"""SELECT buyer_node_id as nid, date(start_load) as d,
                       SUM(COALESCE(cqd_volume, bl_volume)) as v
                  FROM liftings
                 WHERE company_id=? AND status='completed'
                   AND start_load IS NOT NULL
                   AND buyer_node_id IN ({ph})
              GROUP BY buyer_node_id, date(start_load)""",
            [company_id] + node_ids_resolved).fetchall()
        disp_l = conn.execute(
            f"""SELECT from_node_id as nid, date(start_load) as d,
                       SUM(bl_volume) as v
                  FROM liftings
                 WHERE company_id=? AND status='completed'
                   AND start_load IS NOT NULL
                   AND from_node_id IN ({ph})
              GROUP BY from_node_id, date(start_load)""",
            [company_id] + node_ids_resolved).fetchall()

    # Build daily delta per node (signed)
    deltas = {nid: {} for nid in node_ids_resolved}
    for r in recv_x:
        deltas[r["nid"]][r["d"]] = deltas[r["nid"]].get(r["d"], 0.0) + float(r["v"] or 0.0)
    for r in recv_l:
        deltas[r["nid"]][r["d"]] = deltas[r["nid"]].get(r["d"], 0.0) + float(r["v"] or 0.0)
    for r in disp_x:
        deltas[r["nid"]][r["d"]] = deltas[r["nid"]].get(r["d"], 0.0) - float(r["v"] or 0.0)
    for r in disp_l:
        deltas[r["nid"]][r["d"]] = deltas[r["nid"]].get(r["d"], 0.0) - float(r["v"] or 0.0)

    dates = _date_list(date_from, date_to)
    if not dates:
        return _empty_result()
    start_iso = dates[0]

    by_node = {}
    agg_series = {d: 0.0 for d in dates}

    for n in node_rows:
        nid = n["id"]
        running = float(n["opening_stock"] or 0.0)
        # Apply deltas strictly before the window
        for d, delta in deltas[nid].items():
            if d and d < start_iso:
                running += delta
        slot_series = []
        for d in dates:
            running += deltas[nid].get(d, 0.0)
            slot_series.append({"date": d, "value": running})
            agg_series[d] += running
        by_node[nid] = {"series": slot_series, "total": slot_series[-1]["value"]}

    series = [{"date": d, "value": agg_series[d]} for d in dates]
    total = series[-1]["value"] if series else None
    return {"series": series, "by_node": by_node, "total": total}


def metric_measured_stock(company_id, node_ids=None, date_from=None, date_to=None):
    """Most recent measured stock reading per node within the window.

    `series` is the daily sum of latest-known-as-of-day measurements across
    selected nodes (carries last known reading forward day-by-day).
    """
    with get_db() as conn:
        sql_n, p_n = _node_filter(node_ids, "f.node_id")
        rows = conn.execute(
            f"""SELECT date(f.date) as date, f.node_id, f.volume
                  FROM flows f
                 WHERE f.company_id=? AND f.flow_type='stock'
                   AND date(f.date) BETWEEN ? AND ?{sql_n}
              ORDER BY f.node_id, date(f.date)""",
            [company_id, date_from, date_to] + p_n).fetchall()

    dates = _date_list(date_from, date_to)
    if not dates:
        return _empty_result()

    by_node_dict = {}
    for r in rows:
        by_node_dict.setdefault(r["node_id"], {})[r["date"]] = float(r["volume"] or 0.0)

    agg_series = {d: 0.0 for d in dates}
    by_node = {}
    for nid, day_map in by_node_dict.items():
        running = None
        s = []
        for d in dates:
            if d in day_map:
                running = day_map[d]
            s.append({"date": d, "value": running})
            if running is not None:
                agg_series[d] += running
        latest = s[-1]["value"] if s else None
        by_node[nid] = {"series": s, "total": latest}

    series = [{"date": d, "value": agg_series[d]} for d in dates]
    total = series[-1]["value"] if series else None
    return {"series": series, "by_node": by_node, "total": total}


# ── Targets + Achievement ─────────────────────────────────────────────────────

def metric_target(company_id, node_ids=None, date_from=None, date_to=None):
    """Pro-rated daily target (target_vol / days_in_month) across the window.

    Returns a flat per-day target series. Aggregates ALL categories together —
    callers wanting only production or only lifting should filter upstream.
    """
    from calendar import monthrange
    with get_db() as conn:
        sql_n, p_n = _node_filter(node_ids, "node_id")
        rows = conn.execute(
            f"""SELECT node_id, year, month, COALESCE(SUM(target_vol),0) as v
                  FROM targets
                 WHERE company_id=?{sql_n}
              GROUP BY node_id, year, month""",
            [company_id] + p_n).fetchall()

    dates = _date_list(date_from, date_to)
    if not dates:
        return _empty_result()

    # Build per-(year,month) total + per-node-(year,month)
    month_total = {}    # (y,m) -> total target
    node_month = {}     # (nid, y, m) -> target
    for r in rows:
        key = (r["year"], r["month"])
        month_total[key] = month_total.get(key, 0.0) + float(r["v"] or 0.0)
        node_month[(r["node_id"], r["year"], r["month"])] = float(r["v"] or 0.0)

    by_node_ids = set(nid for (nid, *_) in node_month.keys())

    agg_series = []
    by_node = {nid: {"series": [], "total": 0.0} for nid in by_node_ids}
    company_total = 0.0
    for d in dates:
        y, m, _ = (int(x) for x in d.split("-"))
        dim = monthrange(y, m)[1]
        daily = (month_total.get((y, m), 0.0) / dim) if dim else 0.0
        agg_series.append({"date": d, "value": daily})
        company_total += daily
        for nid in by_node_ids:
            slot = (node_month.get((nid, y, m), 0.0) / dim) if dim else 0.0
            by_node[nid]["series"].append({"date": d, "value": slot})
            by_node[nid]["total"] += slot

    return {"series": agg_series, "by_node": by_node, "total": company_total}


def metric_actual_vs_target_pct(company_id, node_ids=None, date_from=None, date_to=None):
    """Production achievement: inflow ÷ pro-rated target × 100, daily."""
    inflow = metric_inflow(company_id, node_ids, date_from, date_to)
    target = metric_target(company_id, node_ids, date_from, date_to)

    target_by_date = {p["date"]: p["value"] for p in target["series"]}
    series = []
    for p in inflow["series"]:
        t = target_by_date.get(p["date"]) or 0.0
        v = p["value"] or 0.0
        series.append({"date": p["date"], "value": (v / t * 100) if t > 0 else None})

    # by_node achievement
    by_node = {}
    for nid, slot in inflow["by_node"].items():
        t_slot = target["by_node"].get(nid, {"series": []})
        t_by_d = {p["date"]: p["value"] for p in t_slot.get("series", [])}
        s = []
        for p in slot["series"]:
            t = t_by_d.get(p["date"]) or 0.0
            v = p["value"] or 0.0
            s.append({"date": p["date"], "value": (v / t * 100) if t > 0 else None})
        t_total = t_slot.get("total") or 0.0
        v_total = slot["total"] or 0.0
        by_node[nid] = {"series": s,
                        "total": (v_total / t_total * 100) if t_total > 0 else None}

    in_total = inflow["total"] or 0.0
    tg_total = target["total"] or 0.0
    total = (in_total / tg_total * 100) if tg_total > 0 else None
    return {"series": series, "by_node": by_node, "total": total}


# ── Catalog ───────────────────────────────────────────────────────────────────

METRICS = {
    "inflow":               {"label": "Inflow (volume)",         "unit": "bbl", "fn": metric_inflow},
    "outflow":              {"label": "Outflow (volume)",        "unit": "bbl", "fn": metric_outflow},
    "stock":                {"label": "Stock readings (sum)",    "unit": "bbl", "fn": metric_stock_snapshots},
    "transfers_in":         {"label": "Transfers received",      "unit": "bbl", "fn": metric_transfers_in},
    "transfers_out":        {"label": "Transfers dispatched",    "unit": "bbl", "fn": metric_transfers_out},
    "lifting_volume":       {"label": "Lifting volume (BL)",     "unit": "bbl", "fn": metric_lifting_volume},
    "loss_gain":            {"label": "Loss / Gain",             "unit": "bbl", "fn": metric_loss_gain},
    "loss_gain_pct":        {"label": "Loss / Gain %",           "unit": "%",   "fn": metric_loss_gain_pct},
    "calculated_stock":     {"label": "Calculated stock",        "unit": "bbl", "fn": metric_calculated_stock},
    "measured_stock":       {"label": "Measured stock (latest)", "unit": "bbl", "fn": metric_measured_stock},
    "sw_avg":               {"label": "S&W average %",           "unit": "%",   "fn": metric_sw_avg},
    "target":               {"label": "Target (pro-rated daily)","unit": "bbl", "fn": metric_target},
    "actual_vs_target_pct": {"label": "Production vs target %",  "unit": "%",   "fn": metric_actual_vs_target_pct},
}


def catalog():
    """Return the metric catalog for the frontend dropdown."""
    return [{"id": mid, "label": m["label"], "unit": m["unit"]}
            for mid, m in METRICS.items()]


def fetch(metric_id, company_id, node_ids=None, date_from=None, date_to=None):
    """Resolve a metric id and run its fetcher."""
    m = METRICS.get(metric_id)
    if not m:
        raise ValueError(f"Unknown metric '{metric_id}'.")
    return m["fn"](company_id, node_ids or [], date_from, date_to)
