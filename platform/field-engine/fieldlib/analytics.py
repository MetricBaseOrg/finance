"""Analytics queries — dashboard aggregates and Sankey flow data."""
from datetime import date, datetime, timedelta
from calendar import monthrange
from .core import get_db


def get_today_summary(company_id):
    """Today's KPIs: latest inflow, stock per node, active lifting."""
    with get_db() as conn:
        # Find the most recent date with inflow data
        row = conn.execute(
            "SELECT MAX(date) as m FROM flows WHERE company_id=? AND flow_type='inflow'",
            (company_id,)).fetchone()
        latest_date = row['m'] if row and row['m'] else date.today().isoformat()

        # Total inflow on that date
        total_inflow = conn.execute(
            "SELECT SUM(volume) as t FROM flows "
            "WHERE company_id=? AND flow_type='inflow' AND date=?",
            (company_id, latest_date)).fetchone()

        # Latest-ever S&W reading per node — keyed by node_id for inline display,
        # and a parallel list with node code/name/type for the "other nodes" section
        sw_rows = conn.execute(
            """SELECT f.node_id, f.sw_pct, n.code, n.name, n.node_type
               FROM flows f JOIN nodes n ON n.id = f.node_id
               WHERE f.company_id=? AND f.sw_pct IS NOT NULL
                 AND f.date = (SELECT MAX(date) FROM flows f2
                               WHERE f2.node_id = f.node_id AND f2.sw_pct IS NOT NULL)
               GROUP BY f.node_id, f.sw_pct, n.code, n.name, n.node_type
               ORDER BY n.node_type, n.code""",
            (company_id,)).fetchall()
        sw_rows = [dict(r) for r in sw_rows]
        sw_by_node = {r['node_id']: r['sw_pct'] for r in sw_rows}

        # Latest stock snapshots
        stocks = conn.execute(
            """SELECT f.node_id, f.volume, n.code, n.name, n.node_type, n.capacity
               FROM flows f JOIN nodes n ON n.id = f.node_id
               WHERE f.company_id=? AND f.flow_type='stock'
                 AND f.date = (
                     SELECT MAX(f2.date) FROM flows f2
                     WHERE f2.node_id = f.node_id AND f2.flow_type='stock')
               ORDER BY n.node_type, n.code""",
            (company_id,)).fetchall()
        stocks = [dict(s) for s in stocks]
        for s in stocks:
            s['sw_pct'] = sw_by_node.get(s['node_id'])

        # Transfers on latest_date, aggregated per edge (from -> to)
        xfer_edges = conn.execute(
            """SELECT fn.code as from_code, tn.code as to_code,
                      fn.name as from_name, tn.name as to_name,
                      SUM(t.volume) as sent,
                      SUM(COALESCE(t.receipt_volume, t.volume)) as received
               FROM transfers t
               JOIN nodes fn ON fn.id = t.from_node_id
               JOIN nodes tn ON tn.id = t.to_node_id
               WHERE t.company_id=? AND t.date=?
               GROUP BY t.from_node_id, t.to_node_id, fn.code, tn.code, fn.name, tn.name
               ORDER BY sent DESC""",
            (company_id, latest_date)).fetchall()
        transfers_today = []
        for r in xfer_edges:
            sent     = r['sent'] or 0
            received = r['received'] or 0
            transfers_today.append({
                'from_code': r['from_code'], 'to_code': r['to_code'],
                'from_name': r['from_name'], 'to_name': r['to_name'],
                'sent':      sent,
                'received':  received,
                'loss_gain': received - sent,
                'kind':      'transfer',
            })

        # Completed liftings on latest_date, aggregated per edge
        lift_edges = conn.execute(
            """SELECT fn.code as from_code, bn.code as to_code,
                      fn.name as from_name, bn.name as to_name,
                      SUM(l.bl_volume) as sent,
                      SUM(COALESCE(l.cqd_volume, l.bl_volume)) as received
               FROM liftings l
               LEFT JOIN nodes fn ON fn.id = l.from_node_id
               LEFT JOIN nodes bn ON bn.id = l.buyer_node_id
               WHERE l.company_id=? AND l.status='completed'
                 AND substr(l.start_load,1,10)=?
               GROUP BY l.from_node_id, l.buyer_node_id, fn.code, bn.code, fn.name, bn.name""",
            (company_id, latest_date)).fetchall()
        for r in lift_edges:
            if not r['from_code'] or not r['to_code']:
                continue
            sent     = r['sent'] or 0
            received = r['received'] or 0
            transfers_today.append({
                'from_code': r['from_code'], 'to_code': r['to_code'],
                'from_name': r['from_name'], 'to_name': r['to_name'],
                'sent':      sent,
                'received':  received,
                'loss_gain': received - sent,
                'kind':      'lifting',
            })

        # Active lifting
        active_lift = conn.execute(
            """SELECT l.*, fn.code as from_code, bn.code as buyer_code
               FROM liftings l
               LEFT JOIN nodes fn ON fn.id = l.from_node_id
               LEFT JOIN nodes bn ON bn.id = l.buyer_node_id
               WHERE l.company_id=? AND l.status='active'
               ORDER BY l.created_at DESC LIMIT 1""",
            (company_id,)).fetchone()

        # YTD inflow total
        year = latest_date[:4]
        ytd_inflow = conn.execute(
            "SELECT SUM(volume) as t FROM flows "
            "WHERE company_id=? AND flow_type='inflow' AND date LIKE ?",
            (company_id, f"{year}-%")).fetchone()

        # YTD lifting volume (completed liftings)
        ytd_lift = conn.execute(
            "SELECT SUM(bl_volume) as t FROM liftings "
            "WHERE company_id=? AND status='completed' AND start_load LIKE ?",
            (company_id, f"{year}-%")).fetchone()

        return {
            'date':          latest_date,
            'total_inflow':  total_inflow['t'] or 0.0,
            'sw_by_node':    sw_by_node,
            'sw_readings':   sw_rows,
            'stocks':        stocks,
            'transfers_today': transfers_today,
            'active_lifting': dict(active_lift) if active_lift else None,
            'ytd_inflow':    ytd_inflow['t'] or 0.0,
            'ytd_lifting':   ytd_lift['t'] or 0.0,
        }


