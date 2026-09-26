const { useEffect, useMemo, useState } = React;
const {
  Area,
  AreaChart,
  CartesianGrid,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} = Recharts;

const h = React.createElement;

const services = [
  {
    key: "checkout",
    name: "checkout-svc",
    base: "/api/checkout",
    probe: "healthz",
    healthLabel: "Health",
    strategy: "canary",
  },
  {
    key: "payments",
    name: "payments-svc",
    base: "/api/payments",
    probe: "readyz",
    healthLabel: "Readiness",
    strategy: "blue-green",
  },
];

const environments = {
  dev: {
    checkout: {
      currentStage: 30,
      commit: "8f4c21a",
      version: "v1.4.2-dev",
      chartOffset: 0,
      timeline: [
        ["Git commit", "09:10", "done"],
        ["ArgoCD sync", "09:12", "done"],
        ["Rollout stage", "09:18", "active"],
        ["Promoted", "--", "pending"],
      ],
    },
    payments: {
      active: { version: "v1.3.8", health: "ready", tone: "ok" },
      preview: { version: "v1.4.0-rc.2", health: "warming", tone: "pending" },
      commit: "41de02c",
      chartOffset: 1,
      timeline: [
        ["Git commit", "09:03", "done"],
        ["ArgoCD sync", "09:05", "done"],
        ["Preview ready", "09:08", "active"],
        ["Promoted", "--", "pending"],
      ],
    },
    rollbacks: [
      {
        at: "Yesterday 18:42",
        service: "checkout-svc",
        reason: "error rate breached 2% for 5 minutes during 30% canary",
      },
      {
        at: "Sep 10, 16:11",
        service: "payments-svc",
        reason: "p99 latency exceeded 450ms before blue-green promotion",
      },
    ],
  },
  staging: {
    checkout: {
      currentStage: 10,
      commit: "c7a912e",
      version: "v1.4.1",
      chartOffset: 2,
      timeline: [
        ["Git commit", "08:24", "done"],
        ["ArgoCD sync", "08:27", "done"],
        ["Rollout stage", "08:34", "active"],
        ["Promoted", "--", "pending"],
      ],
    },
    payments: {
      active: { version: "v1.3.7", health: "ready", tone: "ok" },
      preview: { version: "v1.3.8", health: "ready", tone: "ok" },
      commit: "2ab71fd",
      chartOffset: 3,
      timeline: [
        ["Git commit", "07:55", "done"],
        ["ArgoCD sync", "07:58", "done"],
        ["Preview ready", "08:04", "done"],
        ["Promoted", "08:18", "done"],
      ],
    },
    rollbacks: [
      {
        at: "Sep 11, 12:09",
        service: "checkout-svc",
        reason: "availability SLO dipped below 99.5% during 10% canary",
      },
    ],
  },
  prod: {
    checkout: {
      currentStage: 100,
      commit: "f02ad91",
      version: "v1.4.0",
      chartOffset: 4,
      timeline: [
        ["Git commit", "06:42", "done"],
        ["ArgoCD sync", "06:45", "done"],
        ["Rollout stage", "07:02", "done"],
        ["Promoted", "07:16", "done"],
      ],
    },
    payments: {
      active: { version: "v1.3.7", health: "ready", tone: "ok" },
      preview: { version: "none", health: "idle", tone: "pending" },
      commit: "91be83f",
      chartOffset: 5,
      timeline: [
        ["Git commit", "05:31", "done"],
        ["ArgoCD sync", "05:36", "done"],
        ["Preview ready", "05:50", "done"],
        ["Promoted", "06:05", "done"],
      ],
    },
    rollbacks: [
      {
        at: "Sep 07, 21:33",
        service: "payments-svc",
        reason: "preview environment failed readiness checks before promotion",
      },
      {
        at: "Sep 03, 02:16",
        service: "checkout-svc",
        reason: "p99 latency breached 600ms for two analysis windows",
      },
    ],
  },
};

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `${response.status} ${response.statusText}`);
  }

  return text.trim();
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(json));
  }

  return json;
}

function requestStats(metrics, service) {
  const pattern = new RegExp(
    `driftguard_http_requests_total\\{[^}]*service="${service}-svc"[^}]*status="(\\d+)"[^}]*\\}\\s+(\\d+)`,
    "g",
  );
  let total = 0;
  let errors = 0;
  let match;

  while ((match = pattern.exec(metrics)) !== null) {
    const count = Number(match[2]);
    total += count;
    if (Number(match[1]) >= 500) {
      errors += count;
    }
  }

  return {
    errors,
    errorRate: total > 0 ? (errors / total) * 100 : 0,
    total,
  };
}

function p99Latency(metrics, service) {
  const bucketPattern = new RegExp(
    `driftguard_http_request_duration_seconds_bucket\\{[^}]*route="/"[^}]*service="${service}-svc"[^}]*le="([^"]+)"[^}]*\\}\\s+(\\d+)`,
    "g",
  );
  const buckets = [];
  let match;

  while ((match = bucketPattern.exec(metrics)) !== null) {
    const boundary = match[1] === "+Inf" ? Infinity : Number(match[1]);
    buckets.push({ boundary, count: Number(match[2]) });
  }

  const finite = buckets.filter((bucket) => Number.isFinite(bucket.boundary));
  const total = buckets.find((bucket) => bucket.boundary === Infinity)?.count || finite.at(-1)?.count || 0;
  const threshold = total * 0.99;
  const selected = finite.find((bucket) => bucket.count >= threshold) || finite.at(-1);

  return selected ? Math.round(selected.boundary * 1000) : 0;
}

