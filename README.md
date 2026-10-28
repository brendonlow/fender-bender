# Fender Bender Chooser

**Live: https://brendonlow.github.io/fender-bender/**

Compare comprehensive car insurance for a **Geely EX5** in Sydney, and keep track of the real quotes you get. It's set up for a car garaged in the Hills District (NSW 2155), using policy details checked in October 2026.

![Insurers view](docs/insurers.jpg)

## What it does

You make five choices:

1. **Which EX5**: Complete or Inspire (sets the insured value)
2. **Main driver's age**: the biggest thing insurers price on
3. **Excess**: $500, $1,000, $1,500 or $2,000
4. **Must-haves**: new car if it's written off, hire car after an accident, agreed value, your own repairer, charging cable cover
5. **Yearly or monthly**: monthly usually costs 8–12% more

You get a **shortlist**: one card per insurer (22 brands, 32 policies behind them), cheapest first, only those that tick your must-haves. Each card shows the first-year estimate, what it's likely to cost at renewal once the online discount drops off, and a tick for each must-have. Tap a card for the full policy breakdown and sources.

**My quotes** is where you log the real quotes you get. They replace the estimates everywhere, and the top banner shows your best quote and who else is worth asking. It also has a checklist of what to have ready and the questions to ask. Quotes are saved only in your browser.

**Tips** covers what an EX5 should cost to insure, why Geely's included roadside makes the insurer add-on redundant, agreed vs market value, how to get the price down, and green slips.

| Policy detail | Tips | Mobile |
|---|---|---|
| ![Detail](docs/detail.jpg) | ![Tips](docs/tips.jpg) | ![Mobile](docs/mobile.jpg) |

## How good are the numbers?

- **Cover features** come from each insurer's product disclosure statement (PDS), website and comparison sites (CHOICE, Canstar, Finder, Mozo). Every policy's detail panel links its sources. Where a site blocked access or said nothing, the item is marked *not confirmed* rather than guessed, and insurers on CHOICE's 2026 "policies to avoid" list are left off the shortlist.
- **Prices are estimates.** Insurers don't publish premiums, so the model starts from published EX5 evidence: CHOICE's new-Geely average of $1,622, Youi's EX5 range of $1,082–$1,978, Drive's Sydney quote of about $1,904, and NRMA's own EX5 quote of about $2,237. It then adjusts for rough profile rules and each brand's relative pricing. Use the estimates to choose who to ask for a quote first; your real quotes are what count.
- **Claims:** Australia has no public claims-acceptance data for car insurance. The app shows CHOICE's 2025 claims-satisfaction survey where a brand was included.

Not financial advice. Read the PDS and Key Facts Sheet before buying.

## Run it

It's a static site with no build step. Open `index.html`, or run `python3 serve.py 8100` and go to http://localhost:8100.

Sibling apps: [Vroom Vroom Chooser](https://brendonlow.github.io/vroom-vroom/) (pick an EV) and [Protect Lab](https://brendonlow.github.io/protect-lab/) (paint protection for the EX5).
