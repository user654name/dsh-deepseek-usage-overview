/**
 * dsh-deepseek-usage-overview — host half.
 *
 * Serves one read-only, loopback-only JSON endpoint for the in-app usage page:
 *
 *   GET /api/deepseek-usage/overview
 *       ?start=<unix seconds>&end=<unix seconds>&tz=<seconds east of UTC>
 *       [&lang=zh|en][&refresh=1]
 *
 * The endpoint resolves the signed-in DeepSeek account grant through the Host
 * `deepseekAccount` service and queries the same private Platform endpoints the
 * Platform usage page itself calls:
 *
 *   GET {origin}/api/v0/users/get_user_summary      recharge/bonus wallets + total spend
 *   GET {origin}/auth-api/v0/users/current          currency + balance-alert setting
 *   GET {origin}/api/v0/usage/by_api_key/amount     per-key/per-model token buckets
 *   GET {origin}/api/v0/usage/by_api_key/cost       per-key/per-model spend buckets
 *
 * The browser receives aggregated numbers only: the account token, deployment
 * headers and raw Platform payloads never leave the Host. Every request is
 * fenced to a loopback peer socket, is GET-only, and is cached briefly so the
 * page and the double-click shortcut cannot hammer Platform.
 *
 * @module dsh-deepseek-usage-overview
 */

/** Stable Cordis plugin name. */
export const name = "deepseek-usage";

/** Services required before this plugin activates. */
export const inject = ["webServer"];

/** Exact loopback-only route owned by this plugin. */
export const OVERVIEW_PATH = "/api/deepseek-usage/overview";

const UPSTREAM_TIMEOUT_MS = 15000;
const CACHE_TTL_MS = 30000;
const MAX_RANGE_SECONDS = 366 * 86400;
const CLIENT_VERSION = "0.2.2-rc.1";
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

/** Thrown when Platform rejects the stored grant. */
class AccountAuthError extends Error {
	constructor(message) {
		super(message);
		this.name = "AccountAuthError";
	}
}

/** Thrown when Platform answers with an unexpected status or envelope. */
class UpstreamError extends Error {
	constructor(message) {
		super(message);
		this.name = "UpstreamError";
	}
}

/** Write one JSON response. */
function json(res, status, value) {
	const body = JSON.stringify(value);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"cache-control": "no-store"
	});
	res.end(body);
}

/**
 * Loopback fence, primary on the peer socket address rather than the
 * client-controllable Host header.
 * @param {unknown} address peer socket address.
 * @returns {boolean} whether the address is a loopback interface.
 */
