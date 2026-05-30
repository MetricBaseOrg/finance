"""Safe evaluation of user-supplied widget formulas.

A widget can opt into a custom expression instead of (or alongside) picking a
single metric. The expression references metric IDs as variables, e.g.

    inflow - outflow
    (lifting_volume / inflow) * 100
    transfers_in - transfers_out

It can also pin a specific node using the NODECODE_metricid syntax, e.g.

    SMHK_inflow + NMHK_inflow + SBJ_inflow
    TANK1_calculated_stock - TANK1_transfers_out

A formula can also reference the value of another KPI widget on the same
dashboard by its title in square brackets, e.g.

    [Field A Dispatch] - [Field B Receipt]
    ([Net production] / inflow) * 100

Bracketed titles resolve to the referenced KPI widget's evaluated total
(scalar) and series. Cycles are rejected at evaluation time.

Evaluation rules:

* Plain metric IDs aggregate across the widget's selected nodes (same as the
  metric picker).
* NODECODE_metricid variables always scope to that one node, regardless of
  which nodes the widget has selected.
* Math comes from `simpleeval`, which AST-walks the expression — no `eval`,
  no name lookups outside the supplied namespace, no attribute access, no
  imports.
* The formula is evaluated *per timestep* against the aligned per-day values
  of each referenced variable, and again on the total values for the headline
  number.
"""
from . import metrics as metrics_mod


_BLOCKED_TOKENS = ("__",)


def _import_simpleeval():
    """Lazy import so a missing dep does not break the rest of the db package."""
    try:
        from simpleeval import SimpleEval, NameNotDefined, InvalidExpression
    except ImportError as e:
        raise RuntimeError(
            "simpleeval is required for custom formulas — "
            "run 'pip install -r requirements.txt' to install it."
        ) from e
    return SimpleEval, NameNotDefined, InvalidExpression


def _sorted_metric_ids():
    """Metric IDs sorted longest-first for greedy suffix matching."""
    return sorted(metrics_mod.METRICS.keys(), key=len, reverse=True)


def _split_node_metric(name):
    """Try to split 'NODECODE_metricid' into (node_code, metric_id).

    Longest-metric-ID-first matching so multi-word IDs like 'transfers_in'
    are matched before a shorter suffix like 'in' would be.
    Returns (code, metric_id) or None if the name doesn't fit the pattern.
    """
    for mid in _sorted_metric_ids():
        suffix = f"_{mid}"
        if name.endswith(suffix) and len(name) > len(suffix):
            return name[:-len(suffix)], mid
    return None


_WIDGET_REF_PREFIX = "_wref_"


def _extract_widget_refs(expr):
    """Replace every `[Title]` segment with a safe placeholder identifier.

    Returns (rewritten_expr, widget_refs) where widget_refs maps each
    placeholder name to the original title string. Titles are stripped of
    surrounding whitespace; the original casing is preserved.

    Raises ValueError on unbalanced brackets or empty titles.
    """
    widget_refs = {}
    out = []
    i = 0
    n = len(expr)
    counter = 0
    while i < n:
        ch = expr[i]
        if ch == ']':
            raise ValueError("Formula has an unmatched ']' — widget references use [Title].")
        if ch == '[':
            close = expr.find(']', i + 1)
            if close == -1:
                raise ValueError("Formula has an unmatched '[' — widget references use [Title].")
            inner = expr[i + 1:close]
            if '[' in inner:
                raise ValueError("Formula has nested '[' inside a widget reference.")
            title = inner.strip()
            if not title:
                raise ValueError("Widget reference '[]' is empty — write [Widget Title].")
            placeholder = f"{_WIDGET_REF_PREFIX}{counter}"
            counter += 1
            widget_refs[placeholder] = title
            out.append(placeholder)
            i = close + 1
        else:
            out.append(ch)
            i += 1
    return ''.join(out), widget_refs


def parse_metric_refs(expr):
    """Parse an expression and return the variables it references.

    Returns a tuple:
        plain_refs      : set of plain metric IDs  (e.g. {'inflow', 'outflow'})
        node_metric_refs: dict  var_name -> (node_code, metric_id)
                          (e.g. {'SMHK_inflow': ('SMHK', 'inflow')})
        widget_refs     : dict  placeholder_var -> widget_title
                          (e.g. {'_wref_0': 'Field A Dispatch'})

    Raises ValueError on syntax errors, disallowed tokens, attribute access,
    function calls, or identifiers that match neither form.
    """
    if not expr or not isinstance(expr, str):
        return set(), {}, {}
    # Block __ in the *source* expression (before placeholder substitution).
    if any(tok in expr for tok in _BLOCKED_TOKENS):
        raise ValueError("Formula contains disallowed token.")

    rewritten, widget_refs = _extract_widget_refs(expr)

    import ast
    try:
        tree = ast.parse(rewritten, mode="eval")
    except SyntaxError as e:
        raise ValueError(f"Formula syntax error: {e.msg}")

    all_names = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            all_names.add(node.id)
        if isinstance(node, ast.Attribute):
            raise ValueError("Attribute access is not allowed in formulas.")
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            raise ValueError(f"Function calls are not allowed (found '{node.func.id}').")

    known_metrics = set(metrics_mod.METRICS.keys())
    plain_refs = set()
    node_metric_refs = {}
    unknown = []

    for name in all_names:
        if name in widget_refs:
            continue  # placeholder for a [Title] ref, resolved separately
        if name in known_metrics:
            plain_refs.add(name)
        else:
            pair = _split_node_metric(name)
            if pair:
                node_metric_refs[name] = pair  # var_name -> (code, metric_id)
            else:
                unknown.append(name)

    if unknown:
        raise ValueError(
            f"Formula references unknown metric(s): {', '.join(sorted(unknown))}. "
            f"Use a plain metric id (e.g. 'inflow'), NODECODE_metric (e.g. 'SMHK_inflow'), "
            f"or another KPI widget by title (e.g. '[Net production]')."
        )
    return plain_refs, node_metric_refs, widget_refs