def get_monthly_summary(company_id, year, month):
    """Monthly inflow vs target per node, and lifting count/volume."""
    with get_db() as conn:
        month_str = f"{year:04d}-{month:02d}"
        inflows = conn.execute(
            """SELECT n.id as node_id, n.code, n.name,
                      SUM(f.volume) as total_vol,
                      AVG(f.sw_pct) as avg_sw,
                      COUNT(DISTINCT f.date) as days
               FROM flows f JOIN nodes n ON n.id = f.node_id
               WHERE f.company_id=? AND f.flow_type='inflow'
                 AND strftime('%Y-%m', f.date) = ?
               GROUP BY f.node_id""",
            (company_id, month_str)).fetchall()

        liftings = conn.execute(
            """SELECT COUNT(*) as cnt, SUM(bl_volume) as total_bl
               FROM liftings
               WHERE company_id=? AND status='completed'
                 AND strftime('%Y-%m', start_load) = ?""",
            (company_id, month_str)).fetchone()

        targets = conn.execute(
            """SELECT t.node_id, t.category, t.target_vol
               FROM targets t
               WHERE company_id=? AND year=? AND month=?""",
            (company_id, year, month)).fetchall()

        target_map = {(r['node_id'], r['category']): r['target_vol'] for r in targets}

        return {
            'year': year, 'month': month,
            'inflows': [dict(r) for r in inflows],
            'liftings': dict(liftings) if liftings else {},
            'target_map': {str(k): v for k, v in target_map.items()},
        }


