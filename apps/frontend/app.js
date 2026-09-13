const { useEffect, useMemo, useState } = React;
const {
  CartesianGrid,
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

function App() {
  const [environment, setEnvironment] = useState("dev");
  const [serviceState, setServiceState] = useState({});
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

    setServiceState(next);
    setLastCheck(new Date().toLocaleString());
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => clearInterval(timer);
  }, []);

  const envData = environments[environment];
  const payload = useMemo(
    () => ({
      environment,
      lastCheck,
      checkout: serviceState.checkout?.root || serviceState.checkout || {},
      payments: serviceState.payments?.root || serviceState.payments || {},
      rollout: envData,
    }),
    [environment, envData, lastCheck, serviceState],
  );

  return h(
    "main",
    { className: "shell" },
    h(
      "header",
      { className: "topbar" },
      h(
        "div",
        null,
        h("p", { className: "eyebrow" }, "GitOps runtime"),
        h("h1", null, "DriftGuard"),
      ),
      h(
        "div",
        { className: "top-actions" },
        h(EnvironmentTabs, { current: environment, onChange: setEnvironment }),
        h(
          "button",
          { className: "icon-button", type: "button", "aria-label": "Refresh services", onClick: refresh },
          h("span", { "aria-hidden": "true" }, "↻"),
        ),
      ),
    ),
    h(
      "section",
      { className: "status-grid", "aria-label": "Service status" },
      h(ServicePanel, {
        config: services[0],
        envData: envData.checkout,
        state: serviceState.checkout,
      }),
      h(ServicePanel, {
        config: services[1],
        envData: envData.payments,
        state: serviceState.payments,
      }),
    ),
    h(TimelinePanel, { environment, envData }),
    h(RawJsonPanel, { lastCheck, payload }),
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
