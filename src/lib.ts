// The Actor's logic, kept apart from the Apify SDK so the tests can run it with a stub fetch.
// It calls only the public OddsRelay /v2 routes, through the `oddsrelay` client.
import { InsufficientTokensError, OddsRelay, OddsRelayError } from "oddsrelay";
import type { CoverageSummary, FetchLike, MatchedBoard, Quote, RawBoard, Result } from "oddsrelay";

/** The boards the Actor reads: the six matched boards plus raw. */
export const BOARDS = ["standard", "each-way", "extra-place", "bog", "dutching", "2up", "raw"] as const;
export type Board = (typeof BOARDS)[number];

/** The input as .actor/input_schema.json defines it. */
export interface Input {
  apiKey?: string;
  mode?: "odds" | "coverage";
  board?: Board;
  sports?: string[];
  bookmakers?: string[];
  markets?: string[];
  maxTokens?: number;
}

export type Row = Record<string, string | number | null>;

export interface Deps {
  /** Saves rows to the dataset. */
  push: (rows: Row[]) => Promise<unknown>;
  /** Progress for the log and the run's status line. */
  note?: (message: string) => unknown;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
}

export interface Summary {
  rows: number;
  tokens: number;
  message: string;
}

/** A problem the user can fix from the input form. Its message is shown as the run's status. */
export class UserError extends Error {
  override name = "UserError";
}

const DEFAULT_MAX_TOKENS = 500;

export async function run(input: Input, given: Deps): Promise<Summary> {
  // An empty push is skipped: there is nothing to save, and it keeps the SDK out of an edge case.
  const deps = { ...given, push: (rows: Row[]) => (rows.length ? given.push(rows) : Promise.resolve()) };
  const note = given.note ?? (() => {});
  const apiKey = input.apiKey?.trim();
  if (input.mode === "coverage") return coverage(input, deps, "");
  if (!apiKey) {
    return coverage(input, deps, "No API key was given, so this run listed coverage, which needs no key. Add your OddsRelay API key to get prices. ");
  }

  const board = input.board ?? "standard";
  if (!BOARDS.includes(board)) throw new UserError(`Unknown board "${board}". Pick one of: ${BOARDS.join(", ")}.`);
  const max = input.maxTokens ?? DEFAULT_MAX_TOKENS;
  const client = new OddsRelay({ apiKey, fetch: deps.fetch, sleep: deps.sleep });
  const filters = { sports: list(input.sports), bookmakers: list(input.bookmakers), markets: list(input.markets) };
  let tokens = 0;
  let rows = 0;

  const tooDear = (cost: number) =>
    new UserError(
      `This request costs ${cost} tokens, above your limit of ${max} ("Most tokens this run may spend"). ` +
        "Add sports, bookmakers or markets to narrow it, or raise the limit. Nothing was spent.",
    );

  if (board !== "raw") {
    const cost = (fresh(await client.odds(board, { ...filters, quote: true })) as Quote).cost;
    if (cost > max) throw tooDear(cost);
    note(`Reading the ${board} board (priced at ${cost} tokens)`);
    const res = await client.odds(board, filters);
    const found = matchedRows(board, fresh(res) as MatchedBoard);
    await deps.push(found);
    tokens += res.tokens.cost ?? cost;
    rows += found.length;
    return { rows, tokens, message: done(rows, tokens, "") };
  }

  // Raw is paged. Each page is priced first, and the walk stops before a page that would pass the limit.
  const seen = new Set<string>();
  let cursor: string | undefined;
  let stopped = "";
  let page = 0;
  do {
    const params = { ...filters, cursor };
    const cost = (fresh(await client.raw({ ...params, quote: true })) as Quote).cost;
    if (tokens + cost > max) {
      if (page === 0) throw tooDear(cost);
      stopped = ` Stopped after page ${page}: the next page costs ${cost} tokens, which would pass your limit of ${max}.`;
      break;
    }
    const res = await client.raw(params);
    const body = fresh(res) as RawBoard;
    page++;
    tokens += res.tokens.cost ?? cost;
    // A page can repeat an event whose kick-off moved during the walk: keep the first copy.
    const events = body.data.filter((e) => !seen.has(e.id));
    for (const e of events) seen.add(e.id);
    const found = rawRows({ ...body, data: events });
    await deps.push(found);
    rows += found.length;
    note(`Page ${page}: ${found.length} rows (${tokens} tokens so far)`);
    cursor = body.meta.next_cursor ?? undefined;
  } while (cursor);
  return { rows, tokens, message: done(rows, tokens, stopped) };
}