def get_flow_sankey(company_id, year=None, date_from=None, date_to=None):
    """Build Sankey flow data from transfers + liftings.

    Source nodes (wells, fields) appear naturally on the left — no synthetic
    'Production' node. The leftmost node in a chain is whichever node has
    transfers out but no transfers in.
    """
    with get_db() as conn:
        params_xfer = [company_id]
        params_lift = [company_id]
        date_cond_xfer = ""
        date_cond_lift = ""

        if date_from or date_to:
            if date_from:
                date_cond_xfer += " AND t.date >= ?"
                date_cond_lift += " AND l.start_load >= ?"
                params_xfer.append(date_from)
                params_lift.append(date_from)
            if date_to:
                date_cond_xfer += " AND t.date <= ?"
                date_cond_lift += " AND l.start_load <= ?"
                params_xfer.append(date_to)
                params_lift.append(date_to)
        else:
            if not year:
                row = conn.execute(
                    "SELECT MAX(date) as m FROM flows WHERE company_id=?",
                    (company_id,)).fetchone()
                year = row['m'][:4] if row and row['m'] else str(date.today().year)
            like = f"{year}-%"
            date_cond_xfer = " AND t.date LIKE ?"
            date_cond_lift = " AND l.start_load LIKE ?"
            params_xfer.append(like)
            params_lift.append(like)

        # Transfers between nodes
        xfers = conn.execute(
            f"""SELECT fn.name as from_name, tn.name as to_name, SUM(t.volume) as vol
               FROM transfers t
               JOIN nodes fn ON fn.id = t.from_node_id
               JOIN nodes tn ON tn.id = t.to_node_id
               WHERE t.company_id=? {date_cond_xfer}
               GROUP BY t.from_node_id, t.to_node_id ORDER BY vol DESC""",
            params_xfer).fetchall()

        # Lifting outflows (storage/terminal → buyer)
        lifts = conn.execute(
            f"""SELECT fn.name as from_name, bn.name as buyer_name,
                      SUM(l.bl_volume) as vol
               FROM liftings l
               LEFT JOIN nodes fn ON fn.id = l.from_node_id
               LEFT JOIN nodes bn ON bn.id = l.buyer_node_id
               WHERE l.company_id=? AND l.status='completed' {date_cond_lift}
               GROUP BY l.from_node_id, l.buyer_node_id""",
            params_lift).fetchall()

        edges = []
        for r in xfers:
            if (r['vol'] or 0) > 0:
                edges.append({'from': r['from_name'], 'to': r['to_name'],
                               'flow': round(r['vol'])})
        for r in lifts:
            if r['from_name'] and r['buyer_name'] and (r['vol'] or 0) > 0:
                edges.append({'from': r['from_name'],
                               'to': r['buyer_name'] or 'Buyer',
                               'flow': round(r['vol'])})

        # ── Per-edge L/G ──────────────────────────────────────────────────
        # For each (from, to) pair, L/G = destination_measured − source_measured.
        # This is the actual custody-transfer measurement discrepancy on that
        # transit segment. Keyed by "from_name->to_name" for the Sankey tooltip.
        edge_xfer = conn.execute(
            f"""SELECT fn.name as f, tn.name as t,
                       SUM(transfers.volume) as src,
                       SUM(COALESCE(transfers.receipt_volume, transfers.volume)) as dst
                FROM transfers
                JOIN nodes fn ON fn.id = transfers.from_node_id
                JOIN nodes tn ON tn.id = transfers.to_node_id
                WHERE transfers.company_id=? {date_cond_xfer.replace('t.', 'transfers.')}
                GROUP BY transfers.from_node_id, transfers.to_node_id""",
            params_xfer).fetchall()
        edge_lift = conn.execute(
            f"""SELECT fn.name as f, bn.name as t,
                       SUM(liftings.bl_volume) as src,
                       SUM(COALESCE(liftings.cqd_volume, liftings.bl_volume)) as dst
                FROM liftings
                LEFT JOIN nodes fn ON fn.id = liftings.from_node_id
                LEFT JOIN nodes bn ON bn.id = liftings.buyer_node_id
                WHERE liftings.company_id=? AND liftings.status='completed' {date_cond_lift.replace('l.', 'liftings.')}
                GROUP BY liftings.from_node_id, liftings.buyer_node_id""",
            params_lift).fetchall()

        edge_lg = {}
        for r in list(edge_xfer) + list(edge_lift):
            if not r['f'] or not r['t']:
                continue
            key = f"{r['f']}->{r['t']}"
            src = r['src'] or 0
            dst = r['dst'] or 0
            lg  = dst - src
            edge_lg[key] = {
                'source_dispatched': src,
                'destination_received': dst,
                'loss_gain': lg,
                'loss_gain_pct': round(lg / src * 100, 4) if src > 0 else None,
            }

        # ── Per-node L/G — sum of inbound-edge L/Gs (custody-transfer style) ──
        node_names = {e['from'] for e in edges} | {e['to'] for e in edges}
        node_lg = {}
        # Aggregate inbound edges per destination node
        for key, e in edge_lg.items():
            _, to_name = key.split('->', 1)
            slot = node_lg.setdefault(to_name, {
                'total_dispatched_toward': 0,
                'total_received': 0,
            })
            slot['total_dispatched_toward'] += e['source_dispatched']
            slot['total_received']          += e['destination_received']

        for name in node_names:
            slot = node_lg.get(name)
            if slot and slot['total_dispatched_toward'] > 0:
                lg = slot['total_received'] - slot['total_dispatched_toward']
                slot['loss_gain'] = lg
                slot['loss_gain_pct'] = round(lg / slot['total_dispatched_toward'] * 100, 4)
            else:
                # Source-only node (no inbound) — no L/G to report
                node_lg[name] = {
                    'total_dispatched_toward': 0,
                    'total_received': 0,
                    'loss_gain': None,
                    'loss_gain_pct': None,
                }

        return {'year': year, 'flows': edges, 'node_lg': node_lg, 'edge_lg': edge_lg}


