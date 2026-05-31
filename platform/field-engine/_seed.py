"""Seed sample FieldFlow data so the dashboard/analytics render real charts.

Idempotent + scoped: only touches rows whose node code starts with 'SD-' (and
their dependent flows/transfers/liftings/targets) for the given org(s), so it
never disturbs real field data and can be re-run. Run via run-seed.ps1 which
sets PGDSN from .env.local.

To remove the sample data later: run this with REMOVE=1 in the environment.
"""
import os, uuid, random
from datetime import date, timedelta

import psycopg

ORG_IDS = [
    "cmpps20xt0002xctcoiobev63",  # MetricBase
    "cmpskwszn0000kstcxsmzllmu",  # Pertamina EP
]

NOW = "now()"


def nid():
    return "sd_" + uuid.uuid4().hex[:22]


def wipe(conn, org):
    """Remove previously-seeded rows (node code prefix 'SD-') for this org."""
    ids = [r[0] for r in conn.execute(
        'select id from nodes where company_id=%s and code like %s', (org, "SD-%")
    ).fetchall()]
    if ids:
        for tbl, col in [("targets", "node_id"), ("flows", "node_id")]:
            conn.execute(f'delete from {tbl} where company_id=%s and {col} = ANY(%s)', (org, ids))
        conn.execute('delete from liftings where company_id=%s and (from_node_id = ANY(%s) or buyer_node_id = ANY(%s))', (org, ids, ids))
        conn.execute('delete from transfers where company_id=%s and (from_node_id = ANY(%s) or to_node_id = ANY(%s))', (org, ids, ids))
        conn.execute('delete from nodes where company_id=%s and id = ANY(%s)', (org, ids))
    conn.commit()


