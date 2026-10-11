// Runs the Actor's logic against the OpenAPI file's example replies. No call leaves this machine.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { explain, run, UserError } from "../dist/lib.js";

const fixture = (name) => JSON.parse(readFileSync(new URL(`fixtures/${name}.json`, import.meta.url), "utf8"));
const KEY = "test-key-not-real";

/** A fetch that answers from `routes` (first match on path and quote flag) and records each call. */
function stub(routes) {
  const calls = [];
  const fetch = async (url, init) => {
    const u = new URL(url);
    calls.push({ url: u, headers: init.headers });
    const quote = u.searchParams.get("quote") === "true";
    const hit = routes.find((r) => u.pathname === r.path && !!r.quote === quote && (!r.when || r.when(u)));
    if (!hit) throw new Error(`unexpected call ${url}`);
    const body = typeof hit.body === "function" ? hit.body(u) : hit.body;
    return new Response(body === undefined ? "" : JSON.stringify(body), {
      status: hit.status ?? 200,
      headers: { "content-type": "application/json", ...(hit.headers ?? {}) },
    });
  };
  return { fetch, calls };
}

async function go(input, routes) {
  const { fetch, calls } = stub(routes);
  const rows = [];
  const summary = await run(input, { fetch, push: async (r) => rows.push(...r), sleep: async () => {} });
  return { rows, calls, summary };
}

const quote = (cost) => ({ cost, remaining: "unlimited", rate_card: "2026-09" });

test("standard board: one row per back price and lay, priced first, key in the header only", async () => {
  const { rows, calls, summary } = await go(
    { apiKey: KEY, board: "standard", sports: ["tennis"], bookmakers: ["william_hill"] },
    [
      { path: "/v2/odds/standard", quote: true, body: quote(12) },
      { path: "/v2/odds/standard", body: fixture("standard"), headers: { "x-tokens-cost": "12" } },
    ],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url.searchParams.get("quote"), "true");
  assert.equal(calls[1].url.searchParams.get("sports"), "tennis");
  assert.equal(calls[1].url.searchParams.get("bookmakers"), "william_hill");
  for (const c of calls) {
    assert.equal(c.headers.Authorization, `Bearer ${KEY}`);
    assert.ok(!c.url.href.includes(KEY));
  }
  assert.equal(rows.length, 1);
  assert.deepEqual(
    { ...rows[0], backLink: undefined, layLink: undefined },
    {
      product: "standard",
      region: "uk",
      eventId: "or_evt_917dd44bce05",
      sport: "tennis_itf_w35_shenyang_chn",
      sportTitle: "ITF W35 Shenyang CHN",
      commenceTime: "2026-09-17T03:00:00Z",
      homeTeam: "Sijia Wei",
      awayTeam: "Zhuoxuan Bai",
      eventName: null,
      venue: null,
      market: "h2h",
      outcome: "Sijia Wei",
      point: null,
      bookmaker: "william_hill",
      backPrice: 2.9,
      places: null,
      placeFraction: null,
      dutchId: null,
      backLink: undefined,
      exchange: "betfair_exchange",
      layPrice: 3.45,
      layAvailable: 175,
      layLink: undefined,
      placeLayPrice: null,
      placeLayAvailable: null,
      placeLayPlaces: null,
      processedAt: "2026-09-17T02:20:57.271Z",
    },
  );
  assert.equal(summary.tokens, 12);
  assert.match(summary.message, /Saved 1 price rows, spending 12 tokens/);
});

test("each-way board: win and place lays paired by exchange", async () => {
  const { rows } = await go({ apiKey: KEY, board: "each-way" }, [
    { path: "/v2/odds/each-way", quote: true, body: quote(5) },
    { path: "/v2/odds/each-way", body: fixture("each-way") },
  ]);
  assert.equal(rows.length, 1);
  const r = rows[0];
  assert.equal(r.venue, "Illawarra Grange");
  assert.equal(r.places, 3);
  assert.equal(r.placeFraction, 0.2);
  assert.equal(r.exchange, "betfair_exchange");
  assert.equal(r.layPrice, 3.25);
  assert.equal(r.placeLayPrice, 2.16);
  assert.equal(r.placeLayPlaces, 3);
});

test("dutching board: back legs only, with their dutchId", async () => {
  const { rows } = await go({ apiKey: KEY, board: "dutching" }, [
    { path: "/v2/odds/dutching", quote: true, body: quote(5) },
    { path: "/v2/odds/dutching", body: fixture("dutching") },
  ]);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => [r.bookmaker, r.dutchId, r.exchange, r.layPrice]), [
    ["william_hill", "b8d7916c", null, null],
    ["betfair_exchange", "b8d7916c", null, null],
  ]);
});

test("a quote above the limit stops before any data call and spends nothing", async () => {
  const { fetch, calls } = stub([{ path: "/v2/odds/standard", quote: true, body: quote(5400) }]);
  await assert.rejects(
    run({ apiKey: KEY, board: "standard", maxTokens: 500 }, { fetch, push: async () => {} }),
    (err) => err instanceof UserError && /costs 5400 tokens, above your limit of 500/.test(err.message),
  );
  assert.equal(calls.length, 1);
});