def get_stock_balance(company_id, node_id=None, date_from=None, date_to=None):
    """Custody-transfer L/G per node — measurement discrepancy on inbound edges.

    Per-edge L/G (the unit of oil accounting): for every transfer/lifting,
        edge_lg = destination_meter_reading - source_meter_reading
                = COALESCE(receipt_volume, volume) - volume         (transfers)
                = COALESCE(cqd_volume, bl_volume) - bl_volume       (liftings)

    Per-node L/G is the SUM of L/Gs on all inbound edges of that node:
        node_lg = Σ (receipt_volume - volume)      over transfers WHERE to_node=N
                + Σ (cqd_volume - bl_volume)       over liftings  WHERE buyer_node=N

    Sign convention: negative = loss in transit, positive = gain (usually a
    measurement anomaly). When `receipt_volume`/`cqd_volume` are not recorded
    they fall back to the source-side value, so the L/G is 0 — correctly
    signalling "no measurement discrepancy known".

    Source-only nodes (no inbound transfers or liftings) return `loss_gain=None`.

    Response fields (per node):
      - `total_dispatches`     = source-measured volume OUT (transfers + liftings)
      - `total_receipts`       = destination-measured volume IN (transfers receipt + liftings cqd)
      - `total_dispatched_toward` = source-measured volume IN (what upstream said it sent)
      - `loss_gain`            = total_receipts − total_dispatched_toward
      - `loss_gain_pct`        = loss_gain / total_dispatched_toward × 100

    Optional `date_from`/`date_to` restrict to that window.
    """
    with get_db() as conn:
        node_filter = "AND n.id = ?" if node_id else ""
        params = [company_id]
        if node_id:
            params.append(node_id)

        nodes = conn.execute(
            f"""SELECT n.id, n.code, n.name, n.node_type,
                       COALESCE(n.opening_stock, 0) as opening_stock
                FROM nodes n
                WHERE n.company_id=? {node_filter}
                  AND n.active=1
                  AND n.node_type != 'buyer'
                ORDER BY n.node_type, n.code""",
            params).fetchall()

        # Reusable date predicates
        def with_dates(base_params, col):
            sql = ""
            p = list(base_params)
            if date_from:
                sql += f" AND {col} >= ?"
                p.append(date_from)
            if date_to:
                sql += f" AND {col} <= ?"
                p.append(date_to)
            return sql, p

        results = []
        for n in nodes:
            nid = n['id']

            # ── Inbound (transfers + liftings where N is the destination) ────
            # `dispatched_toward` = source-measured volume sent toward N by upstream
            # `received_at`     = destination-measured volume actually arriving at N
            # Per-edge L/G aggregates to: received_at − dispatched_toward
            sql, p = with_dates([company_id, nid], "date")
            in_xfer = conn.execute(
                f"SELECT COALESCE(SUM(t.volume),0) as src, "
                f"       COALESCE(SUM(COALESCE(t.receipt_volume, t.volume)),0) as dst "
                f"FROM transfers t WHERE t.company_id=? AND t.to_node_id=?{sql}",
                p).fetchone()

            sql, p = with_dates([company_id, nid], "start_load")
            in_lift = conn.execute(
                f"SELECT COALESCE(SUM(l.bl_volume),0) as src, "
                f"       COALESCE(SUM(COALESCE(l.cqd_volume, l.bl_volume)),0) as dst "
                f"FROM liftings l WHERE l.company_id=? AND l.buyer_node_id=? AND l.status='completed'{sql}",
                p).fetchone()

            dispatched_toward = in_xfer['src'] + in_lift['src']
            receipts          = in_xfer['dst'] + in_lift['dst']

            # ── Outbound (transfers + liftings where N is the source) ────────
            # Still useful for the calculated-stock display, but no longer the
            # basis of L/G — L/G belongs to inbound edges.
            sql, p = with_dates([company_id, nid], "date")
            out_xfer = conn.execute(
                f"SELECT COALESCE(SUM(volume),0) as t FROM transfers "
                f"WHERE company_id=? AND from_node_id=?{sql}",
                p).fetchone()

            sql, p = with_dates([company_id, nid], "start_load")
            out_lift = conn.execute(
                f"SELECT COALESCE(SUM(bl_volume),0) as t FROM liftings "
                f"WHERE company_id=? AND from_node_id=? AND status='completed'{sql}",
                p).fetchone()

            dispatches = out_xfer['t'] + out_lift['t']

            measured_row = conn.execute(
                """SELECT volume, date FROM flows
                   WHERE company_id=? AND node_id=? AND flow_type='stock'
                   ORDER BY date DESC LIMIT 1""",
                (company_id, nid)).fetchone()

            opening = n['opening_stock']
            calculated = opening + receipts - dispatches
            measured = measured_row['volume'] if measured_row else None
            last_date = measured_row['date'] if measured_row else None

            # Per-edge L/G aggregated to the node level. A node with no inbound
            # (wells / fields with no upstream) returns None — they have no
            # transit measurement to compare against.
            if dispatched_toward > 0:
                loss_gain = receipts - dispatched_toward
                loss_gain_pct = loss_gain / dispatched_toward * 100
            else:
                loss_gain = None
                loss_gain_pct = None

            results.append({
                'node_id':              nid,
                'node_code':            n['code'],
                'node_name':            n['name'],
                'node_type':            n['node_type'],
                'opening_stock':        opening,
                'total_receipts':       receipts,
                'total_dispatches':     dispatches,
                'dispatched_toward':    dispatched_toward,
                'calculated_stock':     calculated,
                'measured_stock':       measured,
                'loss_gain':            loss_gain,
                'loss_gain_pct':        round(loss_gain_pct, 4) if loss_gain_pct is not None else None,
                'last_measured_date':   last_date,
            })

        return results[0] if (node_id and results) else results