def seed_org(conn, org):
    wipe(conn, org)
    if os.getenv("REMOVE") == "1":
        print(f"  {org}: removed seed data")
        return

    rng = random.Random(hash(org) & 0xffffffff)
    today = date.today()
    start = today - timedelta(days=90)

    # ── Nodes ────────────────────────────────────────────────────────────────
    nodes = {
        "well1": (nid(), "SD-WELL-01", "North Well 1", "well", None, 0),
        "well2": (nid(), "SD-WELL-02", "North Well 2", "well", None, 0),
        "gs":    (nid(), "SD-GS-01",   "Gathering Station", "pipeline", None, 0),
        "tank":  (nid(), "SD-TANK-A",  "Storage Tank A", "storage", 80000, 12000),
        "term":  (nid(), "SD-TERM-01", "Export Terminal", "terminal", 120000, 6000),
        "buyer": (nid(), "SD-BUYER-X", "Buyer / Offtaker", "buyer", None, 0),
    }
    node_rows = [
        (n[0], org, n[1], n[2], n[3], n[4], "bbl", None, True, None, n[5], None)
        for n in nodes.values()
    ]
    conn.cursor().executemany(
        'insert into nodes (id,company_id,code,name,node_type,capacity,unit,parent_code,active,notes,opening_stock,created_at) '
        'values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())',
        node_rows,
    )

    w1, w2, gs, tank, term = (nodes[k][0] for k in ("well1", "well2", "gs", "tank", "term"))
    buyer = nodes["buyer"][0]

    flows, transfers, liftings, targets = [], [], [], []
    tank_stock = 12000.0
    term_stock = 6000.0

    for i in range(91):
        d = start + timedelta(days=i)
        ds = d.isoformat()
        in1 = round(880 + 140 * rng.random() + 60 * (i / 90.0), 1)
        in2 = round(480 + 90 * rng.random(), 1)
        sw1 = round(0.35 + 0.25 * rng.random(), 3)
        sw2 = round(0.55 + 0.25 * rng.random(), 3)
        # inflow at wells
        flows.append((nid(), org, w1, ds, "inflow", in1, sw1, None, "actual", None, "auto", ))
        flows.append((nid(), org, w2, ds, "inflow", in2, sw2, None, "actual", None, "auto", ))
        # wells -> gathering station (small measurement loss)
        transfers.append((nid(), org, w1, gs, ds, in1, round(in1 * 0.999, 1), None))
        transfers.append((nid(), org, w2, gs, ds, in2, round(in2 * 0.998, 1), None))
        # gathering -> tank
        gs_total = round(in1 + in2, 1)
        transfers.append((nid(), org, gs, tank, ds, gs_total, round(gs_total * 0.9995, 1), None))
        tank_stock += gs_total

        # tank -> terminal every 6 days (feeds liftings)
        if i % 6 == 0 and i > 0:
            mv = round(min(tank_stock * 0.5, 9000), 1)
            transfers.append((nid(), org, tank, term, ds, mv, round(mv * 0.999, 1), None))
            tank_stock -= mv
            term_stock += mv

        # weekly stock readings (measured)
        if i % 7 == 0:
            flows.append((nid(), org, tank, ds, "stock", round(tank_stock, 1), None, None, "actual", "weekly gauge", "auto"))
            flows.append((nid(), org, term, ds, "stock", round(term_stock, 1), None, None, "actual", "weekly gauge", "auto"))

        # completed liftings ~ every 12 days from terminal
        if i % 12 == 0 and i >= 12 and term_stock > 20000:
            bl = round(18000 + 12000 * rng.random(), 1)
            term_stock -= bl
            liftings.append((
                nid(), org, term, buyer, f"MT Nusantara {rng.randint(1, 9)}",
                round(bl * 1.02, 1), bl, round(bl * 0.9995, 1),
                ds, ds, (d + timedelta(days=2)).isoformat(),
                ds, (d + timedelta(days=1)).isoformat(),
                "completed", None,
            ))

    # one active + one tentative lifting near/after today
    liftings.append((
        nid(), org, term, buyer, "MT Khatulistiwa", 32000.0, None, None,
        today.isoformat(), today.isoformat(), (today + timedelta(days=3)).isoformat(),
        today.isoformat(), None, "active", None,
    ))
    liftings.append((
        nid(), org, term, buyer, "MT Cendrawasih", 30000.0, None, None,
        (today + timedelta(days=8)).isoformat(), (today + timedelta(days=7)).isoformat(),
        (today + timedelta(days=10)).isoformat(), None, None, "tentative", None,
    ))

    # ── Targets (current year, all months) ────────────────────────────────────
    yr = today.year
    for m in range(1, 13):
        targets.append((nid(), org, w1, yr, m, "production", 28000.0))
        targets.append((nid(), org, w2, yr, m, "production", 15500.0))
        targets.append((nid(), org, term, yr, m, "lifting", 40000.0))

    cur = conn.cursor()
    cur.executemany(
        'insert into flows (id,company_id,node_id,date,flow_type,volume,sw_pct,category,status,memo,reported_by,created_at) '
        'values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())', flows)
    cur.executemany(
        'insert into transfers (id,company_id,from_node_id,to_node_id,date,volume,receipt_volume,memo,created_at) '
        'values (%s,%s,%s,%s,%s,%s,%s,%s,now())', transfers)
    cur.executemany(
        'insert into liftings (id,company_id,from_node_id,buyer_node_id,tanker_name,nominated,bl_volume,cqd_volume,'
        'eta,laycan_start,laycan_end,start_load,stop_load,status,notes,created_at) '
        'values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())', liftings)
    cur.executemany(
        'insert into targets (id,company_id,node_id,year,month,category,target_vol,created_at) '
        'values (%s,%s,%s,%s,%s,%s,%s,now())', targets)
    conn.commit()
    print(f"  {org}: {len(node_rows)} nodes, {len(flows)} flows, {len(transfers)} transfers, "
          f"{len(liftings)} liftings, {len(targets)} targets")


def main():
    conn = psycopg.connect(os.environ["PGDSN"])
    targets = os.getenv("SEED_ORG")
    org_list = [targets] if targets else ORG_IDS
    print("REMOVE mode" if os.getenv("REMOVE") == "1" else "SEED mode")
    for org in org_list:
        seed_org(conn, org)
    print("done")


if __name__ == "__main__":
    main()