function metricSeries(seed, live) {
  const baseError = Math.max(live.errorRate, 0.06 + seed * 0.04);
  const baseLatency = Math.max(live.p99Ms || 18, 80 + seed * 14);
  const points = ["09:00", "09:05", "09:10", "09:15", "09:20", "09:25"];

  return points.map((time, index) => {
    const wave = Math.sin(index + seed) * 0.08;
    return {
      time,
      errorRate: Number(Math.max(0, baseError + wave + index * 0.015).toFixed(2)),
      p99: Math.round(baseLatency + Math.cos(index + seed) * 18 + index * 5),
    };
  });
}

function statusClass(state) {
  if (state === "Online" || state === "ready") return "ok";
  if (state === "Down") return "down";
  return "pending";
}

const routes = ["home", "insights", "signals", "entities"];
const routeLabels = {
  home: "Home",
  insights: "Insight",
  signals: "Signals",
  entities: "Entities",
};

function getRouteFromHash() {
  const hash = window.location.hash.replace(/^#/, "").toLowerCase();
  return routes.includes(hash) ? hash : "home";
}

function setRouteHash(route) {
  const next = `#${route}`;
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

function formatClockLabel(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function handleActivation(action) {
  return (event) => {
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    action();
  };
}

function buildHistorySeries(history, valueKey) {
  return history.map((item) => ({
    time: item.time,
    value: item[valueKey],
  }));
}

function LiveLogo() {
  return h(
    "svg",
    { className: "dg-logo", viewBox: "0 0 40 40", "aria-hidden": "true" },
    h("path", {
      d: "M20 3l11 4v9c0 8-4.5 14.7-11 21-6.5-6.3-11-13-11-21V7l11-4z",
    }),
    h("path", {
      d: "M20 10v19m-6-7h12",
    }),
  );
}

function App() {
  const [page, setPage] = useState(() => (typeof window !== "undefined" ? getRouteFromHash() : "home"));
  const [selectedService, setSelectedService] = useState("checkout");
  const [serviceState, setServiceState] = useState({});
  const [historyState, setHistoryState] = useState({ checkout: [], payments: [] });
  const [lastCheck, setLastCheck] = useState("Waiting for first refresh");

  async function refresh() {
    const next = {};

    await Promise.all(
      services.map(async (service) => {
        try {
          const [root, health, metrics] = await Promise.all([
            fetchJson(`${service.base}/`),
            fetchText(`${service.base}/${service.probe}`),
            fetchText(`${service.base}/metrics`),
          ]);
          const requests = requestStats(metrics, service.key);

          next[service.key] = {
            root,
            health,
            metrics,
            online: true,
            requests: requests.total,
            errorRate: requests.errorRate,
            p99Ms: p99Latency(metrics, service.key),
          };
        } catch (error) {
          next[service.key] = {
            error: error.message,
            health: "down",
            online: false,
            requests: 0,
            errorRate: 100,
            p99Ms: 0,
          };
        }
      }),
    );

    const stamp = formatClockLabel();

    setServiceState(next);
    setHistoryState((current) => {
      const nextHistory = { checkout: [...(current.checkout || [])], payments: [...(current.payments || [])] };

      services.forEach((service) => {
        const live = next[service.key] || {};
        nextHistory[service.key] = [
          ...(nextHistory[service.key] || []).slice(-5),
          {
            time: stamp,
            requests: live.requests || 0,
            errorRate: Number((live.errorRate || 0).toFixed(2)),
            p99Ms: live.p99Ms || 0,
            health: live.online ? "online" : "down",
            version: live.root?.version || "n/a",
          },
        ].slice(-8);
      });

      return nextHistory;
    });
    setLastCheck(new Date().toLocaleString());
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const syncRoute = () => setPage(getRouteFromHash());
    window.addEventListener("hashchange", syncRoute);
    return () => window.removeEventListener("hashchange", syncRoute);
  }, []);

  useEffect(() => {
    setRouteHash(page);
  }, [page]);

  const checkoutState = serviceState.checkout || {};
  const paymentsState = serviceState.payments || {};
  const liveServices = services.map((service) => ({
    ...service,
    state: serviceState[service.key] || {},
    history: historyState[service.key] || [],
  }));
  const totalRequests = liveServices.reduce((sum, service) => sum + (service.state.requests || 0), 0);
  const onlineCount = liveServices.filter((service) => service.state.online).length;
  const maxLatency = Math.max(...liveServices.map((service) => service.state.p99Ms || 0), 0);
  const totalErrors = liveServices.reduce((sum, service) => sum + Math.round((service.state.requests || 0) * ((service.state.errorRate || 0) / 100)), 0);
  const checkoutHistory = buildHistorySeries(historyState.checkout, "requests");
  const checkoutErrorHistory = buildHistorySeries(historyState.checkout, "errorRate");
  const checkoutLatencyHistory = buildHistorySeries(historyState.checkout, "p99Ms");
  const paymentsHistory = buildHistorySeries(historyState.payments, "requests");
  const paymentsErrorHistory = buildHistorySeries(historyState.payments, "errorRate");
  const selected = liveServices.find((service) => service.key === selectedService) || liveServices[0];
  const activeServices = liveServices.filter((service) => service.state.online).length;
  const liveState = activeServices === liveServices.length ? "All systems live" : `${activeServices}/${liveServices.length} services online`;
  const selectedTrend = selected.key === "checkout" ? checkoutHistory : paymentsHistory;
  const selectedErrorTrend = selected.key === "checkout" ? checkoutErrorHistory : paymentsErrorHistory;
  const selectedLatencyTrend = selected.key === "checkout" ? checkoutLatencyHistory : buildHistorySeries(historyState.payments, "p99Ms");
  const alerts = liveServices
    .filter((service) => (service.state.errorRate || 0) > 1 || !(service.state.online ?? false))
    .map((service) => ({
      label: service.name,
      message: service.state.online ? `${service.state.errorRate.toFixed(2)}% error rate` : "service is offline",
      tone: service.state.online ? "warning" : "down",
    }));
  const pageMeta = {
    home: {
      title: "Live overview",
      description: "Real service health and request telemetry from checkout and payments.",
    },
    insights: {
      title: "Insights",
      description: "Live request, latency, and error trends from the running services.",
    },
    signals: {
      title: "Signals",
      description: "Active alerts, failures, and health transitions detected from real probes.",
    },
    entities: {
      title: "Entities",
      description: "Service details, live payloads, and the current API responses.",
    },
  }[page];

  const payload = useMemo(
    () => ({
      page,
      lastCheck,
      services: liveServices.map((service) => ({
        key: service.key,
        name: service.name,
        online: service.state.online,
        root: service.state.root || null,
        requests: service.state.requests || 0,
        errorRate: service.state.errorRate || 0,
        p99Ms: service.state.p99Ms || 0,
      })),
      history: historyState,
    }),
    [historyState, lastCheck, liveServices, page],
  );

  return h(
    DriftguardLiveApp,
    {
      page,
      onNavigate: setPage,
      onRefresh: refresh,
      lastCheck,
      pageMeta,
      liveServices,
      totalRequests,
      onlineCount,
      totalErrors,
      maxLatency,
      liveState,
      selected,
      selectedTrend,
      selectedErrorTrend,
      selectedLatencyTrend,
      alerts,
      payload,
      selectedService,
      onSelectService: setSelectedService,
    },
  );
}

function DriftguardLiveApp({
  page,
  onNavigate,
  onRefresh,
  lastCheck,
  pageMeta,
  liveServices,
  totalRequests,
  onlineCount,
  totalErrors,
  maxLatency,
  liveState,
  selected,
  selectedTrend,
  selectedErrorTrend,
  selectedLatencyTrend,
  alerts,
  payload,
  selectedService,
  onSelectService,
}) {
  return h(
    "main",
    { className: "dg-app dg-app-full" },
    h(
      "header",
      { className: "dg-topbar" },
      h(
        "button",
        {
          type: "button",
          className: "dg-brand",
          onClick: () => onNavigate("home"),
          "aria-label": "Go to home",
        },
        h(LiveLogo),
        h(
          "div",
          null,
          h("strong", null, "DriftGuard"),
          h("span", null, "GitOps command center"),
        ),
      ),
      h(
        "label",
        { className: "dg-search" },
        h("span", { "aria-hidden": "true" }, "⌕"),
        h("input", {
          type: "search",
          placeholder: "Search services, pages, or signals",
          "aria-label": "Search dashboard",
        }),
      ),
      h(
        "nav",
        { className: "dg-nav", "aria-label": "Primary" },
        routes.map((route) =>
          h(
            "button",
            {
              key: route,
              type: "button",
              className: `dg-nav-link ${page === route ? "active" : ""}`,
              onClick: () => onNavigate(route),
            },
            routeLabels[route],
          ),
        ),
      ),
      h(
        "div",
        { className: "dg-tools" },
        h("button", { className: "dg-icon", type: "button", onClick: onRefresh, "aria-label": "Refresh data" }, "↻"),
        h("button", { className: "dg-icon", type: "button", onClick: () => onNavigate("signals"), "aria-label": "Open signals" }, "⚑"),
        h("button", { className: "dg-avatar-chip", type: "button", onClick: () => onNavigate("entities"), "aria-label": "Open entities" }, h("span", null, "A")),
      ),
    ),
    h(
      "section",
      { className: "dg-hero" },
      h(
        "div",
        null,
        h(
          "div",
          { className: "dg-live-banner" },
          h("span", { className: "dg-live-dot", "aria-hidden": "true" }),
          h("span", null, liveState),
          h("strong", null, "Running"),
        ),
        h("p", { className: "dg-kicker" }, "Real-time DriftGuard"),
        h("h1", null, pageMeta.title),
        h("p", { className: "dg-hero-copy" }, pageMeta.description),
      ),
      h(
        "div",
        { className: "dg-hero-meta" },
        h("div", { className: "dg-kpi" }, h("span", null, "Online"), h("strong", null, `${onlineCount}/${liveServices.length}`)),
        h("div", { className: "dg-kpi" }, h("span", null, "Requests"), h("strong", null, String(totalRequests))),
        h("div", { className: "dg-kpi" }, h("span", null, "Errors"), h("strong", null, String(totalErrors))),
        h("div", { className: "dg-kpi" }, h("span", null, "p99 latency"), h("strong", null, `${maxLatency}ms`)),
      ),
    ),
    page === "home" && h(HomePage, { liveServices, onNavigate, onSelectService, selectedService, onRefresh }),
    page === "insights" && h(InsightsPage, { liveServices, selectedTrend, selectedErrorTrend, selectedLatencyTrend, onSelectService, onNavigate }),
    page === "signals" && h(SignalsPage, { alerts, liveServices, onNavigate, onSelectService }),
    page === "entities" && h(EntitiesPage, { liveServices, selected, payload, lastCheck, onSelectService, onNavigate }),
    h(
      "footer",
      { className: "dg-footer" },
      h("span", null, `Last refresh ${lastCheck}`),
      h("button", { type: "button", className: "dg-footer-action", onClick: onRefresh }, "Refresh live data"),
    ),
    h(
      "svg",
      { className: "dg-defs", viewBox: "0 0 10 10", "aria-hidden": "true" },
      h(
        "defs",
        null,
        h(
          "linearGradient",
          { id: "dg-bar", x1: "0%", y1: "0%", x2: "100%", y2: "0%" },
          h("stop", { offset: "0%", stopColor: "#f3d49f" }),
          h("stop", { offset: "55%", stopColor: "#9fd8e1" }),
          h("stop", { offset: "100%", stopColor: "#f7b56e" }),
        ),
      ),
    ),
  );
}

function HomePage({ liveServices, onNavigate, onSelectService, selectedService, onRefresh }) {
  const heroSummary = liveServices.map((service) => ({
    ...service,
    requests: service.state.requests || 0,
    errorRate: service.state.errorRate || 0,
    p99Ms: service.state.p99Ms || 0,
  }));
  const selected = heroSummary.find((service) => service.key === selectedService) || heroSummary[0];
  const trendData = (selected?.history || []).map((item) => ({ time: item.time, value: item.requests }));

  return h(
    "section",
    { className: "dg-page-grid" },
    h(
      "div",
      { className: "dg-page-main" },
      h(
        "div",
        { className: "dg-panel-grid" },
        heroSummary.map((service) =>
          h(
            "article",
            {
              key: service.key,
              className: `dg-service-card ${selectedService === service.key ? "active" : ""}`,
              role: "button",
              tabIndex: 0,
              onClick: () => onSelectService(service.key),
              onKeyDown: handleActivation(() => onSelectService(service.key)),
            },
            h("div", { className: "dg-card-top" }, h("strong", null, service.name), h("span", null, service.state.online ? "Online" : "Down")),
            h("p", null, service.state.root?.version || "Waiting for live data"),
            h(
              "div",
              { className: "dg-metric-strip" },
              h("div", null, h("small", null, "Requests"), h("strong", null, String(service.requests))),
              h("div", null, h("small", null, "Error rate"), h("strong", null, `${service.errorRate.toFixed(2)}%`)),
              h("div", null, h("small", null, "p99"), h("strong", null, `${service.p99Ms}ms`)),
            ),
            h("button", { type: "button", className: "dg-card-link", onClick: () => onNavigate("entities") }, "Open entity"),
          ),
        ),
      ),
      h(
        "article",
        { className: "dg-chart-card" },
        h("div", { className: "dg-section-head" }, h("strong", null, "Live request trend"), h("button", { type: "button", className: "dg-inline-btn", onClick: onRefresh }, "Refresh")),
        h(TrendChart, { data: trendData, stroke: selectedService === "checkout" ? "#8fd8e3" : "#f0b56d", suffix: " requests" }),
      ),
    ),
    h(
      "aside",
      { className: "dg-sidebar" },
      h(
        "article",
        { className: "dg-compact-card" },
        h("div", { className: "dg-section-head" }, h("strong", null, "Quick actions"), h("span", null, "Clickable")),
        h(
          "div",
          { className: "dg-action-list" },
          [
            ["Insights", "insights"],
            ["Signals", "signals"],
            ["Entities", "entities"],
          ].map(([label, route]) =>
            h(
              "button",
              { key: route, type: "button", className: "dg-action-row", onClick: () => onNavigate(route) },
              h("span", null, label),
              h("strong", null, "→"),
            ),
          ),
        ),
      ),
    ),
  );
}

function InsightsPage({ liveServices, selectedTrend, selectedErrorTrend, selectedLatencyTrend, onSelectService, onNavigate }) {
  return h(
    "section",
    { className: "dg-page-grid" },
    h(
      "div",
      { className: "dg-page-main" },
      h(
        "article",
        { className: "dg-chart-card" },
        h("div", { className: "dg-section-head" }, h("strong", null, "Requests over time"), h("span", null, "Real samples from API")),
        h(TrendChart, { data: selectedTrend, stroke: "#8fd8e3", suffix: " req" }),
      ),
      h(
        "article",
        { className: "dg-chart-card" },
        h("div", { className: "dg-section-head" }, h("strong", null, "Error rate trend"), h("span", null, "Based on live metrics")),
        h(TrendChart, { data: selectedErrorTrend, stroke: "#f0b56d", suffix: "%" }),
      ),
      h(
        "article",
        { className: "dg-chart-card" },
        h("div", { className: "dg-section-head" }, h("strong", null, "Latency trend"), h("span", null, "p99 in milliseconds")),
        h(TrendChart, { data: selectedLatencyTrend, stroke: "#ab8df2", suffix: "ms" }),
      ),
    ),
    h(
      "aside",
      { className: "dg-sidebar" },
      liveServices.map((service) =>
        h(
          "button",
          {
            key: service.key,
            type: "button",
            className: "dg-service-mini",
            onClick: () => onSelectService(service.key),
          },
          h("strong", null, service.name),
          h("span", null, `${service.state.requests || 0} req • ${service.state.errorRate?.toFixed(2) || "0.00"}%`),
        ),
      ),
      h("button", { type: "button", className: "dg-action-row", onClick: () => onNavigate("signals") }, h("span", null, "Open signals"), h("strong", null, "→")),
    ),
  );
}

function SignalsPage({ alerts, liveServices, onNavigate, onSelectService }) {
  const signalItems = alerts.length
    ? alerts
    : liveServices.map((service) => ({
        label: service.name,
        message: `Live and healthy • ${service.state.requests || 0} requests`,
        tone: "ok",
      }));

  return h(
    "section",
    { className: "dg-page-grid" },
    h(
      "div",
      { className: "dg-page-main" },
      h(
        "article",
        { className: "dg-issue-board" },
        signalItems.map((item) =>
          h(
            "button",
            {
              key: `${item.label}-${item.message}`,
              type: "button",
              className: `dg-issue-row ${item.tone}`,
              onClick: () => onNavigate("entities"),
            },
            h("strong", null, item.label),
            h("span", null, item.message),
            h("em", null, "Open"),
          ),
        ),
      ),
    ),
    h(
      "aside",
      { className: "dg-sidebar" },
      liveServices.map((service) =>
        h(
          "button",
          { key: service.key, type: "button", className: "dg-service-mini", onClick: () => onSelectService(service.key) },
          h("strong", null, service.name),
          h("span", null, service.state.online ? "Healthy" : "Offline"),
        ),
      ),
    ),
  );
}

function EntitiesPage({ liveServices, selected, payload, lastCheck, onSelectService, onNavigate }) {
  return h(
    "section",
    { className: "dg-page-grid" },
    h(
      "div",
      { className: "dg-page-main" },
      h(
        "article",
        { className: "dg-entity-card" },
        h("div", { className: "dg-section-head" }, h("strong", null, selected.name), h("span", null, selected.state.online ? "Online" : "Down")),
        h("p", null, selected.state.root ? JSON.stringify(selected.state.root) : "No live payload yet"),
        h(
          "div",
          { className: "dg-metric-strip" },
          h("div", null, h("small", null, "Requests"), h("strong", null, String(selected.state.requests || 0))),
          h("div", null, h("small", null, "Error rate"), h("strong", null, `${(selected.state.errorRate || 0).toFixed(2)}%`)),
          h("div", null, h("small", null, "p99"), h("strong", null, `${selected.state.p99Ms || 0}ms`)),
        ),
      ),
      h(
        "article",
        { className: "dg-raw-live" },
        h("div", { className: "dg-section-head" }, h("strong", null, "Live payload"), h("span", null, lastCheck)),
        h("pre", null, JSON.stringify(payload, null, 2)),
      ),
    ),
    h(
      "aside",
      { className: "dg-sidebar" },
      liveServices.map((service) =>
        h(
          "button",
          {
            key: service.key,
            type: "button",
            className: `dg-service-mini ${selected.key === service.key ? "active" : ""}`,
            onClick: () => onSelectService(service.key),
          },
          h("strong", null, service.name),
          h("span", null, service.state.root?.version || "n/a"),
        ),
      ),
      h("button", { type: "button", className: "dg-action-row", onClick: () => onNavigate("home") }, h("span", null, "Back home"), h("strong", null, "→")),
    ),
  );
}

function TrendChart({ data, stroke, suffix }) {
  const series = data.length ? data : [{ time: "now", value: 0 }];

  return h(
    ResponsiveContainer,
    { width: "100%", height: 220 },
    h(
      LineChart,
      { data: series, margin: { top: 10, right: 10, bottom: 0, left: -20 } },
      h(CartesianGrid, { stroke: "rgba(255,255,255,0.07)", vertical: false }),
      h(XAxis, { dataKey: "time", tick: { fill: "#847f90", fontSize: 11 }, tickLine: false, axisLine: false }),
      h(YAxis, { tick: { fill: "#847f90", fontSize: 11 }, tickLine: false, axisLine: false }),
      h(Tooltip, {
        contentStyle: {
          background: "#17141d",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 16,
          color: "#f7f4ff",
        },
        formatter: (value) => [`${value}${suffix}`, "live"],
      }),
      h(Line, { type: "monotone", dataKey: "value", stroke, strokeWidth: 3, dot: false, activeDot: { r: 4 } }),
    ),
  );
}

function DriftguardDashboard({
  environment,
  onEnvironmentChange,
  onRefresh,
  lastCheck,
  navLinks,
  issueCards,
  issueHighlight,
  activityData,
  deviceData,
  checkoutState,
  paymentsState,
  envData,
  scanProgress,
  combinedRequests,
  payload,
}) {
  return h(
    "main",
    { className: "dg-app" },
    h(
      "header",
      { className: "dg-topbar" },
      h(
        "div",
        { className: "dg-brand" },
        h("span", { className: "dg-mark", "aria-hidden": "true" }, "⛨"),
        h(
          "div",
          null,
          h("strong", null, "DriftGuard"),
          h("span", null, "GitOps command center"),
        ),
      ),
      h(
        "label",
        { className: "dg-search" },
        h("span", { "aria-hidden": "true" }, "⌕"),
        h("input", {
          type: "search",
          placeholder: "Search here",
          "aria-label": "Search dashboard",
        }),
      ),
      h(
        "nav",
        { className: "dg-nav", "aria-label": "Primary" },
        navLinks.map((label, index) =>
          h(
            "button",
            {
              key: label,
              type: "button",
              className: `dg-nav-link ${index === 0 ? "active" : ""}`,
            },
            label,
          ),
        ),
      ),
      h(
        "div",
        { className: "dg-tools" },
        h(
          "button",
          { className: "dg-icon", type: "button", "aria-label": "Menu" },
          "☰",
        ),
        h(
          "button",
          {
            className: "dg-icon",
            type: "button",
            onClick: onRefresh,
            "aria-label": "Refresh metrics",
          },
          "↗",
        ),
        h(
          "button",
          { className: "dg-icon", type: "button", "aria-label": "Notifications" },
          "◔",
        ),
        h(
          "button",
          { className: "dg-avatar-chip", type: "button", "aria-label": "Profile" },
          h("span", null, "A"),
        ),
        h("span", { className: "dg-caret", "aria-hidden": "true" }, "⌃"),
      ),
    ),
    h(
      "section",
      { className: "dg-hero" },
      h(
        "div",
        null,
        h("p", { className: "dg-kicker" }, "DriftGuard overview"),
        h("h1", null, "Hey Arnazz10!", h("br"), "Welcome Back"),
      ),
      h(
        "div",
        { className: "dg-hero-meta" },
        h(
          "div",
          { className: "dg-toggle" },
          h("span", null, "Server Requests"),
          h("button", { type: "button", className: "dg-switch", "aria-pressed": "true" }, h("span", null, "●")),
        ),
        h(EnvironmentTabs, { current: environment, onChange: onEnvironmentChange }),
      ),
    ),
    h(
      "section",
      { className: "dg-grid" },
      h(
        "aside",
        { className: "dg-column dg-column-left" },
        h(
          "article",
          { className: "dg-card dg-issues" },
          h(
            "div",
            { className: "dg-card-head" },
            h("div", null, h("p", { className: "dg-label" }, "Issue Detected"), h("span", null, "Solve the issue to get full recovery")),
            h("button", { className: "dg-refresh", type: "button", onClick: onRefresh, "aria-label": "Refresh issue list" }, "↻"),
          ),
          h(
            "div",
            { className: "dg-issue-list" },
            issueCards.map((item, index) =>
              h(
                "div",
                {
                  key: item.title,
                  className: `dg-issue ${index === issueHighlight ? "highlight" : ""}`,
                },
                h(
                  "span",
                  { className: "dg-issue-icon" },
                  item.icon,
                ),
                h(
                  "div",
                  null,
                  h("strong", null, item.title),
                  h("p", null, item.detail),
                ),
                h("span", { className: "dg-arrow", "aria-hidden": "true" }, "›"),
              ),
            ),
          ),
          h(
            "div",
            { className: "dg-alert-cta" },
            h("span", { className: "dg-alert-pill" }, "+"),
            h("div", null, h("strong", null, "Add to alerts"), h("p", null, "Keep the on-call stream aligned with rollback events")),
            h("span", { className: "dg-chevrons", "aria-hidden": "true" }, "››"),
          ),
        ),
      ),
      h(
        "section",
        { className: "dg-column dg-column-center" },
        h(
          "article",
          { className: "dg-card dg-panel" },
          h(
            "div",
            { className: "dg-card-head" },
            h("div", null, h("p", { className: "dg-label" }, "Data Activity"), h("span", null, "Viewing last 7 days chart")),
            h("span", { className: "dg-mini-icons", "aria-hidden": "true" }, "▤ ▢"),
          ),
          h("strong", { className: "dg-figure" }, String(Math.round((combinedRequests || 498) / 1.6))),
          h("p", { className: "dg-subfigure" }, "Discovered assists"),
          h(
            "div",
            { className: "dg-chart-wrap" },
            h(
              ResponsiveContainer,
              { width: "100%", height: 160 },
              h(
                BarChart,
                { data: activityData, margin: { top: 10, right: 6, bottom: 0, left: -20 } },
                h(CartesianGrid, { stroke: "rgba(255,255,255,0.07)", vertical: false }),
                h(XAxis, { dataKey: "time", tick: { fill: "#847f90", fontSize: 11 }, tickLine: false, axisLine: false }),
                h(YAxis, { tick: { fill: "#847f90", fontSize: 11 }, tickLine: false, axisLine: false }),
                h(Tooltip, {
                  contentStyle: {
                    background: "#17141d",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#f7f4ff",
                  },
                }),
                h(Bar, { dataKey: "requests", radius: [8, 8, 4, 4], fill: "url(#dg-bar)" }),
                h(Bar, { dataKey: "assists", radius: [8, 8, 4, 4], fill: "rgba(255,255,255,0.24)" }),
              ),
            ),
          ),
        ),
        h(
          "article",
          { className: "dg-card dg-panel" },
          h(
            "div",
            { className: "dg-card-head" },
            h("div", null, h("p", { className: "dg-label" }, "Data Activity"), h("span", null, "Last rollout window")),
            h("span", { className: "dg-mini-icons", "aria-hidden": "true" }, "▤ ▢"),
          ),
          h("strong", { className: "dg-figure" }, String(checkoutState.p99Ms || envData.checkout.currentStage + 233)),
          h("p", { className: "dg-subfigure" }, "Entry point breakdown"),
          h(
            "div",
            { className: "dg-chart-wrap" },
            h(
              ResponsiveContainer,
              { width: "100%", height: 160 },
              h(
                AreaChart,
                { data: deviceData, margin: { top: 10, right: 6, bottom: 0, left: -20 } },
                h(CartesianGrid, { stroke: "rgba(255,255,255,0.07)", vertical: false }),
                h(XAxis, { dataKey: "time", tick: { fill: "#847f90", fontSize: 11 }, tickLine: false, axisLine: false }),
                h(YAxis, { tick: { fill: "#847f90", fontSize: 11 }, tickLine: false, axisLine: false }),
                h(Tooltip, {
                  contentStyle: {
                    background: "#17141d",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#f7f4ff",
                  },
                }),
                h(Area, { type: "monotone", dataKey: "scans", stroke: "#9be6d4", fill: "rgba(155, 230, 212, 0.18)" }),
              ),
            ),
          ),
        ),
        h("div", { className: "dg-bottom-rail" }, h("span", { "aria-hidden": "true" }, "⌄")),
      ),
      h(
        "aside",
        { className: "dg-column dg-column-right" },
        h(
          "article",
          { className: "dg-card dg-profile" },
          h(
            "div",
            { className: "dg-profile-head" },
            h("button", { type: "button", className: "dg-profile-menu", "aria-label": "Profile menu" }, "≡"),
            h("div", { className: "dg-profile-actions" }, h("span", null, "↗"), h("span", null, "⌫"), h("span", null, "◔")),
            h("button", { type: "button", className: "dg-avatar-mini", "aria-label": "Current user" }, h("span", null, "A")),
            h("span", { className: "dg-profile-caret", "aria-hidden": "true" }, "⌃"),
          ),
          h(
            "div",
            { className: "dg-ring" },
            h("div", { className: "dg-ring-dot" }),
            h("div", { className: "dg-ring-core" }, h("span", null, "A")),
          ),
          h("h3", null, "Ms. Arnazz10", h("small", null, "Admin")),
        ),
        h(
          "article",
          { className: "dg-card dg-device" },
          h(
            "div",
            { className: "dg-card-head" },
            h("div", null, h("p", { className: "dg-label" }, "My Device Reports"), h("span", null, "Viewing last 7 days chart")),
            h("span", { className: "dg-mini-icons gold", "aria-hidden": "true" }, "▤ ▢"),
          ),
          h("strong", { className: "dg-figure" }, `${Math.max(18, Math.round((paymentsState.p99Ms || 163) / 7))}t`),
          h("p", { className: "dg-subfigure" }, "You device scan time"),
          h(
            "div",
            { className: "dg-device-chart" },
            h(
              ResponsiveContainer,
              { width: "100%", height: 118 },
              h(
                LineChart,
                { data: deviceData, margin: { top: 4, right: 8, bottom: 0, left: -18 } },
                h(CartesianGrid, { stroke: "rgba(255,255,255,0.08)", vertical: false }),
                h(XAxis, { dataKey: "time", tick: { fill: "#847f90", fontSize: 10 }, tickLine: false, axisLine: false }),
                h(YAxis, { tick: { fill: "#847f90", fontSize: 10 }, tickLine: false, axisLine: false }),
                h(Tooltip, {
                  contentStyle: {
                    background: "#17141d",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 16,
                    color: "#f7f4ff",
                  },
                }),
                h(Line, { type: "monotone", dataKey: "scans", stroke: "#8d8df8", strokeWidth: 2.5, dot: true }),
              ),
            ),
          ),
          h(
            "div",
            { className: "dg-chip-grid" },
            ["Routers", "Memory", "Scanning"].map((label, index) =>
              h(
                "div",
                { key: label, className: `dg-chip ${index === 2 ? "active" : ""}` },
                h("span", null, label),
              ),
            ),
          ),
          h(
            "div",
            { className: "dg-system" },
            h("div", { className: "dg-system-head" }, h("span", null, "System scan"), h("small", null, "last scan")),
            h(
              "div",
              { className: "dg-progress" },
              h("div", { className: "dg-progress-fill", style: { width: `${scanProgress}%` } }),
              h("span", { className: "dg-progress-glow", "aria-hidden": "true" }),
            ),
            h("div", { className: "dg-progress-foot" }, h("strong", null, "Progress"), h("span", null, `${scanProgress}%`)),
          ),
        ),
      ),
    ),
    h(
      "section",
      { className: "dg-footer-row" },
      h(
        "details",
        { className: "dg-raw" },
        h(
          "summary",
          null,
          h("div", null, h("p", { className: "dg-label" }, "Last check"), h("h2", null, lastCheck)),
          h("span", null, "Raw JSON status"),
        ),
        h("pre", null, JSON.stringify(payload, null, 2)),
      ),
    ),
    h(
      "svg",
      { className: "dg-defs", viewBox: "0 0 10 10", "aria-hidden": "true" },
      h(
        "defs",
        null,
        h(
          "linearGradient",
          { id: "dg-bar", x1: "0%", y1: "0%", x2: "100%", y2: "0%" },
          h("stop", { offset: "0%", stopColor: "#f3d49f" }),
          h("stop", { offset: "55%", stopColor: "#9fd8e1" }),
          h("stop", { offset: "100%", stopColor: "#f7b56e" }),
        ),
      ),
    ),
  );
}

function EnvironmentTabs({ current, onChange }) {
  return h(
    "div",
    { className: "tabs", role: "tablist", "aria-label": "Environment" },
    Object.keys(environments).map((environment) =>
      h(
        "button",
        {
          key: environment,
          className: `tab ${current === environment ? "active" : ""}`,
          role: "tab",
          "aria-selected": current === environment,
          type: "button",
          onClick: () => onChange(environment),
        },
        environment,
      ),
    ),
  );
}

function ServicePanel({ config, envData, state = {} }) {
  const liveVersion = state.root?.version ? `version ${state.root.version}` : "Checking...";
  const title = config.key === "checkout" ? envData.version : liveVersion;
  const onlineText = state.online ? "Online" : state.online === false ? "Down" : "Pending";
  const series = metricSeries(envData.chartOffset, state);

  return h(
    "article",
    { className: "service", "data-service": config.key },
    h(
      "div",
      { className: "service-head" },
      h("div", null, h("p", { className: "label" }, config.name), h("h2", null, title)),
      h("span", { className: `pill ${statusClass(onlineText)}` }, onlineText),
    ),
    h(
      "dl",
      null,
      h("div", null, h("dt", null, config.healthLabel), h("dd", null, state.health || "...")),
      h("div", null, h("dt", null, "Requests"), h("dd", null, String(state.requests ?? "..."))),
    ),
    h(
      "div",
      { className: "service-body" },
      config.strategy === "canary"
        ? h(CanaryRollout, { currentStage: envData.currentStage })
        : h(BlueGreenView, { data: envData }),
      h(SloMetrics, { service: config.name, series }),
    ),
  );
}

function CanaryRollout({ currentStage }) {
  const stages = [10, 30, 100];

  return h(
    "section",
    { className: "rollout-card", "aria-label": "Canary traffic split" },
    h("div", { className: "section-head" }, h("p", { className: "label" }, "Canary split"), h("strong", null, `${currentStage}% live`)),
    h(
      "div",
      { className: "canary-track" },
      h("div", { className: "canary-fill", style: { width: `${currentStage}%` } }),
      stages.map((stage) =>
        h(
          "div",
          {
            key: stage,
            className: `canary-stage ${stage <= currentStage ? "reached" : ""} ${stage === currentStage ? "current" : ""}`,
            style: { left: `${stage}%` },
          },
          h("span", null, `${stage}%`),
        ),
      ),
    ),
  );
}

function BlueGreenView({ data }) {
  return h(
    "section",
    { className: "rollout-card", "aria-label": "Blue green environments" },
    h("div", { className: "section-head" }, h("p", { className: "label" }, "Blue-green"), h("strong", null, data.commit)),
    h(
      "div",
      { className: "bluegreen" },
      h(EnvironmentCard, { label: "Active", data: data.active }),
      h(EnvironmentCard, { label: "Preview", data: data.preview }),
    ),
  );
}

function EnvironmentCard({ label, data }) {
  return h(
    "div",
    { className: `env-card ${data.tone}` },
    h("p", { className: "label" }, label),
    h("strong", null, data.version),
    h("span", null, data.health),
  );
}

function SloMetrics({ service, series }) {
  return h(
    "section",
    { className: "slo-panel", "aria-label": `${service} SLO metrics` },
    h("div", { className: "section-head" }, h("p", { className: "label" }, "SLO metrics"), h("strong", null, "live + PromQL mock")),
    h(
      "div",
      { className: "charts" },
      h(MiniChart, {
        data: series,
        dataKey: "errorRate",
        title: "Error rate",
        suffix: "%",
        stroke: "#087f5b",
      }),
      h(MiniChart, {
        data: series,
        dataKey: "p99",
        title: "p99 latency",
        suffix: "ms",
        stroke: "#146c94",
      }),
    ),
  );
}

function MiniChart({ data, dataKey, title, suffix, stroke }) {
  return h(
    "div",
    { className: "chart-card" },
    h("div", { className: "chart-title" }, h("span", null, title), h("strong", null, `${data.at(-1)[dataKey]}${suffix}`)),
    h(
      ResponsiveContainer,
      { width: "100%", height: 132 },
      h(
        LineChart,
        { data, margin: { top: 8, right: 10, bottom: 0, left: -22 } },
        h(CartesianGrid, { stroke: "#d8e0e7", strokeDasharray: "3 3" }),
        h(XAxis, { dataKey: "time", tick: { fill: "#637381", fontSize: 11 }, tickLine: false, axisLine: false }),
        h(YAxis, { tick: { fill: "#637381", fontSize: 11 }, tickLine: false, axisLine: false }),
        h(Tooltip, {
          contentStyle: {
            background: "#18222d",
            border: "1px solid #2c3b49",
            borderRadius: 8,
            color: "#e9f2f5",
          },
          formatter: (value) => [`${value}${suffix}`, title],
        }),
        h(Line, { type: "monotone", dataKey, stroke, strokeWidth: 3, dot: false, activeDot: { r: 4 } }),
      ),
    ),
  );
}

function TimelinePanel({ environment, envData }) {
  const combinedSteps = envData.checkout.timeline.map((checkoutStep, index) => ({
    name: checkoutStep[0],
    checkout: checkoutStep,
    payments: envData.payments.timeline[index],
  }));

  return h(
    "section",
    { className: "timeline-panel", "aria-label": "Deployment timeline" },
    h(
      "div",
      { className: "section-head" },
      h("div", null, h("p", { className: "label" }, "Deployment timeline"), h("h2", null, `${environment} release flow`)),
      h("span", { className: "pill ok" }, "Git synced"),
    ),
    h(
      "div",
      { className: "stepper" },
      combinedSteps.map((step) =>
        h(
          "div",
          { key: step.name, className: "step" },
          h("span", { className: `step-dot ${step.checkout[2]}` }),
          h("strong", null, step.name),
          h("small", null, `checkout ${step.checkout[1]}`),
          h("small", null, `payments ${step.payments[1]}`),
        ),
      ),
    ),
    h(RollbackLog, { items: envData.rollbacks }),
  );
}

function RollbackLog({ items }) {
  return h(
    "details",
    { className: "rollback-log" },
    h("summary", null, "Rollback history"),
    h(
      "div",
      { className: "rollback-items" },
      items.map((item) =>
        h(
          "article",
          { key: `${item.at}-${item.service}`, className: "rollback-item" },
          h("div", null, h("strong", null, item.service), h("span", null, item.at)),
          h("p", null, item.reason),
        ),
      ),
    ),
  );
}

function RawJsonPanel({ lastCheck, payload }) {
  return h(
    "details",
    { className: "activity" },
    h(
      "summary",
      null,
      h("div", null, h("p", { className: "label" }, "Last check"), h("h2", null, lastCheck)),
      h("span", null, "Raw JSON status"),
    ),
    h("pre", null, JSON.stringify(payload, null, 2)),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