def get_node_inflow_series(company_id, date_from=None, date_to=None, days=365):
    """Daily inflow totals per node for trend charts."""
    with get_db() as conn:
        q = """SELECT f.date, n.code as node_code, n.name as node_name,
                      SUM(f.volume) as volume, AVG(f.sw_pct) as sw_pct
               FROM flows f JOIN nodes n ON n.id = f.node_id
               WHERE f.company_id=? AND f.flow_type='inflow'"""
        params = [company_id]
        if date_from or date_to:
            if date_from:
                q += " AND f.date >= ?"
                params.append(date_from)
            if date_to:
                q += " AND f.date <= ?"
                params.append(date_to)
        else:
            q += " AND f.date >= date('now', ?)"
            params.append(f'-{days} days')
            
        q += " GROUP BY f.date, f.node_id, n.code, n.name ORDER BY f.date"
        return [dict(r) for r in conn.execute(q, params).fetchall()]


def get_monthly_inflow_totals(company_id, year):
    """Return list of 12 monthly inflow totals for a given year [jan..dec]."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT CAST(strftime('%m', date) AS INTEGER) AS month,
                   COALESCE(SUM(volume), 0) AS actual
            FROM flows
            WHERE company_id = ?
              AND flow_type = 'inflow'
              AND strftime('%Y', date) = ?
            GROUP BY month
        """, (company_id, str(year))).fetchall()

        monthly = [0] * 12
        for r in rows:
            if 1 <= r['month'] <= 12:
                monthly[r['month'] - 1] = r['actual'] or 0
        return monthly


def get_monthly_lifting_totals(company_id, year):
    """Return list of 12 monthly completed lifting BL volumes for a given year [jan..dec]."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT CAST(strftime('%m', start_load) AS INTEGER) AS month,
                   COALESCE(SUM(bl_volume), 0) AS actual
            FROM liftings
            WHERE company_id = ?
              AND status = 'completed'
              AND start_load IS NOT NULL
              AND strftime('%Y', start_load) = ?
            GROUP BY month
        """, (company_id, str(year))).fetchall()

        monthly = [0] * 12
        for r in rows:
            if 1 <= r['month'] <= 12:
                monthly[r['month'] - 1] = r['actual'] or 0
        return monthly


def get_calculated_stock_history(company_id, date_from=None, date_to=None, days=90, node_id=None):
    """Daily calculated stock per storage node for trend charts."""
    from datetime import date, timedelta
    
    with get_db() as conn:
        q = """SELECT id, code, name, COALESCE(opening_stock, 0) as opening_stock
               FROM nodes
               WHERE company_id=? AND node_type IN ('storage','pipeline','terminal') AND active=1"""
        params = [company_id]
        if node_id:
            q += " AND id=?"
            params.append(node_id)
            
        nodes = conn.execute(q, params).fetchall()
        
        xin = conn.execute(
            """SELECT to_node_id as node_id, date(date) as date, SUM(volume) as vol
               FROM transfers WHERE company_id=? GROUP BY to_node_id, date(date)""",
            (company_id,)
        ).fetchall()
        
        xout = conn.execute(
            """SELECT from_node_id as node_id, date(date) as date, SUM(volume) as vol
               FROM transfers WHERE company_id=? GROUP BY from_node_id, date(date)""",
            (company_id,)
        ).fetchall()
        
        lout = conn.execute(
            """SELECT from_node_id as node_id, date(start_load) as date, SUM(bl_volume) as vol
               FROM liftings WHERE company_id=? AND status='completed' AND start_load IS NOT NULL
               GROUP BY from_node_id, date(start_load)""",
            (company_id,)
        ).fetchall()
        
    changes = {}
    for n in nodes:
        changes[n['id']] = {}
        
    for r in xin:
        if r['node_id'] in changes and r['date']:
            changes[r['node_id']][r['date']] = changes[r['node_id']].get(r['date'], 0.0) + r['vol']
            
    for r in xout:
        if r['node_id'] in changes and r['date']:
            changes[r['node_id']][r['date']] = changes[r['node_id']].get(r['date'], 0.0) - r['vol']
            
    for r in lout:
        if r['node_id'] in changes and r['date']:
            changes[r['node_id']][r['date']] = changes[r['node_id']].get(r['date'], 0.0) - r['vol']
            
    end_date = date.fromisoformat(date_to) if date_to else date.today()
    start_date = date.fromisoformat(date_from) if date_from else (end_date - timedelta(days=days))
    span_days = max(0, (end_date - start_date).days)

    results = []
    for n in nodes:
        nid = n['id']
        all_dates = sorted(changes[nid].keys())
        running = n['opening_stock']

        for d in all_dates:
            if d < start_date.isoformat():
                running += changes[nid][d]

        for i in range(span_days + 1):
            d = start_date + timedelta(days=i)
            d_str = d.isoformat()
            if d_str in changes[nid]:
                running += changes[nid][d_str]

            results.append({
                'date': d_str,
                'node_code': n['code'],
                'node_name': n['name'],
                'volume': running
            })

    return results


