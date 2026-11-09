/**
 * Offline tests for the Host half of dsh-deepseek-usage-overview.
 *
 * These cover the pieces that must not regress: the loopback fence, query
 * validation, the Platform payload fold and the guarantee that the account
 * token never enters the browser payload.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
	aggregateUsage,
	buildOverview,
	isLoopbackAddress,
	parseRange,
	platformHeaders
} from "../index.js";

const RANGE = { start: 1_794_153_600, end: 1_794_240_000, tz: 28_800 };

/** Small Platform-shaped amount payload. */
function amountPayload() {
	return {
		code: 0,
		data: {
			biz_code: 0,
			biz_data: {
				start: RANGE.start,
				end: RANGE.end,
				bucket: 3600,
				models: ["deepseek-flash"],
				series: [
					{
						api_key: { tracking_id: "key-1", name: "DeepSeek Harness", key_type: "DSH" },
						model: "deepseek-flash",
						buckets: [
							{
								time: RANGE.start + 9 * 3600,
								usage: { RESPONSE_TOKEN: 100, REQUEST: 2, PROMPT_CACHE_HIT_TOKEN: 1000, PROMPT_CACHE_MISS_TOKEN: 10 }
							},
							{
								time: RANGE.start + 10 * 3600,
								usage: { RESPONSE_TOKEN: 50, REQUEST: 1, PROMPT_CACHE_HIT_TOKEN: 500, PROMPT_CACHE_MISS_TOKEN: 5 }
							}
						]
					}
				],
				function_series: [
					{
						api_key: { tracking_id: "key-1", name: "DeepSeek Harness", key_type: "DSH" },
						model: "server-tool-search",
						buckets: [{ time: RANGE.start + 9 * 3600, usage: { FUNCTION_CALL: 3 } }]
					}
				]
			}
		}
	};
}

/** Small Platform-shaped cost payload. */
function costPayload() {
	return {
		code: 0,
		data: {
			biz_code: 0,
			biz_data: {
				start: RANGE.start,
				end: RANGE.end,
				bucket: 3600,
				data: [
					{
						currency: "CNY",
						series: [
							{
								api_key: { tracking_id: "key-1", name: "DeepSeek Harness", key_type: "DSH" },
								model: "deepseek-flash",
								buckets: [
									{ time: RANGE.start + 9 * 3600, cost: "0.5" },
									{ time: RANGE.start + 10 * 3600, cost: "0.25" }
								]
							}
						],
						function_series: [
							{
								api_key: { tracking_id: "key-1", name: "DeepSeek Harness", key_type: "DSH" },
								model: "server-tool-search",
								buckets: [{ time: RANGE.start + 9 * 3600, cost: "0.125" }]
							}
						]
					}
				]
			}
		}
	};
}

/** Small Platform-shaped user summary payload. */
function summaryPayload() {
	return {
		code: 0,
		data: {
			biz_code: 0,
			biz_data: {
				normal_wallets: [{ currency: "CNY", balance: "13.04" }],
				bonus_wallets: [{ currency: "CNY", balance: "0" }],
				total_costs: [{ currency: "CNY", amount: "265.61" }]
			}
		}
	};
}

test("loopback fence accepts only loopback peer addresses", () => {
	assert.equal(isLoopbackAddress("127.0.0.1"), true);
	assert.equal(isLoopbackAddress("::1"), true);
	assert.equal(isLoopbackAddress("::ffff:127.0.0.1"), true);
	assert.equal(isLoopbackAddress("10.0.0.2"), false);
	assert.equal(isLoopbackAddress("192.168.1.5"), false);
	assert.equal(isLoopbackAddress(undefined), false);
});

