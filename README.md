# composio-scavio (TypeScript)

[Scavio](https://scavio.dev) real-time search tools for [Composio](https://composio.dev) (TypeScript).

Scavio is a single Search API over Google, YouTube, Amazon, Walmart, Reddit, TikTok, and Instagram. This package exposes those endpoints as a Composio custom toolkit so your agents can pull structured, up-to-date results across any Composio-supported framework.

> **Amazon changed (breaking).** The upstream provider moved in 2026-07:
> `domain` is replaced by `country`, a two-letter marketplace code (`us`, `gb`
> -- the UK is `gb`, not `uk` -- `de`, `jp`, ...), and `sort_by`, `pages`,
> `category_id`, `merchant_id`, `language`, `currency`, `device`, `zip_code`
> and `autoselect_variant` are gone. The marketplace ignores all of them
> (`sort_by` returns the identical unordered set for every value), so they are
> removed rather than kept as silent no-ops. Rank and filter results yourself.

## Install

```bash
npm install composio-scavio
```

`@composio/core` and `zod` are dependencies. Get a Scavio API key from the [Scavio Dashboard](https://dashboard.scavio.dev) (50 free credits to start, no credit card).

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
  countryCode: "us",
});
console.log(out);
```

Pass `all: true` to register every tool regardless of the individual flags.

## Tools

All tools are grouped under the `SCAVIO` custom toolkit; agent-facing slugs are prefixed `LOCAL_SCAVIO_` (Composio convention for custom tools). Providers: Google, Amazon (search, product, offers), Walmart (search, product), YouTube (16 tools: search, shorts, suggestions, video, metadata, comments, comment replies, transcript, related, channel search, channel, channel videos, channel shorts, channel community, channel resolve, streams), Reddit (search, post), TikTok (11 tools), Instagram (12 tools). 47 tools total.

## Credits

Most endpoints cost 1 credit, including Google. Instagram costs 8-10 credits per call per endpoint, except user posts which costs 2. YouTube search and shorts cost 2, YouTube streams 3, and YouTube transcript 8. See [scavio.dev/docs](https://scavio.dev/docs).

## Links

- Scavio: https://scavio.dev
- Docs: https://scavio.dev/docs
- Dashboard: https://dashboard.scavio.dev