# ── Operations Overview KPI strip ──────────────────────────────────────────────
# Five cards: Production (BOPD, latest day), Lifting Volume (YTD bbl),
# Lift/Prod Ratio (YTD %), S&W (latest day %), Oil Losses (MTD bbl + %).
# Each card returns: headline value, comparison value (for delta), 14-day series,
# and a target. The frontend handles green/amber/red coloring.

def _date_series(end_date, n_days):
    """Inclusive list of YYYY-MM-DD strings ending at end_date, n_days long."""
    start = end_date - timedelta(days=n_days - 1)
    return [(start + timedelta(days=i)).isoformat() for i in range(n_days)]


def _fill_series(rows_by_date, date_list, default=0.0):
    """Project sparse {date: value} dict onto a dense date_list, filling gaps."""
    return [rows_by_date.get(d, default) for d in date_list]


def get_ops_kpis(company_id, spark_days=14):
    """Five-card Operations Overview KPI strip — see module-level comment."""
    with get_db() as conn:
        # Per-company L/G threshold drives Card 5 (Oil Losses MTD) target_pct.
        # The platform schema (Prisma `Organization`) has no per-org threshold
        # column, so default to the spec value of 0.5%.
        lg_threshold_pct = 0.5

        # Anchor date = latest day with ANY flow data; fall back to today.
        anchor_row = conn.execute(
            "SELECT MAX(date) as m FROM flows WHERE company_id=?",
            (company_id,)).fetchone()
        anchor_iso = anchor_row['m'] if anchor_row and anchor_row['m'] else date.today().isoformat()
        try:
            anchor = date.fromisoformat(anchor_iso)
        except ValueError:
            anchor = datetime.fromisoformat(anchor_iso).date()
        prev   = anchor - timedelta(days=1)
        year   = anchor.year
        month  = anchor.month
        month_start = date(year, month, 1).isoformat()
        days_in_month = monthrange(year, month)[1]
        day_of_month  = anchor.day
        day_of_year   = (anchor - date(year, 1, 1)).days + 1

        spark_dates = _date_series(anchor, spark_days)
        spark_first = spark_dates[0]

        # ── Daily inflow totals (production) ──────────────────────────────────
        inflow_rows = conn.execute(
            """SELECT date, SUM(volume) as v
                 FROM flows
                WHERE company_id=? AND flow_type='inflow' AND date >= ?
             GROUP BY date""",
            (company_id, spark_first)).fetchall()
        inflow_by_date = {r['date']: float(r['v'] or 0.0) for r in inflow_rows}
        # Fill missing days with 0 so the sparkline renders consistently
        prod_series = _fill_series(inflow_by_date, spark_dates, 0.0)
        prod_today  = inflow_by_date.get(anchor.isoformat(), 0.0)
        prod_prev   = inflow_by_date.get(prev.isoformat(), 0.0)

        # YTD production for the ratio + losses denominator
        ytd_prod_row = conn.execute(
            "SELECT COALESCE(SUM(volume),0) as v FROM flows "
            "WHERE company_id=? AND flow_type='inflow' AND date LIKE ?",
            (company_id, f"{year}-%")).fetchone()
        ytd_prod = float(ytd_prod_row['v'] or 0.0)

        # ── Daily lifting (completed liftings, keyed by start_load date) ──────
        lift_rows = conn.execute(
            """SELECT date(start_load) as d, SUM(bl_volume) as v
                 FROM liftings
                WHERE company_id=? AND status='completed'
                  AND start_load IS NOT NULL AND date(start_load) >= ?
             GROUP BY date(start_load)""",
            (company_id, spark_first)).fetchall()
        lift_by_date = {r['d']: float(r['v'] or 0.0) for r in lift_rows}
        lift_spark   = _fill_series(lift_by_date, spark_dates, 0.0)

        # YTD lifting (the headline number on Card 2)
        ytd_lift_row = conn.execute(
            "SELECT COALESCE(SUM(bl_volume),0) as v FROM liftings "
            "WHERE company_id=? AND status='completed' AND start_load LIKE ?",
            (company_id, f"{year}-%")).fetchone()
        ytd_lift = float(ytd_lift_row['v'] or 0.0)

        # YTD lifting as-of 7 days ago, for Card 3 ratio Δ
        ref_date = (anchor - timedelta(days=7)).isoformat()
        ytd_lift_ref_row = conn.execute(
            "SELECT COALESCE(SUM(bl_volume),0) as v FROM liftings "
            "WHERE company_id=? AND status='completed' "
            "AND start_load LIKE ? AND date(start_load) <= ?",
            (company_id, f"{year}-%", ref_date)).fetchone()
        ytd_prod_ref_row = conn.execute(
            "SELECT COALESCE(SUM(volume),0) as v FROM flows "
            "WHERE company_id=? AND flow_type='inflow' "
            "AND date LIKE ? AND date <= ?",
            (company_id, f"{year}-%", ref_date)).fetchone()
        ytd_lift_ref = float(ytd_lift_ref_row['v'] or 0.0)
        ytd_prod_ref = float(ytd_prod_ref_row['v'] or 0.0)

        # ── S&W: latest-day average, prior-day average, 14-day daily averages ─
        sw_rows = conn.execute(
            """SELECT date, AVG(sw_pct) as v
                 FROM flows
                WHERE company_id=? AND sw_pct IS NOT NULL AND date >= ?
             GROUP BY date""",
            (company_id, spark_first)).fetchall()
        sw_by_date = {r['date']: (float(r['v']) if r['v'] is not None else None) for r in sw_rows}
        sw_series  = [sw_by_date.get(d) for d in spark_dates]   # may contain None
        sw_today   = sw_by_date.get(anchor.isoformat())
        sw_prev    = sw_by_date.get(prev.isoformat())

        # ── Oil Losses MTD ────────────────────────────────────────────────────
        # MTD throughput L/G = sum of (dispatches - receipts) across all
        # intermediate nodes for the month-to-date window.
        def _mtd_loss(end_iso):
            """Σ (dispatches − receipts) across intermediate nodes, month_start..end_iso."""
            in_xfer = conn.execute(
                """SELECT t.to_node_id as nid,
                          SUM(COALESCE(t.receipt_volume, t.volume)) as v
                     FROM transfers t
                    WHERE t.company_id=? AND t.date >= ? AND t.date <= ?
                 GROUP BY t.to_node_id""",
                (company_id, month_start, end_iso)).fetchall()
            in_lift = conn.execute(
                """SELECT l.buyer_node_id as nid,
                          SUM(COALESCE(l.cqd_volume, l.bl_volume)) as v
                     FROM liftings l
                    WHERE l.company_id=? AND l.status='completed'
                      AND date(l.start_load) >= ? AND date(l.start_load) <= ?
                 GROUP BY l.buyer_node_id""",
                (company_id, month_start, end_iso)).fetchall()
            out_xfer = conn.execute(
                """SELECT t.from_node_id as nid, SUM(t.volume) as v
                     FROM transfers t
                    WHERE t.company_id=? AND t.date >= ? AND t.date <= ?
                 GROUP BY t.from_node_id""",
                (company_id, month_start, end_iso)).fetchall()
            out_lift = conn.execute(
                """SELECT l.from_node_id as nid, SUM(l.bl_volume) as v
                     FROM liftings l
                    WHERE l.company_id=? AND l.status='completed'
                      AND date(l.start_load) >= ? AND date(l.start_load) <= ?
                 GROUP BY l.from_node_id""",
                (company_id, month_start, end_iso)).fetchall()
            recv = {}
            disp = {}
            for r in in_xfer:  recv[r['nid']] = recv.get(r['nid'], 0.0) + float(r['v'] or 0.0)
            for r in in_lift:  recv[r['nid']] = recv.get(r['nid'], 0.0) + float(r['v'] or 0.0)
            for r in out_xfer: disp[r['nid']] = disp.get(r['nid'], 0.0) + float(r['v'] or 0.0)
            for r in out_lift: disp[r['nid']] = disp.get(r['nid'], 0.0) + float(r['v'] or 0.0)
            total_loss = 0.0
            total_recv = 0.0
            for nid in set(recv) | set(disp):
                r = recv.get(nid, 0.0)
                d = disp.get(nid, 0.0)
                # Only intermediate nodes (both sides > 0) contribute to L/G
                if r > 0 and d > 0:
                    total_loss += (d - r)
                    total_recv += r
            return total_loss, total_recv

        loss_mtd,      recv_mtd      = _mtd_loss(anchor.isoformat())
        loss_mtd_prev, recv_mtd_prev = _mtd_loss(prev.isoformat())
        loss_mtd_pct      = (loss_mtd      / recv_mtd      * 100) if recv_mtd      > 0 else None
        loss_mtd_pct_prev = (loss_mtd_prev / recv_mtd_prev * 100) if recv_mtd_prev > 0 else None

        # Loss 14-day sparkline = per-day net (dispatches - receipts) across all nodes
        loss_daily = conn.execute(
            """SELECT d, SUM(net) as v FROM (
                 SELECT t.date as d, SUM(t.volume - COALESCE(t.receipt_volume, t.volume)) as net
                   FROM transfers t
                  WHERE t.company_id=? AND t.date >= ?
               GROUP BY t.date
                 UNION ALL
                 SELECT date(l.start_load) as d,
                        SUM(l.bl_volume - COALESCE(l.cqd_volume, l.bl_volume)) as net
                   FROM liftings l
                  WHERE l.company_id=? AND l.status='completed'
                    AND l.start_load IS NOT NULL AND date(l.start_load) >= ?
               GROUP BY date(l.start_load))
            GROUP BY d""",
            (company_id, spark_first, company_id, spark_first)).fetchall()
        loss_by_date = {r['d']: float(r['v'] or 0.0) for r in loss_daily}
        loss_series  = _fill_series(loss_by_date, spark_dates, 0.0)

        # ── Targets ───────────────────────────────────────────────────────────
        # Monthly targets per node + category. Aggregate:
        #   prod_target_month = Σ targets where category indicates inflow/production
        #   lift_target_month = Σ targets where category indicates lifting
        # Category convention: targets table is freeform; we treat anything with
        # 'lift' in the lowercase category as lifting, everything else as production.
        targets = conn.execute(
            """SELECT category, COALESCE(SUM(target_vol),0) as v
                 FROM targets
                WHERE company_id=? AND year=? AND month=?
             GROUP BY category""",
            (company_id, year, month)).fetchall()
        prod_target_month = 0.0
        lift_target_month = 0.0
        for r in targets:
            cat = (r['category'] or '').lower()
            if 'lift' in cat:
                lift_target_month += float(r['v'] or 0.0)
            else:
                prod_target_month += float(r['v'] or 0.0)

        # Annual targets = sum across all months this year
        annual_targets = conn.execute(
            """SELECT category, COALESCE(SUM(target_vol),0) as v
                 FROM targets
                WHERE company_id=? AND year=?
             GROUP BY category""",
            (company_id, year)).fetchall()
        prod_target_year = 0.0
        lift_target_year = 0.0
        for r in annual_targets:
            cat = (r['category'] or '').lower()
            if 'lift' in cat:
                lift_target_year += float(r['v'] or 0.0)
            else:
                prod_target_year += float(r['v'] or 0.0)

        prod_target_daily = (prod_target_month / days_in_month) if days_in_month else None
        # YTD prorated lifting target = annual × (day_of_year / 365)
        lift_target_ytd_pace = (lift_target_year * day_of_year / 365.0) if lift_target_year > 0 else None

        # Ratio target = lifting_target_year / production_target_year * 100
        if prod_target_year > 0 and lift_target_year > 0:
            ratio_target = lift_target_year / prod_target_year * 100
        else:
            ratio_target = None

        # ── Compute derived metrics ───────────────────────────────────────────
        ratio_today = (ytd_lift     / ytd_prod     * 100) if ytd_prod     > 0 else None
        ratio_ref   = (ytd_lift_ref / ytd_prod_ref * 100) if ytd_prod_ref > 0 else None

        # Build a ratio 14-day sparkline: rolling YTD ratio at each day
        # (cheap approximation: cumulative within the sparkline window)
        ratio_series = []
        running_prod = 0.0
        running_lift = 0.0
        for d in spark_dates:
            running_prod += inflow_by_date.get(d, 0.0)
            running_lift += lift_by_date.get(d, 0.0)
            ratio_series.append(
                (running_lift / running_prod * 100) if running_prod > 0 else None
            )

        return {
            'anchor_date':    anchor.isoformat(),
            'spark_days':     spark_days,
            'spark_dates':    spark_dates,

            'production': {
                'today':        prod_today,
                'prev':         prod_prev,
                'series':       prod_series,
                'target_daily': prod_target_daily,
                'unit':         'bopd',
            },
            'lifting': {
                'ytd':          ytd_lift,
                'target_ytd':   lift_target_ytd_pace,
                'target_year':  lift_target_year if lift_target_year > 0 else None,
                'series':       lift_spark,        # daily marginal contribution
                'unit':         'bbl',
            },
            'ratio': {
                'today':        ratio_today,
                'prev':         ratio_ref,         # 7-day-prior YTD ratio
                'series':       ratio_series,
                'target':       ratio_target,
                'unit':         '%',
            },
            'sw': {
                'today':        sw_today,
                'prev':         sw_prev,
                'series':       sw_series,
                'target':       0.5,                # hardcoded per spec
                'unit':         '%',
            },
            'losses': {
                'mtd':          loss_mtd,
                'mtd_pct':      loss_mtd_pct,
                'prev_mtd':     loss_mtd_prev,
                'prev_mtd_pct': loss_mtd_pct_prev,
                'series':       loss_series,
                'target_pct':   lg_threshold_pct,   # per-company L/G threshold
                'unit':         'bbl',
            },
        }
