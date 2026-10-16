# Publishing this Actor on Apify Store

Everything the owner needs to put the UK Bookmaker Odds API Actor on Apify Store. Claude built and tested it; the owner
signs up, logs in, pushes and publishes. Nothing here is public until he does. Written 11 Oct 2026 from Apify's
docs and terms as they read that day (sources at the end), section 1 updated 16 Oct 2026; re-read the Publishing tab on the day, forms change.

## 1. Read this first: two Apify rules that touch this Actor

Apify's Store publishing terms (last updated 15 Sep 2026) say:

- **"Promote off-platform products or services"** (section 2.2.4 Restrictions, under Specific Prohibitions, item (i)): unless Apify
  agrees in writing, a publisher must not "directly or indirectly offer, link to, or promote any product or service
  outside of the Platform" in an Actor or its README or description.
- **§10.4.1:** Apify may restrict an Actor that "contains, requires, or directs Users to any payment method other
  than the Apify payment gateway".

**Where it stands (16 Oct 2026):** Apify support replied on 14 Oct 2026 that they cannot confirm the rule, but
that if we publish, the Actor must clearly explain three things. The owner's decision (16 Oct 2026): publish
**without sign-up or pricing links**. The Store version therefore:

- has no link to the OddsRelay sign-up page, the pricing page or the homepage ("OddsRelay" is plain text); step 1
  of "How to get UK bookmaker odds data" says an OddsRelay account and key are needed, with no link;
- keeps two support links only: the API documentation (oddsrelay.io/docs) and hello@oddsrelay.io;
- says these three things in "Before you start", near the top of the README:
  1. users must provide their own OddsRelay API key (Coverage mode works without one);
  2. using OddsRelay may involve separate costs: it is a separate service with its own plans, billed by OddsRelay,
     not by Apify; Free covers a trial only;
  3. how the key is used and stored: it is entered in a secret input field (`isSecret: true` in
     `.actor/input_schema.json`) that Apify stores encrypted; the Actor sends it only to api.oddsrelay.io in the
     Authorization header; it is never logged or written to the dataset.

Nothing in the Actor takes payment, and it charges nothing through Apify. If Apify asks for changes after
publishing, answer within 3 business days (§8.2) and ask Claude to re-gate the README.

## 2. The listing (Publication tab, Display information)

| Field | Text |
|---|---|
| Actor name (URL, cannot change later) | `uk-bookmaker-odds-api` (already in `.actor/actor.json`) |
| Title (40 to 50 characters; this is 46) | UK Bookmaker Odds API with Exchange Lay Prices (already in `.actor/actor.json`) |
| Description (Store card, at most 300 characters; this is 195) | Pre-match odds from UK and Irish bookmakers, bet365 included, with Betfair, Smarkets, Matchbook and BETDAQ lay prices, read from the OddsRelay API with your own key into a dataset you can export. |
| SEO title (40 to 50 characters; this is 48) | UK Betting Odds API: Bookmaker and Exchange Data |
| SEO description (145 to 155 characters; this is 150) | Pre-match odds from UK and Irish bookmakers, bet365 included, beside Betfair, Smarkets, Matchbook and BETDAQ lay prices. Export to CSV, Excel or JSON. |
| Categories (pick 3) | Sports, Developer tools, Integrations |
| Icon | The OddsRelay avatar, 512 x 512 PNG: `~/Dev/oddsrelay/brand/social/avatar-512.png` |
| README | Comes from `README.md` on push; nothing to paste |
| Hide source files from Actor detail | Leave ticked (the default) until github.com/oddsrelay is visible again; then it can be unticked so the code is public |

Never put "bet365" in the title or the SEO title: §2.2.1 asks listings to avoid any suggestion of affiliation with
a trademark owner. It appears once in the description and once in the README (its opening line), with the "not affiliated" line in the FAQ.

## 3. Monetisation

Choose **Pay per usage** with no Actor price: users pay only Apify's own platform usage, and OddsRelay tokens come
from their OddsRelay plan. This is a holding choice: the owner decides monetisation later (pay per event is the other
model Apify offers; read its notice rules on the Monetization tab before switching, as users of a priced Actor
are told of price changes in advance). A free Actor needs no Apify billing or identity check.

## 4. The other Publication sections

| Section | What to do |
|---|---|
| Sample output | Apify fills it from the dataset schema, or paste the Best odds guaranteed row from the README's Output section |
| Output schema | Already in `.actor/output_schema.json`: the run's dataset |
| Actor permissions | **Limited permissions**: the Actor only writes to its own run's dataset |

## 5. Test account notes (for Apify's checks)

