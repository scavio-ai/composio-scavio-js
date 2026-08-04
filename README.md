# composio-scavio (TypeScript)

[Scavio](https://scavio.dev) real-time search tools for [Composio](https://composio.dev) (TypeScript).

Scavio is a single Search API over Google, YouTube, Amazon, Walmart, Reddit, TikTok, TikTok Shop, Instagram, X and LinkedIn. This package exposes **all ten platforms -- 97 tools, one per live endpoint** -- as a Composio custom toolkit so your agents can pull structured, up-to-date results across any Composio-supported framework.

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

`@composio/core`, `scavio` (>= 0.14.0) and `zod` are dependencies. Get a Scavio API key from the [Scavio Dashboard](https://dashboard.scavio.dev) (50 one-time signup credits, no credit card; the free plan does not refill monthly).

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

Pass `all: true` to register every tool regardless of the individual flags.

## Tools

All tools are grouped under the `SCAVIO` custom toolkit; agent-facing slugs are prefixed `LOCAL_SCAVIO_` (Composio convention for custom tools). Every provider is gated by its own flag.

| Platform | Flag | Tools | Endpoints |
|---|---|---|---|
| Google | `enableGoogle` | 14 | search, ai mode, maps search, maps place, maps reviews, shopping, shopping product, shopping stores, flights, hotels, hotels detail, news, trends, trending |
| Amazon | `enableAmazon` | 3 | search, product, offers |
| Walmart | `enableWalmart` | 2 | search, product |
| YouTube | `enableYoutube` | 15 | search, shorts, suggestions, video, comments, comment replies, transcript, related, channel search, channel, channel videos, channel shorts, channel community, channel resolve, streams |
| Reddit | `enableReddit` | 12 | search, search suggestions, post, post comments, comment replies, subreddit, subreddit posts, user, user posts, user comments, popular, trending |
| TikTok | `enableTiktok` | 11 | profile, user posts, video, video comments, comment replies, search videos, search users, hashtag, hashtag videos, user followers, user followings |
| TikTok Shop | `enableTiktokShop` | 8 | search, search suggestions, product, product reviews, categories, category products, shop products, resolve |
| Instagram | `enableInstagram` | 12 | profile, user posts, user reels, user tagged, user stories, post, post comments, comment replies, search users, search hashtags, user followers, user followings |
| X (Twitter) | `enableX` | 11 | search, tweet, tweet comments, tweet retweeters, user, user tweets, user replies, user media, user followers, user followings, trending |
| LinkedIn | `enableLinkedin` | 9 | person, person about, person posts, company, company posts, search jobs, job, post, post comments |
| **Total** | | **97** | |

Two endpoints are deliberately not exposed:

- `/youtube/metadata` is a deprecated alias of `/youtube/video`; only `YOUTUBE_VIDEO` is registered.
- The five retired LinkedIn endpoints (`person/contact`, `company/people`, `company/jobs`, `search/people`, `search/posts`) return 410 unbilled. `LINKEDIN_COMPANY` returns `featured_employees`, a 4-6 person sample, in place of the retired employee directory, and `LINKEDIN_SEARCH_JOBS` with the company name replaces `company/jobs`.

## Credits

Every tool states its cost in its description. Most endpoints cost 1 credit.

| Platform | Credits |
|---|---|
| Google (all 14 v2 endpoints) | 1 |
| Amazon, Walmart | 1 |
| Reddit (all 12) | 1 |
| TikTok (all 11), TikTok Shop (all 8) | 1 |
| X (all 11) | 1 |
| YouTube | 1, except search 2, shorts 2, streams 3, transcript 8 |
| Instagram | 10, except post 8, comment replies 8, user posts 2 |
| LinkedIn | 1 for person, person about, company, post; 10 for person posts, company posts, search jobs, post comments; **30 for job** (the most expensive endpoint in the API) |

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