export function isLoopbackAddress(address) {
	if (typeof address !== "string") return false;
	const a = address.toLowerCase();
	if (a === "::1") return true;
	const ipv4 = a.startsWith("::ffff:") ? a.slice(7) : a;
	const octets = ipv4.split(".");
	return octets.length === 4 && octets[0] === "127" && octets.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

/** Parse a Host header without breaking bracketed or bare IPv6 literals. */
function hostNameOf(value) {
	if (typeof value !== "string") return null;
	const host = value.trim().toLowerCase();
	if (host.startsWith("[")) {
		const close = host.indexOf("]");
		if (close <= 1) return null;
		const suffix = host.slice(close + 1);
		if (suffix !== "" && !/^:\d+$/.test(suffix)) return null;
		return host.slice(1, close);
	}
	const firstColon = host.indexOf(":");
	const lastColon = host.lastIndexOf(":");
	if (firstColon !== lastColon) return host;
	if (lastColon === -1) return host.replace(/\.$/, "");
	if (!/^\d+$/.test(host.slice(lastColon + 1))) return null;
	return host.slice(0, lastColon).replace(/\.$/, "");
}

function isLoopbackHostHeader(req) {
	const name = hostNameOf(req.headers.host);
	return name === "localhost" || isLoopbackAddress(name);
}

/**
 * Refuse non-loopback callers and non-GET methods before doing any work.
 * @returns {boolean} whether the request was rejected.
 */
export function rejectForeignCaller(req, res) {
	if (req.method !== "GET") {
		json(res, 405, { ok: false, error: "method-not-allowed" });
		return true;
	}
	const peer = req.socket?.remoteAddress;
	if (isLoopbackAddress(peer) && isLoopbackHostHeader(req)) return false;
	json(res, 403, { ok: false, error: "forbidden" });
	return true;
}

/** Read one integer query parameter. */
function intParam(params, key) {
	const raw = params.get(key);
	if (typeof raw !== "string" || raw.trim() === "" || !/^-?\d{1,15}$/.test(raw.trim())) return null;
	const value = Number(raw);
	return Number.isSafeInteger(value) ? value : null;
}

/**
 * Validate the requested reporting window. The browser owns local-calendar
 * boundaries and its timezone offset because it renders the dates.
 * @param {URLSearchParams} params query parameters.
 * @returns {{ ok: true, start: number, end: number, tz: number } | { ok: false, error: string }}
 */
export function parseRange(params) {
	const start = intParam(params, "start");
	const end = intParam(params, "end");
	const tz = intParam(params, "tz");
	if (start === null || end === null) return { ok: false, error: "invalid-range" };
	if (tz === null || tz < -86400 || tz > 86400) return { ok: false, error: "invalid-tz" };
	if (end <= start) return { ok: false, error: "invalid-range" };
	if (end - start > MAX_RANGE_SECONDS) return { ok: false, error: "range-too-large" };
	return { ok: true, start, end, tz };
}

/** Read a Platform client locale label (`zh_CN` or `en_US`). */
function wireLocale(lang) {
	return typeof lang === "string" && lang.toLowerCase().startsWith("zh") ? "zh_CN" : "en_US";
}

/**
 * Build the request headers the embedded Platform page composes: deployment
 * headers from the Host session, the account token, and the five client
 * identity headers.
 */
export function platformHeaders(session, tz, lang) {
	const requestHeaders = session?.requestHeaders !== null && typeof session?.requestHeaders === "object" ? session.requestHeaders : {};
	return {
		...requestHeaders,
		"x-dsh-auth-token": session.token,
		accept: "application/json",
		"x-client-bundle-id": "",
		"x-client-platform": "web",
		"x-client-version": CLIENT_VERSION,
		"x-client-locale": wireLocale(lang),
		"x-client-timezone-offset": String(tz)
	};
}

/** Read one bounded JSON Platform response, translating auth failures. */
async function platformGet(origin, path, headers) {
	let response;
	try {
		response = await fetch(new URL(path, origin), {
			method: "GET",
			headers,
			redirect: "error",
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
		});
	} catch (error) {
		throw new UpstreamError(`network: ${error instanceof Error ? error.name : "error"}`);
	}
	if (response.status === 401 || response.status === 403) throw new AccountAuthError("rejected");
	if (!response.ok) throw new UpstreamError(`http-${response.status}`);
	const text = await response.text();
	if (text.length > MAX_RESPONSE_BYTES) throw new UpstreamError("response-too-large");
	let payload;
	try {
		payload = JSON.parse(text);
	} catch {
		throw new UpstreamError("invalid-json");
	}
	const code = payload?.code;
	if (typeof code === "number" && code !== 0) {
		if (code === 40002 || code === 40003) throw new AccountAuthError("rejected");
		throw new UpstreamError(`code-${code}`);
	}
	const bizCode = payload?.data?.biz_code;
	if (typeof bizCode === "number" && bizCode !== 0) {
		if (bizCode === 40002 || bizCode === 40003) throw new AccountAuthError("rejected");
		throw new UpstreamError(`biz-code-${bizCode}`);
	}
	return payload;
}

/** Coerce a Platform numeric scalar (string, number or null) to a finite number. */
function num(value) {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

/** Read the string amount of one usage entry. */
function scalarString(value) {
	if (typeof value === "string") return value;
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return null;
}

/** Identity of an API key series. */
function keyIdentity(apiKey) {
	if (typeof apiKey === "string" && apiKey.trim() !== "") {
		return { id: apiKey.trim(), name: apiKey.trim(), keyType: "" };
	}
	if (apiKey === null || typeof apiKey !== "object") return { id: "unknown", name: "unknown", keyType: "" };
	const trackingId = typeof apiKey.tracking_id === "string" ? apiKey.tracking_id.trim() : "";
	const name = typeof apiKey.name === "string" ? apiKey.name.trim() : "";
	const id = trackingId !== "" ? trackingId : name !== "" ? name : "unknown";
	return { id, name: name !== "" ? name : id, keyType: typeof apiKey.key_type === "string" ? apiKey.key_type : "" };
}

/** One empty bucket aggregate. */
function emptyBucket(time) {
	return {
		time,
		cost: 0,
		modelCost: 0,
		functionCost: 0,
		tokens: 0,
		requests: 0,
		cacheHit: 0,
		cacheMiss: 0,
		responseTokens: 0,
		keys: {}
	};
}

/** Ensure one bucket holds an aggregate for one key. */
function bucketKey(bucket, key) {
	let entry = bucket.keys[key.id];
	if (entry === undefined) {
		entry = { cost: 0, modelCost: 0, functionCost: 0, tokens: 0, requests: 0, cacheHit: 0, cacheMiss: 0, responseTokens: 0 };
		bucket.keys[key.id] = entry;
	}
	return entry;
}

/** Ensure one key total. */
function keyTotal(totals, key) {
	let entry = totals.get(key.id);
	if (entry === undefined) {
		entry = { id: key.id, name: key.name, keyType: key.keyType, cost: 0, tokens: 0, requests: 0 };
		totals.set(key.id, entry);
	}
	return entry;
}

/**
 * Pick the cost currency block that matches the account currency, otherwise
 * the first block carrying spend.
 */
function pickCostBlock(blocks, currency) {
	if (!Array.isArray(blocks) || blocks.length === 0) return null;
	const preferred = typeof currency === "string" && currency !== "" ? blocks.find((block) => block?.currency === currency) : undefined;
	if (preferred !== undefined) return preferred;
	const spending = blocks.find((block) => (block?.series ?? []).some((series) => (series?.buckets ?? []).some((bucket) => num(bucket?.cost) !== 0)));
	if (spending !== undefined) return spending;
	return blocks[0];
}

/**
 * Fold Platform amount/cost payloads into chart buckets and totals.
 * Exported for offline unit tests.
 * @param {object} input payloads and requested window.
 * @returns {object} aggregated usage view.
 */
export function aggregateUsage({ amount, cost, range, currency }) {
	const amountBiz = amount?.data?.biz_data;
	const costBiz = cost?.data?.biz_data;
	const amountSeries = Array.isArray(amountBiz?.series) ? amountBiz.series : [];
	const functionAmountSeries = Array.isArray(amountBiz?.function_series) ? amountBiz.function_series : [];
	const costBlock = pickCostBlock(costBiz?.data, currency);
	const costSeries = Array.isArray(costBlock?.series) ? costBlock.series : [];
	const functionCostSeries = Array.isArray(costBlock?.function_series) ? costBlock.function_series : [];

	const start = range.start;
	const end = range.end;
	const rawBucket = Number(amountBiz?.bucket ?? costBiz?.bucket);
	const bucketSeconds = Number.isFinite(rawBucket) && rawBucket > 0 ? Math.trunc(rawBucket) : end - start <= 2 * 86400 ? 3600 : 86400;
	const bucketCount = Math.min(2000, Math.max(1, Math.ceil((end - start) / bucketSeconds)));

	const buckets = [];
	const byTime = new Map();
	for (let index = 0; index < bucketCount; index += 1) {
		const time = start + index * bucketSeconds;
		if (time >= end) break;
		const bucket = emptyBucket(time);
		buckets.push(bucket);
		byTime.set(time, bucket);
	}

	const keyTotals = new Map();
	const totals = {
		cost: 0,
		modelCost: 0,
		functionCost: 0,
		tokens: 0,
		requests: 0,
		cacheHit: 0,
		cacheMiss: 0,
		responseTokens: 0
	};

	/** Locate the bucket that owns one timestamp (clamped into the window). */
	function bucketAt(time) {
		const exact = byTime.get(time);
		if (exact !== undefined) return exact;
		const index = Math.floor((time - start) / bucketSeconds);
		if (index < 0 || index >= buckets.length) return null;
		return buckets[index];
	}

	for (const series of amountSeries) {
		const key = keyIdentity(series?.api_key);
		const total = keyTotal(keyTotals, key);
		for (const rawBucket of Array.isArray(series?.buckets) ? series.buckets : []) {
			const bucket = bucketAt(num(rawBucket?.time));
			if (bucket === null) continue;
			const usage = rawBucket?.usage;
			const cacheHit = num(usage?.PROMPT_CACHE_HIT_TOKEN);
			const cacheMiss = num(usage?.PROMPT_CACHE_MISS_TOKEN);
			const responseTokens = num(usage?.RESPONSE_TOKEN);
			const requests = num(usage?.REQUEST);
			const tokens = cacheHit + cacheMiss + responseTokens;
			const keyBucket = bucketKey(bucket, key);
			bucket.cacheHit += cacheHit;
			bucket.cacheMiss += cacheMiss;
			bucket.responseTokens += responseTokens;
			bucket.tokens += tokens;
			bucket.requests += requests;
			keyBucket.cacheHit += cacheHit;
			keyBucket.cacheMiss += cacheMiss;
			keyBucket.responseTokens += responseTokens;
			keyBucket.tokens += tokens;
			keyBucket.requests += requests;
			total.tokens += tokens;
			total.requests += requests;
			totals.cacheHit += cacheHit;
			totals.cacheMiss += cacheMiss;
			totals.responseTokens += responseTokens;
			totals.tokens += tokens;
			totals.requests += requests;
		}
	}

	for (const series of functionAmountSeries) {
		const key = keyIdentity(series?.api_key);
		keyTotal(keyTotals, key);
	}

	function addCost(seriesList, isFunction) {
		for (const series of seriesList) {
			const key = keyIdentity(series?.api_key);
			const total = keyTotal(keyTotals, key);
			for (const rawBucket of Array.isArray(series?.buckets) ? series.buckets : []) {
				const bucket = bucketAt(num(rawBucket?.time));
				if (bucket === null) continue;
				const cost_ = num(rawBucket?.cost);
				const keyBucket = bucketKey(bucket, key);
				bucket.cost += cost_;
				keyBucket.cost += cost_;
				total.cost += cost_;
				totals.cost += cost_;
				if (isFunction) {
					bucket.functionCost += cost_;
					keyBucket.functionCost += cost_;
					totals.functionCost += cost_;
				} else {
					bucket.modelCost += cost_;
					keyBucket.modelCost += cost_;
					totals.modelCost += cost_;
				}
			}
		}
	}

	addCost(costSeries, false);
	addCost(functionCostSeries, true);

	return {
		bucket: bucketSeconds,
		currency: typeof costBlock?.currency === "string" && costBlock.currency !== "" ? costBlock.currency : currency,
		totals,
		keys: [...keyTotals.values()].sort((a, b) => b.cost - a.cost),
		buckets
	};
}

/** Read the wallet list from a user summary payload. */
function walletsOf(list) {
	if (!Array.isArray(list)) return [];
	return list
		.filter((wallet) => wallet !== null && typeof wallet === "object" && typeof wallet.currency === "string")
		.map((wallet) => ({ currency: wallet.currency, balance: scalarString(wallet.balance) ?? "0" }));
}

/**
 * Build the browser payload from already-fetched Platform payloads.
 * Exported for offline unit tests.
 */
export function buildOverview({ summary, current, amount, cost, range, origin }) {
	const summaryBiz = summary?.data?.biz_data ?? {};
	const currentBiz = current?.data?.biz_data ?? {};
	const wallets = walletsOf(summaryBiz.normal_wallets);
	const bonusWallets = walletsOf(summaryBiz.bonus_wallets);
	const totalCosts = Array.isArray(summaryBiz.total_costs)
		? summaryBiz.total_costs
				.filter((entry) => entry !== null && typeof entry === "object" && typeof entry.currency === "string")
				.map((entry) => ({ currency: entry.currency, amount: scalarString(entry.amount) ?? "0" }))
		: [];
	const currency =
		typeof currentBiz.currency === "string" && currentBiz.currency !== "" ? currentBiz.currency : wallets[0]?.currency ?? "CNY";
	const balance = wallets.find((wallet) => wallet.currency === currency)?.balance ?? wallets[0]?.balance ?? "0";
	const bonus = bonusWallets.find((wallet) => wallet.currency === currency)?.balance ?? bonusWallets[0]?.balance ?? "0";
	const alert = currentBiz?.balance_alert?.[currency];
	const usage = aggregateUsage({ amount, cost, range, currency });
	return {
		ok: true,
		updatedAt: Date.now(),
		origin: typeof origin === "string" ? origin : "https://platform.deepseek.com",
		range: { start: range.start, end: range.end, tz: range.tz, bucket: usage.bucket },
		account: {
			currency,
			balance,
			bonus,
			wallets,
			bonusWallets,
			totalCosts,
			balanceAlert:
				alert !== null && typeof alert === "object" && typeof alert.enabled === "boolean"
					? { enabled: alert.enabled, alertBound: scalarString(alert.alert_bound) }
					: null
		},
		usage: {
			currency: usage.currency,
			bucket: usage.bucket,
			totals: usage.totals,
			keys: usage.keys,
			buckets: usage.buckets
		}
	};
}

/** One in-flight/cached overview read per query key. */
function createCache(ttlMs) {
	const entries = new Map();
	return {
		get(key) {
			const hit = entries.get(key);
			if (hit === undefined) return undefined;
			if (Date.now() - hit.at > ttlMs) {
				entries.delete(key);
				return undefined;
			}
			return hit.value;
		},
		set(key, value) {
			if (entries.size > 40) entries.clear();
			entries.set(key, { at: Date.now(), value });
		},
		clear() {
			entries.clear();
		}
	};
}

/**
 * Resolve the account session and fetch every Platform payload for one window.
 * @param {object} ctx plugin context.
 * @param {object} range validated window.
 * @param {string|undefined} lang active UI language.
 * @returns {Promise<object>} overview payload.
 */
export async function loadOverview(ctx, range, lang) {
	const account = ctx.get("deepseekAccount");
	if (account === undefined || account === null || typeof account.getPlatformSession !== "function") {
		return { ok: false, error: "account-unavailable" };
	}
	let session;
	try {
		session = await account.getPlatformSession();
	} catch {
		return { ok: false, error: "account-unavailable" };
	}
	if (session === null || typeof session.token !== "string" || session.token === "" || typeof session.origin !== "string") {
		return { ok: false, error: "signed-out" };
	}
	const origin = session.origin;
	const headers = platformHeaders(session, range.tz, lang);
	const usageQuery = `start=${range.start}&end=${range.end}&tz=${range.tz}`;
	const [summaryResult, currentResult, amountResult, costResult] = await Promise.all([
		platformGet(origin, "/api/v0/users/get_user_summary", headers)
			.then((value) => ({ ok: true, value }))
			.catch((error) => ({ ok: false, error })),
		platformGet(origin, "/auth-api/v0/users/current", headers)
			.then((value) => ({ ok: true, value }))
			.catch((error) => ({ ok: false, error })),
		platformGet(origin, `/api/v0/usage/by_api_key/amount?${usageQuery}`, headers)
			.then((value) => ({ ok: true, value }))
			.catch((error) => ({ ok: false, error })),
		platformGet(origin, `/api/v0/usage/by_api_key/cost?${usageQuery}`, headers)
			.then((value) => ({ ok: true, value }))
			.catch((error) => ({ ok: false, error }))
	]);
	if (summaryResult.ok === false && summaryResult.error instanceof AccountAuthError) return { ok: false, error: "signed-out" };
	if (!summaryResult.ok) return { ok: false, error: "upstream", detail: summaryResult.error.message };
	if (currentResult.ok === false && currentResult.error instanceof AccountAuthError) return { ok: false, error: "signed-out" };
	if (amountResult.ok === false && amountResult.error instanceof AccountAuthError) return { ok: false, error: "signed-out" };
	if (costResult.ok === false && costResult.error instanceof AccountAuthError) return { ok: false, error: "signed-out" };
	if (!amountResult.ok || !costResult.ok) {
		return {
			ok: true,
			partial: true,
			error: "usage-unavailable",
			origin,
			updatedAt: Date.now(),
			range,
			account: buildOverview({
				summary: summaryResult.value,
				current: currentResult.ok === true ? currentResult.value : null,
				amount: null,
				cost: null,
				range,
				origin
			}).account,
			usage: null
		};
	}
	const payload = buildOverview({
		summary: summaryResult.value,
		current: currentResult.ok === true ? currentResult.value : null,
		amount: amountResult.value,
		cost: costResult.value,
		range,
		origin
	});
	return payload;
}

/**
 * Plugin body: register the loopback-only overview route.
 * @param {object} ctx plugin context.
 */
export function apply(ctx) {
	const cache = createCache(CACHE_TTL_MS);
	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "exact",
				path: OVERVIEW_PATH,
				handler: async (req, res) => {
					if (rejectForeignCaller(req, res)) return;
					try {
						const url = new URL(req.url ?? OVERVIEW_PATH, "http://127.0.0.1");
						const range = parseRange(url.searchParams);
						if (range.ok === false) {
							json(res, 400, { ok: false, error: range.error });
							return;
						}
						const lang = url.searchParams.get("lang") ?? undefined;
						const cacheKey = `${range.start}|${range.end}|${range.tz}|${wireLocale(lang)}`;
						const force = url.searchParams.get("refresh") === "1";
						if (force === false) {
							const hit = cache.get(cacheKey);
							if (hit !== undefined) {
								json(res, 200, hit);
								return;
							}
						}
						const payload = await loadOverview(ctx, range, lang);
						if (payload.ok === true) cache.set(cacheKey, payload);
						json(res, 200, payload);
					} catch (error) {
						json(res, 500, { ok: false, error: "internal", detail: error instanceof Error ? error.message : String(error) });
					}
				}
			}),
		"deepseek-usage: overview route"
	);
}
