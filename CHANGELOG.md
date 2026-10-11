# Changelog

## 0.1

- First version of the UK Bookmaker Odds API Actor.
- Odds mode reads one OddsRelay board (Standard, Each-way, Extra place, Best odds guaranteed, Dutching, 2Up or Raw), filtered by sport, bookmaker and market, and saves one row per price.
- Every call is priced first at no cost; the run stops before it would pass the token cap you set.
- The Raw board is read page by page, with repeated events dropped.
- Coverage mode lists which bookmakers carry which sports on each board, with no key and no tokens. A run with no key lists coverage.
- Plain error messages for a refused key, too few tokens and too many requests.
- Built against the OddsRelay API contract version 2026-07-08.
