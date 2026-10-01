/**
 * k6 load test — Linkora Indexer search service
 *
 * Scenario: 100 concurrent virtual users, 5-minute ramp-up
 * Target:   P95 response time < 200 ms
 * Results:  Written to tests/load/results.json (uploaded as CI artifact,
 *           non-blocking — the job does not fail on threshold breach)
 *
 * Run locally:
 *   k6 run tests/load/search.js
 *
 * Run against a custom host:
 *   BASE_URL=https://indexer.example.com k6 run tests/load/search.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate, Counter } from "k6/metrics";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

/**
 * k6 scenario options.
 *
 * Stage breakdown:
 *   0:00 – 1:00  ramp from 0 → 100 VUs
 *   1:00 – 4:00  hold at 100 VUs (sustained load)
 *   4:00 – 5:00  ramp back down to 0 VUs
 */
export const options = {
  stages: [
    { duration: "1m", target: 100 }, // ramp up
    { duration: "3m", target: 100 }, // hold
    { duration: "1m", target: 0 }, //   ramp down
  ],

  thresholds: {
    // P95 response time target: < 200 ms (informational — not blocking CI)
    http_req_duration: ["p(95)<200"],
    // Error rate must stay below 5%
    http_req_failed: ["rate<0.05"],
  },

  // Write machine-readable results; CI uploads this as an artifact
  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

const searchResponseTime = new Trend("search_response_time", true);
const searchErrors = new Rate("search_error_rate");
const totalRequests = new Counter("total_requests");

// ---------------------------------------------------------------------------
// Seed data — representative Stellar addresses and post IDs used in queries.
// These are synthetic testnet-format addresses; replace with real fixtures
// when running against a seeded environment.
// ---------------------------------------------------------------------------

const SAMPLE_ADDRESSES = [
  "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  "GBOVQKJYHXRR3DX6NOX2RRYFRCUMSADGDESTDNBDS6CDVLGVESRTAC47",
  "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGGEWODYNTNTQEQXNFYUFEZ",
  "GC2PIUYXSD23OQMWEJIUHFW2NFBDJTM5RXMJKM4K7KLJLX3PRJFNCJ4",
  "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3",
  "GA7QYNF7SOWQ3GLR2BGMZEHXR34U4QEICMCRFVX6FZLT3XU5DX3LGCZ",
  "GABCD4NRNLBTPNFQL3PXHP4TTKC4MZMN3GZJNVMB5DQ2IQOAA7VZFKX",
  "GAHK7EEG2WWHVKDNT4CEQFZGKF2LGDSW2IVM4S5DP42RBW3K6BTODB4",
];

const SAMPLE_POST_IDS = ["1", "2", "3", "5", "8", "13", "21", "34"];

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Pick a random element from an array.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Perform a GET request and validate the response, recording custom metrics.
 *
 * @param {string} url         - Full URL to request
 * @param {string} tag         - Short label used in metric tags
 * @param {number} [expectedStatus=200]
 * @returns {import("k6/http").RefinedResponse<"text">}
 */
function getAndCheck(url, tag, expectedStatus = 200) {
  const params = {
    headers: { Accept: "application/json" },
    tags: { endpoint: tag },
  };

  const res = http.get(url, params);
  totalRequests.add(1);

  const ok = check(res, {
    [`${tag}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${tag}: has body`]: (r) => r.body && r.body.length > 0,
    [`${tag}: content-type json`]: (r) =>
      (r.headers["Content-Type"] || "").includes("application/json"),
  });

  searchResponseTime.add(res.timings.duration, { endpoint: tag });
  searchErrors.add(!ok);

  return res;
}

// ---------------------------------------------------------------------------
// Default function — executed once per VU per iteration
// ---------------------------------------------------------------------------

export default function () {
  // Randomly pick one of several search/query patterns to simulate realistic
  // traffic mix across the indexer's read endpoints.
  const scenario = Math.random();

  if (scenario < 0.35) {
    // --- Posts list (most common query) ---
    const limit = [10, 20, 50][Math.floor(Math.random() * 3)];
    const url = `${BASE_URL}/api/posts?limit=${limit}`;
    getAndCheck(url, "list_posts");
  } else if (scenario < 0.55) {
    // --- Posts list filtered by author ---
    const author = randomItem(SAMPLE_ADDRESSES);
    const url = `${BASE_URL}/api/posts?author=${author}&limit=20`;
    getAndCheck(url, "list_posts_by_author");
  } else if (scenario < 0.7) {
    // --- Single post by ID ---
    const postId = randomItem(SAMPLE_POST_IDS);
    const url = `${BASE_URL}/api/posts/${postId}`;
    // 404 is acceptable for synthetic IDs that may not exist in the DB
    getAndCheck(url, "get_post", 200);
  } else if (scenario < 0.82) {
    // --- Profile lookup ---
    const address = randomItem(SAMPLE_ADDRESSES);
    const url = `${BASE_URL}/api/profiles/${address}`;
    getAndCheck(url, "get_profile");
  } else if (scenario < 0.91) {
    // --- Followers ---
    const address = randomItem(SAMPLE_ADDRESSES);
    const url = `${BASE_URL}/api/follows/${address}/followers?limit=20`;
    getAndCheck(url, "get_followers");
  } else {
    // --- Following ---
    const address = randomItem(SAMPLE_ADDRESSES);
    const url = `${BASE_URL}/api/follows/${address}/following?limit=20`;
    getAndCheck(url, "get_following");
  }

  // Think-time between requests: 0.5 – 1.5 seconds
  sleep(0.5 + Math.random());
}

// ---------------------------------------------------------------------------
// Custom summary — printed at the end of the run
// ---------------------------------------------------------------------------

export function handleSummary(data) {
  // Print a human-readable summary to stdout and persist a JSON file for the
  // CI artifact upload step.
  return {
    stdout: buildTextSummary(data),
    "tests/load/results.json": JSON.stringify(data, null, 2),
  };
}

/**
 * Build a concise text summary from k6 summary data.
 * @param {object} data - k6 summary data object
 * @returns {string}
 */
function buildTextSummary(data) {
  const metrics = data.metrics || {};
  const duration = metrics.http_req_duration;
  const failed = metrics.http_req_failed;
  const requests = metrics.http_reqs;

  const p95 = duration ? duration.values["p(95)"].toFixed(2) : "n/a";
  const p99 = duration ? duration.values["p(99)"].toFixed(2) : "n/a";
  const avg = duration ? duration.values["avg"].toFixed(2) : "n/a";
  const errorRate = failed ? (failed.values.rate * 100).toFixed(2) : "n/a";
  const totalReqs = requests ? requests.values.count : "n/a";

  const p95Status = duration && duration.values["p(95)"] < 200 ? "✅ PASS" : "⚠️  MISS";

  return `
=============================================================
  Linkora Indexer — Search Load Test Results
=============================================================
  Total requests : ${totalReqs}
  Error rate     : ${errorRate}%
  Avg latency    : ${avg} ms
  P95 latency    : ${p95} ms  ${p95Status} (target: < 200 ms)
  P99 latency    : ${p99} ms
=============================================================
  Results saved to tests/load/results.json
=============================================================
`;
}
