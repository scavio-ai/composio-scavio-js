# composio-scavio (TypeScript)

[Scavio](https://scavio.dev) real-time search tools for [Composio](https://composio.dev) (TypeScript).

Scavio is a single Search API over 32 platforms -- Google, YouTube, Amazon, Walmart, eBay, Target, Home Depot, Reddit, TikTok, TikTok Shop, Instagram, X, LinkedIn, Threads, Kuaishou, Zillow, Redfin, Booking.com, Airbnb, Tripadvisor, Yelp, Indeed, Glassdoor, the Apple App Store, Google Play, SEC EDGAR, Companies House, G2, Capterra, Google Ads Transparency and the Meta Ad Library -- plus `extract`, which reads any URL as Markdown, plain text or raw HTML. This package exposes **189 tools, one per live endpoint** as a Composio custom toolkit so your agents can pull structured, up-to-date results across any Composio-supported framework.

> **New in 0.4.0: 21 more platforms, and they are opt-in.** Registering all 189
> tools at once buries the handful an agent actually wants, so the verticals
> added in this release are off by default. The ten original platforms and
> `extract` stay on (104 tools). Turn a vertical on with its flag --
> `buildScavioToolkit({ enableZillow: true })` -- or pass `all: true` for
> everything. Nothing that worked in 0.3.0 changes, except that Walmart grew from
> 2 tools to 7.

> **Walmart was rebuilt (breaking).** Walmart now runs on a scrape.do rebuild:
> `device`, `delivery_zip` and `store_id` never existed on it and are gone,
> `start_page` is replaced by `page`, and five endpoints beyond search/product
> are exposed for the first time (`WALMART_REVIEWS`, `WALMART_CATEGORY`,
> `WALMART_OFFERS`, `WALMART_SELLER`, `WALMART_SELLER_PRODUCTS`).
> `WALMART_OFFERS` returns the **buy-box seller only** -- there is no way to page
> the other sellers -- and `WALMART_SELLER_PRODUCTS` returns roughly the first 40
> items with no pagination at all.

> **Google is v2 only.** `/api/v1/google` was retired on 2026-08-04 and returns
> 410, so none of its vocabulary survives here. The tools take the v2 params
> natively: `gl`, `hl`, `google_domain`, `device` and `start`. **`start` is a
> result offset, not a page number** (0 is page 1, 10 is page 2), and there is no
> `page` argument mapped onto it -- a silent remap fetches the wrong page.

> **Amazon changed (breaking).** The upstream provider moved in 2026-07:
> `domain` is replaced by `country`, a two-letter marketplace code (`us`, `gb`
> -- the UK is `gb`, not `uk` -- `de`, `jp`, ...), and `sort_by`, `pages`,
> `category_id`, `merchant_id`, `language`, `currency`, `device`, `zip_code`
> and `autoselect_variant` are gone. The marketplace ignores all of them
> (`sort_by` returns the identical unordered set for every value), so they are
> removed rather than kept as silent no-ops. Rank and filter results yourself.

> **Reddit search has no filters.** `/reddit/search` accepts only `query` and
> `cursor`; the API strips anything else, so the old `type` and `sort` args
> narrowed nothing and are removed. It returns `data.results` with `next_cursor`
> and `has_more`. `REDDIT_POST` returns a flat post object only -- comments come
> from `REDDIT_POST_COMMENTS`. The subreddit and user feeds do return
> `data.posts`.

## Install

```bash
npm install composio-scavio
```

`@composio/core`, `scavio` (>= 0.15.0) and `zod` are dependencies. Get a Scavio API key from the [Scavio Dashboard](https://dashboard.scavio.dev) (50 one-time signup credits, no credit card; the free plan does not refill monthly).

## Usage

```ts
import { Composio } from "@composio/core";
import { buildScavioToolkit } from "composio-scavio";

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY });

// Build the toolkit; expose only the providers you need.
const scavio = buildScavioToolkit({
  apiKey: process.env.SCAVIO_API_KEY, // or rely on SCAVIO_API_KEY
  enableGoogle: true,
  enableAmazon: true,
  enableTiktok: false,
  enableZillow: true, // opt-in: off unless you ask for it
});

const session = await composio.create("user_1", {
  experimental: { customToolkits: [scavio] },
});

// Hand the agent-ready tools to your framework, or call directly:
const tools = await session.tools();
const out = await session.execute("LOCAL_SCAVIO_GOOGLE_SEARCH", {
  query: "best search API for AI agents",
  gl: "us",
});
console.log(out);
```

`LOCAL_SCAVIO_EXTRACT` is the agent's "read this page" primitive and is on by default:

```ts
const page = await session.execute("LOCAL_SCAVIO_EXTRACT", {
  url: "https://example.com/pricing",
  format: "markdown",
});
```

Pass `all: true` to register every tool regardless of the individual flags.

## Tools

All tools are grouped under the `SCAVIO` custom toolkit; agent-facing slugs are prefixed `LOCAL_SCAVIO_` (Composio convention for custom tools). Every provider is gated by its own flag.

### On by default (104 tools)

| Platform | Flag | Tools | Endpoints |
|---|---|---|---|
| Google | `enableGoogle` | 14 | search, ai mode, maps search, maps place, maps reviews, shopping, shopping product, shopping stores, flights, hotels, hotels detail, news, trends, trending |
| Amazon | `enableAmazon` | 4 | search, product, offers, options |
| Walmart | `enableWalmart` | 7 | search, product, reviews, category, offers, seller, seller products |
| YouTube | `enableYoutube` | 15 | search, shorts, suggestions, video, comments, comment replies, transcript, related, channel search, channel, channel videos, channel shorts, channel community, channel resolve, streams |
| Reddit | `enableReddit` | 12 | search, search suggestions, post, post comments, comment replies, subreddit, subreddit posts, user, user posts, user comments, popular, trending |
| TikTok | `enableTiktok` | 11 | profile, user posts, video, video comments, comment replies, search videos, search users, hashtag, hashtag videos, user followers, user followings |
| TikTok Shop | `enableTiktokShop` | 8 | search, search suggestions, product, product reviews, categories, category products, shop products, resolve |
| Instagram | `enableInstagram` | 12 | profile, user posts, user reels, user tagged, user stories, post, post comments, comment replies, search users, search hashtags, user followers, user followings |
| X (Twitter) | `enableX` | 11 | search, tweet, tweet comments, tweet retweeters, user, user tweets, user replies, user media, user followers, user followings, trending |
| LinkedIn | `enableLinkedin` | 9 | person, person about, person posts, company, company posts, search jobs, job, post, post comments |
| Extract (any URL) | `enableExtract` | 1 | extract |

### Opt-in (85 tools)

| Platform | Flag | Tools | Endpoints |
|---|---|---|---|
| Threads | `enableThreads` | 6 | profile, user posts, user replies, post, post comments, search users |
| Kuaishou (China) | `enableKuaishou` | 14 | profile, user posts, user live, user resolve, video, video comments, comment replies, videos batch, search, search videos, search users, search live, tag feed, trending |
| eBay | `enableEbay` | 3 | search, product, seller |
| Target | `enableTarget` | 4 | search, category, product, reviews |
| Home Depot | `enableHomeDepot` | 3 | search, product, reviews |
| Zillow | `enableZillow` | 3 | search, property, agent reviews |
| Booking.com | `enableBooking` | 3 | search, hotel, reviews |
| Tripadvisor | `enableTripadvisor` | 4 | locations, search, location, reviews |
| Indeed | `enableIndeed` | 4 | search, job, company, company reviews |
| Airbnb | `enableAirbnb` | 3 | search, listing, reviews |
| Glassdoor | `enableGlassdoor` | 4 | companies, company, reviews, salaries |
| Yelp | `enableYelp` | 3 | search, business, reviews |
| Apple App Store | `enableAppStore` | 3 | search, app, reviews |
| Google Play | `enableGooglePlay` | 3 | search, app, reviews |
| SEC EDGAR | `enableSec` | 6 | lookup, company, filings, concept, facts, search |
| Redfin | `enableRedfin` | 3 | search, property, market |
| Companies House | `enableCompaniesHouse` | 4 | search, company, officers, filing history |
| G2 | `enableG2` | 3 | search, product, reviews |
| Capterra | `enableCapterra` | 3 | search, product, reviews |
| Google Ads Transparency | `enableGoogleAds` | 3 | advertisers, search, creative |
| Meta Ad Library | `enableMetaAds` | 3 | search, advertiser, ad |
| **Total** | | **189** | |

Two endpoints are deliberately not exposed:

- `/youtube/metadata` is a deprecated alias of `/youtube/video`; only `YOUTUBE_VIDEO` is registered.
- The five retired LinkedIn endpoints (`person/contact`, `company/people`, `company/jobs`, `search/people`, `search/posts`) return 410 unbilled. `LINKEDIN_COMPANY` returns `featured_employees`, a 4-6 person sample, in place of the retired employee directory, and `LINKEDIN_SEARCH_JOBS` with the company name replaces `company/jobs`.

### Resolve first

Six tools exist only to turn a name you have into the id everything else on that platform is keyed by. Call them first, or the rest of the platform is unreachable: `SEC_LOOKUP` (ticker to CIK), `GLASSDOOR_COMPANIES` (name to `employer_id`), `TRIPADVISOR_LOCATIONS` (name to `geo_id` + `location_id`), `GOOGLE_ADS_ADVERTISERS` (brand to `advertiser_id`), `COMPANIES_HOUSE_SEARCH` (name to `company_number`) and `KUAISHOU_USER_RESOLVE` (share link to `user_id`).

## Credits

Every tool states its cost in its description. Most endpoints cost 1 credit.

| Platform | Credits |
|---|---|
| Google (all 14 v2 endpoints) | 1 |
| Amazon | 1; `AMAZON_OPTIONS` is free (no key, no credits) |
| Reddit (all 12) | 1 |
| TikTok (all 11), TikTok Shop (all 8) | 1 |
| X (all 11) | 1 |
| eBay, Target, Zillow, Booking.com, Airbnb, Glassdoor, App Store, SEC EDGAR, Redfin, Companies House, Google Ads, Meta Ads | 1 |
| Home Depot, Tripadvisor, Indeed, Yelp, Google Play, Capterra | 2 |
| G2 | 5 |
| YouTube | 1, except search 2, shorts 2, streams 3, transcript 8 |
| Instagram | 10, except post 8, comment replies 8, user posts 2 |
| LinkedIn | 1 for person, person about, company, post; 10 for person posts, company posts, search jobs, post comments; **30 for job** (the most expensive endpoint in the API) |

**Four surfaces are body-priced** -- their cost is a function of the request, not a constant for the route, so no single number can be quoted:

| Surface | Price |
|---|---|
| Walmart | 1 credit on `domain` `com` or `ca`, 2 on `com.mx`. `WALMART_PRODUCT`, `_REVIEWS`, `_OFFERS`, `_SELLER` and `_SELLER_PRODUCTS` take no `domain`, so they are always 1. |
| Threads | 2 credits addressed by `user_id`, 4 by `username` (the handle has to be resolved through people search first). `THREADS_POST`, `_POST_COMMENTS` and `_SEARCH_USERS` have no username form and are always 2. |
| Kuaishou | Priced **per endpoint**, never per platform: 1 (`USER_POSTS`, `USER_LIVE`, `USER_RESOLVE`, `VIDEO_COMMENTS`, `COMMENT_REPLIES`, `TAG_FEED`, `TRENDING`), 2 (`VIDEO`), 10 (`PROFILE` and the four searches, per page), 40 (`VIDEOS_BATCH`). |
| Extract | Tier-priced by `mode`: `normal` and `advanced` 1 credit, `ultra` 2. Only a successful extraction is billed -- a dead link, bot wall or timeout costs nothing. |

See [scavio.dev/docs](https://scavio.dev/docs).

## Development

```bash
npm run build      # tsup, CJS + ESM + d.ts
npm run typecheck  # tsc --noEmit
npm test           # vitest run
```

## Links

- Scavio: https://scavio.dev
- Docs: https://scavio.dev/docs
- Dashboard: https://dashboard.scavio.dev