async function coverage(input: Input, deps: Deps, prefix: string): Promise<Summary> {
  // Sent with no key on purpose: only the keyless view lists every product as bookmaker and sport rows.
  const client = new OddsRelay({ apiKey: "", fetch: deps.fetch, sleep: deps.sleep });
  const found = coverageRows(fresh(await client.coverage()) as CoverageSummary, list(input.sports) ?? [], list(input.bookmakers) ?? []);
  await deps.push(found);
  const message = found.length
    ? `${prefix}Saved ${found.length} coverage rows. No tokens spent.`
    : `${prefix}No coverage rows match these sports and bookmakers. No tokens spent.`;
  return { rows: found.length, tokens: 0, message };
}

function done(rows: number, tokens: number, stopped: string): string {
  return rows
    ? `Saved ${rows} price rows, spending ${tokens} tokens.${stopped}`
    : `No prices match these filters right now (${tokens} tokens spent).${stopped}`;
}

function list(values: string[] | undefined): string[] | undefined {
  const kept = (values ?? []).map((v) => v.trim()).filter(Boolean);
  return kept.length ? kept : undefined;
}

function fresh<T>(res: Result<T>): T {
  // Each run uses a new client, which never sends If-None-Match, so a 304 cannot happen; guard anyway.
  if (res.notModified) throw new Error("the API answered 304 Not Modified to a request without an ETag");
  return res.data;
}

/** One row per back price and exchange: the pair a matched board lines up. Dutching rows carry no lay. */
export function matchedRows(board: string, body: MatchedBoard): Row[] {
  const rows: Row[] = [];
  for (const e of body.data) {
    for (const m of e.markets) {
      for (const o of m.outcomes) {
        const lays = pairLays(o.lay);
        for (const b of o.back) {
          const base: Row = {
            product: board,
            region: body.meta.region ?? null,
            eventId: e.event_id,
            sport: e.sport_key,
            sportTitle: e.sport_title ?? null,
            commenceTime: e.commence_time ?? null,
            homeTeam: e.home_team ?? null,
            awayTeam: e.away_team ?? null,
            eventName: e.event_name ?? null,
            venue: e.venue ?? null,
            market: m.key,
            outcome: o.name,
            point: o.point ?? null,
            bookmaker: b.bookmaker ?? null,
            backPrice: b.price ?? null,
            places: b.places ?? null,
            placeFraction: b.place_fraction ?? null,
            dutchId: b.dutch_id ?? null,
            backLink: b.link ?? null,
          };
          for (const lay of lays.length ? lays : [NO_LAY]) {
            rows.push({ ...base, ...lay, processedAt: body.meta.processed_at ?? null });
          }
        }
      }
    }
  }
  return rows;
}

type LayEntry = { exchange: string; price: number | null; available: number | null; link: string | null; places?: number | null };

const NO_LAY: Row = {
  exchange: null,
  layPrice: null,
  layAvailable: null,
  layLink: null,
  placeLayPrice: null,
  placeLayAvailable: null,
  placeLayPlaces: null,
};