def _eval_one(s, expr, names, exc_classes):
    NameNotDefined, InvalidExpression = exc_classes
    s.names = names
    try:
        return s.eval(expr)
    except NameNotDefined as e:
        raise ValueError(str(e))
    except (InvalidExpression, ZeroDivisionError, TypeError, ValueError):
        return None


def evaluate(expr, company_id, node_ids=None, date_from=None, date_to=None,
             widget_context=None):
    """Evaluate `expr` over the time window and return the same shape as a metric.

    Per-day values where any referenced variable is None become None (avoids
    propagating false zeros). Division-by-zero yields None for that day. The
    `total` field is computed against the variable totals, not as a sum of the
    daily series — this matches user intuition for ratio formulas like
    `(lifting_volume / inflow) * 100`.

    Plain metric IDs aggregate across `node_ids` (or all active nodes when
    empty). NODECODE_metricid variables are always scoped to the named node
    regardless of `node_ids`.

    [Widget Title] references resolve via `widget_context['resolve_kpi'](title,
    period)`, which returns the same {series, by_node, total} envelope. The
    callable is also responsible for cycle detection. `widget_context` is
    required whenever the expression contains a bracketed reference; otherwise
    it may be omitted.
    """
    plain_refs, node_metric_refs, widget_refs = parse_metric_refs(expr)
    all_var_names = plain_refs | set(node_metric_refs.keys()) | set(widget_refs.keys())

    if not all_var_names:
        raise ValueError("Formula must reference at least one metric.")

    # The AST parser ran against an expression where [Title] was rewritten to
    # `_wref_N` placeholders. simpleeval needs the same rewrite, otherwise it
    # would parse-error on the brackets.
    rewritten_expr, _ = _extract_widget_refs(expr)

    # Resolve plain metric refs over the widget's node selection.
    resolved = {
        mid: metrics_mod.fetch(mid, company_id, node_ids, date_from, date_to)
        for mid in plain_refs
    }

    # Resolve node-code refs scoped to their specific node.
    if node_metric_refs:
        from .nodes import get_node
        for var_name, (code, metric_id) in node_metric_refs.items():
            node = get_node(company_id, code)
            if node is None:
                raise ValueError(
                    f"Node code '{code}' not found in this company "
                    f"(referenced as '{var_name}' in the formula)."
                )
            resolved[var_name] = metrics_mod.fetch(
                metric_id, company_id, [node["id"]], date_from, date_to
            )

    # Resolve [Title] widget refs via the context-provided callable.
    if widget_refs:
        if not widget_context or not callable(widget_context.get('resolve_kpi')):
            raise ValueError(
                "Formula uses a [Widget Title] reference but no widget context "
                "is available to resolve it."
            )
        resolver = widget_context['resolve_kpi']
        for placeholder, title in widget_refs.items():
            resolved[placeholder] = resolver(title, (date_from, date_to))

    # Use the first variable's series as the date spine — all share the same
    # window so this is stable.
    spine_var = next(iter(all_var_names))
    dates = [p["date"] for p in resolved[spine_var]["series"]]

    # Per-variable date→value lookup
    lookups = {
        var: {p["date"]: p["value"] for p in resolved[var]["series"]}
        for var in all_var_names
    }

    SimpleEval, NameNotDefined, InvalidExpression = _import_simpleeval()
    exc_classes = (NameNotDefined, InvalidExpression)
    s = SimpleEval()
    series = []
    for d in dates:
        names = {var: lookups[var].get(d) for var in all_var_names}
        if any(v is None for v in names.values()):
            series.append({"date": d, "value": None})
            continue
        v = _eval_one(s, rewritten_expr, names, exc_classes)
        series.append({"date": d, "value": v})

    # Total
    total_names = {var: resolved[var].get("total") for var in all_var_names}
    if any(v is None for v in total_names.values()):
        total = None
    else:
        total = _eval_one(s, rewritten_expr, total_names, exc_classes)

    # Per-node breakdown: only meaningful when every variable exposes the same
    # node in by_node. For node-code and widget refs this intersection is
    # typically empty (each ref pins a different scope), so by_node is {} in
    # that case — which is correct since the formula already encodes the scope.
    by_node = {}
    common_nodes = None
    for var, r in resolved.items():
        n_keys = set(r.get("by_node", {}).keys())
        common_nodes = n_keys if common_nodes is None else common_nodes & n_keys
    common_nodes = common_nodes or set()

    for nid in common_nodes:
        node_lookups = {
            var: {p["date"]: p["value"] for p in resolved[var]["by_node"][nid]["series"]}
            for var in all_var_names
        }
        n_series = []
        for d in dates:
            names = {var: node_lookups[var].get(d) for var in all_var_names}
            if any(v is None for v in names.values()):
                n_series.append({"date": d, "value": None})
                continue
            n_series.append({"date": d, "value": _eval_one(s, rewritten_expr, names, exc_classes)})

        n_total_names = {var: resolved[var]["by_node"][nid].get("total") for var in all_var_names}
        if any(v is None for v in n_total_names.values()):
            n_total = None
        else:
            n_total = _eval_one(s, rewritten_expr, n_total_names, exc_classes)
        by_node[nid] = {"series": n_series, "total": n_total}

    return {"series": series, "by_node": by_node, "total": total}