test("raw board: walks pages, prices each, drops repeated events, stops at the limit", async () => {
  const first = fixture("raw");
  const second = structuredClone(first);
  second.meta.next_cursor = "c2";
  second.data.push({ ...structuredClone(first.data[0]), id: "or_evt_second" });
  const pages = { "": first, [first.meta.next_cursor]: second };
  const { rows, calls, summary } = await go({ apiKey: KEY, board: "raw", sports: ["tennis"], maxTokens: 25 }, [
    { path: "/v2/odds/raw", quote: true, body: (u) => quote(u.searchParams.get("cursor") === "c2" ? 99 : 10) },
    { path: "/v2/odds/raw", body: (u) => pages[u.searchParams.get("cursor") ?? ""] },
  ]);
  // Page 1 (10 tokens), page 2 (10), then page 3 is priced at 99 and not fetched.
  assert.deepEqual(
    calls.map((c) => `${c.url.searchParams.get("cursor") ?? "-"}:${c.url.searchParams.get("quote") ?? "data"}`),
    ["-:true", "-:data", `${first.meta.next_cursor}:true`, `${first.meta.next_cursor}:data`, "c2:true"],
  );
  // Each event: 2 bookmakers x 2 markets x 2 outcomes = 8 rows. Page 2 repeats page 1's event and adds one.
  assert.equal(rows.length, 16);
  assert.equal(new Set(rows.map((r) => r.eventId)).size, 2);
  assert.deepEqual(
    { bookmaker: rows[0].bookmaker, title: rows[0].bookmakerTitle, market: rows[0].market, outcome: rows[0].outcome, price: rows[0].price },
    { bookmaker: "bet600", title: "Bet600", market: "h2h", outcome: "Natsuki Yoshimoto", price: 1.7 },
  );
  assert.equal(summary.tokens, 20);
  assert.match(summary.message, /Stopped after page 2: the next page costs 99 tokens/);
});

test("coverage mode: no key sent, rows filtered by sport prefix and bookmaker", async () => {
  const { rows, calls, summary } = await go({ mode: "coverage", apiKey: KEY, sports: ["horse_racing_uk"], bookmakers: ["betfred"] }, [
    { path: "/v2/coverage", body: fixture("coverage") },
  ]);
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.deepEqual(rows.map((r) => `${r.product}:${r.bookmaker}:${r.sport}:${r.status}`), [
    "bog:betfred:horse_racing:live",
    "extra-place:betfred:horse_racing:live",
  ]);
  assert.equal(summary.tokens, 0);
});

test("odds with no key lists coverage instead and says why", async () => {
  const { rows, calls, summary } = await go({ mode: "odds", apiKey: "  " }, [{ path: "/v2/coverage", body: fixture("coverage") }]);
  assert.equal(calls.length, 1);
  assert.equal(rows.length, 14);
  assert.match(summary.message, /^No API key was given/);
});

test("errors read as plain instructions: 401, 402, 429, 400", async () => {
  const fail = async (status, error, headers) => {
    const { fetch } = stub([{ path: "/v2/odds/standard", quote: true, status, body: error && { error }, headers }]);
    try {
      await run({ apiKey: KEY }, { fetch, push: async () => {}, sleep: async () => {} });
    } catch (err) {
      const message = explain(err);
      assert.ok(!message.includes(KEY));
      return message;
    }
    assert.fail("no error");
  };
  assert.match(await fail(401, { code: "invalid_api_key", message: "x" }), /did not accept the API key \(invalid_api_key\)/);
  assert.match(
    await fail(402, { code: "insufficient_tokens", message: "x", cost: 900, remaining: 12, resets_at: "2026-11-01T00:00:00Z" }),
    /costs 900 tokens and 12 are left\. The balance next resets at 2026-11-01T00:00:00Z/,
  );
  assert.match(await fail(429, undefined, { "retry-after": "1" }), /^Too many requests/);
  assert.match(
    await fail(400, { code: "unknown_sport", message: "unknown sport", valid: ["soccer", "tennis"], request_id: "or_req_1" }),
    /OddsRelay answered 400 unknown_sport: unknown sport\. Valid values include: soccer, tennis\. \(request id or_req_1\)/,
  );
});

test("every row fits the dataset schema: each field declared, and its type allows what the row holds", async () => {
  const { matchedRows, rawRows, coverageRows } = await import("../dist/lib.js");
  const schema = JSON.parse(readFileSync(new URL("../.actor/dataset_schema.json", import.meta.url), "utf8"));
  const props = schema.fields.properties;
  const rows = [
    ...["standard", "each-way", "dutching"].flatMap((b) => matchedRows(b, fixture(b))),
    ...rawRows(fixture("raw")),
    ...coverageRows(fixture("coverage"), [], []),
  ];
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      assert.ok(props[k], `field ${k} is not in the dataset schema`);
      const kind = v === null ? "null" : typeof v;
      assert.ok([props[k].type].flat().includes(kind), `field ${k} holds ${kind}, schema allows ${props[k].type}`);
    }
  }
  // Apify validates with draft-07 JSON Schema: a null is allowed by a "null" type, never by "nullable".
  for (const [k, p] of Object.entries(props)) assert.ok(!("nullable" in p) && p.type.includes("null"), k);
});