/** Flat lay columns per exchange. Each-way boards send win and place lays apart: they are paired by exchange. */
function pairLays(lay: LayEntry[] | { win: LayEntry[]; place: LayEntry[] } | undefined): Row[] {
  if (!lay) return [];
  if (Array.isArray(lay)) {
    return lay.map((l) => ({ ...NO_LAY, exchange: l.exchange, layPrice: l.price, layAvailable: l.available, layLink: l.link }));
  }
  const exchanges = [...new Set([...lay.win, ...lay.place].map((l) => l.exchange))];
  return exchanges.map((x) => {
    const w = lay.win.find((l) => l.exchange === x);
    const p = lay.place.find((l) => l.exchange === x);
    return {
      exchange: x,
      layPrice: w?.price ?? null,
      layAvailable: w?.available ?? null,
      layLink: w?.link ?? p?.link ?? null,
      placeLayPrice: p?.price ?? null,
      placeLayAvailable: p?.available ?? null,
      placeLayPlaces: p?.places ?? null,
    };
  });
}

/** One row per event, venue, market and outcome. Exchanges may add back and lay prices with the amount available. */
export function rawRows(body: RawBoard): Row[] {
  const rows: Row[] = [];
  for (const e of body.data) {
    for (const v of e.bookmakers) {
      for (const m of v.markets) {
        for (const o of m.outcomes) {
          rows.push({
            product: "raw",
            region: v.region ?? body.meta.region ?? null,
            eventId: e.id,
            sport: e.sport_key,
            sportTitle: e.sport_title ?? null,
            commenceTime: e.commence_time ?? null,
            homeTeam: e.home_team ?? null,
            awayTeam: e.away_team ?? null,
            market: m.key,
            outcome: o.name,
            bookmaker: v.key,
            bookmakerTitle: v.title ?? null,
            price: o.price ?? null,
            backPrice: o.back_price ?? null,
            layPrice: o.lay_price ?? null,
            layAvailable: o.available ?? null,
            lastUpdate: m.last_update ?? v.last_update ?? null,
            link: v.link ?? null,
            processedAt: body.meta.processed_at ?? null,
          });
        }
      }
    }
  }
  return rows;
}

/** Keyless coverage as rows. A sport filter matches either way round, so a competition key still finds its sport. */
export function coverageRows(body: CoverageSummary, sports: string[], bookmakers: string[]): Row[] {
  const rows: Row[] = [];
  for (const [product, entries] of Object.entries(body.products)) {
    for (const r of entries) {
      if (sports.length && !sports.some((s) => r.sport.startsWith(s) || s.startsWith(r.sport))) continue;
      if (bookmakers.length && !bookmakers.includes(r.bookmaker)) continue;
      rows.push({ product, region: body.region, sport: r.sport, bookmaker: r.bookmaker, status: r.status, generatedAt: body.generated_at });
    }
  }
  return rows;
}

/** The run's failure message, in words the user can act on. Never contains the key: the client keeps it out. */
export function explain(err: unknown): string {
  if (err instanceof UserError) return err.message;
  if (err instanceof InsufficientTokensError) {
    const resets = err.resetsAt ? ` The balance next resets at ${err.resetsAt}.` : "";
    return (
      `Not enough tokens on your OddsRelay account: this call costs ${err.cost ?? "more than"} tokens and ` +
      `${err.remaining ?? "fewer"} are left.${resets} Narrow the filters, or check your plan in your OddsRelay account.`
    );
  }
  if (err instanceof OddsRelayError) {
    const id = err.requestId ? ` (request id ${err.requestId})` : "";
    if (err.status === 401) {
      return `OddsRelay did not accept the API key (${err.code}). Copy it again from your OddsRelay account and paste it into "OddsRelay API key".`;
    }
    if (err.status === 429) {
      return `Too many requests: OddsRelay asked us to slow down (${err.code}) and three tries did not get through. Wait a minute, then run again.`;
    }
    const valid = Array.isArray(err.body?.valid) ? ` Valid values include: ${err.body.valid.slice(0, 30).join(", ")}.` : "";
    const said = typeof err.body?.message === "string" ? `: ${err.body.message.replace(/[.\s]+$/, "")}` : "";
    return `OddsRelay answered ${err.status} ${err.code}${said}.${valid}${id}`;
  }
  if (err instanceof TypeError && /fetch/i.test(err.message)) {
    return `Could not reach api.oddsrelay.io (${err.message}). Try again in a few minutes.`;
  }
  return err instanceof Error ? err.message : String(err);
}