- **Daily automated test:** Apify runs every public Actor once a day with its prefilled input and needs a Succeeded
  run with a non-empty dataset within 5 minutes. The prefilled input has no key (Sports `soccer`, Bookmakers
  `bet365` and `william_hill`), so the Actor lists those coverage rows (7 on 11 Oct), which takes seconds and needs
  no key and no tokens. No exclusion from the tests is needed.
- **If Apify staff ask to see prices:** make a separate OddsRelay key on a test account with a small token budget
  and send it privately in that support thread. Never put a key in the listing, the README or a public issue.
- **Local proof, 11 Oct 2026:** the tests passed on the contract's example replies; `apify validate-schema` passed;
  a local `apify run` without a key saved coverage rows; with a key, the Standard and Raw boards saved price rows
  within the token cap; an unfiltered request priced above the cap was refused before spending anything; a wrong
  sport key gave the API's list of valid keys. The key never reached the dataset, the log or the files.
- **Independent re-test, 11 Oct 2026 (night):** a fresh clone and install passed the tests, `apify validate-schema`
  (input, dataset and output schemas) and the gates; live runs saved Standard (349 rows, 6 tokens), Each-way
  (35 rows, 250 tokens) and Raw (144 rows, 12 tokens) rows, every one valid against the dataset schema. Fixed then:
  the dataset schema now allows empty values the way Apify's validation docs show (`"type": ["number", "null"]`,
  not `nullable`, which Apify does not document; every row has some empty fields, so a validator that ignores
  `nullable` would refuse every row), and `actor.json` uses the `input` and `output` keys the Apify tool reads.

## 6. The owner's steps, in order

1. **Apify account** (5 min): sign up at https://console.apify.com/sign-up with hello@oddsrelay.io. Pick the
   username `oddsrelay` if free. Settings, Account: display name "OddsRelay", website https://oddsrelay.io, the
   avatar above. No personal name.
2. **Ask Apify**: done. Support replied on 14 Oct 2026; the README now carries what they asked for (section 1).
3. **Command-line tool** (3 min), in your own terminal:
   `npm install -g apify-cli@1.10.0`, then `apify login` (it opens the browser; you sign in, Claude never sees it).
4. **Push** (5 min, most of it Apify building the image):
   `cd ~/Dev/oddsrelay-oss/apify-oddsrelay && apify push`
5. **Try it** (3 min): in Apify Console, open the Actor, run it once with no key (coverage rows appear), then once
   with your own key, Board Standard, Sports `soccer`, Bookmakers `bet365`.
6. **Publish** (10 min), as decided on 16 Oct 2026 (section 1): Publication tab, fill section 2, 3 and 4, mark each
   section complete, "Publish on Store". Then search Apify Store for "UK Bookmaker Odds API" to check the page.
7. **GitHub, later** (2 min, only once github.com/oddsrelay answers again): create and push the repo as
   the other OddsRelay repos were, with the description
   "Apify Actor for UK bookmaker odds from the OddsRelay API". Then untick "Hide source files" if you want the code
   public on Apify too.

After publishing, Apify expects answers to Issues within 14 days (§8.1) and replies to its own requests within
3 business days (§8.2). Plan about 2 hours a week of upkeep in Apify's estimate; for an API client this is mostly
answering questions.

## Sources (read 11 Oct 2026)

- Actor definition, actor.json: https://docs.apify.com/platform/actors/development/actor-definition/actor-json
- Input schema specification v1: https://docs.apify.com/platform/actors/development/actor-definition/input-schema/specification/v1
- Dataset schema: https://docs.apify.com/platform/actors/development/actor-definition/dataset-schema
- Publishing overview and steps: https://docs.apify.com/platform/actors/publishing and https://docs.apify.com/platform/actors/publishing/publish
- Automated testing: https://docs.apify.com/platform/actors/publishing/test
- Quality score: https://docs.apify.com/platform/actors/publishing/quality-score
- README guidance: https://docs.apify.com/platform/actors/publishing/actor-readme
- Monetisation: https://docs.apify.com/platform/actors/publishing/monetize
- Naming and descriptions: https://docs.apify.com/academy/actor-marketing-playbook/actor-basics/name-your-actor and https://docs.apify.com/academy/actor-marketing-playbook/actor-basics/actor-description
- Store publishing terms (15 Sep 2026): https://docs.apify.com/legal/store-publishing-terms-and-conditions
- Acceptable use policy (20 Feb 2026, no rule on odds data): https://docs.apify.com/legal/acceptable-use-policy
- Apify's own Actor-building guide and template (TypeScript, `ts-empty`): https://github.com/apify/agent-skills and https://github.com/apify/actor-templates
