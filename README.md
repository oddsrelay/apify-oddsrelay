**UK Bookmaker Odds API** gives you **pre-match odds from UK and Irish bookmakers, bet365 included, with Betfair, Smarkets, Matchbook and BETDAQ lay prices**, as a table you can download as CSV, Excel or JSON, or read through the Apify API.

It is an **API client** for the [OddsRelay](https://oddsrelay.io) odds API. Each run sends your request to `api.oddsrelay.io` with **your own OddsRelay API key** and saves the reply as rows in the run's dataset. It talks to no other site.

No key yet? Run it once without one: it lists **coverage**, which bookmakers carry which sports on each board, at no cost.

## What does UK Bookmaker Odds API do?

- Saves **bookmaker back prices beside exchange lay prices**, one row per price, from the board you pick.
- Covers **football, horse racing, tennis and the other sports** on the OddsRelay boards, for UK and Irish bookmakers.
- Filters by **sport, bookmaker and market**, so you take only what you need.
- **Prices every call first, at no cost**, and stops before it would spend more tokens than your limit.
- Runs on a **schedule**, from the **Apify API**, or through **Apify integrations** such as Make, Zapier and webhooks, like any Actor.

## Which odds boards can I get?

| Board | What each row holds |
|---|---|
| **Standard** | A bookmaker's back price beside an exchange's lay price and the amount available to lay. |
| **Each-way** | A bookmaker's each-way offer, with its places and place terms, beside the exchange win lay and place lay. |
| **Extra place** | Races where a bookmaker pays more places than the exchange place market, with the win lay and the place lay. |
| **Best odds guaranteed (BOG)** | Win prices from bookmakers offering BOG on a race, beside the exchange win lay. |
| **Dutching** | Back prices only, one leg per outcome at different venues, grouped by `dutchId`. |
| **2Up** | Football prices from bookmakers' 2Up markets, beside the exchange match odds lay. |
| **Raw** | Every bookmaker's and exchange's prices by event, as each lists them, across many markets. |

**bet365 is on every OddsRelay plan.** To see every bookmaker and sport key, run the Actor in **Coverage** mode.

## What data does it return?

| Field | What it is |
|---|---|
| `product`, `region` | The board the row came from, and the region code of its prices (`uk`) |
| `eventId`, `eventName` | OddsRelay's event id, the same on every board and run, and the event name where the board gives one |
| `sport`, `sportTitle` | Sport or competition key, and its name |
| `commenceTime` | Scheduled start, ISO 8601 in UTC |
| `homeTeam`, `awayTeam`, `venue` | The teams or players, or the racecourse |
| `market`, `outcome`, `point` | Market key (such as `h2h`), the selection, and the line where there is one |
| `bookmaker`, `backPrice` | Bookmaker key and its decimal back price |
| `places`, `placeFraction` | Each-way terms |
| `dutchId` | Groups the back legs of one dutch, on the Dutching board |
| `exchange`, `layPrice`, `layAvailable` | The exchange, its decimal lay price and the amount available at that price |
| `placeLayPrice`, `placeLayAvailable`, `placeLayPlaces` | The place lay and the places in the exchange's place market, on each-way and extra place boards |
| `backLink`, `layLink` | Links to the event at the bookmaker and the market at the exchange, where the board gives them |
| `bookmakerTitle`, `price`, `lastUpdate`, `link` | Raw rows: the venue's name, its decimal price, when its market last moved, and a link to the event |
| `processedAt` | When the board was built |
| `status`, `generatedAt` | Coverage rows: `live`, or `interrupted_24h` when that bookmaker and sport were off the board in the last 24 hours, and when the list was built |

The dataset has four views: **Overview**, **Matched odds**, **Raw odds** and **Coverage**.

## How to get UK bookmaker odds data

1. Create an OddsRelay account at [app.oddsrelay.io/signup](https://app.oddsrelay.io/signup) and copy your API key from it.
2. Open this Actor, paste the key into **OddsRelay API key**, and leave **What to fetch** on **Odds**.
3. Pick a **Board**, such as Standard.
4. Add the **Sports** and **Bookmakers** you want, for example `soccer` and `bet365`. Narrow filters cost fewer tokens.
5. Set **Most tokens this run may spend**, then click **Start**.
6. Open the **Output** tab, choose a view, and download the rows as CSV, Excel or JSON.

Want fresh prices every morning? Save the input as a **task** and give it a **schedule**.

## How much does it cost?

**The Actor has no price of its own.** Apify bills its usual platform usage for each run, as for any Actor.

**The odds come from your OddsRelay plan**, which spends tokens per call. Before each call the Actor asks OddsRelay what it will cost, which spends nothing, and it never starts a call that would take the run past your limit. Coverage runs need no key and spend no tokens.

Free gives you 50,000 tokens for 14 days from sign-up, with no card, then no tokens until you choose a plan, on the same key. Plans are on the [OddsRelay pricing page](https://oddsrelay.io/pricing).

## Input

See the **Input** tab for every field. An example:

```json
{
  "apiKey": "<your OddsRelay API key>",
  "mode": "odds",
  "board": "standard",
  "sports": ["soccer"],
  "bookmakers": ["bet365", "william_hill"],
  "markets": ["h2h"],
  "maxTokens": 500
}
```

- **OddsRelay API key** is a secret field: Apify stores it encrypted, and the Actor sends it only to `api.oddsrelay.io`, in the `Authorization` header. It is never logged or saved to the dataset.
- **Sports, Bookmakers and Markets** take lowercase keys. Leave a list empty to take everything on the board, which costs more.
- **Most tokens this run may spend** caps the run. On the Raw board the Actor reads page after page and stops before the page that would pass the cap.

## Output

You can download the dataset in various formats such as JSON, HTML, CSV or Excel. A Best odds guaranteed row:

```json
{
  "product": "bog",
  "region": "uk",
  "eventId": "or_evt_58ab94d71497",
  "sport": "horse_racing",
  "sportTitle": "Horse Racing",
  "commenceTime": "2026-09-17T12:30:00Z",
  "venue": "Ayr",
  "market": "win",
  "outcome": "Bassrah",
  "bookmaker": "ladbrokes",
  "backPrice": 4.0,
  "exchange": "smarkets",
  "layPrice": 4.4,
  "layAvailable": 75.93,
  "processedAt": "2026-09-17T12:01:10.000Z"
}
```

A Coverage row:

```json
{
  "product": "bog",
  "region": "uk",
  "sport": "horse_racing",
  "bookmaker": "betfred",
  "status": "live",
  "generatedAt": "2026-09-17T02:20:29Z"
}
```

## Tips

- **Start with Coverage** to see the keys, then run Odds with only the sports and bookmakers you need.
- **Markets cut the cost** on the Standard and Dutching boards, which carry many markets per event.
- **Keep the token cap low** while you try things out, and raise it once you know what a run needs.

## FAQ

### Do I need an OddsRelay account?

For prices, yes: they are read with your own OddsRelay API key and spend your plan's tokens. Coverage works without an account.

### Where do the prices come from?

From the OddsRelay API. This Actor is a client for it: it sends your request to `api.oddsrelay.io` and saves the reply.

### Which bookmakers and regions are covered?

UK and Irish bookmakers, bet365 included, with Betfair, Smarkets, Matchbook and BETDAQ lay prices. Run Coverage for the current list of bookmaker and sport keys.

### Why did my run stop early?

The next call would have taken the run past **Most tokens this run may spend**. The rows saved before it are in the dataset. Narrow the filters or raise the cap.

### What do the error messages mean?

- **"did not accept the API key"**: the key is wrong, revoked or paused. Copy it again from your OddsRelay account.
- **"Not enough tokens"**: your plan has fewer tokens left than the call costs. Narrow the filters or check your plan.
- **"Too many requests"**: OddsRelay asked the Actor to slow down three times. Wait a minute and run again.
- **"Valid values include"**: a sport, bookmaker or market key is not one the board knows. The message lists the keys it accepts.

### Is this for betting tips?

No. OddsRelay supplies odds data to businesses and developers: price comparison sites, oddsmatchers, models and dashboards. It gives no tips or predictions. Use the data within the laws and licences that apply to you.

### Is OddsRelay linked to the bookmakers?

OddsRelay is not affiliated with or endorsed by bet365, or by any other bookmaker or exchange named here.

### Where can I get help?

Open an issue on the **Issues** tab, or email [hello@oddsrelay.io](mailto:hello@oddsrelay.io). The full API documentation is at [oddsrelay.io/docs](https://oddsrelay.io/docs).
