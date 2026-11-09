/**
 * dsh-deepseek-usage — browser half.
 *
 * A hand-written `__ModuleLoader__` bundle (no build step). It contributes:
 *
 *   1. a sidebar footer shortcut ("用量") that opens an in-app usage page;
 *   2. the usage page itself, registered in the frame-wide `shell.overlay`
 *      layer — the same cards, filters and hourly spend chart the DeepSeek
 *      Platform usage page shows, rendered with Host theme tokens;
 *   3. a double-click hot zone in the bottom-right corner of the window that
 *      opens the same page.
 *
 * Data comes from the Host half's loopback endpoint
 * `GET /api/deepseek-usage/overview`; the browser never sees the account
 * credential or any raw Platform response.
 */
window.__ModuleLoader__.load({
  id: "dsh-deepseek-usage",
  factory: (require) => {
    const React = require("react");
    const { jsx, jsxs } = require("react/jsx-runtime");

    /** Locale namespace of this plugin. */
    const NS = "dsh-deepseek-usage";

    /** Chinese copy (the user's primary language). */
    const zh = {
      "action.label": "用量",
      "action.short": "用量",
      "action.title": "查看 DeepSeek 用量（也可双击窗口右下角）",
      "panel.title": "用量信息",
      "panel.subtitle": "所有日期均按 {tz} 时间显示，数据可能有 5 分钟延迟。",
      "panel.close": "关闭",
      "balance.label": "充值余额",
      "balance.bonus": "赠送余额",
      "balance.topUp": "去充值",
      "balance.alertOn": "余额预警已开启",
      "balance.alertOff": "余额预警未开启",
      "total.label": "累计消费金额",
      "filter.range": "时间维度",
      "filter.key": "API Key",
      "filter.all": "全部",
      "filter.clear": "清除筛选条件",
      "filter.export": "导出",
      "filter.exportEmpty": "暂无可导出的用量数据",
      "stat.cost": "消费金额",
      "stat.requests": "API 请求次数",
      "stat.tokens": "Tokens",
      "chart.title": "消费金额",
      "chart.mode.type": "调用类型",
      "chart.mode.key": "API Key",
      "chart.model": "模型调用",
      "chart.function": "工具调用",
      "chart.empty": "所选时间范围内暂无用量数据",
      "chart.axisMoney": "金额",
      "range.today": "今天",
      "range.yesterday": "昨天",
      "range.7d": "近 7 天",
      "range.30d": "近 30 天",
      "range.month": "本月",
      "action.refresh": "刷新",
      "action.openPlatform": "在平台打开",
      "action.more": "更多操作",
      "state.loading": "正在读取用量…",
      "state.signedOut.title": "未登录 DeepSeek 账号",
      "state.signedOut.body": "用量信息来自 DeepSeek 平台账号。请在「设置 → 账号与余额」中登录 DeepSeek 账号后重试。",
      "state.error.title": "用量读取失败",
      "state.error.body": "无法读取 DeepSeek 平台用量，请稍后重试。",
      "state.error.retry": "重试",
      "state.partial": "用量明细暂时不可用，当前仅显示账户余额与累计消费。",
      "state.updated": "更新于 {time}",
      "key.unknown": "未知 Key",
      "unit.cny": "CNY",
      "unit.usd": "USD"
    };

    /** English copy. */
    const en = {
      "action.label": "Usage",
      "action.short": "Usage",
      "action.title": "View DeepSeek usage (or double-click the bottom-right corner)",
      "panel.title": "Usage",
      "panel.subtitle": "All dates use {tz} time; data may lag by 5 minutes.",
      "panel.close": "Close",
      "balance.label": "Balance",
      "balance.bonus": "Bonus",
      "balance.topUp": "Top up",
      "balance.alertOn": "Low-balance alert on",
      "balance.alertOff": "Low-balance alert off",
      "total.label": "Total spent",
      "filter.range": "Period",
      "filter.key": "API key",
      "filter.all": "All",
      "filter.clear": "Clear filters",
      "filter.export": "Export",
      "filter.exportEmpty": "No usage data to export",
      "stat.cost": "Spend",
      "stat.requests": "API requests",
      "stat.tokens": "Tokens",
      "chart.title": "Spend",
      "chart.mode.type": "Call type",
      "chart.mode.key": "API key",
      "chart.model": "Model calls",
      "chart.function": "Tool calls",
      "chart.empty": "No usage in the selected period",
      "chart.axisMoney": "Amount",
      "range.today": "Today",
      "range.yesterday": "Yesterday",
      "range.7d": "Last 7 days",
      "range.30d": "Last 30 days",
      "range.month": "This month",
      "action.refresh": "Refresh",
      "action.openPlatform": "Open in Platform",
      "action.more": "More actions",
      "state.loading": "Loading usage…",
      "state.signedOut.title": "Not signed in to DeepSeek",
      "state.signedOut.body":
        "Usage comes from your DeepSeek Platform account. Sign in from Settings → Account & balance, then try again.",
      "state.error.title": "Could not load usage",
      "state.error.body": "DeepSeek Platform usage is unavailable right now. Try again shortly.",
      "state.error.retry": "Retry",
      "state.partial": "Usage details are temporarily unavailable; showing account balance and total spend only.",
      "state.updated": "Updated {time}",
      "key.unknown": "Unknown key",
      "unit.cny": "CNY",
      "unit.usd": "USD"
    };

    /** Active translate function, bound by `apply`. */
    let translate = (key) => key;

    /**
     * Translate one key with `{name}` interpolation.
     * @param {string} key locale key.
     * @param {Record<string, string|number>} [params] interpolation values.
     * @returns {string} localized text.
     */
    function T(key, params) {
      let text;
      try {
        text = translate(key);
      } catch {
        text = key;
      }
      if (typeof text !== "string" || text === "" || text === key) text = zh[key] ?? key;
      if (params !== undefined) {
        for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
      }
      return text;
    }

    //#region styles
    const triggerCss = `
      .dsu-trigger{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:28px;padding:4px 7px;box-sizing:border-box;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;cursor:pointer;white-space:nowrap}
      .dsu-trigger:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}
      .dsu-trigger:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
      .dsu-triggerIcon{display:block;flex:none}
      .dsu-settingsAction{display:inline-flex;align-items:center;gap:6px;height:28px;padding:0 9px;font:inherit;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);background:transparent;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;cursor:pointer;white-space:nowrap}
      .dsu-settingsAction:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
      .dsu-settingsAction:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
    `;

    const panelCss = `
      .dsu-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(15,23,42,.42);pointer-events:auto}
      .dsu-panel{display:flex;flex-direction:column;width:min(980px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:hidden;box-sizing:border-box;border-radius:16px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);box-shadow:0 24px 64px rgba(0,0,0,.28)}
      .dsu-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:22px 24px 12px;flex:none}
      .dsu-headText{min-width:0}
      .dsu-title{margin:0;font-size:20px;line-height:28px;font-weight:600;letter-spacing:-.2px}
      .dsu-sub{margin:6px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
      .dsu-headActions{display:flex;align-items:center;gap:8px;flex:none}
      .dsu-iconBtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}
      .dsu-iconBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
      .dsu-linkBtn{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 8px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);background:transparent;border:none;border-radius:6px;cursor:pointer;text-decoration:none;white-space:nowrap}
      .dsu-linkBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
      .dsu-body{overflow-y:auto;padding:4px 24px 24px;flex:1}
      .dsu-cards{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .dsu-card{display:flex;flex-direction:column;justify-content:space-between;gap:12px;min-height:112px;box-sizing:border-box;padding:16px 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
      .dsu-cardTop{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:18px}
      .dsu-cardLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
      .dsu-cardValueRow{display:flex;align-items:baseline;gap:8px;min-width:0}
      .dsu-big{font-size:30px;line-height:36px;font-weight:600;letter-spacing:-.6px;font-variant-numeric:tabular-nums}
      .dsu-unit{font-size:12px;color:var(--dsw-alias-label-secondary);letter-spacing:.02em}
      .dsu-cardFoot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .dsu-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary)}
      .dsu-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary);flex:none}
      .dsu-tag[data-on="true"]{color:var(--dsw-alias-state-success-primary)}
      .dsu-tag[data-on="true"] .dsu-dot{background:var(--dsw-alias-state-success-primary);box-shadow:0 0 6px color-mix(in srgb,var(--dsw-alias-state-success-primary) 60%,transparent)}
      .dsu-primary{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 14px;font:inherit;font-size:12px;font-weight:600;color:var(--dsw-alias-bg-layer-1);background:var(--dsw-alias-label-primary);border:1px solid transparent;border-radius:8px;cursor:pointer;text-decoration:none;white-space:nowrap}
      .dsu-primary:hover{opacity:.88}
      .dsu-filterRow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:18px 0 14px}
      .dsu-field{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-layer-2);font-size:12px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
      .dsu-field select{appearance:none;-webkit-appearance:none;border:none;outline:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:0 16px 0 2px;cursor:pointer;max-width:180px;background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 6px) 52%,calc(100% - 2px) 52%;background-size:4px 4px,4px 4px;background-repeat:no-repeat}
      .dsu-field select option{background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary)}
      .dsu-textBtn{height:32px;padding:0 8px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);background:transparent;border:none;border-radius:8px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
      .dsu-textBtn:hover{color:var(--dsw-alias-label-primary)}
      .dsu-textBtn:disabled{opacity:.45;cursor:default;text-decoration:none}
      .dsu-spacer{flex:1 1 auto}
      .dsu-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .dsu-stat{box-sizing:border-box;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
      .dsu-statLabel{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
      .dsu-statValue{display:flex;align-items:baseline;gap:6px;margin-top:8px;font-size:26px;line-height:32px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.4px;overflow-wrap:anywhere}
      .dsu-chartCard{margin-top:14px;padding:16px 18px 12px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-layer-2)}
      .dsu-chartHead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .dsu-chartTitle{display:flex;align-items:baseline;gap:8px;font-size:13px;font-weight:600}
      .dsu-chartValue{font-size:13px;font-weight:500;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
      .dsu-seg{display:inline-flex;align-items:center;gap:2px;padding:2px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base)}
      .dsu-segBtn{height:26px;padding:0 10px;font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary);background:transparent;border:none;border-radius:7px;cursor:pointer;white-space:nowrap}
      .dsu-segBtn[data-active="true"]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
      .dsu-chartWrap{position:relative;margin-top:10px}
      .dsu-chartSvg{display:block;width:100%;height:auto;overflow:visible}
      .dsu-axis{font-size:10px;fill:var(--dsw-alias-label-secondary)}
      .dsu-gridLine{stroke:var(--dsw-alias-border-l1);stroke-width:1;shape-rendering:crispEdges}
      .dsu-legend{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:8px;padding-left:4px}
      .dsu-legendItem{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-secondary)}
      .dsu-legendDot{width:8px;height:8px;border-radius:2px;flex:none}
      .dsu-emptyChart{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--dsw-alias-label-secondary);pointer-events:none}
      .dsu-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:56px 24px;text-align:center}
      .dsu-stateTitle{font-size:15px;line-height:22px;font-weight:600}
      .dsu-stateBody{max-width:460px;font-size:12px;line-height:19px;color:var(--dsw-alias-label-secondary)}
      .dsu-warn{display:flex;align-items:center;gap:8px;margin:0 0 12px;padding:9px 12px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warn-primary);border:1px solid color-mix(in srgb,var(--dsw-alias-state-warn-primary) 32%,transparent);border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent)}
      .dsu-foot{margin:12px 0 0;font-size:11px;line-height:16px;color:var(--dsw-alias-label-secondary);text-align:right}
      .dsu-loading{display:flex;align-items:center;justify-content:center;gap:8px;padding:64px 16px;font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dsu-spinner{width:14px;height:14px;border-radius:50%;border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-label-secondary);animation:dsuSpin .8s linear infinite}
      @keyframes dsuSpin{to{transform:rotate(360deg)}}
      @media (max-width:720px){.dsu-cards,.dsu-stats{grid-template-columns:1fr}.dsu-panel{width:calc(100vw - 20px);max-height:calc(100vh - 20px)}.dsu-backdrop{padding:10px}.dsu-head{padding:16px 16px 10px}.dsu-body{padding:4px 16px 18px}}
      @media (prefers-reduced-motion:reduce){.dsu-spinner{animation:none}}
    `;
    //#endregion

    //#region store
    /** Shared open/selection state for the trigger, the page and the hot zone. */
    let state = {
      open: false,
      range: "today",
      chartMode: "type",
      keyFilter: "all",
      data: null,
      error: null,
      loading: false,
      loadedRange: null,
      fetchedAt: 0
    };

    const listeners = new Set();

    /** Publish a partial state update. */
    function setState(patch) {
      state = { ...state, ...patch };
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch {
          /* a broken subscriber must not break the page */
        }
      }
    }

    function subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }

    function getSnapshot() {
      return state;
    }

    /** Subscribe one component to the shared state. */
    function useAppState() {
      const [snapshot, setSnapshot] = React.useState(getSnapshot);
      React.useEffect(() => subscribe(() => setSnapshot(getSnapshot())), []);
      return snapshot;
    }

    /**
     * Error boundary around the page so a render failure shows a readable
     * fallback instead of silently disappearing from the overlay slot.
     */
    class UsageBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error) {
        try {
          console.error("[dsh-deepseek-usage]", error);
        } catch {
          /* diagnostics must never mask the fallback */
        }
      }

      render() {
        if (this.state.error === null) return this.props.children;
        const error = this.state.error;
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error && typeof error.stack === "string" ? error.stack : "";
        const detail = stack === "" ? message : `${message}\n\n${stack}`;
        const box = {
          position: "fixed",
          inset: 0,
          zIndex: 2147483000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          background: "rgba(15,23,42,.55)"
        };
        const panel = {
          width: "min(900px, calc(100vw - 48px))",
          maxHeight: "calc(100vh - 48px)",
          overflow: "auto",
          boxSizing: "border-box",
          padding: "18px 20px",
          borderRadius: 12,
          background: "var(--dsw-alias-bg-layer-1, #ffffff)",
          color: "var(--dsw-alias-label-primary, #111111)",
          boxShadow: "0 24px 64px rgba(0,0,0,.35)",
          font: "inherit"
        };
        const button = {
          height: 30,
          padding: "0 12px",
          marginRight: 8,
          font: "inherit",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--dsw-alias-bg-layer-1, #ffffff)",
          background: "var(--dsw-alias-label-primary, #111111)",
          border: "none",
          borderRadius: 8,
          cursor: "pointer"
        };
        const secondary = { ...button, color: "var(--dsw-alias-label-primary, #111111)", background: "transparent", border: "1px solid var(--dsw-alias-border-l2, #d0d0d0)" };
        return jsxs("div", {
          style: box,
          children: jsxs("div", {
            style: panel,
            role: "alertdialog",
            children: [
              jsx("div", { style: { fontSize: 15, fontWeight: 600, marginBottom: 6 }, children: "用量页面渲染失败 / Usage page failed to render" }),
              jsx("div", { style: { fontSize: 12, lineHeight: "19px", color: "var(--dsw-alias-label-secondary, #666)" }, children: "请把下面的错误详情发给 Agent 以便定位。 / Send the details below to the agent." }),
              jsx("pre", { style: { margin: "10px 0 14px", padding: 10, borderRadius: 8, background: "rgba(127,127,127,.14)", fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-all", maxHeight: 360, overflow: "auto", textAlign: "left" }, children: detail }),
              jsxs("div", {
                children: [
                  jsx("button", {
                    type: "button",
                    style: button,
                    onClick: () => {
                      const text = detail;
                      try {
                        if (navigator.clipboard?.writeText) {
                          navigator.clipboard.writeText(text).then(() => this.setState({ copied: true }), () => {});
                        }
                      } catch {
                        /* clipboard is best effort */
                      }
                    },
                    children: this.state.copied === true ? "已复制 / Copied" : "复制错误详情 / Copy details"
                  }),
                  jsx("button", { type: "button", style: secondary, onClick: closeUsage, children: "关闭 / Close" })
                ]
              })
            ]
          })
        });
      }
    }

    /** Registered overlay entry: boundary plus the page. */
    function UsagePage() {
      return jsx(UsageBoundary, { children: jsx(UsagePanel, {}) });
    }

    function openUsage() {
      setState({ open: true });
    }

    function closeUsage() {
      setState({ open: false });
    }
    //#endregion

    //#region data
    const RANGE_IDS = ["today", "yesterday", "7d", "30d", "month"];

    /** Unix seconds of local midnight for a shifted (UTC) calendar date. */
    function localMidnightSeconds(year, month, day, tz) {
      return Date.UTC(year, month, day) / 1000 - tz;
    }

    /**
     * Compute the requested window. The browser owns calendar boundaries so the
     * page labels dates in the viewer's own timezone.
     * @param {string} rangeId one of RANGE_IDS.
     * @param {Date} [now] current instant.
     * @returns {{start:number,end:number,tz:number}} unix seconds and offset.
     */
    function rangeBounds(rangeId, now = new Date()) {
      const tz = -now.getTimezoneOffset() * 60;
      const shifted = new Date(now.getTime() + tz * 1000);
      const year = shifted.getUTCFullYear();
      const month = shifted.getUTCMonth();
      const day = shifted.getUTCDate();
      const todayStart = localMidnightSeconds(year, month, day, tz);
      switch (rangeId) {
        case "yesterday":
          return { start: todayStart - 86400, end: todayStart, tz };
        case "7d":
          return { start: todayStart - 6 * 86400, end: todayStart + 86400, tz };
        case "30d":
          return { start: todayStart - 29 * 86400, end: todayStart + 86400, tz };
        case "month":
          return { start: localMidnightSeconds(year, month, 1, tz), end: todayStart + 86400, tz };
        case "today":
        default:
          return { start: todayStart, end: todayStart + 86400, tz };
      }
    }

    /** Human readable GMT offset such as `GMT+8`. */
    function timezoneLabel(tz) {
      const sign = tz >= 0 ? "+" : "-";
      const abs = Math.abs(tz);
      const hours = Math.floor(abs / 3600);
      const minutes = Math.floor((abs % 3600) / 60);
      return `GMT${sign}${hours}${minutes === 0 ? "" : `:${String(minutes).padStart(2, "0")}`}`;
    }

    /** Local hour/minute label for one bucket timestamp. */
    function hourLabel(time, tz) {
      const date = new Date((time + tz) * 1000);
      return `${String(date.getUTCHours()).padStart(2, "0")}:00`;
    }

    /** Local month-day label for one daily bucket timestamp. */
    function dayLabel(time, tz) {
      const date = new Date((time + tz) * 1000);
      return `${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
    }

    /** Local `MM-DD HH:mm` label. */
    function localStamp(time, tz) {
      const date = new Date((time + tz) * 1000);
      const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(date.getUTCDate()).padStart(2, "0");
      const hh = String(date.getUTCHours()).padStart(2, "0");
      const mi = String(date.getUTCMinutes()).padStart(2, "0");
      return `${mm}-${dd} ${hh}:${mi}`;
    }

    /** Format a money amount; positive amounts truncate to cents like Platform. */
    function money(value, currency) {
      const amount = typeof value === "number" ? value : Number(value);
      const safe = Number.isFinite(amount) ? amount : 0;
      const subCent = safe !== 0 && Math.abs(safe) < 0.01;
      const display = !subCent && safe > 0 ? Math.floor(safe * 100) / 100 : safe;
      const text = new Intl.NumberFormat("zh-CN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: subCent ? 4 : 2
      }).format(display);
      return `${currency === "USD" ? "$" : "¥"}${text}`;
    }

    /** Format an integer count with grouping. */
    function integer(value) {
      const amount = typeof value === "number" ? value : Number(value);
      return new Intl.NumberFormat("zh-CN").format(Number.isFinite(amount) ? Math.round(amount) : 0);
    }

    /** Short currency label. */
    function currencyUnit(currency) {
      return currency === "USD" ? T("unit.usd") : T("unit.cny");
    }

    /** Clamp a value to a finite number. */
    function finite(value) {
      const amount = typeof value === "number" ? value : Number(value);
      return Number.isFinite(amount) ? amount : 0;
    }

    /** Active UI language prefix, for Host-side Platform locale headers. */
    function languageTag() {
      const locale = typeof document !== "undefined" && typeof document.documentElement.lang === "string" ? document.documentElement.lang : "zh";
      return locale.toLowerCase().startsWith("en") ? "en" : "zh";
    }

    let requestSerial = 0;

    /**
     * Fetch the overview for the selected range.
     * @param {boolean} force bypass the fresh-result short circuit.
     */
    async function load(force) {
      const requestedRange = state.range;
      const bounds = rangeBounds(requestedRange);
      if (!force && state.data !== null && state.loadedRange === requestedRange && Date.now() - state.fetchedAt < 20000) return;
      const serial = ++requestSerial;
      setState({ loading: true, error: null });
      const params = new URLSearchParams({
        start: String(bounds.start),
        end: String(bounds.end),
        tz: String(bounds.tz),
        lang: languageTag()
      });
      if (force) params.set("refresh", "1");
      try {
        const response = await fetch(`/api/deepseek-usage/overview?${params.toString()}`, {
          headers: { accept: "application/json" },
          cache: "no-store",
          credentials: "same-origin"
        });
        const payload = await response.json();
        if (serial !== requestSerial) return;
        if (payload === null || typeof payload !== "object" || payload.ok !== true) {
          setState({
            loading: false,
            data: null,
            loadedRange: requestedRange,
            fetchedAt: Date.now(),
            error: typeof payload?.error === "string" ? payload.error : "network"
          });
          return;
        }
        const keys = Array.isArray(payload.usage?.keys) ? payload.usage.keys : [];
        const keyFilter = state.keyFilter !== "all" && !keys.some((key) => key.id === state.keyFilter) ? "all" : state.keyFilter;
        setState({
          loading: false,
          data: payload,
          loadedRange: requestedRange,
          fetchedAt: Date.now(),
          keyFilter,
          error: payload.partial === true ? payload.error ?? "usage-unavailable" : null
        });
      } catch {
        if (serial !== requestSerial) return;
        setState({ loading: false, loadedRange: requestedRange, fetchedAt: Date.now(), error: "network" });
      }
    }

    /** Totals limited to one API key (or all keys). */
    function totalsFor(usage, keyFilter) {
      if (keyFilter === "all" || usage === null) return usage?.totals ?? null;
      const totals = { cost: 0, modelCost: 0, functionCost: 0, tokens: 0, requests: 0, cacheHit: 0, cacheMiss: 0, responseTokens: 0 };
      for (const bucket of usage.buckets ?? []) {
        const entry = bucket.keys?.[keyFilter];
        if (entry === undefined) continue;
        for (const field of Object.keys(totals)) totals[field] += finite(entry[field]);
      }
      return totals;
    }

    /** CSV export of the currently visible buckets. */
    function exportCsv(data, keyFilter) {
      const usage = data?.usage;
      if (usage === null || usage === undefined) return;
      const currency = usage.currency ?? data.account?.currency ?? "CNY";
      const tz = data.range?.tz ?? rangeBounds(state.range).tz;
      const keys = Array.isArray(usage.keys) ? usage.keys : [];
      const nameOf = (id) => keys.find((key) => key.id === id)?.name ?? id;
      const rows = [["time_local", "api_key", `cost_${currency}`, "tokens", "requests"]];
      for (const bucket of usage.buckets ?? []) {
        const ids = keyFilter === "all" ? Object.keys(bucket.keys ?? {}) : [keyFilter];
        if (ids.length === 0) {
          rows.push([localStamp(bucket.time, tz), "", String(bucket.cost ?? 0), String(bucket.tokens ?? 0), String(bucket.requests ?? 0)]);
          continue;
        }
        for (const id of ids) {
          const entry = bucket.keys?.[id];
          if (entry === undefined) continue;
          rows.push([localStamp(bucket.time, tz), nameOf(id), String(entry.cost ?? 0), String(entry.tokens ?? 0), String(entry.requests ?? 0)]);
        }
      }
      const csv = rows.map((row) => row.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell)).join(",")).join("\r\n");
      const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `deepseek-usage-${state.range}-${localStamp(data.range?.start ?? Date.now() / 1000, tz).replace(/[: ]/g, "")}.csv`;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    //#endregion

    //#region components
    /** Small bar-chart glyph used by the sidebar shortcut. */
    function UsageIcon(props) {
      const size = props.size ?? 14;
      return jsx("svg", {
        viewBox: "0 0 16 16",
        width: size,
        height: size,
        className: "dsu-triggerIcon",
        "aria-hidden": "true",
        focusable: "false",
        children: [
          jsx("rect", { x: 2, y: 9, width: 2.6, height: 5, rx: 1, fill: "currentColor" }, "a"),
          jsx("rect", { x: 6.7, y: 5, width: 2.6, height: 9, rx: 1, fill: "currentColor" }, "b"),
          jsx("rect", { x: 11.4, y: 2, width: 2.6, height: 12, rx: 1, fill: "currentColor" }, "c")
        ]
      });
    }

    /** Sidebar footer shortcut; opens the in-app page. */
    function UsageTrigger(props) {
      const t = typeof props.t === "function" ? props.t : T;
      const wide = props.wide === true;
      const label = t("action.label");
      return jsx(React.Fragment, {
        children: [
          jsx("style", { children: triggerCss }, "style"),
          jsx(
            "button",
            {
              type: "button",
              className: "dsu-trigger",
              title: t("action.title"),
              "aria-label": t("action.title"),
              onClick: openUsage,
              children: [
                jsx(UsageIcon, { size: 14 }, "icon"),
                wide ? jsx("span", { children: label }, "label") : null
              ]
            },
            "button"
          )
        ]
      });
    }

    /** Settings header shortcut; appears next to Close while Settings is open. */
    function SettingsUsageAction(props) {
      const t = typeof props.t === "function" ? props.t : T;
      return jsx(React.Fragment, {
        children: [
          jsx("style", { children: triggerCss }, "style"),
          jsx(
            "button",
            {
              type: "button",
              className: "dsu-settingsAction",
              title: t("action.title"),
              onClick: openUsage,
              children: [
                jsx(UsageIcon, { size: 13 }, "icon"),
                jsx("span", { children: t("action.label") }, "label")
              ]
            },
            "button"
          )
        ]
      });
    }

    /** Circular arrow glyph for refresh. */
    function RefreshIcon() {
      return jsx("svg", {
        viewBox: "0 0 16 16",
        width: 14,
        height: 14,
        "aria-hidden": "true",
        focusable: "false",
        children: [
          jsx("path", { d: "M13 8a5 5 0 1 1-1.5-3.55", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" }, "arc"),
          jsx("path", { d: "M13.2 2.6v3.2H10", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }, "head")
        ]
      });
    }

    /** Close glyph. */
    function CloseIcon() {
      return jsx("svg", {
        viewBox: "0 0 16 16",
        width: 14,
        height: 14,
        "aria-hidden": "true",
        focusable: "false",
        children: jsx("path", { d: "M3.5 3.5l9 9m0-9l-9 9", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" })
      });
    }

    /** Round the chart maximum up to a readable value. */
    function niceCeil(value) {
      if (!(value > 0)) return 0.01;
      const exponent = Math.floor(Math.log10(value));
      const base = 10 ** exponent;
      const scaled = value / base;
      const step = scaled <= 1 ? 1 : scaled <= 2 ? 2 : scaled <= 5 ? 5 : 10;
      return step * base;
    }

    /** Stacked hourly/daily spend chart drawn with plain SVG. */
    function UsageChart(props) {
      const t = props.t;
      const usage = props.usage;
      const series = props.series;
      const tz = props.tz;
      const currency = props.currency;
      const width = 780;
      const height = 232;
      const pad = { left: 56, right: 10, top: 14, bottom: 26 };
      const plotWidth = width - pad.left - pad.right;
      const plotHeight = height - pad.top - pad.bottom;
      const buckets = Array.isArray(usage?.buckets) ? usage.buckets : [];
      const count = buckets.length;
      const maxTotal = Math.max(
        0,
        ...buckets.map((_, index) => series.reduce((sum, item) => sum + finite(item.values[index]), 0))
      );
      const top = niceCeil(maxTotal);
      const empty = !(maxTotal > 0);
      const y = (value) => pad.top + plotHeight - (value / top) * plotHeight;
      const slot = count > 0 ? plotWidth / count : plotWidth;
      const barWidth = Math.max(2, Math.min(26, slot * 0.58));
      const bucketSeconds = finite(usage?.bucket) || (count <= 2 ? 3600 : finite(usage?.buckets?.[1]?.time) - finite(usage?.buckets?.[0]?.time) || 3600);
      const hourly = bucketSeconds < 86400;
      const tickIndexes = [];
      if (count > 0) {
        const ticks = count <= 4 ? count : 4;
        for (let index = 0; index < ticks; index += 1) tickIndexes.push(index === ticks - 1 ? count - 1 : Math.round((index * (count - 1)) / (ticks - 1)));
      }
      const uniqueTicks = [...new Set(tickIndexes)];
      const labelOf = (index) => {
        const time = buckets[index]?.time ?? 0;
        return hourly ? hourLabel(time, tz) : dayLabel(time, tz);
      };
      const axisRows = [1, 0.5, 0];
      return jsxs("div", {
        className: "dsu-chartWrap",
        children: [
          jsxs("svg", {
            className: "dsu-chartSvg",
            viewBox: `0 0 ${width} ${height}`,
            role: "img",
            "aria-label": `${t("chart.title")} ${currencyUnit(currency)}`,
            children: [
              ...axisRows.map((ratio) =>
                jsx(
                  "g",
                  {
                    children: [
                      jsx("line", { x1: pad.left, x2: width - pad.right, y1: y(top * ratio), y2: y(top * ratio), className: "dsu-gridLine" }, "line"),
                      jsx("text", {
                        x: pad.left - 8,
                        y: y(top * ratio) + 3,
                        textAnchor: "end",
                        className: "dsu-axis",
                        children: ratio === 0 ? "0" : money(top * ratio, currency).replace(/^[¥$]/, "")
                      }, "label")
                    ]
                  },
                  `axis-${ratio}`
                )
              ),
              ...buckets.map((bucket, index) => {
                const x = pad.left + index * slot + (slot - barWidth) / 2;
                let base = 0;
                const rects = [];
                for (const item of series) {
                  const value = finite(item.values[index]);
                  if (!(value > 0)) continue;
                  const y0 = y(base);
                  const y1 = y(base + value);
                  base += value;
                  rects.push(
                    jsx(
                      "rect",
                      {
                        x,
                        y: y1,
                        width: barWidth,
                        height: Math.max(1, y0 - y1),
                        fill: item.color,
                        rx: Math.min(3, barWidth / 3),
                        children: jsx("title", {
                          children: `${labelOf(index)} · ${item.label} ${money(value, currency)}`
                        })
                      },
                      item.label
                    )
                  );
                }
                return jsx("g", { children: rects }, bucket.time);
              }),
              ...uniqueTicks.map((index) =>
                jsx("text", {
                  x: pad.left + index * slot + slot / 2,
                  y: height - 8,
                  textAnchor: "middle",
                  className: "dsu-axis",
                  children: labelOf(index)
                }, `x-${index}`)
              )
            ]
          }),
          empty ? jsx("div", { className: "dsu-emptyChart", children: t("chart.empty") }) : null,
          jsx("div", {
            className: "dsu-legend",
            children: series.map((item) =>
              jsxs(
                "span",
                {
                  className: "dsu-legendItem",
                  children: [
                    jsx("span", { className: "dsu-legendDot", style: { background: item.color } }),
                    jsx("span", { children: item.label })
                  ]
                },
                item.label
              )
            )
          })
        ]
      });
    }

    /** Balance + total-spent cards. */
    function AccountCards(props) {
      const t = props.t;
      const data = props.data;
      const account = data.account ?? {};
      const currency = account.currency ?? "CNY";
      const total = Array.isArray(account.totalCosts) ? account.totalCosts.find((entry) => entry.currency === currency) ?? account.totalCosts[0] : null;
      const alert = account.balanceAlert;
      const origin = data.origin ?? "https://platform.deepseek.com";
      const bonus = finite(account.bonus);
      return jsxs("div", {
        className: "dsu-cards",
        children: [
          jsxs("div", {
            className: "dsu-card",
            children: [
              jsxs("div", {
                className: "dsu-cardTop",
                children: [
                  jsx("span", { className: "dsu-cardLabel", children: t("balance.label") }),
                  alert === null || alert === undefined
                    ? null
                    : jsxs("span", { className: "dsu-tag", "data-on": alert.enabled === true ? "true" : "false", children: [
                        jsx("span", { className: "dsu-dot" }),
                        jsx("span", { children: alert.enabled === true ? t("balance.alertOn") : t("balance.alertOff") })
                      ] })
                ]
              }),
              jsxs("div", {
                className: "dsu-cardFoot",
                children: [
                  jsxs("div", {
                    className: "dsu-cardValueRow",
                    children: [
                      jsx("span", { className: "dsu-big", children: money(account.balance, currency) }),
                      jsx("span", { className: "dsu-unit", children: currencyUnit(currency) })
                    ]
                  }),
                  jsx("a", {
                    className: "dsu-primary",
                    href: `${origin}/top_up`,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    children: t("balance.topUp")
                  })
                ]
              }),
              bonus > 0
                ? jsx("div", { className: "dsu-tag", children: `${t("balance.bonus")} ${money(bonus, currency)}` })
                : null
            ]
          }),
          jsxs("div", {
            className: "dsu-card",
            children: [
              jsx("div", { className: "dsu-cardTop", children: jsx("span", { className: "dsu-cardLabel", children: t("total.label") }) }),
              jsxs("div", {
                className: "dsu-cardValueRow",
                children: [
                  jsx("span", { className: "dsu-big", children: money(total?.amount ?? 0, currency) }),
                  jsx("span", { className: "dsu-unit", children: currencyUnit(currency) })
                ]
              })
            ]
          })
        ]
      });
    }

    /** Filter row: range, API key, clear and export. */
    function FilterRow(props) {
      const t = props.t;
      const data = props.data;
      const app = props.app;
      const usage = data.usage;
      const keys = Array.isArray(usage?.keys) ? usage.keys : [];
      const canClear = app.range !== "today" || app.keyFilter !== "all";
      const canExport = usage !== null && usage !== undefined && Array.isArray(usage.buckets);
      return jsxs("div", {
        className: "dsu-filterRow",
        children: [
          jsxs("label", {
            className: "dsu-field",
            children: [
              jsx("span", { children: t("filter.range") }),
              jsx("select", {
                value: app.range,
                onChange: (event) => setState({ range: event.target.value }),
                children: RANGE_IDS.map((id) => jsx("option", { value: id, children: t(`range.${id}`) }, id))
              })
            ]
          }),
          jsxs("label", {
            className: "dsu-field",
            children: [
              jsx("span", { children: t("filter.key") }),
              jsx("select", {
                value: app.keyFilter,
                onChange: (event) => setState({ keyFilter: event.target.value }),
                children: [
                  jsx("option", { value: "all", children: t("filter.all") }, "all"),
                  ...keys.map((key) => jsx("option", { value: key.id, children: key.name }, key.id))
                ]
              })
            ]
          }),
          jsx("button", {
            type: "button",
            className: "dsu-textBtn",
            disabled: !canClear,
            onClick: () => setState({ range: "today", keyFilter: "all" }),
            children: t("filter.clear")
          }),
          jsx("span", { className: "dsu-spacer" }),
          jsx("button", {
            type: "button",
            className: "dsu-primary",
            disabled: !canExport,
            title: canExport ? t("filter.export") : t("filter.exportEmpty"),
            onClick: () => exportCsv(data, app.keyFilter),
            children: t("filter.export")
          })
        ]
      });
    }

    /** Cost / requests / tokens stat cards. */
    function StatCards(props) {
      const t = props.t;
      const totals = props.totals;
      const currency = props.currency;
      return jsxs("div", {
        className: "dsu-stats",
        children: [
          jsxs("div", {
            className: "dsu-stat",
            children: [
              jsx("div", { className: "dsu-statLabel", children: t("stat.cost") }),
              jsxs("div", { className: "dsu-statValue", children: [
                jsx("span", { children: money(totals?.cost ?? 0, currency) }),
                jsx("span", { className: "dsu-unit", children: currencyUnit(currency) })
              ] })
            ]
          }),
          jsxs("div", {
            className: "dsu-stat",
            children: [
              jsx("div", { className: "dsu-statLabel", children: t("stat.requests") }),
              jsx("div", { className: "dsu-statValue", children: jsx("span", { children: integer(totals?.requests ?? 0) }) })
            ]
          }),
          jsxs("div", {
            className: "dsu-stat",
            children: [
              jsx("div", { className: "dsu-statLabel", children: t("stat.tokens") }),
              jsx("div", { className: "dsu-statValue", children: jsx("span", { children: integer(totals?.tokens ?? 0) }) })
            ]
          })
        ]
      });
    }

    /** Chart card with call-type / API-key grouping. */
    function ChartCard(props) {
      const t = props.t;
      const data = props.data;
      const app = props.app;
      const usage = data.usage;
      const totals = props.totals;
      const currency = usage?.currency ?? data.account?.currency ?? "CNY";
      const tz = data.range?.tz ?? 0;
      const buckets = Array.isArray(usage?.buckets) ? usage.buckets : [];
      const palette = ["#f97316", "#fb7185", "#a78bfa", "#38bdf8", "#34d399", "#facc15", "#f472b6", "#94a3b8"];
      const keyFilter = app.keyFilter;
      let series;
      if (app.chartMode === "key") {
        const keys = (usage?.keys ?? []).filter((key) => keyFilter === "all" || key.id === keyFilter);
        series = keys.map((key, index) => ({
          label: key.name,
          color: palette[index % palette.length],
          values: buckets.map((bucket) => finite(bucket.keys?.[key.id]?.cost))
        }));
      } else if (keyFilter === "all") {
        series = [
          { label: t("chart.model"), color: palette[0], values: buckets.map((bucket) => finite(bucket.modelCost)) },
          { label: t("chart.function"), color: "#fbbf24", values: buckets.map((bucket) => finite(bucket.functionCost)) }
        ];
      } else {
        series = [
          { label: t("chart.model"), color: palette[0], values: buckets.map((bucket) => finite(bucket.keys?.[keyFilter]?.modelCost)) },
          { label: t("chart.function"), color: "#fbbf24", values: buckets.map((bucket) => finite(bucket.keys?.[keyFilter]?.functionCost)) }
        ];
      }
      if (series.length === 0) series = [{ label: t("chart.model"), color: palette[0], values: buckets.map(() => 0) }];
      return jsxs("div", {
        className: "dsu-chartCard",
        children: [
          jsxs("div", {
            className: "dsu-chartHead",
            children: [
              jsxs("div", {
                className: "dsu-chartTitle",
                children: [
                  jsx("span", { children: `${t("chart.title")} (${currencyUnit(currency)})` }),
                  jsx("span", { className: "dsu-chartValue", children: money(totals?.cost ?? 0, currency) })
                ]
              }),
              jsxs("div", {
                className: "dsu-seg",
                role: "group",
                "aria-label": t("chart.title"),
                children: [
                  jsx("button", {
                    type: "button",
                    className: "dsu-segBtn",
                    "data-active": app.chartMode === "type" ? "true" : "false",
                    onClick: () => setState({ chartMode: "type" }),
                    children: t("chart.mode.type")
                  }),
                  jsx("button", {
                    type: "button",
                    className: "dsu-segBtn",
                    "data-active": app.chartMode === "key" ? "true" : "false",
                    onClick: () => setState({ chartMode: "key" }),
                    children: t("chart.mode.key")
                  })
                ]
              })
            ]
          }),
          jsx(UsageChart, { t, usage, series, tz, currency })
        ]
      });
    }

    /** Loading, error and signed-out states. */
    function StateBlock(props) {
      const t = props.t;
      if (props.kind === "loading") {
        return jsxs("div", {
          className: "dsu-loading",
          children: [jsx("span", { className: "dsu-spinner" }), jsx("span", { children: t("state.loading") })]
        });
      }
      const signedOut = props.kind === "signed-out";
      return jsxs("div", {
        className: "dsu-state",
        children: [
          jsx("div", { className: "dsu-stateTitle", children: signedOut ? t("state.signedOut.title") : t("state.error.title") }),
          jsx("div", { className: "dsu-stateBody", children: signedOut ? t("state.signedOut.body") : t("state.error.body") }),
          signedOut
            ? null
            : jsx("button", { type: "button", className: "dsu-primary", onClick: () => load(true), children: t("state.error.retry") })
        ]
      });
    }

    /** The in-app usage page, mounted in the frame-wide overlay layer. */
    function UsagePanel(props) {
      const t = typeof props.t === "function" ? props.t : T;
      const app = useAppState();
      const { open, data, error, loading, range } = app;

      React.useEffect(() => {
        if (!open) return undefined;
        load(false);
        return undefined;
      }, [open, range]);

      React.useEffect(() => {
        if (!open) return undefined;
        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            closeUsage();
          }
        };
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
      }, [open]);

      if (!open) return null;

      const bounds = data?.range ?? rangeBounds(range);
      const tz = bounds.tz;
      const account = data?.account ?? null;
      const usage = data?.usage ?? null;
      const totals = totalsFor(usage, app.keyFilter);
      const signedOut = error === "signed-out" || error === "account-unavailable";
      const origin = data?.origin ?? "https://platform.deepseek.com";
      const updated = data?.updatedAt ?? app.fetchedAt;
      const updatedText = updated > 0 ? new Date(updated).toLocaleTimeString("zh-CN", { hour12: false }) : "";

      let body;
      if (signedOut) {
        body = jsx(StateBlock, { t, kind: "signed-out" });
      } else if (loading && data === null) {
        body = jsx(StateBlock, { t, kind: "loading" });
      } else if (data === null) {
        body = jsx(StateBlock, { t, kind: "error" });
      } else {
        body = jsxs(React.Fragment, {
          children: [
            account !== null ? jsx(AccountCards, { t, data }) : null,
            usage === null
              ? jsx("div", { className: "dsu-warn", style: { marginTop: "16px" }, children: t("state.partial") })
              : jsxs(React.Fragment, {
                  children: [
                    jsx(FilterRow, { t, data, app }),
                    jsx(StatCards, { t, totals, currency: usage.currency ?? account?.currency ?? "CNY" }),
                    jsx(ChartCard, { t, data, app, totals })
                  ]
                }),
            updatedText === "" ? null : jsx("p", { className: "dsu-foot", children: t("state.updated", { time: `${dayLabel(updated / 1000, tz)} ${updatedText}` }) })
          ]
        });
      }

      return jsx(React.Fragment, {
        children: [
          jsx("style", { children: panelCss }, "style"),
          jsx("div", {
            className: "dsu-backdrop",
            onMouseDown: (event) => {
              if (event.target === event.currentTarget) closeUsage();
            },
            children: jsxs("div", {
              className: "dsu-panel",
              role: "dialog",
              "aria-modal": "true",
              "aria-label": t("panel.title"),
              children: [
                jsxs("div", {
                  className: "dsu-head",
                  children: [
                    jsxs("div", {
                      className: "dsu-headText",
                      children: [
                        jsx("h2", { className: "dsu-title", children: t("panel.title") }),
                        jsx("p", { className: "dsu-sub", children: t("panel.subtitle", { tz: timezoneLabel(tz) }) })
                      ]
                    }),
                    jsxs("div", {
                      className: "dsu-headActions",
                      children: [
                        jsx("button", {
                          type: "button",
                          className: "dsu-iconBtn",
                          title: t("action.refresh"),
                          "aria-label": t("action.refresh"),
                          disabled: loading,
                          onClick: () => load(true),
                          children: jsx(RefreshIcon, {})
                        }),
                        jsx("a", {
                          className: "dsu-linkBtn",
                          href: `${origin}/usage`,
                          target: "_blank",
                          rel: "noopener noreferrer",
                          children: t("action.openPlatform")
                        }),
                        jsx("button", {
                          type: "button",
                          className: "dsu-iconBtn",
                          title: t("panel.close"),
                          "aria-label": t("panel.close"),
                          onClick: closeUsage,
                          children: jsx(CloseIcon, {})
                        })
                      ]
                    })
                  ]
                }),
                jsx("div", { className: "dsu-body", children: body })
              ]
            })
          }, "backdrop")
        ]
      });
    }
    //#endregion

    //#region plugin body
    /** Services required by the client plugin body. */
    const inject = ["slots", "locale"];

    /**
     * Client plugin body: register the dictionaries, the sidebar shortcut, the
     * frame-wide page and the bottom-right double-click hot zone.
     * @param {object} ctx client root context.
     */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "deepseek-usage: dictionaries");
      translate = ctx.locale.bind(NS);

      ctx.slots.inject("sidebar.footer.action", () =>
        ctx.slots.register(
          {
            name: "sidebar.footer.action",
            id: "deepseek-usage",
            order: 30,
            locale: NS,
            label: () => T("action.label")
          },
          UsageTrigger
        )
      );

      ctx.slots.inject("settings.action", () =>
        ctx.slots.register(
          {
            name: "settings.action",
            id: "deepseek-usage.settings",
            order: 10,
            locale: NS,
            label: () => T("action.label")
          },
          SettingsUsageAction
        )
      );

      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: "deepseek-usage.page",
            order: 200,
            locale: NS
          },
          UsagePage
        )
      );

      ctx.effect(() => {
        // The bottom-right corner belongs to the floating balance whale widget:
        // a double-click on its non-interactive body opens this page. Interactive
        // controls (buttons, inputs, links) inside the corner keep their behavior.
        const edge = 200;
        const corner = 44;
        const isInteractive = (target) => {
          let node = target;
          for (let depth = 0; node && depth < 8; depth += 1) {
            if (node instanceof Element) {
              const tag = node.tagName.toLowerCase();
              if (tag === "button" || tag === "a" || tag === "input" || tag === "textarea" || tag === "select" || tag === "summary") return true;
              if (node.isContentEditable) return true;
              const role = node.getAttribute("role");
              if (role === "button" || role === "textbox" || role === "menuitem" || role === "switch") return true;
            }
            node = node.parentElement;
          }
          return false;
        };
        const onDoubleClick = (event) => {
          if (event.defaultPrevented || event.button !== 0) return;
          if (event.clientX < window.innerWidth - edge) return;
          if (event.clientY < window.innerHeight - edge) return;
          const exactCorner = event.clientX >= window.innerWidth - corner && event.clientY >= window.innerHeight - corner;
          if (!exactCorner && isInteractive(event.target)) return;
          event.preventDefault();
          openUsage();
        };
        window.addEventListener("dblclick", onDoubleClick, true);
        return () => window.removeEventListener("dblclick", onDoubleClick, true);
      }, "deepseek-usage: bottom-right double click");
    }
    //#endregion

    return { inject, apply, __debug: { UsagePage, UsagePanel, UsageBoundary, openUsage, closeUsage, setState, load } };
  }
});