test("parseRange validates the requested window", () => {
	const params = new URLSearchParams({ start: String(RANGE.start), end: String(RANGE.end), tz: String(RANGE.tz) });
	assert.deepEqual(parseRange(params), { ok: true, ...RANGE });
	assert.equal(parseRange(new URLSearchParams()).ok, false);
	assert.equal(parseRange(new URLSearchParams({ start: "10", end: "10", tz: "0" })).ok, false);
	assert.equal(parseRange(new URLSearchParams({ start: "20", end: "10", tz: "0" })).ok, false);
	assert.equal(parseRange(new URLSearchParams({ start: "0", end: "100", tz: "999999" })).ok, false);
	assert.equal(parseRange(new URLSearchParams({ start: "0", end: String(400 * 86400), tz: "0" })).ok, false);
});

test("aggregateUsage folds amount and cost into hourly buckets and totals", () => {
	const usage = aggregateUsage({
		amount: amountPayload(),
		cost: costPayload(),
		range: RANGE,
		currency: "CNY"
	});
	assert.equal(usage.bucket, 3600);
	assert.equal(usage.buckets.length, 24);
	assert.equal(usage.currency, "CNY");
	assert.equal(usage.totals.requests, 3);
	assert.equal(usage.totals.tokens, 1000 + 10 + 100 + 500 + 5 + 50);
	assert.equal(usage.totals.modelCost, 0.75);
	assert.equal(usage.totals.functionCost, 0.125);
	assert.equal(usage.totals.cost, 0.875);
	assert.equal(usage.keys.length, 1);
	assert.equal(usage.keys[0].name, "DeepSeek Harness");
	assert.equal(usage.keys[0].cost, 0.875);
	const busy = usage.buckets.find((bucket) => bucket.time === RANGE.start + 9 * 3600);
	assert.equal(busy.cost, 0.625);
	assert.equal(busy.keys["key-1"].modelCost, 0.5);
	assert.equal(busy.keys["key-1"].functionCost, 0.125);
});

test("aggregateUsage tolerates missing usage payloads", () => {
	const usage = aggregateUsage({ amount: null, cost: null, range: RANGE, currency: "CNY" });
	assert.equal(usage.totals.cost, 0);
	assert.equal(usage.totals.tokens, 0);
	assert.equal(usage.buckets.length, 24);
});

test("buildOverview exposes wallets, total spend and alert state without the token", () => {
	const overview = buildOverview({
		summary: summaryPayload(),
		current: {
			code: 0,
			data: {
				biz_code: 0,
				biz_data: { currency: "CNY", balance_alert: { CNY: { enabled: true, alert_bound: "5" }, USD: { enabled: false } } }
			}
		},
		amount: amountPayload(),
		cost: costPayload(),
		range: RANGE,
		origin: "https://platform.deepseek.com"
	});
	assert.equal(overview.ok, true);
	assert.equal(overview.origin, "https://platform.deepseek.com");
	assert.equal(overview.account.currency, "CNY");
	assert.equal(overview.account.balance, "13.04");
	assert.equal(overview.account.totalCosts[0].amount, "265.61");
	assert.deepEqual(overview.account.balanceAlert, { enabled: true, alertBound: "5" });
	assert.equal(overview.usage.totals.cost, 0.875);
	const serialized = JSON.stringify(overview);
	assert.equal(serialized.includes("secret-token"), false);
	assert.equal(serialized.includes("x-dsh-auth-token"), false);
	assert.equal(serialized.includes("x-client-"), false);
});

test("platformHeaders sends the account token and client identity headers last", () => {
	const session = {
		origin: "https://platform.deepseek.com",
		token: "secret-token",
		requestHeaders: { cookie: "deployment=1", "x-client-platform": "desktop-win" }
	};
	const headers = platformHeaders(session, RANGE.tz, "zh");
	assert.equal(headers["x-dsh-auth-token"], "secret-token");
	assert.equal(headers["x-client-platform"], "web");
	assert.equal(headers["x-client-locale"], "zh_CN");
	assert.equal(headers["x-client-timezone-offset"], "28800");
	assert.equal(headers.cookie, "deployment=1");
	assert.equal(headers["x-client-version"].length > 0, true);
});
