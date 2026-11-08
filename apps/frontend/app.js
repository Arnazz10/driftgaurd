/* =====================================================================
   DriftGuard frontend — zero-build vanilla JS SPA
   Pages: landing · command center · rollout studio · pipeline · services · playbooks
   Talks to the real Go services via /api/<svc>/ (nginx proxy locally) or any
   configured base URL; falls back to an honest, clearly-labelled simulation.
   ===================================================================== */
(() => {
  "use strict";

  /* ---------------------------------------------------------------- utils */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = () => window.innerWidth < 760;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clock = (d = new Date()) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const fmtNum = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e4 ? (n / 1e3).toFixed(1) + "k" : Math.round(n).toLocaleString());
  const fmtMs = (ms) => (ms >= 100 ? Math.round(ms) : ms >= 10 ? ms.toFixed(1) : ms.toFixed(2));
  const store = {
    get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
  };

  const ICON = {
    git: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    layers: '<path d="M12 2l10 6-10 6L2 8z"/><path d="M2 16l10 6 10-6M2 12l10 6 10-6"/>',
    sync: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    bird: '<path d="M4 20l6-6M14 4l6 6-8 8-6-6z"/><path d="M12 10l2 2"/>',
    card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    flame: '<path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3-1-6 1-9z"/>',
    flask: '<path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-10V3"/><path d="M7 15h10"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>',
    shield: '<path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/>',
    pulse: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    gauge: '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    zap: '<path d="M13 2L3 14h8l-1 8 10-12h-8z"/>',
    server: '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/>',
    alert: '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    play: '<path d="M6 4l14 8-14 8z"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  };
  const icon = (name, cls = "") => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;

  /* -------------------------------------------------------------- toasts */
  function toast(msg, tone = "info", ms = 3200) {
    const el = document.createElement("div");
    el.className = `toast ${tone}`;
    el.innerHTML = `<span class="dot"></span><div>${msg}</div>`;
    $("#toasts").appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 380); }, ms);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      ta.remove();
    }
    toast("Copied to clipboard", "ok", 1800);
  }

  /* ========================================================= TELEMETRY */
  const SERVICES = [
    { key: "checkout", name: "checkout-svc", probe: "healthz", strategy: "canary", tone: "ember", color: "#5b8cff", seed: 0 },
    { key: "payments", name: "payments-svc", probe: "readyz", strategy: "blue-green", tone: "ice", color: "#7d869c", seed: 1 },
  ];
  const THRESH = { err: 5, p95: 500 };
  const HISTORY = 32;
  const DEFAULT_BASES = { checkout: "/api/checkout", payments: "/api/payments" };

  function parseMetricLine(line) {
    const m = line.match(/^([a-zA-Z_:][\w:]*)(\{([^}]*)\})?\s+(\S+)/);
    if (!m) return null;
    const labels = {};
    if (m[3]) m[3].replace(/(\w+)="((?:[^"\\]|\\.)*)"/g, (_, k, v) => { labels[k] = v; return ""; });
    return { name: m[1], labels, value: Number(m[4]) };
  }

  function parseMetrics(text, svcName) {
    const out = { total: 0, errors: 0, rootTotal: 0, rootErrors: 0, buckets: [] };
    for (const line of text.split("\n")) {
      if (!line.startsWith("driftguard_")) continue;
      const p = parseMetricLine(line);
      if (!p || (p.labels.service && p.labels.service !== svcName)) continue;
      if (p.name === "driftguard_http_requests_total") {
        out.total += p.value;
        const bad = Number(p.labels.status) >= 500;
        if (bad) out.errors += p.value;
        if (p.labels.route === "/") { out.rootTotal += p.value; if (bad) out.rootErrors += p.value; }
      } else if (p.name === "driftguard_http_request_duration_seconds_bucket" && p.labels.route === "/") {
        out.buckets.push({ le: p.labels.le === "+Inf" ? Infinity : Number(p.labels.le), count: p.value });
      }
    }
    out.buckets.sort((a, b) => a.le - b.le);
    return out;
  }

  function quantileMs(cur, prev, q) {
    if (!cur.length) return 0;
    let counts = cur.map((b, i) => b.count - (prev && prev[i] && prev[i].le === b.le ? prev[i].count : 0));
    let total = counts[counts.length - 1];
    if (total <= 0) { counts = cur.map((b) => b.count); total = counts[counts.length - 1]; }
    if (total <= 0) return 0;
    const target = total * q;
    for (let i = 0; i < cur.length; i++) {
      if (counts[i] >= target) {
        const hi = cur[i].le === Infinity ? cur[i - 1]?.le || 10 : cur[i].le;
        const lo = i > 0 ? cur[i - 1].le : 0;
        const below = i > 0 ? counts[i - 1] : 0;
        const frac = counts[i] - below > 0 ? (target - below) / (counts[i] - below) : 1;
        return (lo + (hi - lo) * clamp(frac, 0, 1)) * 1000;
      }
    }
    return 0;
  }

  async function timedFetch(url, opts = {}, timeout = 2500) {
    const ctl = new AbortController();
    const id = setTimeout(() => ctl.abort(), timeout);
    const t0 = performance.now();
    try {
      const res = await fetch(url, { cache: "no-store", ...opts, signal: ctl.signal });
      const text = await res.text();
      return { ok: res.ok, status: res.status, statusText: res.statusText, text, ms: performance.now() - t0, type: res.headers.get("content-type") || "" };
    } finally { clearTimeout(id); }
  }

  const Telemetry = {
    bases: { ...DEFAULT_BASES, ...store.get("dg.bases", {}) },
    traffic: store.get("dg.traffic", true),
    mode: "connecting",
    state: {},
    listeners: new Set(),
    lastTick: 0,
    failures: { checkout: 0, payments: 0 },
    tickCount: 0,

    init() {
      for (const s of SERVICES) {
        this.state[s.key] = {
          key: s.key, name: s.name, mode: "connecting", online: false, version: "—", health: "pending",
          total: 0, errors: 0, rps: 0, err: 0, p95: 0, p99: 0, rtt: 0, failRate: 0,
          history: [], metricsText: "", prev: null, simPhase: rand(0, 10),
        };
      }
    },
    on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); },
    emit() { for (const fn of this.listeners) { try { fn(this.state, this.mode); } catch (e) { console.error(e); } } },
    url(key, path) { return `${this.bases[key].replace(/\/$/, "")}/${path.replace(/^\//, "")}`; },

    start() {
      this.init();
      const first = this.tick();
      setInterval(() => this.tick(), 2500);
      return first;
    },

    async tick() {
      this.tickCount++;
      const now = performance.now();
      const dt = this.lastTick ? (now - this.lastTick) / 1000 : 2.5;
      this.lastTick = now;
      await Promise.all(SERVICES.map((s) => this.probe(s, dt)));
      const modes = SERVICES.map((s) => this.state[s.key].mode);
      this.mode = modes.every((m) => m === "live") ? "live" : modes.some((m) => m === "live") ? "partial" : "sim";
      updateModeChip();
      this.emit();
    },

    async probe(svc, dt) {
      const st = this.state[svc.key];
      const backoff = this.failures[svc.key] >= 2 && this.tickCount % 6 !== 0;
      if (!backoff) {
        try {
          if (this.traffic && st.mode === "live") await this.burst(svc.key, 10, true);
          const [root, health, metrics] = await Promise.all([
            timedFetch(this.url(svc.key, "/")),
            timedFetch(this.url(svc.key, svc.probe)),
            timedFetch(this.url(svc.key, "metrics")),
          ]);
          let json = {};
          try { json = JSON.parse(root.text || "{}"); } catch { /* injected 5xx returns plain text */ }
          if (!metrics.ok || !metrics.text.includes("driftguard_http_requests_total")) throw new Error("not a DriftGuard service");
          if (!json.service && root.status < 500) throw new Error("unexpected root response");
          const m = parseMetrics(metrics.text, svc.name);
          const prev = st.prev;
          const dTot = prev ? Math.max(0, m.rootTotal - prev.rootTotal) : 0;
          const dErr = prev ? Math.max(0, m.rootErrors - prev.rootErrors) : 0;
          st.rps = prev ? dTot / dt : 0;
          st.err = dTot > 0 ? (dErr / dTot) * 100 : m.rootTotal ? (m.rootErrors / m.rootTotal) * 100 : 0;
          st.p95 = quantileMs(m.buckets, prev?.buckets, 0.95);
          st.p99 = quantileMs(m.buckets, prev?.buckets, 0.99);
          st.total = m.total; st.errors = m.errors; st.prev = m;
          if (json.version) st.version = json.version;
          st.health = health.ok ? "ok" : "degraded";
          st.rtt = root.ms; st.online = true; st.mode = "live"; st.metricsText = metrics.text;
          timedFetch(this.url(svc.key, "chaos")).then((r) => { if (r.ok) { try { st.failRate = JSON.parse(r.text).failRate || 0; } catch { /* old build */ } } }).catch(() => {});
          this.failures[svc.key] = 0;
          if (!prev) { st.history = []; return; } // first live sample has no rate yet
          this.push(st);
          return;
        } catch {
          this.failures[svc.key]++;
        }
      }
      this.simulate(svc, st, dt);
    },

    simulate(svc, st, dt) {
      st.simPhase += dt;
      const t = st.simPhase;
      const base = svc.seed ? 34 : 52;
      st.rps = Math.max(4, base + Math.sin(t / 3.2) * 9 + Math.sin(t / 1.3) * 4 + rand(-3, 3));
      st.err = clamp(st.failRate * 100 + rand(-3, 3) * st.failRate + rand(0, 0.35), 0, 100);
      st.p95 = Math.max(4, (svc.seed ? 41 : 33) + Math.sin(t / 4) * 9 + rand(-4, 6) + st.failRate * 60);
      st.p99 = st.p95 * rand(1.3, 1.6);
      const n = st.rps * dt;
      st.total += n; st.errors += n * (st.err / 100);
      st.version = svc.seed ? "v1.3.8-sim" : "v1.4.2-sim";
      st.health = st.failRate > 0.2 ? "degraded" : "ok";
      st.rtt = rand(8, 26); st.online = true; st.mode = "sim";
      st.metricsText = simMetrics(svc, st);
      this.push(st);
    },

    push(st) {
      st.history.push({ t: clock(), rps: st.rps, err: st.err, p95: st.p95 });
      if (st.history.length > HISTORY) st.history.shift();
    },

    series(key, field) {
      const h = this.state[key]?.history || [];
      const vals = h.map((p) => p[field]);
      while (vals.length < HISTORY) vals.unshift(vals.length ? vals[0] : 0);
      return vals;
    },

    async burst(key, n = 50, silent = false) {
      const st = this.state[key];
      if (st.mode !== "live") {
        const errs = Math.round(n * st.failRate * rand(0.85, 1.15));
        st.total += n; st.errors += errs;
        return { ok: n - errs, bad: errs, ms: rand(30, 90), simulated: true };
      }
      const t0 = performance.now();
      const res = await Promise.allSettled(Array.from({ length: n }, () => timedFetch(this.url(key, "/"), {}, 4000)));
      const ok = res.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      if (!silent) this.tick();
      return { ok, bad: n - ok, ms: performance.now() - t0, simulated: false };
    },

    async setChaos(key, rate) {
      const st = this.state[key];
      rate = clamp(rate, 0, 1);
      if (st.mode !== "live") { st.failRate = rate; return { simulated: true, failRate: rate }; }
      const r = await timedFetch(this.url(key, `chaos?rate=${rate}`), { method: "POST" });
      if (!r.ok) throw new Error(r.status === 404 ? "This build has no /chaos endpoint — rebuild with `make local-up`." : `HTTP ${r.status}`);
      st.failRate = JSON.parse(r.text).failRate;
      return { simulated: false, failRate: st.failRate };
    },

    setBases(bases) {
      this.bases = { ...DEFAULT_BASES, ...bases };
      store.set("dg.bases", bases);
      for (const s of SERVICES) { this.failures[s.key] = 0; this.state[s.key].prev = null; }
      return this.tick();
    },
  };

  function simMetrics(svc, st) {
    const ok = Math.round(st.total - st.errors);
    const bad = Math.round(st.errors);
    const name = svc.name;
    const total = ok + bad;
    const les = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
    const lines = [
      "# HELP driftguard_http_requests_total Total HTTP requests by service, route, method, and status code.",
      "# TYPE driftguard_http_requests_total counter",
      `driftguard_http_requests_total{method="GET",route="/",service="${name}",status="200"} ${ok}`,
      `driftguard_http_requests_total{method="GET",route="/",service="${name}",status="500"} ${bad}`,
      `driftguard_http_requests_total{method="GET",route="/${svc.probe}",service="${name}",status="200"} ${Math.round(total / 9)}`,
      "# HELP driftguard_http_request_duration_seconds HTTP request latency by service, route, and method.",
      "# TYPE driftguard_http_request_duration_seconds histogram",
    ];
    for (const le of les) {
      const frac = 1 - Math.exp(-(le * 1000) / Math.max(st.p95 / 3, 1));
      lines.push(`driftguard_http_request_duration_seconds_bucket{method="GET",route="/",service="${name}",le="${le}"} ${Math.round(total * frac)}`);
    }
    lines.push(`driftguard_http_request_duration_seconds_bucket{method="GET",route="/",service="${name}",le="+Inf"} ${total}`);
    lines.push(`driftguard_http_request_duration_seconds_count{method="GET",route="/",service="${name}"} ${total}`);
    lines.push("# HELP go_goroutines Number of goroutines that currently exist.", "# TYPE go_goroutines gauge", `go_goroutines ${Math.round(rand(7, 11))}`);
    return lines.join("\n");
  }

  function updateModeChip() {
    const chip = $("#modeChip");
    if (!chip) return;
    const m = Telemetry.mode;
    chip.className = `mode-chip ${m === "live" ? "live" : m === "partial" ? "sim" : m === "sim" ? "sim" : ""}`;
    chip.querySelector("span").textContent = m === "live" ? "live cluster" : m === "partial" ? "partial live" : m === "sim" ? "simulation" : "connecting";
    chip.title = m === "live" ? "Connected to the real checkout-svc and payments-svc" : "Services unreachable — showing simulated telemetry. Configure endpoints on the Services page.";
  }

  /* ============================================================ CHARTS */
  let gradSeq = 0;
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }

  class Chart {
    constructor(el, opts) {
      this.el = el;
      this.o = Object.assign({ series: [], spark: false, threshold: null, unit: "", minMax: 1, pad: 6 }, opts);
      this.data = this.o.series.map(() => []);
      this.w = 0; this.h = 0;
      this.ro = new ResizeObserver(() => this.build());
      this.ro.observe(el);
    }
    build() {
      const w = Math.round(this.el.clientWidth), h = Math.round(this.el.clientHeight);
      if (!w || !h || (w === this.w && h === this.h && this.svg)) return;
      this.w = w; this.h = h;
      const spark = this.o.spark;
      const defs = this.o.series.map((s) => {
        s.gid = `g${++gradSeq}`;
        return `<linearGradient id="${s.gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.color}" stop-opacity="${spark ? 0.14 : 0.16}"/><stop offset="1" stop-color="${s.color}" stop-opacity="0"/></linearGradient>`;
      }).join("");
      let grid = "";
      if (!spark) for (let i = 1; i < 4; i++) grid += `<line class="gridl" x1="0" x2="${w}" y1="${(h / 4) * i}" y2="${(h / 4) * i}"/>`;
      const bodies = this.o.series.map((s, i) => `<path class="area" data-i="${i}" fill="url(#${s.gid})"/><path class="line draw-in" data-i="${i}" stroke="${s.color}"/>${spark ? "" : `<circle class="head" data-i="${i}" r="4" fill="${s.color}" stroke="#0a0c12" stroke-width="2"/>`}`).join("");
      this.el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><defs>${defs}</defs>${grid}<g class="thr-g"></g>${bodies}<g class="ax"></g></svg>`;
      this.svg = this.el.firstChild;
      this.draw();
    }
    update(...arrays) { this.data = arrays; this.draw(); }
    draw() {
      if (!this.svg || !this.data.length || !this.data[0].length) return;
      const { w, h } = this, pad = this.o.spark ? 3 : this.o.pad;
      const all = this.data.flat();
      let max = Math.max(this.o.minMax, ...all, this.o.threshold ? this.o.threshold * 1.15 : 0) * 1.18;
      const y = (v) => h - pad - (clamp(v, 0, max) / max) * (h - pad * 2);
      this.data.forEach((vals, i) => {
        const n = vals.length;
        const pts = vals.map((v, j) => [(j / (n - 1)) * w, y(v)]);
        const d = smoothPath(pts);
        const line = this.svg.querySelector(`.line[data-i="${i}"]`);
        const area = this.svg.querySelector(`.area[data-i="${i}"]`);
        if (line) line.setAttribute("d", d);
        if (area) area.setAttribute("d", `${d} L${w},${h} L0,${h} Z`);
        const head = this.svg.querySelector(`.head[data-i="${i}"]`);
        if (head) { head.setAttribute("cx", pts[n - 1][0] - 4); head.setAttribute("cy", pts[n - 1][1]); }
      });
      if (this.o.threshold) {
        const ty = y(this.o.threshold);
        this.svg.querySelector(".thr-g").innerHTML = `<line class="thr" x1="0" x2="${w}" y1="${ty}" y2="${ty}"/>${this.o.spark ? "" : `<text class="thr-label" x="${w - 4}" y="${ty - 6}" text-anchor="end">gate ${this.o.threshold}${this.o.unit}</text>`}`;
      }
      if (!this.o.spark) {
        this.svg.querySelector(".ax").innerHTML = `<text class="axis" x="4" y="12">${fmtMs(max / 1.18)}${this.o.unit}</text>`;
      }
    }
    destroy() { this.ro.disconnect(); }
  }

  /* ============================================================ CANVAS */
  function fitCanvas(canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function glowDot(ctx, x, y, r, color, alpha = 1) {
    ctx.globalAlpha = alpha * 0.07; ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  const qBez = (p0, c, p1, t) => [(1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * c[0] + t * t * p1[0], (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * c[1] + t * t * p1[1]];

  /* ============================================================= SCOPE */
  function makeScope() {
    const fns = [];
    return {
      add(f) { fns.push(f); },
      interval(fn, ms) { const id = setInterval(fn, ms); fns.push(() => clearInterval(id)); return id; },
      timeout(fn, ms) { const id = setTimeout(fn, ms); fns.push(() => clearTimeout(id)); return id; },
      on(t, e, f, o) { t.addEventListener(e, f, o); fns.push(() => t.removeEventListener(e, f, o)); },
      sub(fn) { fns.push(Telemetry.on(fn)); fn(Telemetry.state, Telemetry.mode); },
      chart(el, opts) { const c = new Chart(el, opts); fns.push(() => c.destroy()); return c; },
      loop(fn) {
        let id, last = performance.now();
        const step = (now) => { const dt = Math.min(0.12, (now - last) / 1000); last = now; if (!document.hidden) fn(dt, now); id = requestAnimationFrame(step); };
        id = requestAnimationFrame(step);
        fns.push(() => cancelAnimationFrame(id));
      },
      observe(el, cb) { const ro = new ResizeObserver(cb); ro.observe(el); fns.push(() => ro.disconnect()); },
      dispose() { fns.splice(0).reverse().forEach((f) => { try { f(); } catch { /* ignore */ } }); },
    };
  }

  /* ============================================================ SHARED UI */
  function splitWords(text, baseDelay = 0, step = 0.07, cls = "") {
    return text.split(" ").map((w, i) => `<span class="split-word"><span class="${cls}" style="--d:${(baseDelay + i * step).toFixed(2)}s">${w}</span></span>`).join(" ");
  }

  function footer() {
    return `
    <footer class="footer">
      <div class="wrap">
        <div class="footer-grid">
          <div>
            <a class="nav-brand" href="#/"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3l13 5v10c0 8.5-5.4 15-13 19C12.4 33 7 26.5 7 18V8z"/><path class="tick" d="M14 20l4.5 4.5L27 15"/></svg><span>Drift<b>Guard</b></span></a>
            <p class="muted" style="max-width:360px;margin-top:14px;font-size:14px">GitOps continuous delivery for AWS EKS. Terraform builds the ground, ArgoCD keeps it true, Argo Rollouts ships it safely and Prometheus decides.</p>
          </div>
          <div><h5>Explore</h5><a href="#/dashboard">Command Center</a><a href="#/rollouts">Rollout Studio</a><a href="#/pipeline">Pipeline</a></div>
          <div><h5>Operate</h5><a href="#/services">Live Services</a><a href="#/playbooks">Demo Playbooks</a><a href="#/rollouts?mode=bluegreen">Blue-green</a></div>
          <div><h5>Source</h5><a href="https://github.com/Arnazz10/driftgaurd" target="_blank" rel="noopener">GitHub ↗</a><a href="https://github.com/Arnazz10/driftgaurd/tree/main/charts" target="_blank" rel="noopener">Helm charts ↗</a><a href="https://github.com/Arnazz10/driftgaurd/tree/main/terraform" target="_blank" rel="noopener">Terraform ↗</a></div>
        </div>
        <div class="footer-big">DRIFTGUARD</div>
        <div class="footer-bottom"><span>© ${new Date().getFullYear()} DriftGuard · built by Arnazz10</span><span>desired state = actual state</span></div>
      </div>
    </footer>`;
  }

  /* ============================================================== DATA */
  const ENVS = {
    dev: {
      checkout: { stage: 1, commit: "8f4c21a", from: "v1.4.1", to: "v1.4.2", timeline: [["Git commit", "values-dev.yaml image.tag → v1.4.2", "09:10", "done"], ["ArgoCD sync", "checkout-dev Synced", "09:12", "done"], ["Canary 40%", "analysis run 2/4 in progress", "09:18", "active"], ["Promoted", "awaiting analysis", "--", "pending"]] },
      payments: { active: "v1.3.8", preview: "v1.4.0-rc.2", previewState: "analysing", commit: "41de02c", timeline: [["Git commit", "values-dev.yaml image.tag → v1.4.0-rc.2", "09:03", "done"], ["ArgoCD sync", "payments-dev Synced", "09:05", "done"], ["Preview ready", "prePromotionAnalysis running", "09:08", "active"], ["Promoted", "manual promotion required", "--", "pending"]] },
      rollbacks: [["Yesterday 18:42", "checkout-svc", "5xx rate breached 5% across 2 analysis windows at 40% canary"], ["Sep 10, 16:11", "payments-svc", "p95 latency exceeded 500ms during pre-promotion analysis"]],
    },
    staging: {
      checkout: { stage: 0, commit: "c7a912e", from: "v1.4.0", to: "v1.4.1", timeline: [["Git commit", "values-staging image.tag → v1.4.1", "08:24", "done"], ["ArgoCD sync", "checkout-staging Synced", "08:27", "done"], ["Canary 20%", "pause 60s", "08:34", "active"], ["Promoted", "pending", "--", "pending"]] },
      payments: { active: "v1.3.8", preview: "—", previewState: "idle", commit: "2ab71fd", timeline: [["Git commit", "values-staging image.tag → v1.3.8", "07:55", "done"], ["ArgoCD sync", "payments-staging Synced", "07:58", "done"], ["Preview ready", "analysis successful", "08:04", "done"], ["Promoted", "active service switched", "08:18", "done"]] },
      rollbacks: [["Sep 11, 12:09", "checkout-svc", "availability dipped below SLO during 20% canary"]],
    },
    prod: {
      checkout: { stage: 4, commit: "f02ad91", from: "v1.3.9", to: "v1.4.0", timeline: [["Git commit", "values-prod image.tag → v1.4.0", "06:42", "done"], ["ArgoCD sync", "checkout-prod Synced", "06:45", "done"], ["Canary 20→60%", "3 analysis runs successful", "07:02", "done"], ["Promoted", "100% on v1.4.0", "07:16", "done"]] },
      payments: { active: "v1.3.7", preview: "—", previewState: "idle", commit: "91be83f", timeline: [["Git commit", "values-prod image.tag → v1.3.7", "05:31", "done"], ["ArgoCD sync", "payments-prod Synced", "05:36", "done"], ["Preview ready", "analysis successful", "05:50", "done"], ["Promoted", "manual promotion by on-call", "06:05", "done"]] },
      rollbacks: [["Sep 07, 21:33", "payments-svc", "preview stack failed readiness before promotion"], ["Sep 03, 02:16", "checkout-svc", "p95 latency breached 500ms for two analysis windows"]],
    },
  };

  /* ============================================================ LANDING */
  const Landing = {
    title: "DriftGuard — Ship fearlessly. Drift never.",
    html() {
      const stack = ["Terraform", "AWS EKS", "ArgoCD", "Argo Rollouts", "Prometheus", "Grafana", "Helm", "GitHub Actions", "Amazon ECR", "Go", "IRSA + OIDC", "Kubernetes"];
      const marquee = [...stack, ...stack].map((s) => `<span class="marquee-item"><i></i>${s}</span>`).join("");
      return `
      <section class="hero">
        <div class="wrap hero-grid">
          <div class="hero-copy">
            <span class="hero-badge reveal"><b>GITOPS</b><span data-scramble>Metric-gated delivery for AWS EKS</span></span>
            <h1 class="h-display h1 hero-title">
              <span class="line">${splitWords("Ship fearlessly.", 0.1)}</span>
              <span class="line">${splitWords("Drift", 0.3)} <span class="split-word"><span class="grad-duo" style="--d:.38s">never.</span></span></span>
            </h1>
            <p class="lead reveal" style="--d:.5s">DriftGuard turns every <code>git push</code> into a progressive rollout. ArgoCD reconciles the cluster to Git, Argo Rollouts shifts traffic step by step, and Prometheus pulls the plug the moment errors spike.</p>
            <div class="hero-cta reveal" style="--d:.62s">
              <a class="btn btn-ember magnetic" href="#/dashboard">Launch Command Center <span class="arrow">→</span></a>
              <a class="btn btn-ghost magnetic" href="#/rollouts">${icon("play", "kpi-svg")} Watch a rollout</a>
            </div>
            <div class="hero-trust reveal" style="--d:.74s">
              <div><b data-count="4">0</b><span>canary stages</span></div>
              <div><b data-count="5" data-suffix="%">0</b><span>5xx abort gate</span></div>
              <div><b data-count="500" data-suffix="ms">0</b><span>p95 gate</span></div>
              <div><b data-count="0">0</b><span>secrets in git</span></div>
            </div>
            <div class="scroll-cue reveal" style="--d:.9s"><i></i>scroll to see how</div>
          </div>
          <div class="reactor reveal" style="--d:.3s">
            <canvas id="reactor"></canvas>
            <div class="reactor-hud tl float-a"><span>CANARY WEIGHT</span><b id="hudW">0%</b></div>
            <div class="reactor-hud tr float-b"><span>p95 LATENCY</span><b id="hudL">— ms</b></div>
            <div class="reactor-hud br float-a"><span>5xx RATE · gate &lt; 5%</span><b id="hudE">—</b></div>
          </div>
        </div>
      </section>

      <div class="marquee"><div class="marquee-track">${marquee}</div></div>

      <section class="section">
        <div class="wrap">
          <div class="page-head" style="text-align:center;justify-items:center">
            <span class="eyebrow reveal">The problem</span>
            <h2 class="h-display h2 reveal" style="--d:.08s">Deploys fail. <span class="grad-ember">Drift</span> hides.<br/>Humans get paged.</h2>
          </div>
          <div class="contrast">
            <div class="tile bad-side reveal">
              <div>
                <div class="tile-kicker" style="color:var(--bad)">${icon("alert", "kpi-svg")} without a guard</div>
                <h3 class="h-display h3" style="margin:12px 0 18px">Big-bang releases</h3>
                <ul>
                  <li>Live cluster quietly diverges from what's in Git.</li>
                  <li>A bad image hits 100% of users in one shot.</li>
                  <li>Someone eyeballs Grafana and decides to roll back at 2am.</li>
                  <li>Static AWS keys live in CI secrets forever.</li>
                </ul>
              </div>
              <div class="drift-viz"><svg viewBox="0 0 400 90" preserveAspectRatio="none"><path d="M0 45 C100 45 200 45 400 45" stroke="#6b7386" stroke-dasharray="4 6" fill="none"/><path class="draw-in" d="M0 45 C80 46 140 30 200 52 S320 10 400 80" stroke="#f2b84b" stroke-width="2.4" fill="none"/><text x="6" y="36" fill="#6b7386" font-size="10" font-family="JetBrains Mono">desired</text><text x="330" y="74" fill="#f2b84b" font-size="10" font-family="JetBrains Mono">actual</text></svg></div>
            </div>
            <div class="tile good-side reveal" style="--d:.12s">
              <div>
                <div class="tile-kicker" style="color:var(--ok)">${icon("shield", "kpi-svg")} with driftguard</div>
                <h3 class="h-display h3" style="margin:12px 0 18px">Progressive, self-correcting</h3>
                <ul>
                  <li>ArgoCD <b>selfHeal</b> snaps the cluster back to Git within seconds.</li>
                  <li>Canary walks 20 → 40 → 60 → 100% with analysis between every step.</li>
                  <li>Prometheus aborts automatically on 5xx &gt; 5% or p95 &gt; 500ms.</li>
                  <li>GitHub OIDC + IRSA — short-lived credentials only.</li>
                </ul>
              </div>
              <div class="drift-viz"><svg viewBox="0 0 400 90" preserveAspectRatio="none"><path d="M0 45 C100 45 200 45 400 45" stroke="#6b7386" stroke-dasharray="4 6" fill="none"/><path class="draw-in" d="M0 70 C60 70 90 20 150 40 S260 46 400 45" stroke="#e8ebf2" stroke-width="2.4" fill="none"/><text x="330" y="36" fill="#e8ebf2" font-size="10" font-family="JetBrains Mono">reconciled</text></svg></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section" id="how">
        <div class="wrap">
          <div class="page-head-row">
            <div class="page-head" style="margin:0">
              <span class="eyebrow reveal">How it works</span>
              <h2 class="h-display h2 reveal" style="--d:.08s">From <span class="grad-ember">commit</span><br/>to <span class="grad-ice">confidence</span>.</h2>
            </div>
            <p class="lead reveal" style="--d:.16s;max-width:420px">Six stages, zero kubectl. Every arrow below is automated and every decision is made by metrics, not by mood.</p>
          </div>
          <div class="flow" id="flow">
            <div class="flow-rail"><i></i></div>
            ${[
              ["Commit desired state", "Bump image.tag in a Helm values file and push. Git is the only interface to the cluster.", "git push"],
              ["Build & ship", "GitHub Actions tests the Go service, builds the image and pushes to ECR using GitHub OIDC — no static keys.", "ci.yaml"],
              ["Reconcile", "ArgoCD's app-of-apps detects the change and syncs it, pruning and self-healing anything that drifts.", "selfHeal: true"],
              ["Progressive rollout", "Argo Rollouts runs a canary for checkout-svc and blue-green for payments-svc.", "20 · 40 · 60 · 100"],
              ["Analyze", "AnalysisTemplates query Prometheus every 30s for 5xx ratio and p95 latency.", "count: 2"],
              ["Promote or abort", "Healthy? Traffic shifts forward. Breach? The rollout aborts and stable keeps serving.", "auto-rollback"],
            ].map(([t, d, c], i) => `
              <div class="flow-step reveal" style="--d:${i * 0.05}s">
                <div class="flow-num">0${i + 1}</div>
                <div><h4>${t}</h4><p>${d}</p></div>
                <span class="chip ember mono">${c}</span>
              </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="page-head" style="text-align:center;justify-items:center;margin-bottom:0">
            <span class="eyebrow reveal">Capabilities</span>
            <h2 class="h-display h2 reveal" style="--d:.08s">Every safety net,<br/><span class="grad-duo">already wired.</span></h2>
          </div>
          <div class="bento">
            <a class="tile lift b-wide reveal" href="#/rollouts">
              <div class="tile-head"><div><div class="tile-kicker">${icon("bird", "kpi-svg")} checkout-svc</div><h3 class="tile-title" style="margin-top:10px">Metric-gated canary</h3><p class="tile-sub">Replica-weighted steps with 60s pauses and Prometheus analysis between each one.</p></div><span class="chip ember">open studio →</span></div>
              <div class="mini-canary" id="miniCanary">
                <div class="row stable"><span>stable v1</span><div class="bar"><i style="width:100%"></i></div><b>100%</b></div>
                <div class="row canary"><span>canary v2</span><div class="bar"><i style="width:0%"></i></div><b>0%</b></div>
              </div>
            </a>
            <div class="tile lift b-small reveal" style="--d:.06s">
              <div><div class="tile-kicker">${icon("gauge", "kpi-svg")} analysis</div><h3 class="tile-title" style="margin-top:10px">5xx gate</h3></div>
              <div class="bento-viz"><svg class="gauge" viewBox="0 0 150 90" id="miniGauge"><path class="track" d="M15 80 A60 60 0 0 1 135 80" stroke-width="12" fill="none" stroke-linecap="round"/><path class="val" d="M15 80 A60 60 0 0 1 135 80" stroke="url(#gGrad)" stroke-width="12" fill="none" stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="188.5"/><defs><linearGradient id="gGrad"><stop offset="0" stop-color="#e8ebf2"/><stop offset=".6" stop-color="#5b8cff"/><stop offset="1" stop-color="#f2b84b"/></linearGradient></defs><text x="75" y="72" text-anchor="middle" fill="#e8ebf2" font-family="Inter" font-size="20" font-weight="600" id="miniGaugeVal">0%</text></svg></div>
            </div>
            <a class="tile lift b-mid reveal" href="#/rollouts?mode=bluegreen">
              <div><div class="tile-kicker">${icon("card", "kpi-svg")} payments-svc</div><h3 class="tile-title" style="margin-top:10px">Blue-green with a human gate</h3><p class="tile-sub">Preview stack, pre-promotion analysis, manual promote, 30s scale-down delay.</p></div>
              <div class="bg-switch" id="miniBG">
                <div class="bg-stack on"><b>blue</b>active</div>
                <div class="bg-wire"><svg viewBox="0 0 60 40"><path d="M0 20 H60" stroke="#7d869c" stroke-width="2" stroke-dasharray="4 5" style="animation:flowDash .8s linear infinite"/></svg></div>
                <div class="bg-stack green"><b>green</b>preview</div>
              </div>
            </a>
            <a class="tile lift b-mid reveal" style="--d:.06s" href="#/pipeline">
              <div><div class="tile-kicker">${icon("layers", "kpi-svg")} terraform</div><h3 class="tile-title" style="margin-top:10px">Infrastructure as code</h3><p class="tile-sub">VPC, EKS, spot node group, ECR, GitHub OIDC and IRSA — remote state in S3 with DynamoDB locks.</p></div>
              <div class="bento-viz"><div class="layers"><i></i><i></i><i></i></div></div>
            </a>
            <div class="tile lift b-small reveal">
              <div><div class="tile-kicker">${icon("heart", "kpi-svg")} argocd</div><h3 class="tile-title" style="margin-top:10px">Self-heal</h3><p class="tile-sub">Delete it. Watch it return.</p></div>
              <div class="bento-viz"><div class="heal" id="miniHeal">${[[0, 0], [51, 0], [102, 0], [0, 51], [51, 51], [102, 51], [0, 102], [51, 102], [102, 102]].map(([x, y], i) => `<div class="pod" style="left:${x}px;top:${y}px">p${i}</div>`).join("")}</div></div>
            </div>
            <a class="tile lift b-wide reveal" style="--d:.06s" href="#/dashboard">
              <div class="tile-head"><div><div class="tile-kicker">${icon("pulse", "kpi-svg")} prometheus</div><h3 class="tile-title" style="margin-top:10px">Real telemetry, not vibes</h3><p class="tile-sub">Both services expose identical <code>driftguard_http_*</code> metrics scraped every 15s. This chart is streaming right now.</p></div><span class="chip" id="bentoMode">—</span></div>
              <div class="chart" id="bentoChart" style="height:120px"></div>
            </a>
          </div>
        </div>
      </section>

      <section class="section-tight">
        <div class="wrap">
          <div class="stats-band reveal">
            <div class="stat"><b class="grad-ember" data-count="4">0</b><span>progressive canary steps</span></div>
            <div class="stat"><b class="grad-ember" data-count="30" data-suffix="s">0</b><span>analysis interval</span></div>
            <div class="stat"><b class="grad-ice" data-count="15" data-suffix="s">0</b><span>Prometheus scrape</span></div>
            <div class="stat"><b class="grad-ice" data-count="2" data-suffix="×">0</b><span>t3.medium spot nodes (dev)</span></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="page-head-row" style="margin-bottom:30px">
            <div class="page-head" style="margin:0"><span class="eyebrow reveal">Live right now</span><h2 class="h-display h2 reveal" style="--d:.08s">The services are <span class="grad-ember">breathing.</span></h2></div>
            <a class="btn btn-ghost reveal" href="#/services">Poke the APIs <span class="arrow">→</span></a>
          </div>
          <div class="live-strip">
            <div class="tile reveal">
              <div class="tile-head"><div><div class="tile-kicker">throughput · req/s</div><div class="kpi-val" style="margin-top:8px" id="lsRps">—</div></div><span class="chip" id="lsMode">—</span></div>
              <div class="chart" id="lsChart" style="height:160px"></div>
            </div>
            ${SERVICES.map((s, i) => `
            <div class="tile reveal" style="--d:${0.08 * (i + 1)}s">
              <div class="svc-name"><span class="orb ok" id="lsOrb-${s.key}"></span><div><b class="tile-title" style="margin:0">${s.name}</b><div class="muted mono" style="font-size:12px" id="lsVer-${s.key}">—</div></div></div>
              <div class="svc-metrics" style="grid-template-columns:1fr 1fr;margin-top:18px">
                <div class="svc-metric"><span>5xx</span><b id="lsErr-${s.key}">—</b></div>
                <div class="svc-metric"><span>p95</span><b id="lsLat-${s.key}">—</b></div>
              </div>
              <div class="spark" id="lsSpark-${s.key}" style="height:50px;margin-top:16px"></div>
            </div>`).join("")}
          </div>
        </div>
      </section>

      <section class="section-tight">
        <div class="wrap">
          <div class="cta reveal">
            <span class="eyebrow">Ready when you are</span>
            <h2 class="h-display h2">Stop babysitting<br/><span class="grad-duo">deploys.</span></h2>
            <p class="lead">Spin up the stack locally with <code>make local-up</code>, then break things on purpose and watch DriftGuard catch them.</p>
            <div class="hero-cta" style="justify-content:center">
              <a class="btn btn-ember magnetic" href="#/playbooks">Run a playbook <span class="arrow">→</span></a>
              <a class="btn btn-ghost magnetic" href="#/pipeline">Explore the pipeline</a>
            </div>
          </div>
        </div>
      </section>
      ${footer()}`;
    },
    mount(root, scope) {
      mountReactor(scope, $("#reactor", root));

      // flow rail scroll progress
      const flow = $("#flow", root);
      const steps = $$(".flow-step", flow);
      const onScroll = () => {
        const r = flow.getBoundingClientRect();
        const mid = window.innerHeight * 0.6;
        const p = clamp((mid - r.top) / r.height, 0, 1);
        flow.style.setProperty("--p", p);
        $(".flow-rail i", flow).style.setProperty("--p", p);
        steps.forEach((s) => { const sr = s.getBoundingClientRect(); s.classList.toggle("lit", sr.top + sr.height / 2 < mid); });
      };
      scope.on(window, "scroll", onScroll, { passive: true });
      onScroll();

      // mini canary cycle
      const mc = $("#miniCanary", root);
      const weights = [0, 20, 40, 60, 100];
      let wi = 0;
      scope.interval(() => {
        wi = (wi + 1) % weights.length;
        const w = weights[wi];
        $(".stable i", mc).style.width = `${100 - w}%`; $(".stable b", mc).textContent = `${100 - w}%`;
        $(".canary i", mc).style.width = `${w}%`; $(".canary b", mc).textContent = `${w}%`;
      }, 1500);

      // mini gauge
      const g = $("#miniGauge .val", root), gv = $("#miniGaugeVal", root);
      scope.sub((st) => {
        const e = st.checkout?.err || 0;
        g.setAttribute("stroke-dashoffset", 188.5 * (1 - clamp(e / 10, 0.02, 1)));
        gv.textContent = `${e.toFixed(1)}%`;
      });

      // mini blue-green toggle
      const bg = $("#miniBG", root);
      let blueOn = true;
      scope.interval(() => {
        blueOn = !blueOn;
        const [b, gr] = $$(".bg-stack", bg);
        b.classList.toggle("on", blueOn); gr.classList.toggle("on", !blueOn);
        b.lastChild.textContent = blueOn ? "active" : "preview"; gr.lastChild.textContent = blueOn ? "preview" : "active";
        $("path", bg).setAttribute("stroke", blueOn ? "#7d869c" : "#5b8cff");
      }, 2600);

      // mini heal
      const pods = $$("#miniHeal .pod", root);
      scope.interval(() => {
        const p = pods[Math.floor(Math.random() * pods.length)];
        p.classList.add("gone"); p.classList.remove("back");
        scope.timeout(() => { p.classList.remove("gone"); p.classList.add("back"); }, 1300);
      }, 2200);

      // live charts
      const bento = scope.chart($("#bentoChart", root), { series: [{ color: "#5b8cff" }, { color: "#7d869c" }] });
      const ls = scope.chart($("#lsChart", root), { series: [{ color: "#5b8cff" }, { color: "#7d869c" }] });
      const sparks = Object.fromEntries(SERVICES.map((s) => [s.key, scope.chart($(`#lsSpark-${s.key}`, root), { spark: true, series: [{ color: s.color }] })]));
      scope.sub((st, mode) => {
        const a = Telemetry.series("checkout", "rps"), b = Telemetry.series("payments", "rps");
        bento.update(a, b); ls.update(a, b);
        const chipCls = mode === "live" ? "chip ok" : "chip warn";
        const chipTxt = mode === "live" ? "● live" : mode === "connecting" ? "connecting" : "● simulated";
        for (const id of ["#bentoMode", "#lsMode"]) { const c = $(id, root); c.className = chipCls; c.textContent = chipTxt; }
        $("#lsRps", root).innerHTML = `${((st.checkout?.rps || 0) + (st.payments?.rps || 0)).toFixed(1)}<small>req/s</small>`;
        for (const s of SERVICES) {
          const x = st[s.key]; if (!x) continue;
          sparks[s.key].update(Telemetry.series(s.key, "p95"));
          $(`#lsErr-${s.key}`, root).textContent = `${x.err.toFixed(2)}%`;
          $(`#lsLat-${s.key}`, root).textContent = `${fmtMs(x.p95)}ms`;
          $(`#lsVer-${s.key}`, root).textContent = `${x.version} · ${s.strategy}`;
          $(`#lsOrb-${s.key}`, root).className = `orb ${x.err > THRESH.err ? "bad" : x.health === "ok" ? "ok" : "warn"}`;
        }
      });
    },
  };

  function mountReactor(scope, canvas) {
    let ctx, W, H;
    const resize = () => ({ ctx, w: W, h: H } = fitCanvas(canvas));
    resize();
    scope.observe(canvas, resize);
    const stages = [0, 20, 40, 60, 100];
    let si = 0, st = 0, weight = 0, flash = 0, spawnAcc = 0, rot = 0;
    const parts = [], bursts = [];
    const hudW = $("#hudW"), hudL = $("#hudL"), hudE = $("#hudE");
    let hudT = 0;

    scope.loop((dt) => {
      const S = Math.min(W, H);
      const ox = (W - S) / 2, oy = (H - S) / 2;
      const P = (x, y) => [ox + x * S, oy + y * S];
      const src = P(0.06, 0.5), hub = P(0.44, 0.5), stable = P(0.86, 0.22), canary = P(0.86, 0.78);
      rot += dt;
      st += dt;
      if (st > 2.8) { st = 0; si = (si + 1) % stages.length; if (stages[si] === 100) flash = 1; }
      weight = lerp(weight, stages[si], Math.min(1, dt * 3));
      flash = Math.max(0, flash - dt * 0.6);

      spawnAcc += dt * (reduced ? 8 : 30);
      while (spawnAcc > 1) {
        spawnAcc--;
        const c = Math.random() * 100 < weight;
        parts.push({ t: 0, sp: rand(0.55, 0.85), c, err: c && Math.random() < 0.04, j: rand(-1, 1), px: null, py: null });
      }

      ctx.clearRect(0, 0, W, H);

      // lanes
      const cS = [hub[0] + S * 0.18, stable[1]], cC = [hub[0] + S * 0.18, canary[1]];
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(125,134,156,.16)";
      ctx.beginPath(); ctx.moveTo(...src); ctx.lineTo(...hub); ctx.stroke();
      ctx.strokeStyle = `rgba(125,134,156,${0.12 + (1 - weight / 100) * 0.3})`;
      ctx.beginPath(); ctx.moveTo(...hub); ctx.quadraticCurveTo(...cS, ...stable); ctx.stroke();
      ctx.strokeStyle = `rgba(91,140,255,${0.12 + (weight / 100) * 0.4})`;
      ctx.beginPath(); ctx.moveTo(...hub); ctx.quadraticCurveTo(...cC, ...canary); ctx.stroke();

      // hub rings
      ctx.save(); ctx.translate(...hub);
      for (let i = 0; i < 3; i++) {
        const r = S * (0.09 + i * 0.045);
        ctx.rotate(rot * (i % 2 ? -0.6 : 0.4) * (i + 1) * 0.5);
        ctx.strokeStyle = i === 1 ? "rgba(125,134,156,.45)" : "rgba(91,140,255,.5)";
        ctx.lineWidth = i === 0 ? 2 : 1;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * (0.6 + i * 0.25)); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r, Math.PI, Math.PI * (1.3 + i * 0.15)); ctx.stroke();
      }
      ctx.restore();
      ctx.save(); ctx.translate(...hub);
      const pulse = 1 + Math.sin(rot * 3) * 0.04 + flash * 0.25;
      ctx.scale(pulse, pulse);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, S * 0.11);
      g.addColorStop(0, `rgba(91,140,255,${0.35 + flash * 0.4})`); g.addColorStop(1, "rgba(91,140,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, S * 0.11, 0, Math.PI * 2); ctx.fill();
      const k = S * 0.0018;
      ctx.scale(k, k); ctx.translate(-20, -20);
      const sh = new Path2D("M20 3l13 5v10c0 8.5-5.4 15-13 19C12.4 33 7 26.5 7 18V8z");
      const sg = ctx.createLinearGradient(0, 0, 40, 40); sg.addColorStop(0, "#c9d1e4"); sg.addColorStop(1, "#5b8cff");
      ctx.fillStyle = sg; ctx.fill(sh);
      ctx.strokeStyle = "#0a0c12"; ctx.lineWidth = 3.4; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.stroke(new Path2D("M14 20l4.5 4.5L27 15"));
      ctx.restore();

      // nodes
      const node = (p, label, sub, color, glow) => {
        const w = S * 0.22, h = S * 0.1;
        ctx.save();
        ctx.shadowBlur = 0;
        roundRect(ctx, p[0] - w / 2, p[1] - h / 2, w, h, 14);
        ctx.fillStyle = "rgba(15,18,26,.96)"; ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = color; ctx.globalAlpha = 0.4 + glow * 0.6; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#e8ebf2"; ctx.font = `700 ${Math.max(10, S * 0.026)}px Inter, sans-serif`; ctx.textAlign = "center";
        ctx.fillText(label, p[0], p[1] - 1);
        ctx.fillStyle = color; ctx.font = `500 ${Math.max(9, S * 0.019)}px "JetBrains Mono", monospace`;
        ctx.fillText(sub, p[0], p[1] + S * 0.027);
        ctx.restore();
      };
      node(stable, "stable", `v1 · ${Math.round(100 - weight)}%`, "#7d869c", 1 - weight / 100);
      node(canary, "canary", `v2 · ${Math.round(weight)}%`, "#5b8cff", weight / 100);
      ctx.fillStyle = "#6b7386"; ctx.font = `500 ${Math.max(9, S * 0.02)}px "JetBrains Mono", monospace`; ctx.textAlign = "center";
      ctx.fillText("users", src[0], src[1] - S * 0.04);
      glowDot(ctx, ...src, 4, "#c9d1e4");

      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt * p.sp;
        let pos;
        if (p.t < 1) pos = [lerp(src[0], hub[0], p.t), lerp(src[1], hub[1], p.t) + Math.sin(p.t * 9 + p.j * 3) * S * 0.012 * p.j];
        else if (p.t < 2) pos = qBez(hub, p.c ? cC : cS, p.c ? canary : stable, p.t - 1);
        else {
          if (p.err) bursts.push({ x: canary[0] - S * 0.11, y: canary[1], r: 0, a: 1 });
          parts.splice(i, 1); continue;
        }
        const color = p.err && p.t > 1.3 ? "#f2b84b" : p.t < 1 ? "#c9d1e4" : p.c ? "#5b8cff" : "#7d869c";
        if (p.px !== null) {
          ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(...pos); ctx.stroke(); ctx.globalAlpha = 1;
        }
        glowDot(ctx, pos[0], pos[1], p.err ? 3 : 2.2, color);
        p.px = pos[0]; p.py = pos[1];
      }
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i]; b.r += dt * 60; b.a -= dt * 1.6;
        if (b.a <= 0) { bursts.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(242,184,75,${b.a})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.stroke();
      }
      if (flash > 0) {
        ctx.globalAlpha = Math.min(1, flash * 1.5);
        ctx.fillStyle = "#e8ebf2"; ctx.font = `800 ${S * 0.04}px Inter, sans-serif`; ctx.textAlign = "center";
        ctx.fillText("promoted", hub[0], hub[1] + S * 0.2);
        ctx.globalAlpha = 1;
      }

      hudT += dt;
      if (hudT > 0.2 && hudW) {
        hudT = 0;
        hudW.textContent = `${Math.round(weight)}%`;
        const c = Telemetry.state.checkout;
        if (c) { hudL.textContent = `${fmtMs(c.p95)} ms`; hudE.innerHTML = `${c.err.toFixed(2)}% <span style="color:${c.err < THRESH.err ? "var(--ok)" : "var(--bad)"}">${c.err < THRESH.err ? "✓" : "✗"}</span>`; }
      }
    });
  }

  /* ========================================================== DASHBOARD */
  const Dashboard = {
    title: "Command Center — DriftGuard",
    html() {
      const env = store.get("dg.env", "dev");
      return `
      <section class="page">
        <div class="wrap">
          <div class="page-head-row page-head">
            <div style="display:grid;gap:14px">
              <span class="eyebrow reveal">Command center</span>
              <h1 class="h-display reveal" style="--d:.06s">Everything, <span class="grad-ember">reconciled.</span></h1>
              <p class="lead reveal" style="--d:.12s">Live health, throughput and latency from <code>checkout-svc</code> and <code>payments-svc</code>, plus rollout state per environment.</p>
            </div>
            <div class="reveal" style="--d:.18s;display:grid;gap:10px;justify-items:end">
              <div class="seg" id="envSeg"><span class="seg-pill"></span>${["dev", "staging", "prod"].map((e) => `<button type="button" data-env="${e}" class="${e === env ? "on" : ""}">${e}</button>`).join("")}</div>
              <span class="muted mono" style="font-size:12px" id="lastTick">waiting for first probe…</span>
            </div>
          </div>

          <div class="grid g4">
            ${[
              ["online", "server", "ok", "Services online", ""],
              ["rps", "zap", "", "Throughput", "req/s"],
              ["err", "alert", "bad", "5xx rate", "%"],
              ["lat", "gauge", "ice", "p95 latency", "ms"],
            ].map(([id, ic, tone, label, unit], i) => `
              <div class="tile kpi lift reveal" style="--d:${i * 0.06}s">
                <div class="tile-head" style="margin:0"><span class="tile-kicker">${label}</span><span class="kpi-icon ${tone}">${icon(ic)}</span></div>
                <div class="kpi-val" id="k-${id}">—<small>${unit}</small></div>
                <div class="spark" id="ks-${id}"></div>
              </div>`).join("")}
          </div>

          <div class="grid g2" style="margin-top:20px">
            ${SERVICES.map((s, i) => `
              <div class="tile svc-card reveal" style="--d:${i * 0.08}s">
                <div class="tile-head" style="margin:0">
                  <div class="svc-name"><span class="orb ok" id="d-orb-${s.key}"></span><div><h3 class="tile-title" style="margin:0">${s.name}</h3><span class="muted mono" style="font-size:12px" id="d-ver-${s.key}">—</span></div></div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><span class="chip ${s.tone}">${s.strategy}</span><span class="chip" id="d-mode-${s.key}">—</span></div>
                </div>
                <div class="svc-metrics">
                  <div class="svc-metric"><span>requests</span><b id="d-tot-${s.key}">—</b></div>
                  <div class="svc-metric"><span>req/s</span><b id="d-rps-${s.key}">—</b></div>
                  <div class="svc-metric"><span>5xx</span><b id="d-err-${s.key}">—</b></div>
                  <div class="svc-metric"><span>p99</span><b id="d-p99-${s.key}">—</b></div>
                </div>
                <div class="chart" id="d-chart-${s.key}"></div>
              </div>`).join("")}
          </div>

          <div class="grid g2" style="margin-top:20px" id="envBlock"></div>

          <div class="grid g2" style="margin-top:20px">
            <div class="tile reveal">
              <div class="tile-head"><div><span class="tile-kicker"><span class="dot pulse" style="color:var(--ok)"></span> event stream</span><h3 class="tile-title" style="margin-top:8px">What just happened</h3></div><span class="chip ember mono" id="feedCount">0 events</span></div>
              <div class="feed" id="feed"></div>
            </div>
            <div class="tile reveal" style="--d:.08s">
              <div class="tile-head"><div><span class="tile-kicker">${icon("undo", "kpi-svg")} automatic rollbacks</span><h3 class="tile-title" style="margin-top:8px">Caught before customers noticed</h3></div></div>
              <div id="rollbacks"></div>
              <a class="btn btn-ghost btn-sm" href="#/rollouts" style="margin-top:18px">Reproduce one in the studio <span class="arrow">→</span></a>
            </div>
          </div>
        </div>
      </section>
      ${footer()}`;
    },
    mount(root, scope) {
      const seg = $("#envSeg", root);
      const pill = $(".seg-pill", seg);
      const placePill = () => { const on = $("button.on", seg); if (on) { pill.style.left = `${on.offsetLeft}px`; pill.style.width = `${on.offsetWidth}px`; } };
      const renderEnv = (env) => {
        const d = ENVS[env];
        const stages = [20, 40, 60, 100];
        $("#envBlock", root).innerHTML = `
          <div class="tile reveal in">
            <div class="tile-head"><div><span class="tile-kicker">${icon("bird", "kpi-svg")} checkout-svc · ${env}</span><h3 class="tile-title" style="margin-top:8px">Canary ${d.checkout.from} → ${d.checkout.to}</h3></div><span class="chip mono">#${d.checkout.commit}</span></div>
            <div class="rollout-track"><div class="rt-steps">${stages.map((w, i) => `<div class="rt-step ${i < d.checkout.stage ? "done" : i === d.checkout.stage ? "active" : ""}"><b>${w}%</b>${i < d.checkout.stage ? "passed" : i === d.checkout.stage ? "analysing" : "queued"}</div>`).join("")}</div></div>
            <div class="timeline" style="margin-top:18px">${d.checkout.timeline.map(([t, s, time, state]) => `<div class="tl-item ${state}"><span class="tl-dot"></span><div><b>${t}</b><span>${s}</span></div><time>${time}</time></div>`).join("")}</div>
          </div>
          <div class="tile reveal in">
            <div class="tile-head"><div><span class="tile-kicker">${icon("card", "kpi-svg")} payments-svc · ${env}</span><h3 class="tile-title" style="margin-top:8px">Blue-green</h3></div><span class="chip mono">#${d.payments.commit}</span></div>
            <div class="bg-switch">
              <div class="bg-stack on"><b>${d.payments.active}</b>active</div>
              <div class="bg-wire"><svg viewBox="0 0 60 40"><path d="M0 20 H60" stroke="${d.payments.previewState === "idle" ? "#3a4152" : "#5b8cff"}" stroke-width="2" stroke-dasharray="4 5" style="animation:flowDash 1s linear infinite"/></svg></div>
              <div class="bg-stack green ${d.payments.previewState !== "idle" ? "on" : ""}"><b>${d.payments.preview}</b>${d.payments.previewState}</div>
            </div>
            <div class="timeline" style="margin-top:18px">${d.payments.timeline.map(([t, s, time, state]) => `<div class="tl-item ${state}"><span class="tl-dot"></span><div><b>${t}</b><span>${s}</span></div><time>${time}</time></div>`).join("")}</div>
          </div>`;
        $("#rollbacks", root).innerHTML = d.rollbacks.map(([at, svc, why]) => `<div class="rb-item"><span class="rb-icon">${icon("undo", "kpi-svg")}</span><div><b>${svc}</b> <span class="muted mono" style="font-size:12px">· ${at}</span><p>${why}</p></div></div>`).join("");
      };
      scope.on(seg, "click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        $$("button", seg).forEach((x) => x.classList.toggle("on", x === b));
        placePill(); store.set("dg.env", b.dataset.env); renderEnv(b.dataset.env);
        pushFeed("ember", `Switched context to <b>${b.dataset.env}</b> — ArgoCD apps ${b.dataset.env === "prod" ? "checkout-prod, payments-prod" : `checkout-${b.dataset.env}, payments-${b.dataset.env}`}`);
      });
      scope.observe(seg, placePill);
      renderEnv(store.get("dg.env", "dev"));
      requestAnimationFrame(placePill);

      const ks = {
        rps: scope.chart($("#ks-rps", root), { spark: true, series: [{ color: "#5b8cff" }] }),
        err: scope.chart($("#ks-err", root), { spark: true, series: [{ color: "#f2b84b" }], threshold: THRESH.err, minMax: 1 }),
        lat: scope.chart($("#ks-lat", root), { spark: true, series: [{ color: "#7d869c" }] }),
        online: scope.chart($("#ks-online", root), { spark: true, series: [{ color: "#e8ebf2" }] }),
      };
      const charts = Object.fromEntries(SERVICES.map((s) => [s.key, scope.chart($(`#d-chart-${s.key}`, root), { series: [{ color: s.color }], unit: " r/s" })]));

      const feed = $("#feed", root);
      let count = 0;
      function pushFeed(tone, html) {
        count++;
        const el = document.createElement("div");
        el.className = "feed-item";
        el.innerHTML = `<time>${clock()}</time><span class="chip ${tone}" style="padding:2px 8px">${tone === "ok" ? "ok" : tone === "bad" ? "alert" : tone === "ice" ? "sync" : "info"}</span><p>${html}</p>`;
        feed.prepend(el);
        while (feed.children.length > 12) feed.lastChild.remove();
        $("#feedCount", root).textContent = `${count} events`;
      }
      const ambient = [
        ["ice", "ArgoCD · <b>root-app</b> Synced · Healthy — 0 resources out of sync"],
        ["ok", "Prometheus · ServiceMonitor scrape succeeded for both services"],
        ["ice", "ArgoCD · selfHeal compared live state against Git — no drift"],
        ["ok", "Argo Rollouts · AnalysisRun <b>checkout-svc-analysis</b> measurement successful"],
        ["ember", "Grafana · DriftGuard dashboard refreshed"],
      ];
      let amb = 0;
      scope.interval(() => { pushFeed(...ambient[amb++ % ambient.length]); }, 5200);
      pushFeed("ice", "Command center connected — probing services every 2.5s");

      let lastMode = null;
      scope.sub((st, mode) => {
        if (!st.checkout?.history.length) return;
        const online = SERVICES.filter((s) => st[s.key].online && st[s.key].health === "ok").length;
        const rps = (st.checkout.rps || 0) + (st.payments.rps || 0);
        const err = Math.max(st.checkout.err, st.payments.err);
        const lat = Math.max(st.checkout.p95, st.payments.p95);
        $("#k-online", root).innerHTML = `${online}<small>/ ${SERVICES.length}</small>`;
        $("#k-rps", root).innerHTML = `${rps.toFixed(1)}<small>req/s</small>`;
        $("#k-err", root).innerHTML = `<span style="color:${err > THRESH.err ? "var(--bad)" : "inherit"}">${err.toFixed(2)}</span><small>% max</small>`;
        $("#k-lat", root).innerHTML = `${fmtMs(lat)}<small>ms max</small>`;
        const sum = (f) => Telemetry.series("checkout", f).map((v, i) => v + Telemetry.series("payments", f)[i]);
        const mx = (f) => Telemetry.series("checkout", f).map((v, i) => Math.max(v, Telemetry.series("payments", f)[i]));
        ks.rps.update(sum("rps")); ks.err.update(mx("err")); ks.lat.update(mx("p95"));
        ks.online.update(Telemetry.series("checkout", "rps").map(() => online + rand(-0.04, 0.04)));
        for (const s of SERVICES) {
          const x = st[s.key];
          charts[s.key].update(Telemetry.series(s.key, "rps"));
          $(`#d-orb-${s.key}`, root).className = `orb ${x.err > THRESH.err ? "bad" : x.health === "ok" ? "ok" : "warn"}`;
          $(`#d-ver-${s.key}`, root).textContent = `${x.version} · rtt ${fmtMs(x.rtt)}ms · failRate ${(x.failRate * 100).toFixed(0)}%`;
          const m = $(`#d-mode-${s.key}`, root); m.className = `chip ${x.mode === "live" ? "ok" : "warn"}`; m.textContent = x.mode === "live" ? "● live" : "● simulated";
          $(`#d-tot-${s.key}`, root).textContent = fmtNum(x.total);
          $(`#d-rps-${s.key}`, root).textContent = x.rps.toFixed(1);
          $(`#d-err-${s.key}`, root).textContent = `${x.err.toFixed(2)}%`;
          $(`#d-p99-${s.key}`, root).textContent = `${fmtMs(x.p99)}ms`;
          if (x.err > THRESH.err) pushFeed("bad", `<b>${s.name}</b> 5xx at ${x.err.toFixed(1)}% — above the 5% analysis gate`);
        }
        if (mode !== lastMode) {
          pushFeed(mode === "live" ? "ok" : "ember", mode === "live" ? "Connected to the <b>live</b> services" : "Services unreachable — streaming <b>simulated</b> telemetry");
          lastMode = mode;
        }
        $("#lastTick", root).textContent = `last probe ${clock()} · ${mode === "live" ? "live cluster" : "simulation"}`;
      });
    },
  };

  /* ===================================================== ROLLOUT STUDIO */
  const Rollouts = {
    title: "Rollout Studio — DriftGuard",
    html(q) {
      const mode = q.get("mode") === "bluegreen" ? "bluegreen" : "canary";
      return `
      <section class="page">
        <div class="wrap">
          <div class="page-head-row page-head">
            <div style="display:grid;gap:14px">
              <span class="eyebrow reveal">Rollout studio</span>
              <h1 class="h-display reveal" style="--d:.06s">Break it <span class="grad-ember">safely.</span></h1>
              <p class="lead reveal" style="--d:.12s">Run the real rollout strategies from the Helm charts. Inject the same <code>FAIL_RATE</code> the services support and watch the AnalysisTemplate abort the release.</p>
            </div>
            <div class="tabs reveal" style="--d:.18s" id="rTabs"><span class="tab-pill"></span>
              <button type="button" data-mode="canary" class="${mode === "canary" ? "on" : ""}">${icon("bird", "kpi-svg")} Canary · checkout</button>
              <button type="button" data-mode="bluegreen" class="${mode === "bluegreen" ? "on" : ""}">${icon("card", "kpi-svg")} Blue-green · payments</button>
            </div>
          </div>
          <div id="studio"></div>
        </div>
      </section>
      ${footer()}`;
    },
    mount(root, scope, q) {
      const tabs = $("#rTabs", root), pill = $(".tab-pill", tabs);
      const place = () => { const on = $("button.on", tabs); pill.style.left = `${on.offsetLeft}px`; pill.style.width = `${on.offsetWidth}px`; };
      let sub = null;
      const open = (mode) => {
        if (sub) sub.dispose();
        sub = makeScope();
        $$("button", tabs).forEach((b) => b.classList.toggle("on", b.dataset.mode === mode));
        place();
        (mode === "canary" ? mountCanary : mountBlueGreen)($("#studio", root), sub);
      };
      scope.add(() => sub && sub.dispose());
      scope.on(tabs, "click", (e) => { const b = e.target.closest("button"); if (b) { history.replaceState(null, "", `#/rollouts${b.dataset.mode === "bluegreen" ? "?mode=bluegreen" : ""}`); open(b.dataset.mode); } });
      scope.observe(tabs, place);
      open(q.get("mode") === "bluegreen" ? "bluegreen" : "canary");
    },
  };

  function logLine(box, html, cls = "") {
    const d = document.createElement("div");
    d.innerHTML = `<span class="t">${clock()}</span><span class="${cls}">${html}</span>`;
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
  }

  function analysisPanel(id) {
    return `
      <div class="tile analysis">
        <div class="tile-head" style="margin:0"><div><span class="tile-kicker">${icon("flask", "kpi-svg")} AnalysisTemplate</span><h3 class="tile-title" style="margin-top:8px">Prometheus verdict</h3></div><span class="chip" id="${id}-src">simulated</span></div>
        <div class="meter"><div class="meter-top"><span>5xx ratio</span><span id="${id}-err">0.00%</span></div><div class="meter-bar" id="${id}-errbar"><i style="width:0%"></i><em style="left:50%" data-l="5%"></em></div></div>
        <div class="meter"><div class="meter-top"><span>p95 latency</span><span id="${id}-lat">0ms</span></div><div class="meter-bar" id="${id}-latbar"><i style="width:0%"></i><em style="left:50%" data-l="500ms"></em></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap" id="${id}-runs"><span class="muted mono" style="font-size:12px">no measurements yet · interval 30s · count 2 · failureLimit 1</span></div>
        <div class="log" id="${id}-log"></div>
      </div>`;
  }

  function setMeters(id, err, lat, live) {
    $(`#${id}-err`).textContent = `${err.toFixed(2)}%`;
    $(`#${id}-lat`).textContent = `${fmtMs(lat)}ms`;
    const eb = $(`#${id}-errbar`), lb = $(`#${id}-latbar`);
    $("i", eb).style.width = `${clamp(err / 10, 0, 1) * 100}%`; eb.classList.toggle("hot", err >= THRESH.err);
    $("i", lb).style.width = `${clamp(lat / 1000, 0, 1) * 100}%`; lb.classList.toggle("hot", lat >= THRESH.p95);
    const src = $(`#${id}-src`);
    src.className = `chip ${live ? "ok" : "warn"}`; src.textContent = live ? "● live checkout metrics" : "● simulated metrics";
  }

  function mountCanary(host, scope) {
    host.innerHTML = `
      <div class="studio">
        <div class="tile stage reveal in">
          <div class="tile-head" style="margin:0">
            <div><span class="tile-kicker">checkout-svc · strategy.canary</span><h3 class="tile-title" style="margin-top:8px">v1 <span class="muted">→</span> <span class="grad-ember">v2</span></h3></div>
            <span class="chip" id="cPhase">idle</span>
          </div>
          <div class="rt-steps" id="cSteps">${[20, 40, 60, 100].map((w) => `<div class="rt-step"><b>${w}%</b><span>queued</span></div>`).join("")}</div>
          <div class="stage-canvas"><canvas id="cCanvas"></canvas><div class="stage-banner" id="cBanner"></div></div>
          <div class="pods" id="cPods">${Array.from({ length: 10 }, () => '<div class="pod-cell"></div>').join("")}</div>
          <div class="controls">
            <button class="btn btn-ember btn-sm" id="cStart">${icon("play", "kpi-svg")} Start rollout</button>
            <button class="btn btn-ghost btn-sm" id="cSkip">Skip pause</button>
            <button class="btn btn-ghost btn-sm" id="cAbort">Abort</button>
            <button class="btn btn-ghost btn-sm" id="cReset">Reset</button>
            <label class="toggle" style="margin-left:auto"><input type="checkbox" id="cFail"/><span class="sw"></span>FAIL_RATE=0.5</label>
          </div>
        </div>
        ${analysisPanel("ca")}
      </div>`;
    const steps = [
      { k: "w", w: 20 }, { k: "pause", s: 60 }, { k: "analysis" },
      { k: "w", w: 40 }, { k: "pause", s: 60 }, { k: "analysis" },
      { k: "w", w: 60 }, { k: "pause", s: 60 }, { k: "analysis" },
      { k: "w", w: 100 },
    ];
    const S = { phase: "idle", i: -1, t: 0, weight: 0, shown: 0, fails: 0, meas: 0, err: 0.2, lat: 40 };
    const log = $("#ca-log"), phaseEl = $("#cPhase"), banner = $("#cBanner"), pods = $$("#cPods .pod-cell"), stepEls = $$("#cSteps .rt-step");
    const failEl = $("#cFail");
    const live = () => Telemetry.state.checkout?.mode === "live";
    logLine(log, "Rollout <b>checkout-svc</b> loaded · steps: setWeight 20 → pause 60s → analysis → … → 100", "ic");

    const setPhase = (txt, cls = "") => { phaseEl.className = `chip ${cls}`; phaseEl.textContent = txt; };
    const showBanner = (txt, cls) => { banner.className = `stage-banner show ${cls}`; banner.textContent = txt; scope.timeout(() => banner.classList.remove("show"), 2600); };
    const paintSteps = () => {
      const wIdx = Math.floor(S.i / 3);
      stepEls.forEach((el, n) => {
        el.className = "rt-step";
        let label = "queued";
        if (S.phase === "aborted" && n === wIdx) { el.classList.add("fail"); label = "aborted"; }
        else if (n < wIdx || (S.phase === "done")) { el.classList.add("done"); label = "passed"; }
        else if (n === wIdx && S.phase === "running") { el.classList.add("active"); label = steps[S.i].k === "pause" ? `pause ${Math.ceil(S.t * 20)}s` : steps[S.i].k === "analysis" ? "analysing" : "scaling"; }
        el.lastChild.textContent = label;
      });
    };
    const paintPods = () => {
      const n = Math.round(S.weight / 10);
      pods.forEach((p, i) => { p.classList.toggle("canary", i < n); p.classList.toggle("dead", S.phase === "aborted" && i < n); });
    };

    const enter = () => {
      const st = steps[S.i];
      if (!st) {
        S.phase = "done"; setPhase("Healthy · promoted", "ok");
        logLine(log, "✔ Rollout completed — v2 is now stable at 100%", "ok"); showBanner("✓ Promoted to v2", "ok");
        toast("checkout-svc v2 promoted to 100%", "ok"); paintSteps(); return;
      }
      if (st.k === "w") { S.weight = st.w; S.t = 0.6; logLine(log, `setWeight <b>${st.w}%</b> · scaling canary ReplicaSet`, "hl"); }
      if (st.k === "pause") { S.t = st.s / 20; logLine(log, `pause ${st.s}s (compressed 20×)`); }
      if (st.k === "analysis") { S.t = 1.6; S.meas = 0; S.fails = 0; $("#ca-runs").innerHTML = ""; logLine(log, "AnalysisRun started · metrics: error-rate, p95-latency", "ic"); }
      setPhase(st.k === "analysis" ? "Analysing" : st.k === "pause" ? "Paused" : "Progressing", "ember");
      paintSteps(); paintPods();
    };
    const measure = () => {
      S.meas++;
      const ok = S.err < THRESH.err && S.lat < THRESH.p95;
      if (!ok) S.fails++;
      $("#ca-runs").insertAdjacentHTML("beforeend", `<span class="chip ${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} #${S.meas} · ${S.err.toFixed(2)}% · ${fmtMs(S.lat)}ms</span>`);
      logLine(log, `measurement #${S.meas}: 5xx=${(S.err / 100).toFixed(4)} p95=${(S.lat / 1000).toFixed(3)}s → ${ok ? "Successful" : "Failed"}`, ok ? "ok" : "bad");
      if (S.fails > 1) return abort("AnalysisRun failed: error-rate exceeded failureLimit");
      if (S.meas >= 2) { logLine(log, "AnalysisRun Successful ✔", "ok"); next(); }
      else S.t = 1.6;
    };
    const next = () => { S.i++; enter(); };
    const abort = (why) => {
      S.phase = "aborted"; setPhase("Degraded · aborted", "bad");
      logLine(log, `✗ ${why}`, "bad"); logLine(log, "Rollout aborted — scaling canary to 0, stable v1 serves 100%", "bad");
      showBanner("✗ Aborted — rolled back to v1", "bad"); toast("Canary aborted by analysis — v1 keeps serving", "bad");
      paintSteps(); paintPods();
      scope.timeout(() => { S.weight = 0; paintPods(); }, 1400);
    };
    const reset = () => {
      Object.assign(S, { phase: "idle", i: -1, t: 0, weight: 0, fails: 0, meas: 0 });
      setPhase("idle"); paintSteps(); paintPods(); $("#ca-runs").innerHTML = "";
      logLine(log, "Reset — v1 stable at 100%", "ic");
    };

    $("#cStart").onclick = () => {
      if (S.phase === "running") return;
      if (S.phase !== "idle") reset();
      S.phase = "running"; S.i = 0;
      logLine(log, "git push → ArgoCD synced new image tag <b>v2</b>", "hl");
      enter();
    };
    $("#cSkip").onclick = () => { if (S.phase === "running" && steps[S.i].k === "pause") { S.t = 0; logLine(log, "kubectl argo rollouts promote checkout-svc (skip pause)", "hl"); } };
    $("#cAbort").onclick = () => { if (S.phase === "running") abort("kubectl argo rollouts abort checkout-svc"); };
    $("#cReset").onclick = reset;
    failEl.onchange = async () => {
      const rate = failEl.checked ? 0.5 : 0;
      logLine(log, `${failEl.checked ? "Injecting" : "Clearing"} FAIL_RATE=${rate} on canary`, failEl.checked ? "bad" : "ok");
      if (live()) {
        try { await Telemetry.setChaos("checkout", rate); logLine(log, `POST /api/checkout/chaos?rate=${rate} → live service updated`, "ic"); }
        catch (e) { logLine(log, esc(e.message), "bad"); }
      }
    };
    scope.add(() => { if (failEl.checked) Telemetry.setChaos("checkout", 0).catch(() => {}); });

    // canvas traffic
    const canvas = $("#cCanvas");
    let ctx, W, H;
    const resize = () => ({ ctx, w: W, h: H } = fitCanvas(canvas));
    resize(); scope.observe(canvas, resize);
    const parts = [];
    let acc = 0;
    scope.loop((dt) => {
      // state machine
      if (S.phase === "running") {
        S.t -= dt;
        const st = steps[S.i];
        if (st && S.t <= 0) { if (st.k === "analysis") measure(); else next(); }
        else if (st && st.k === "pause") paintSteps();
      }
      // metrics
      const L = Telemetry.state.checkout;
      if (live() && L) { S.err = lerp(S.err, L.err, dt * 2); S.lat = lerp(S.lat, L.p95, dt * 2); }
      else {
        const tErr = failEl.checked && S.weight > 0 ? 50 * (S.weight > 0 ? 1 : 0) * rand(0.85, 1.1) * Math.min(1, 0.3 + S.weight / 60) : rand(0.05, 0.6);
        S.err = lerp(S.err, tErr, dt * 1.6); S.lat = lerp(S.lat, rand(32, 70) + (failEl.checked ? 40 : 0), dt * 2);
      }
      setMeters("ca", S.err, S.lat, live());
      S.shown = lerp(S.shown, S.weight, dt * 3);

      // draw
      ctx.clearRect(0, 0, W, H);
      const src = [24, H / 2], hub = [W * 0.32, H / 2], top = [W - 70, H * 0.24], bot = [W - 70, H * 0.76];
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(125,134,156,.18)"; ctx.beginPath(); ctx.moveTo(...src); ctx.lineTo(...hub); ctx.stroke();
      ctx.strokeStyle = `rgba(125,134,156,${0.15 + (1 - S.shown / 100) * 0.4})`; ctx.beginPath(); ctx.moveTo(...hub); ctx.quadraticCurveTo(W * 0.6, top[1], ...top); ctx.stroke();
      ctx.strokeStyle = `rgba(91,140,255,${0.12 + (S.shown / 100) * 0.5})`; ctx.beginPath(); ctx.moveTo(...hub); ctx.quadraticCurveTo(W * 0.6, bot[1], ...bot); ctx.stroke();
      acc += dt * 36;
      while (acc > 1) { acc--; const c = Math.random() * 100 < S.shown; parts.push({ t: 0, c, sp: rand(0.6, 0.9), err: c && failEl.checked && Math.random() < 0.5 }); }
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt * p.sp;
        if (p.t >= 2) { parts.splice(i, 1); continue; }
        const pos = p.t < 1 ? [lerp(src[0], hub[0], p.t), hub[1]] : qBez(hub, [W * 0.6, p.c ? bot[1] : top[1]], p.c ? bot : top, p.t - 1);
        glowDot(ctx, pos[0], pos[1], 2.4, p.err && p.t > 1.5 ? "#f2b84b" : p.t < 1 ? "#c9d1e4" : p.c ? "#5b8cff" : "#7d869c");
      }
      const lbl = (p, a, b, c) => {
        roundRect(ctx, p[0] - 58, p[1] - 22, 116, 44, 12); ctx.fillStyle = "rgba(15,18,26,.96)"; ctx.fill(); ctx.strokeStyle = c; ctx.stroke();
        ctx.textAlign = "center"; ctx.fillStyle = "#e8ebf2"; ctx.font = "700 12px Inter, sans-serif"; ctx.fillText(a, p[0], p[1] - 2);
        ctx.fillStyle = c; ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.fillText(b, p[0], p[1] + 13);
      };
      lbl(top, "stable v1", `${Math.round(100 - S.shown)}% traffic`, "#7d869c");
      lbl(bot, "canary v2", `${Math.round(S.shown)}% traffic`, "#5b8cff");
      glowDot(ctx, ...hub, 6, "#5b8cff");
      ctx.fillStyle = "#6b7386"; ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.textAlign = "center"; ctx.fillText("service", hub[0], hub[1] - 16);
    });
    paintSteps(); paintPods();
  }

  function mountBlueGreen(host, scope) {
    host.innerHTML = `
      <div class="studio">
        <div class="tile stage reveal in">
          <div class="tile-head" style="margin:0">
            <div><span class="tile-kicker">payments-svc · strategy.blueGreen · autoPromotionEnabled: false</span><h3 class="tile-title" style="margin-top:8px">Active ↔ Preview</h3></div>
            <span class="chip" id="bPhase">idle</span>
          </div>
          <div class="bg-arena">
            <div class="bg-env blue" id="envBlue"><h4>Blue <span class="chip ice" id="tagBlue">v1.3.8</span></h4><div class="podrow">${"<i></i>".repeat(3)}</div><span class="muted mono" style="font-size:12px" id="roleBlue">active service</span></div>
            <div class="bg-router"><svg viewBox="0 0 140 220" preserveAspectRatio="none" id="bgSvg">
              <path class="wire" id="wBlue" d="M70 110 C40 110 30 110 0 110"/>
              <path class="wire" id="wGreen" d="M70 110 C100 110 110 110 140 110"/>
              <circle class="hub" cx="70" cy="110" r="18"/><text x="70" y="114" text-anchor="middle">LB</text>
              <path class="wire live" d="M70 0 V92" style="stroke:#c9d1e4"/><text x="76" y="14">users</text>
            </svg></div>
            <div class="bg-env green" id="envGreen"><h4>Green <span class="chip ember" id="tagGreen">—</span></h4><div class="podrow">${"<i></i>".repeat(3)}</div><span class="muted mono" style="font-size:12px" id="roleGreen">idle</span></div>
          </div>
          <div class="stage-canvas" style="height:auto;min-height:0;border:0;overflow:visible"><div class="stage-banner" id="bBanner"></div></div>
          <div class="controls">
            <button class="btn btn-ember btn-sm" id="bDeploy">${icon("play", "kpi-svg")} Deploy new version</button>
            <button class="btn btn-ice btn-sm" id="bPromote" disabled>Promote</button>
            <button class="btn btn-ghost btn-sm" id="bReset">Reset</button>
            <span class="countdown" id="bCount"></span>
            <label class="toggle" style="margin-left:auto"><input type="checkbox" id="bFail"/><span class="sw"></span>FAIL_RATE=0.5</label>
          </div>
        </div>
        ${analysisPanel("ba")}
      </div>`;
    const envs = { blue: $("#envBlue"), green: $("#envGreen") };
    const log = $("#ba-log"), failEl = $("#bFail"), phaseEl = $("#bPhase"), banner = $("#bBanner");
    const live = () => Telemetry.state.payments?.mode === "live";
    let version = 8;
    const S = { active: "blue", phase: "idle", t: 0, up: 0, meas: 0, fails: 0, err: 0.2, lat: 40, ver: { blue: "v1.3.8", green: "—" } };
    const other = () => (S.active === "blue" ? "green" : "blue");
    const setPhase = (t, c = "") => { phaseEl.className = `chip ${c}`; phaseEl.textContent = t; };
    const showBanner = (txt, cls) => { banner.className = `stage-banner show ${cls}`; banner.textContent = txt; scope.timeout(() => banner.classList.remove("show"), 2600); };
    const paint = () => {
      const pv = other();
      for (const c of ["blue", "green"]) {
        const isA = c === S.active;
        envs[c].classList.toggle("active", isA);
        $(`#tag${c[0].toUpperCase()}${c.slice(1)}`).textContent = S.ver[c];
        const pods = $$(".podrow i", envs[c]);
        pods.forEach((p, i) => {
          const up = isA ? !(S.phase === "scaledown" && S.t < (3 - i) * 1.6) : i < S.up;
          p.className = up ? (c === pv && S.phase === "failed" ? "bad" : "up") : "";
        });
        $(`#role${c[0].toUpperCase()}${c.slice(1)}`).textContent = isA ? "active service · 100% traffic" : S.phase === "idle" ? "idle" : S.phase === "failed" ? "preview · analysis failed" : "preview service";
      }
      // tint pods by colour of the env
      envs.blue.classList.remove("green"); envs.green.classList.remove("blue");
      const wB = $("#wBlue"), wG = $("#wGreen");
      wB.setAttribute("class", `wire ${S.active === "blue" ? "live to-blue" : S.phase !== "idle" && pv === "blue" ? "preview" : ""}`);
      wG.setAttribute("class", `wire ${S.active === "green" ? "live to-green" : S.phase !== "idle" && pv === "green" ? "preview" : ""}`);
      $("#bPromote").disabled = S.phase !== "ready";
      $("#bDeploy").disabled = !["idle", "failed", "promoted"].includes(S.phase);
    };
    logLine(log, "Rollout <b>payments-svc</b> · activeService payments-svc · previewService payments-svc-preview", "ic");

    $("#bDeploy").onclick = () => {
      const pv = other();
      version++;
      S.ver[pv] = `v1.3.${version}`; S.phase = "scaleup"; S.up = 0; S.t = 0.7; S.meas = 0; S.fails = 0;
      $("#ba-runs").innerHTML = "";
      setPhase("Preview scaling", "ember");
      logLine(log, `git push → image.tag ${S.ver[pv]} · ArgoCD synced · preview ReplicaSet (${pv}) scaling up`, "hl");
      paint();
    };
    $("#bPromote").onclick = () => {
      const pv = other();
      logLine(log, "kubectl argo rollouts promote payments-svc", "hl");
      logLine(log, `activeService selector → ${pv} (${S.ver[pv]}) · traffic switched instantly`, "ok");
      S.active = pv; S.phase = "scaledown"; S.t = 6;
      setPhase("Promoted · scaleDownDelay 30s", "ok");
      showBanner(`✓ ${S.ver[pv]} is live`, "ok"); toast(`payments-svc ${S.ver[pv]} promoted`, "ok");
      paint();
    };
    $("#bReset").onclick = () => {
      Object.assign(S, { active: "blue", phase: "idle", up: 0, t: 0, ver: { blue: "v1.3.8", green: "—" } });
      version = 8; setPhase("idle"); $("#ba-runs").innerHTML = ""; $("#bCount").textContent = ""; paint();
      logLine(log, "Reset — blue v1.3.8 active", "ic");
    };
    failEl.onchange = async () => {
      const rate = failEl.checked ? 0.5 : 0;
      logLine(log, `${failEl.checked ? "Injecting" : "Clearing"} FAIL_RATE=${rate} on preview stack`, failEl.checked ? "bad" : "ok");
      if (live()) {
        try { await Telemetry.setChaos("payments", rate); logLine(log, `POST /api/payments/chaos?rate=${rate} → live service updated`, "ic"); }
        catch (e) { logLine(log, esc(e.message), "bad"); }
      }
    };
    scope.add(() => { if (failEl.checked) Telemetry.setChaos("payments", 0).catch(() => {}); });

    scope.loop((dt) => {
      const L = Telemetry.state.payments;
      const previewOn = ["analysis", "ready", "failed", "scaleup"].includes(S.phase);
      if (live() && L) { S.err = lerp(S.err, L.err, dt * 2); S.lat = lerp(S.lat, L.p95, dt * 2); }
      else { S.err = lerp(S.err, failEl.checked && previewOn ? rand(44, 56) : rand(0.05, 0.5), dt * 1.6); S.lat = lerp(S.lat, rand(36, 72), dt * 2); }
      setMeters("ba", S.err, S.lat, live());
      if (S.phase === "idle" || S.phase === "promoted" || S.phase === "ready" || S.phase === "failed") return;
      S.t -= dt;
      if (S.phase === "scaledown") {
        $("#bCount").textContent = `scaling down old stack in ${Math.ceil(S.t * 5)}s`;
        paint();
        if (S.t <= 0) { S.phase = "promoted"; S.up = 0; $("#bCount").textContent = ""; logLine(log, "Old ReplicaSet scaled to 0", "ic"); setPhase("Healthy", "ok"); paint(); }
        return;
      }
      if (S.t > 0) return;
      if (S.phase === "scaleup") {
        S.up++; paint();
        logLine(log, `preview pod ${S.up}/3 Ready`);
        if (S.up >= 3) { S.phase = "analysis"; S.t = 1.6; setPhase("prePromotionAnalysis", "ember"); logLine(log, "prePromotionAnalysis started", "ic"); }
        else S.t = 0.7;
        return;
      }
      if (S.phase === "analysis") {
        S.meas++;
        const ok = S.err < THRESH.err && S.lat < THRESH.p95;
        if (!ok) S.fails++;
        $("#ba-runs").insertAdjacentHTML("beforeend", `<span class="chip ${ok ? "ok" : "bad"}">${ok ? "✓" : "✗"} #${S.meas} · ${S.err.toFixed(2)}% · ${fmtMs(S.lat)}ms</span>`);
        logLine(log, `measurement #${S.meas}: 5xx=${(S.err / 100).toFixed(4)} p95=${(S.lat / 1000).toFixed(3)}s → ${ok ? "Successful" : "Failed"}`, ok ? "ok" : "bad");
        if (S.fails > 1) {
          S.phase = "failed"; setPhase("Analysis failed · promotion blocked", "bad");
          logLine(log, "✗ prePromotionAnalysis failed — active service untouched, users never saw it", "bad");
          showBanner("✗ Promotion blocked", "bad"); toast("Preview failed analysis — promotion blocked", "bad"); paint();
        } else if (S.meas >= 2) {
          S.phase = "ready"; setPhase("Paused · awaiting promote", "warn");
          logLine(log, "✔ Analysis Successful — waiting for manual promotion (autoPromotionEnabled: false)", "ok"); paint();
        } else S.t = 1.6;
      }
    });
    paint();
  }

  /* ============================================================ PIPELINE */
  const NODES = {
    dev: { x: 0, y: 0, ic: "user", t: "Developer", s: "edits values.yaml", cool: 0, role: "Changes the desired state by editing Helm values — never by running kubectl apply.", pts: ["Bump image.tag and env.version", "Optionally set env.failRate for chaos demos", "Open a PR — review is the change-management gate"], files: ["charts/checkout-svc/values-dev.yaml", "charts/payments-svc/values-dev.yaml"] },
    git: { x: 25, y: 0, ic: "git", t: "GitHub", s: "source of truth", cool: 0, role: "The single source of truth for both application and platform state.", pts: ["Root app-of-apps lives in argocd/bootstrap", "Every environment is a directory, every change is a commit", "Rollback = git revert"], files: ["argocd/bootstrap/root-app.yaml", "argocd/applications/*.yaml"] },
    actions: { x: 50, y: 0, ic: "gear", t: "GitHub Actions", s: "CI · OIDC", cool: 0, role: "Builds and tests the Go services, pushes images to ECR and validates Terraform.", pts: ["aws-actions/configure-aws-credentials with role-to-assume (OIDC)", "amazon-ecr-login, docker build & push", "terraform fmt / validate / plan"], files: [".github/workflows/ci.yaml", ".github/workflows/terraform.yaml"] },
    ecr: { x: 75, y: 0, ic: "box", t: "Amazon ECR", s: "image registry", cool: 1, role: "Per-service private registries for checkout-svc and payments-svc images.", pts: ["Created by Terraform", "Pulled by EKS nodes at rollout time"], files: ["terraform/ecr.tf"] },
    tf: { x: 100, y: 0, ic: "layers", t: "Terraform", s: "AWS foundation", cool: 1, role: "Owns every AWS resource: network, cluster, registries and identity.", pts: ["VPC with one NAT gateway", "EKS + managed node group (t3.medium spot in dev)", "GitHub OIDC provider and IRSA roles", "S3 remote state + DynamoDB locking"], files: ["terraform/vpc.tf", "terraform/eks.tf", "terraform/iam-irsa.tf", "terraform/environments/dev.tfvars"] },
    argocd: { x: 8, y: 62, ic: "sync", t: "ArgoCD", s: "app-of-apps", cool: 1, role: "Continuously reconciles the cluster to Git with automated prune and selfHeal.", pts: ["One root app creates a project + an Application per service/env", "syncPolicy.automated: prune + selfHeal", "CreateNamespace=true"], files: ["argocd/bootstrap/root-app.yaml", "argocd/projects/driftguard.yaml", "argocd/applications/checkout-dev.yaml"] },
    checkout: { x: 38, y: 40, ic: "bird", t: "checkout-svc", s: "canary rollout", cool: 0, role: "Go HTTP service released with a replica-weighted canary.", pts: ["setWeight 20 → 40 → 60 → 100", "pause 60s + analysis between steps", "Endpoints: /, /healthz, /readyz, /metrics, /chaos"], files: ["apps/checkout-svc/main.go", "charts/checkout-svc/templates/rollout.yaml"] },
    payments: { x: 38, y: 86, ic: "card", t: "payments-svc", s: "blue-green", cool: 0, role: "Go HTTP service released blue-green with a manual promotion gate.", pts: ["activeService + previewService", "prePromotionAnalysis", "autoPromotionEnabled: false · scaleDownDelaySeconds: 30"], files: ["apps/payments-svc/main.go", "charts/payments-svc/templates/rollout.yaml", "charts/payments-svc/templates/service-preview.yaml"] },
    prom: { x: 66, y: 62, ic: "pulse", t: "Prometheus", s: "kube-prometheus", cool: 1, role: "Scrapes both services through ServiceMonitors every 15s.", pts: ["driftguard_http_requests_total", "driftguard_http_request_duration_seconds"], files: ["observability/kube-prometheus-values.yaml", "charts/checkout-svc/templates/servicemonitor.yaml"] },
    analysis: { x: 66, y: 100, ic: "flask", t: "AnalysisTemplate", s: "the judge", cool: 0, role: "Queries Prometheus and decides whether a rollout may continue.", pts: ["5xx ratio < 0.05", "p95 latency < 0.5s", "interval 30s · count 2 · failureLimit 1"], files: ["charts/checkout-svc/templates/analysistemplate.yaml", "charts/payments-svc/templates/analysistemplate.yaml"] },
    grafana: { x: 94, y: 62, ic: "chart", t: "Grafana", s: "dashboards", cool: 1, role: "Visualises rollout health for humans.", pts: ["Request rate, error rate and latency per service", "Imported from JSON"], files: ["observability/grafana-dashboards/driftguard.json"] },
  };
  const EDGES = [["dev", "git"], ["git", "actions"], ["actions", "ecr"], ["tf", "ecr"], ["git", "argocd"], ["argocd", "checkout"], ["argocd", "payments"], ["ecr", "checkout"], ["checkout", "prom"], ["payments", "prom"], ["prom", "grafana"], ["prom", "analysis"], ["analysis", "checkout"], ["analysis", "payments"]];
  const JOURNEY = [["dev", "git"], ["git", "actions"], ["actions", "ecr"], ["git", "argocd"], ["argocd", "checkout"], ["ecr", "checkout"], ["checkout", "prom"], ["prom", "analysis"], ["analysis", "checkout"], ["prom", "grafana"]];

  const Pipeline = {
    title: "Pipeline — DriftGuard",
    html() {
      return `
      <section class="page">
        <div class="wrap">
          <div class="page-head-row page-head">
            <div style="display:grid;gap:14px">
              <span class="eyebrow reveal">Architecture</span>
              <h1 class="h-display reveal" style="--d:.06s">One push. <span class="grad-ice">Ten hops.</span></h1>
              <p class="lead reveal" style="--d:.12s">Click any component to see what it does and which files in the repo own it. Hit play to follow a commit through the whole system.</p>
            </div>
            <button class="btn btn-ember reveal magnetic" style="--d:.18s" id="pPlay">${icon("play", "kpi-svg")} Follow a commit</button>
          </div>
          <div class="pipe-wrap">
            <div class="tile pipe-canvas reveal" id="pCanvas">
              <div class="pipe-cluster" id="pCluster"></div>
              <svg class="edges" id="pEdges"><defs><linearGradient id="edgeGrad" x1="0" x2="1"><stop offset="0" stop-color="#5b8cff"/><stop offset="1" stop-color="#7d869c"/></linearGradient></defs></svg>
              <div class="pnode cluster-label" id="pClusterLabel">AWS EKS</div>
              ${Object.entries(NODES).map(([id, n]) => `<button type="button" class="pnode ${n.cool ? "cool" : ""}" data-id="${id}" style="left:calc(84px + (100% - 168px) * ${n.x / 100});top:calc(78px + (100% - 150px) * ${n.y / 100})"><span class="pi">${icon(n.ic)}</span><b>${n.t}</b><span>${n.s}</span></button>`).join("")}
            </div>
            <aside class="tile drawer reveal" style="--d:.1s" id="pDrawer"></aside>
          </div>
        </div>
      </section>
      ${footer()}`;
    },
    mount(root, scope) {
      const canvas = $("#pCanvas", root), svg = $("#pEdges", root), drawer = $("#pDrawer", root);
      const els = Object.fromEntries($$(".pnode[data-id]", canvas).map((b) => [b.dataset.id, b]));
      const paths = {};
      const select = (id) => {
        Object.values(els).forEach((e) => e.classList.toggle("sel", e.dataset.id === id));
        const n = NODES[id];
        drawer.innerHTML = `<div class="drawer-body">
          <div style="display:flex;align-items:center;gap:12px"><span class="kpi-icon ${n.cool ? "ice" : ""}">${icon(n.ic)}</span><div><span class="tile-kicker">${n.s}</span><h3 class="tile-title" style="margin:2px 0 0">${n.t}</h3></div></div>
          <p style="margin:0;color:var(--ink-2)">${n.role}</p>
          <ul>${n.pts.map((p) => `<li>${p}</li>`).join("")}</ul>
          <div><div class="tile-kicker" style="margin-bottom:8px">files in this repo</div><div class="files">${n.files.map((f) => `<a href="https://github.com/Arnazz10/driftgaurd/blob/main/${f.replace("*.yaml", "")}" target="_blank" rel="noopener"><code>${f}</code></a>`).join("")}</div></div>
        </div>`;
      };
      const layout = () => {
        const stacked = canvas.clientWidth < 760;
        canvas.classList.toggle("stacked", stacked);
        if (stacked) { svg.innerHTML = svg.querySelector("defs").outerHTML; return; }
        const cr = canvas.getBoundingClientRect();
        const c = (id) => { const r = els[id].getBoundingClientRect(); return [r.left - cr.left + r.width / 2, r.top - cr.top + r.height / 2]; };
        let html = svg.querySelector("defs").outerHTML;
        for (const [a, b] of EDGES) {
          const [x1, y1] = c(a), [x2, y2] = c(b);
          const dx = (x2 - x1) * 0.5, dy = (y2 - y1) * 0.5;
          const d = Math.abs(x2 - x1) > Math.abs(y2 - y1) ? `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}`;
          html += `<path class="edge" id="e-${a}-${b}" d="${d}"/><path class="edge-flow" d="${d}"/>`;
        }
        html += '<circle class="packet" id="pPacket" r="5" cx="-20" cy="-20"/>';
        svg.innerHTML = html;
        for (const [a, b] of EDGES) paths[`${a}-${b}`] = $(`#e-${a}-${b}`, svg);
        const rs = ["argocd", "checkout", "payments", "prom", "analysis", "grafana"].map((id) => els[id].getBoundingClientRect());
        const L = Math.min(...rs.map((r) => r.left)) - cr.left - 22, T = Math.min(...rs.map((r) => r.top)) - cr.top - 40;
        const R = Math.max(...rs.map((r) => r.right)) - cr.left + 22, B = Math.max(...rs.map((r) => r.bottom)) - cr.top + 18;
        Object.assign($("#pCluster", root).style, { left: `${L}px`, top: `${T}px`, width: `${R - L}px`, height: `${B - T}px` });
        Object.assign($("#pClusterLabel", root).style, { left: `${L + 56}px`, top: `${T + 18}px` });
      };
      scope.observe(canvas, layout);
      scope.on(canvas, "click", (e) => { const b = e.target.closest(".pnode[data-id]"); if (b) select(b.dataset.id); });
      select("argocd");

      let playing = false;
      const hit = (id) => { const e = els[id]; e.classList.remove("hot"); void e.offsetWidth; e.classList.add("hot"); scope.timeout(() => e.classList.remove("hot"), 900); };
      const travel = (a, b) => new Promise((resolve) => {
        const p = paths[`${a}-${b}`], pk = $("#pPacket", svg);
        if (!p || !pk) { hit(b); return scope.timeout(resolve, 400); }
        p.classList.add("hot");
        const L = p.getTotalLength(); const dur = 850; const t0 = performance.now();
        const step = (now) => {
          if (!playing) return resolve();
          const k = clamp((now - t0) / dur, 0, 1), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          const pt = p.getPointAtLength(L * e); pk.setAttribute("cx", pt.x); pk.setAttribute("cy", pt.y);
          if (k < 1) requestAnimationFrame(step); else { p.classList.remove("hot"); hit(b); select(b); resolve(); }
        };
        requestAnimationFrame(step);
      });
      scope.add(() => { playing = false; });
      $("#pPlay", root).onclick = async () => {
        if (playing) return;
        playing = true;
        $("#pPlay", root).disabled = true;
        hit("dev"); select("dev");
        if (canvas.classList.contains("stacked")) {
          for (const [, b] of JOURNEY) { if (!playing) break; await new Promise((r) => scope.timeout(r, 700)); hit(b); select(b); els[b].scrollIntoView({ block: "nearest", behavior: "smooth" }); }
        } else for (const [a, b] of JOURNEY) { if (!playing) break; await travel(a, b); }
        if (playing) toast("Commit reached production — analysis passed", "ok");
        playing = false;
        const btn = $("#pPlay", root); if (btn) btn.disabled = false;
      };
    },
  };

  /* ============================================================ SERVICES */
  const ENDPOINTS = (s) => [["GET", "/"], ["GET", `/${s.probe}`], ["GET", s.probe === "healthz" ? "/readyz" : "/healthz"], ["GET", "/metrics"], ["GET", "/chaos"]];

  const Services = {
    title: "Services — DriftGuard",
    html() {
      return `
      <section class="page">
        <div class="wrap">
          <div class="page-head-row page-head">
            <div style="display:grid;gap:14px">
              <span class="eyebrow reveal">Live services</span>
              <h1 class="h-display reveal" style="--d:.06s">Poke the <span class="grad-ember">real APIs.</span></h1>
              <p class="lead reveal" style="--d:.12s">Every button below calls the running Go services. Fire traffic, flip the failure rate and watch the metrics react everywhere in the app.</p>
            </div>
            <label class="toggle ok reveal" style="--d:.18s"><input type="checkbox" id="trafficToggle" ${Telemetry.traffic ? "checked" : ""}/><span class="sw"></span>Background traffic generator</label>
          </div>

          <div class="tile reveal" id="connTile" style="margin-bottom:20px">
            <div class="tile-head" style="margin-bottom:12px"><div><span class="tile-kicker">${icon("server", "kpi-svg")} connection</span><h3 class="tile-title" style="margin-top:8px" id="connTitle">—</h3><p class="tile-sub" id="connSub"></p></div><span class="chip" id="connChip">—</span></div>
            <div class="grid g3" style="align-items:end">
              <div class="field"><label for="baseCheckout">checkout-svc base URL</label><input id="baseCheckout" value="${esc(Telemetry.bases.checkout)}" spellcheck="false"/></div>
              <div class="field"><label for="basePayments">payments-svc base URL</label><input id="basePayments" value="${esc(Telemetry.bases.payments)}" spellcheck="false"/></div>
              <div class="controls"><button class="btn btn-ember btn-sm" id="saveBases">Save & reconnect</button><button class="btn btn-ghost btn-sm" id="resetBases">Defaults</button></div>
            </div>
          </div>

          <div class="svc-grid">
            ${SERVICES.map((s, i) => `
            <div class="tile reveal" style="--d:${i * 0.08}s;display:grid;gap:18px">
              <div class="tile-head" style="margin:0">
                <div class="svc-name"><span class="orb ok" id="s-orb-${s.key}"></span><div><h3 class="tile-title" style="margin:0">${s.name}</h3><span class="muted mono" style="font-size:12px" id="s-ver-${s.key}">—</span></div></div>
                <span class="chip ${s.tone}">${s.strategy}</span>
              </div>
              <div class="endpoints">
                ${ENDPOINTS(s).map(([v, p]) => `<div class="ep"><span class="verb">${v}</span><code>${p}</code><button class="btn btn-ghost btn-xs" data-call="${s.key}" data-path="${p}">Send</button></div>`).join("")}
              </div>
              <div class="term"><div class="term-bar"><i></i><i></i><i></i><span>${s.name} — response</span></div><pre id="term-${s.key}"><span class="c">$</span> click <span class="k">Send</span> on any endpoint <span class="caret"></span></pre></div>
              <div class="tile" style="padding:18px;background:var(--glass)">
                <div class="meter-top" style="margin-bottom:12px"><span>Chaos · FAIL_RATE</span><span class="mono" id="chaosVal-${s.key}">0%</span></div>
                <input type="range" class="range" min="0" max="100" step="5" value="0" id="chaos-${s.key}"/>
                <div class="controls" style="margin-top:14px">
                  <button class="btn btn-danger btn-xs" data-chaos="${s.key}">POST /chaos</button>
                  <button class="btn btn-ghost btn-xs" data-calm="${s.key}">Heal (0%)</button>
                  <button class="btn btn-ember btn-xs" data-burst="${s.key}" style="margin-left:auto">${icon("zap", "kpi-svg")} Fire 100 requests</button>
                </div>
              </div>
              <div>
                <div class="tile-head" style="margin-bottom:10px"><span class="tile-kicker">/metrics · driftguard_*</span><div class="field" style="width:180px"><input placeholder="filter…" data-filter="${s.key}" style="padding:7px 10px"/></div></div>
                <div class="metrics-list" id="mlist-${s.key}"></div>
              </div>
            </div>`).join("")}
          </div>
        </div>
      </section>
      ${footer()}`;
    },
    mount(root, scope) {
      const filters = { checkout: "", payments: "" };
      const term = (key, html) => { const t = $(`#term-${key}`, root); t.innerHTML = html; t.scrollTop = 0; };

      $("#trafficToggle", root).onchange = (e) => { Telemetry.traffic = e.target.checked; store.set("dg.traffic", Telemetry.traffic); toast(`Traffic generator ${Telemetry.traffic ? "on" : "off"}`, "info", 1600); };
      $("#saveBases", root).onclick = async () => {
        const b = { checkout: $("#baseCheckout", root).value.trim() || DEFAULT_BASES.checkout, payments: $("#basePayments", root).value.trim() || DEFAULT_BASES.payments };
        toast("Reconnecting…", "info", 1400);
        await Telemetry.setBases(b);
        toast(Telemetry.mode === "live" ? "Connected to live services" : "Still unreachable — using simulation", Telemetry.mode === "live" ? "ok" : "bad");
      };
      $("#resetBases", root).onclick = async () => {
        store.del("dg.bases"); $("#baseCheckout", root).value = DEFAULT_BASES.checkout; $("#basePayments", root).value = DEFAULT_BASES.payments;
        await Telemetry.setBases({}); toast("Endpoints reset to /api/*", "info");
      };

      scope.on(root, "click", async (e) => {
        const call = e.target.closest("[data-call]");
        const chaos = e.target.closest("[data-chaos]");
        const calm = e.target.closest("[data-calm]");
        const burst = e.target.closest("[data-burst]");
        if (call) {
          const key = call.dataset.call, path = call.dataset.path, st = Telemetry.state[key];
          const url = Telemetry.url(key, path);
          term(key, `<span class="c">$</span> curl -i ${esc(url)}\n<span class="k">… waiting</span>`);
          if (st.mode !== "live") {
            const svc = SERVICES.find((s) => s.key === key);
            const body = path === "/" ? JSON.stringify({ service: svc.name, version: st.version }) : path === "/metrics" ? st.metricsText : path === "/chaos" ? JSON.stringify({ service: svc.name, failRate: st.failRate }) : path === "/healthz" ? "ok" : "ready";
            term(key, `<span class="c">$</span> curl -i ${esc(url)}\n<span class="e">[simulated — service unreachable]</span>\n<span class="s">HTTP/1.1 200 OK</span> · ${fmtMs(rand(4, 20))}ms\n\n${esc(body.length > 3000 ? body.slice(0, 3000) + "\n…" : body)}`);
            return;
          }
          try {
            const r = await timedFetch(url, {}, 4000);
            let body = r.text;
            if (r.type.includes("json")) { try { body = JSON.stringify(JSON.parse(body), null, 2); } catch { /* raw */ } }
            if (body.length > 4000) body = body.slice(0, 4000) + "\n… (truncated)";
            term(key, `<span class="c">$</span> curl -i ${esc(url)}\n<span class="${r.ok ? "s" : "e"}">HTTP/1.1 ${r.status} ${esc(r.statusText)}</span> · ${fmtMs(r.ms)}ms · ${esc(r.type || "text/plain")}\n\n${esc(body)}`);
          } catch (err) {
            term(key, `<span class="c">$</span> curl -i ${esc(url)}\n<span class="e">curl: request failed — ${esc(err.message)}</span>`);
          }
        }
        if (chaos || calm) {
          const key = (chaos || calm).dataset.chaos || (chaos || calm).dataset.calm;
          const rate = calm ? 0 : Number($(`#chaos-${key}`, root).value) / 100;
          if (calm) { $(`#chaos-${key}`, root).value = 0; $(`#chaosVal-${key}`, root).textContent = "0%"; }
          try {
            const r = await Telemetry.setChaos(key, rate);
            term(key, `<span class="c">$</span> curl -X POST ${esc(Telemetry.url(key, `chaos?rate=${rate}`))}\n<span class="s">HTTP/1.1 200 OK</span>${r.simulated ? ' <span class="e">[simulated]</span>' : ""}\n\n${esc(JSON.stringify({ service: SERVICES.find((s) => s.key === key).name, failRate: r.failRate }, null, 2))}`);
            toast(`${key}-svc FAIL_RATE → ${Math.round(rate * 100)}%`, rate > 0 ? "bad" : "ok");
          } catch (err) { toast(esc(err.message), "bad", 5000); }
        }
        if (burst) {
          const key = burst.dataset.burst;
          burst.disabled = true;
          term(key, `<span class="c">$</span> for i in $(seq 100); do curl -s ${esc(Telemetry.url(key, "/"))}; done\n<span class="k">firing…</span>`);
          const r = await Telemetry.burst(key, 100);
          burst.disabled = false;
          term(key, `<span class="c">$</span> for i in $(seq 100); do curl -s ${esc(Telemetry.url(key, "/"))}; done${r.simulated ? '\n<span class="e">[simulated]</span>' : ""}\n\n<span class="s">✔ ${r.ok} × 200 OK</span>\n<span class="${r.bad ? "e" : "s"}">${r.bad ? "✗" : "✔"} ${r.bad} × 5xx</span>\n<span class="k">took ${fmtMs(r.ms)}ms</span>\n\nWatch the 5xx rate move on the Command Center.`);
        }
      });
      scope.on(root, "input", (e) => {
        if (e.target.matches(".range")) { const key = e.target.id.replace("chaos-", ""); $(`#chaosVal-${key}`, root).textContent = `${e.target.value}%`; }
        if (e.target.dataset.filter) { filters[e.target.dataset.filter] = e.target.value.toLowerCase(); paintMetrics(); }
      });

      const paintMetrics = () => {
        for (const s of SERVICES) {
          const st = Telemetry.state[s.key]; if (!st) continue;
          const rows = st.metricsText.split("\n").filter((l) => l.startsWith("driftguard_") && (!filters[s.key] || l.toLowerCase().includes(filters[s.key]))).slice(0, 80);
          $(`#mlist-${s.key}`, root).innerHTML = rows.map((l) => {
            const m = parseMetricLine(l); if (!m) return "";
            const lbl = Object.entries(m.labels).filter(([k]) => k !== "service" && k !== "method").map(([k, v]) => `${k}="${v}"`).join(", ");
            const short = `${m.name.replace("driftguard_http_", "")}${lbl ? ` {${lbl}}` : ""}`;
            return `<div><span title="${esc(l)}">${esc(short)}</span><b>${esc(Number.isInteger(m.value) ? m.value : m.value.toFixed(4))}</b></div>`;
          }).join("") || '<span class="muted">no matching series</span>';
        }
      };
      let synced = false;
      scope.sub((st, mode) => {
        if (!st.checkout) return;
        const t = $("#connTitle", root), sub = $("#connSub", root), chip = $("#connChip", root);
        if (mode === "live") { t.textContent = "Wired to the running services"; sub.innerHTML = "Requests go through the configured base URLs. Locally, nginx proxies <code>/api/checkout</code> and <code>/api/payments</code> to the containers."; chip.className = "chip ok"; chip.textContent = "● live"; }
        else if (mode === "partial") { t.textContent = "One service is unreachable"; sub.textContent = "The reachable service is live; the other is simulated."; chip.className = "chip warn"; chip.textContent = "● partial"; }
        else { t.textContent = "Services unreachable — running a simulation"; sub.innerHTML = "Run <code>make local-up</code> and open <code>localhost:3000</code>, or paste public URLs of the deployed services (CORS is enabled) and reconnect."; chip.className = "chip warn"; chip.textContent = "● simulated"; }
        for (const s of SERVICES) {
          const x = st[s.key];
          $(`#s-orb-${s.key}`, root).className = `orb ${x.err > THRESH.err ? "bad" : x.health === "ok" ? "ok" : "warn"}`;
          $(`#s-ver-${s.key}`, root).textContent = `${x.version} · ${x.mode} · 5xx ${x.err.toFixed(2)}% · p95 ${fmtMs(x.p95)}ms`;
          if (!synced) { $(`#chaos-${s.key}`, root).value = Math.round(x.failRate * 100); $(`#chaosVal-${s.key}`, root).textContent = `${Math.round(x.failRate * 100)}%`; }
        }
        synced = true;
        paintMetrics();
      });
    },
  };

  /* =========================================================== PLAYBOOKS */
  const PLAYBOOKS = [
    {
      id: "canary", n: "01", title: "Successful canary", sub: "checkout-svc walks 20 → 100% under analysis", studio: "#/rollouts",
      steps: [
        ["Build and push a new checkout-svc image tag.", ""],
        ["Bump the tag and version in the dev values file.", "yq -i '.image.tag = \"v2\" | .env.version = \"v2\"' charts/checkout-svc/values-dev.yaml"],
        ["Commit and push — ArgoCD takes it from here.", "git commit -am \"checkout: v2\" && git push"],
        ["Watch Argo Rollouts progress through each analysed step.", "kubectl argo rollouts get rollout checkout-svc -n dev --watch"],
      ],
      script: [
        [2, "$ git commit -am \"checkout: v2\" && git push"], [2, "[main 8f4c21a] checkout: v2", "k"], [2, "ArgoCD: checkout-dev OutOfSync → Syncing → Synced", "s"],
        [3, "$ kubectl argo rollouts get rollout checkout-svc -n dev --watch"],
        [3, "Status:  ॥ Paused   Strategy: Canary   Step: 1/10   SetWeight: 20", "c"],
        [3, "  └─ AnalysisRun checkout-svc-analysis   ✔ Successful (2/2)", "s"],
        [3, "Status:  ॥ Paused   Step: 4/10   SetWeight: 40", "c"], [3, "  └─ AnalysisRun   ✔ Successful (2/2)", "s"],
        [3, "Status:  ॥ Paused   Step: 7/10   SetWeight: 60", "c"], [3, "  └─ AnalysisRun   ✔ Successful (2/2)", "s"],
        [3, "Status:  ✔ Healthy  Step: 10/10  SetWeight: 100  Images: checkout-svc:v2 (stable)", "s"],
      ],
    },
    {
      id: "bluegreen", n: "02", title: "Blue-green promotion", sub: "payments-svc preview → manual promote", studio: "#/rollouts?mode=bluegreen",
      steps: [
        ["Build and push a new payments-svc image tag.", ""],
        ["Update values-dev.yaml with the new tag and version, commit, push.", "git commit -am \"payments: v1.4.0\" && git push"],
        ["Watch the preview stack come up and pass analysis.", "kubectl argo rollouts get rollout payments-svc -n dev --watch"],
        ["Promote once the preview is verified.", "kubectl argo rollouts promote payments-svc -n dev"],
      ],
      script: [
        [1, "$ git commit -am \"payments: v1.4.0\" && git push"], [1, "ArgoCD: payments-dev Synced", "s"],
        [2, "$ kubectl argo rollouts get rollout payments-svc -n dev --watch"],
        [2, "Status:  ◌ Progressing  Strategy: BlueGreen", "c"], [2, "  ├─ revision:2  payments-svc:v1.4.0  preview  3/3 Ready", "k"],
        [2, "  └─ AnalysisRun payments-svc-analysis   ✔ Successful", "s"], [2, "Status:  ॥ Paused — BlueGreenPause (autoPromotionEnabled: false)", "c"],
        [3, "$ kubectl argo rollouts promote payments-svc -n dev"], [3, "rollout 'payments-svc' promoted", "s"],
        [3, "Status:  ✔ Healthy  active: revision:2  (revision:1 scaling down in 30s)", "s"],
      ],
    },
    {
      id: "rollback", n: "03", title: "Automatic rollback", sub: "inject 50% failures, watch the abort", studio: "#/rollouts",
      steps: [
        ["Push a new image tag.", ""],
        ["Set env.failRate to 0.5 in the target values file.", "yq -i '.env.failRate = \"0.5\"' charts/checkout-svc/values-dev.yaml"],
        ["Commit and push, then watch the rollout.", "kubectl argo rollouts get rollout checkout-svc -n dev --watch"],
        ["Prometheus reports 5xx above 5% — the AnalysisTemplate fails and the rollout aborts. Reset failRate to recover.", "yq -i '.env.failRate = \"0\"' charts/checkout-svc/values-dev.yaml && git commit -am fix && git push"],
      ],
      script: [
        [1, "$ yq -i '.env.failRate = \"0.5\"' charts/checkout-svc/values-dev.yaml"], [2, "$ git commit -am \"checkout: v3 (bad)\" && git push"],
        [2, "$ kubectl argo rollouts get rollout checkout-svc -n dev --watch"], [2, "Status:  ॥ Paused   Step: 1/10   SetWeight: 20", "c"],
        [3, "  └─ AnalysisRun checkout-svc-analysis   ✖ Failed  error-rate: 0.4912 ≥ 0.05", "e"],
        [3, "Status:  ✖ Degraded  RolloutAborted: metric \"error-rate\" assessed Failed", "e"],
        [3, "  ├─ canary  ReplicaSet scaled to 0", "k"], [3, "  └─ stable  checkout-svc:v2  4/4 Ready — users unaffected", "s"],
      ],
    },
    {
      id: "selfheal", n: "04", title: "ArgoCD self-heal", sub: "delete a live resource, watch it return", studio: "#/pipeline",
      steps: [
        ["Delete a live resource by hand — simulating drift.", "kubectl delete service checkout-svc -n dev"],
        ["Watch ArgoCD recreate it from Git.", "kubectl get service checkout-svc -n dev --watch"],
        ["In the ArgoCD UI the app briefly shows OutOfSync, then returns to Synced / Healthy.", ""],
      ],
      script: [
        [0, "$ kubectl delete service checkout-svc -n dev"], [0, "service \"checkout-svc\" deleted", "e"],
        [1, "$ kubectl get service checkout-svc -n dev --watch"], [1, "Error from server (NotFound): services \"checkout-svc\" not found", "e"],
        [1, "ArgoCD: checkout-dev OutOfSync (Service/checkout-svc missing) → selfHeal", "c"],
        [1, "NAME           TYPE        CLUSTER-IP     PORT(S)   AGE", "k"], [1, "checkout-svc   ClusterIP   172.20.41.17   80/TCP    2s", "s"],
        [2, "ArgoCD: checkout-dev Synced · Healthy", "s"],
      ],
    },
  ];

  const Playbooks = {
    title: "Playbooks — DriftGuard",
    html() {
      return `
      <section class="page">
        <div class="wrap">
          <div class="page-head">
            <span class="eyebrow reveal">Demo playbooks</span>
            <h1 class="h-display reveal" style="--d:.06s">Four demos. <span class="grad-ember">Zero slides.</span></h1>
            <p class="lead reveal" style="--d:.12s">The exact flows from <code>docs/demos.md</code> and <code>scripts/demo-*.sh</code>, replayed step by step. Copy the commands, run them against your cluster.</p>
          </div>
          <div class="pb-grid">
            <div class="pb-list">${PLAYBOOKS.map((p, i) => `<button type="button" class="tile pb-card reveal" style="--d:${i * 0.05}s" data-pb="${p.id}"><span class="n">${p.n}</span><h4>${p.title}</h4><p>${p.sub}</p></button>`).join("")}</div>
            <div class="tile reveal" style="--d:.1s;display:grid;gap:18px" id="pbBody"></div>
          </div>
        </div>
      </section>
      ${footer()}`;
    },
    mount(root, scope, q) {
      let run = 0;
      const open = (id) => {
        const pb = PLAYBOOKS.find((p) => p.id === id) || PLAYBOOKS[0];
        $$(".pb-card", root).forEach((c) => c.classList.toggle("sel", c.dataset.pb === pb.id));
        $("#pbBody", root).innerHTML = `
          <div class="tile-head" style="margin:0"><div><span class="tile-kicker">playbook ${pb.n}</span><h3 class="tile-title" style="margin-top:8px;font-size:24px">${pb.title}</h3></div>
            <div class="controls"><button class="btn btn-ember btn-sm" id="pbPlay">${icon("play", "kpi-svg")} Replay</button><a class="btn btn-ghost btn-sm" href="${pb.studio}">Try it live →</a></div></div>
          <div class="pb-steps">${pb.steps.map(([t, c], i) => `<div class="pb-step" data-i="${i}"><span class="pn">${i + 1}</span><div><p>${t}</p>${c ? `<div class="cmd"><code>${esc(c)}</code><button type="button" data-copy="${esc(c)}">copy</button></div>` : ""}</div></div>`).join("")}</div>
          <div class="term"><div class="term-bar"><i></i><i></i><i></i><span>zsh — ${pb.id}</span></div><pre id="pbTerm"><span class="c">$</span> press <span class="k">Replay</span> <span class="caret"></span></pre></div>`;
        $("#pbPlay", root).onclick = () => play(pb);
        play(pb);
      };
      const play = async (pb) => {
        const my = ++run;
        const termEl = $("#pbTerm", root), stepEls = $$(".pb-step", root);
        termEl.innerHTML = "";
        const wait = (ms) => new Promise((r) => scope.timeout(r, ms));
        for (const [si, line, cls] of pb.script) {
          if (my !== run || !termEl.isConnected) return;
          stepEls.forEach((s, i) => { s.classList.toggle("on", i === si); s.classList.toggle("done", i < si); });
          const row = document.createElement("div");
          termEl.appendChild(row);
          if (line.startsWith("$")) {
            for (let i = 1; i <= line.length; i += 2) { if (my !== run) return; row.innerHTML = `<span class="c">$</span>${esc(line.slice(1, i))}<span class="caret"></span>`; await wait(14); }
            row.innerHTML = `<span class="c">$</span>${esc(line.slice(1))}`;
            await wait(320);
          } else { row.innerHTML = `<span class="${cls || ""}">${esc(line)}</span>`; await wait(420); }
          termEl.scrollTop = termEl.scrollHeight;
        }
        if (my !== run) return;
        stepEls.forEach((s) => { s.classList.remove("on"); s.classList.add("done"); });
        termEl.insertAdjacentHTML("beforeend", '<div><span class="c">$</span> <span class="caret"></span></div>');
      };
      scope.add(() => { run++; });
      scope.on(root, "click", (e) => {
        const c = e.target.closest("[data-pb]"); if (c) { history.replaceState(null, "", `#/playbooks?id=${c.dataset.pb}`); open(c.dataset.pb); }
        const cp = e.target.closest("[data-copy]"); if (cp) copyText(cp.dataset.copy);
      });
      open(q.get("id") || "canary");
    },
  };

  const NotFound = {
    title: "Lost in drift — DriftGuard",
    html() { return `<section class="page"><div class="wrap notfound"><div><div class="h-display grad-duo">404</div><p class="lead" style="margin:10px auto 24px">This route drifted out of the desired state.</p><a class="btn btn-ember" href="#/">Reconcile to home →</a></div></div></section>`; },
    mount() {},
  };

  /* ============================================================== ROUTER */
  const ROUTES = { "/": Landing, "/dashboard": Dashboard, "/rollouts": Rollouts, "/pipeline": Pipeline, "/services": Services, "/playbooks": Playbooks };
  let current = null;

  function parseHash() {
    const raw = window.location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    return { path: path || "/", q: new URLSearchParams(qs || "") };
  }

  async function render() {
    const { path, q } = parseHash();
    const page = ROUTES[path] || NotFound;
    const app = $("#app");
    if (current) {
      current.scope.dispose();
      const old = app.firstElementChild;
      if (old && !reduced) { $$(".page, section, footer", app).forEach((s) => s.classList.add("leaving")); await new Promise((r) => setTimeout(r, 240)); }
    }
    const scope = makeScope();
    app.innerHTML = page.html(q);
    document.title = page.title;
    window.scrollTo({ top: 0, behavior: "instant" });
    current = { path, page, scope };
    updateNav(path);
    try { page.mount(app, scope, q); } catch (e) { console.error(e); }
    enhance(app, scope);
    $("#nav").classList.remove("open");
    app.focus({ preventScroll: true });
  }

  function updateNav(path) {
    const links = $$("#navLinks a");
    let active = null;
    links.forEach((a) => { const on = a.dataset.route === path; a.classList.toggle("active", on); if (on) active = a; });
    const pill = $("#navPill");
    if (active && !isMobile()) { pill.style.opacity = 1; pill.style.left = `${active.offsetLeft}px`; pill.style.width = `${active.offsetWidth}px`; }
    else pill.style.opacity = 0;
  }

  /* ============================================================ ENHANCERS */
  function enhance(root, scope) {
    // reveal on scroll
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); if (en.target.dataset.count !== undefined) countUp(en.target); $$("[data-count]", en.target).forEach(countUp); }
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    $$(".reveal, .hero-title, [data-count]", root).forEach((el) => io.observe(el));
    scope.add(() => io.disconnect());
    $$("[data-scramble]", root).forEach((el) => scramble(el, el.textContent, scope));
  }

  function countUp(el) {
    if (el.dataset.counted) return;
    el.dataset.counted = 1;
    const target = Number(el.dataset.count), suffix = el.dataset.suffix || "";
    const t0 = performance.now(), dur = 1600;
    const step = (now) => {
      const k = clamp((now - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4);
      el.textContent = `${Math.round(target * e)}${suffix}`;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function scramble(el, text, scope) {
    const chars = "▲◆●■01<>/#$%&*+=";
    let frame = 0;
    const total = 28;
    const tick = () => {
      frame++;
      el.textContent = text.split("").map((c, i) => (c === " " ? " " : i < (frame / total) * text.length ? c : chars[Math.floor(Math.random() * chars.length)])).join("");
      if (frame < total) scope.timeout(tick, 34); else el.textContent = text;
    };
    scope.timeout(tick, 500);
  }

  /* ========================================================== GLOBAL FX */
  function globalFx() {
    const glow = $("#cursorGlow");
    let mx = -999, my = -999, gx = -999, gy = -999;
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      const tile = e.target.closest && e.target.closest(".tile");
      if (tile) { const r = tile.getBoundingClientRect(); tile.style.setProperty("--mx", `${e.clientX - r.left}px`); tile.style.setProperty("--my", `${e.clientY - r.top}px`); }
      const btn = e.target.closest && e.target.closest(".btn");
      if (btn) { const r = btn.getBoundingClientRect(); btn.style.setProperty("--bx", `${e.clientX - r.left}px`); btn.style.setProperty("--by", `${e.clientY - r.top}px`); }
    }, { passive: true });

    // magnetic buttons
    document.addEventListener("pointermove", (e) => {
      const m = e.target.closest && e.target.closest(".magnetic");
      $$(".magnetic.pulling").forEach((x) => { if (x !== m) { x.classList.remove("pulling"); x.style.transform = ""; } });
      if (!m || reduced) return;
      const r = m.getBoundingClientRect();
      m.classList.add("pulling");
      m.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    }, { passive: true });

    const nav = $("#nav"), prog = $("#scrollProgress");
    const onScroll = () => {
      nav.classList.toggle("scrolled", window.scrollY > 20);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { if (current) updateNav(current.path); });
    $("#navBurger").addEventListener("click", () => nav.classList.toggle("open"));

    // background constellation
    const canvas = $("#bgCanvas");
    let ctx, W, H;
    const resize = () => ({ ctx, w: W, h: H } = fitCanvas(canvas));
    resize(); window.addEventListener("resize", resize);
    const N = 0;
    const pts = Array.from({ length: N }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, vx: rand(-0.15, 0.15), vy: rand(-0.15, 0.15), c: i % 3 === 0 ? "255,138,61" : "127,212,255", r: rand(0.6, 1.8) }));
    const loop = () => {
      requestAnimationFrame(loop);
      gx = lerp(gx, mx, 0.12); gy = lerp(gy, my, 0.12);
      glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
      if (document.hidden || reduced) return;
      ctx.clearRect(0, 0, W, H);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy;
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 14000) { p.x += dx * 0.01; p.y += dy * 0.01; }
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      }
      for (let i = 0; i < N; i++) {
        const a = pts[i];
        for (let j = i + 1; j < N; j++) {
          const b = pts[j], dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < 17000) { ctx.strokeStyle = `rgba(${a.c},${(1 - d / 17000) * 0.16})`; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        ctx.fillStyle = `rgba(${a.c},.7)`; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
    };
    loop();
  }

  /* ================================================================ BOOT */
  async function boot() {
    document.body.classList.add("booting");
    const logEl = $("#bootLog"), bar = $("#bootBar"), pct = $("#bootPct"), bootEl = $("#boot");
    let skipped = false;
    const add = (txt, status = "ok", cls = "") => {
      const d = document.createElement("div");
      d.innerHTML = `<span class="${cls}">${txt}</span><span class="${status === "ok" ? "ok" : "hl"}">${status === "ok" ? "✓" : status}</span>`;
      logEl.appendChild(d);
      while (logEl.children.length > 7) logEl.firstChild.remove();
    };
    let p = 0;
    const setP = (v) => { p = v; bar.style.width = `${v}%`; pct.textContent = String(Math.round(v)).padStart(3, "0"); };
    const sleep = (ms) => new Promise((r) => setTimeout(r, skipped ? 0 : ms));
    $("#bootSkip").onclick = () => { skipped = true; };
    window.addEventListener("keydown", function k(e) { if (e.key === "Enter" || e.key === "Escape") { skipped = true; window.removeEventListener("keydown", k); } });

    const first = Telemetry.start();
    const lines = [
      ["terraform apply · vpc, eks, ecr, irsa", 12],
      ["aws eks update-kubeconfig", 22],
      ["argocd app sync root-app", 36],
      ["helm template checkout-svc · payments-svc", 48],
      ["argo rollouts controller ready", 60],
    ];
    await sleep(350);
    for (const [l, v] of lines) { add(l); const from = p; for (let i = 1; i <= 6; i++) { setP(lerp(from, v, i / 6)); await sleep(32); } }
    add("probing checkout-svc, payments-svc", "…", "hl");
    await Promise.race([first, new Promise((r) => setTimeout(r, skipped ? 0 : 2600))]);
    for (const s of SERVICES) add(`${s.name} → ${Telemetry.state[s.key].mode === "live" ? "live" : "simulated"}`, Telemetry.state[s.key].mode === "live" ? "ok" : "sim");
    for (let v = p; v <= 100; v += 4) { setP(Math.min(100, v)); await sleep(18); }
    setP(100);
    add("desired state = actual state", "ok", "ok");
    await sleep(280);

    bootEl.classList.add("done");
    document.body.classList.remove("booting");
    render();
    setTimeout(() => bootEl.classList.add("gone"), 1400);
  }

  window.addEventListener("hashchange", () => render());
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[href^='#/']");
    if (a && a.getAttribute("href") === window.location.hash) { e.preventDefault(); render(); }
  });

  globalFx();
  updateModeChip();
  boot();
})();
