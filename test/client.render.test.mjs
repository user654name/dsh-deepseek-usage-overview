/**
 * Client-half render tests.
 *
 * The browser bundle is loaded exactly the way the Harness page loads it
 * (`window.__ModuleLoader__.load`), then rendered with the real React 18 build
 * that the Harness ships. This catches the class of bug that once crashed the
 * page in the development jsx-runtime: a `jsx()`/`jsxs()` call with no props
 * object ("Cannot read properties of undefined (reading 'key')").
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const jsxRuntime = require("react/jsx-runtime");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clientCode = fs.readFileSync(path.join(repoRoot, "client.js"), "utf8");

/** Load the browser bundle and return its module exports. */
function loadClient() {
	let definition;
	globalThis.window = {
		innerWidth: 1600,
		innerHeight: 1000,
		addEventListener() {},
		removeEventListener() {},
		__ModuleLoader__: {
			load(value) {
				definition = value;
			}
		}
	};
	globalThis.document = { documentElement: { lang: "zh-CN" } };
	vm.runInThisContext(clientCode, { filename: "client.js" });
	const module = definition.factory((id) => {
		if (id === "react") return React;
		if (id === "react/jsx-runtime") return jsxRuntime;
		throw new Error(`Unexpected module: ${id}`);
	});
	const registrations = {};
	module.apply({
		effect(fn) {
			fn();
		},
		locale: {
			register() {},
			bind() {
				return (key) => key;
			}
		},
		slots: {
			inject(name, register) {
				register();
			},
			register(options, component) {
				registrations[options.id] = component;
				return () => {};
			}
		}
	});
	return { module, registrations };
}

/** One representative overview payload. */
function payload() {
	const start = 1_794_153_600;
	const bucket = {
		time: start + 9 * 3600,
		cost: 2.03,
		modelCost: 2,
		functionCost: 0.03,
		tokens: 100,
		requests: 5,
		cacheHit: 60,
		cacheMiss: 20,
		responseTokens: 20,
		keys: {
			"key-1": { cost: 2.03, modelCost: 2, functionCost: 0.03, tokens: 100, requests: 5, cacheHit: 60, cacheMiss: 20, responseTokens: 20 }
		}
	};
	return {
		ok: true,
		origin: "https://platform.deepseek.com",
		updatedAt: Date.now(),
		range: { start, end: start + 86400, tz: 28_800, bucket: 3600 },
		account: {
			currency: "CNY",
			balance: "11.79",
			bonus: "0",
			wallets: [],
			bonusWallets: [],
			totalCosts: [{ currency: "CNY", amount: "266.87" }],
			balanceAlert: { enabled: true, alertBound: "5" }
		},
		usage: {
			currency: "CNY",
			bucket: 3600,
			totals: { cost: 2.03, modelCost: 2, functionCost: 0.03, tokens: 100, requests: 5, cacheHit: 60, cacheMiss: 20, responseTokens: 20 },
			keys: [{ id: "key-1", name: "DeepSeek Harness", keyType: "DSH", cost: 2.03, tokens: 100, requests: 5 }],
			buckets: [bucket]
		}
	};
}

/** Render the registered overlay page and return the HTML. */
function renderPage(module, t = (key) => `T:${key}`) {
	return ReactDOMServer.renderToStaticMarkup(React.createElement(module.__debug.UsagePage, { t }));
}

const { module, registrations } = loadClient();

test("bundle registers the three UI entry points", () => {
	assert.deepEqual(Object.keys(registrations).sort(), ["deepseek-usage", "deepseek-usage.page", "deepseek-usage.settings"]);
});

test("every jsx()/jsxs() call passes a props object", () => {
	// Regression: jsx(SomeComponent) crashed the development jsx-runtime.
	const bareCall = /\bjsxs?\(\s*(?:React\.)?[A-Za-z_$][\w$.]*\s*\)/;
	assert.equal(bareCall.test(clientCode), false);
});

test("renders the empty open state", () => {
	module.__debug.openUsage();
	const html = renderPage(module);
	assert.match(html, /用量信息/);
	assert.match(html, /dsu-backdrop/);
	assert.match(html, /dsu-panel/);
});

test("renders loaded data with cards, filters and chart", () => {
	module.__debug.setState({
		data: payload(),
		loading: false,
		loadedRange: "today",
		fetchedAt: Date.now(),
		error: null
	});
	const html = renderPage(module);
	assert.match(html, /充值余额/);
	assert.match(html, /累计消费金额/);
	assert.match(html, /dsu-cards/);
	assert.match(html, /dsu-filterRow/);
	assert.match(html, /dsu-stats/);
	assert.match(html, /dsu-chartSvg/);
	assert.match(html, /DeepSeek Harness/);
	assert.match(html, /¥/);
});

test("renders a filtered API-key view and the per-key chart mode", () => {
	module.__debug.openUsage();
	module.__debug.setState({ keyFilter: "key-1", chartMode: "key" });
	const html = renderPage(module);
	assert.match(html, /dsu-chartSvg/);
	assert.match(html, /dsu-legendItem/);
});

test("renders the signed-out state", () => {
	module.__debug.openUsage();
	module.__debug.setState({ data: null, loading: false, error: "signed-out" });
	const html = renderPage(module);
	assert.match(html, /未登录 DeepSeek 账号/);
});

test("the error boundary is a React class component", () => {
	const boundary = module.__debug.UsageBoundary;
	assert.equal(typeof boundary.prototype.render, "function");
	assert.equal(typeof boundary.getDerivedStateFromError, "function");
});
