import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

/**
 * The Scavio SDK client is mocked, so no key and no network are used. Each
 * namespace is a proxy that records the method name and the exact options object
 * the tool handed it, which is what these tests assert on.
 */
const { calls } = vi.hoisted(() => ({
  calls: [] as { ns: string; method: string; args: Record<string, unknown> }[],
}));

const NAMESPACES = [
  "google",
  "amazon",
  "walmart",
  "youtube",
  "reddit",
  "tiktok",
  "tiktokShop",
  "instagram",
  "x",
  "linkedin",
] as const;

vi.mock("scavio", () => {
  class Scavio {
    constructor(_config: unknown) {
      for (const ns of NAMESPACES) {
        (this as Record<string, unknown>)[ns] = new Proxy(
          {},
          {
            get:
              (_target, method: string) =>
              (args: Record<string, unknown> = {}) => {
                calls.push({ ns, method: String(method), args });
                return Promise.resolve({ ok: true, ns, method: String(method), args });
              },
          }
        );
      }
    }
  }
  return { Scavio };
});

const { buildScavioToolkit } = await import("../src/index.js");

type Toolkit = ReturnType<typeof buildScavioToolkit>;
type Tool = Toolkit["tools"][number];

/**
 * Tool count per provider, and therefore the coverage contract of this package.
 * Total = 97 = every live Scavio endpoint (98 minus the deprecated
 * /youtube/metadata alias, which is not exposed) minus the 5 retired LinkedIn
 * endpoints, which are never registered.
 */
const EXPECTED_COUNTS: Record<string, number> = {
  google: 14,
  amazon: 3,
  walmart: 2,
  youtube: 15,
  reddit: 12,
  tiktok: 11,
  tiktokShop: 8,
  instagram: 12,
  x: 11,
  linkedin: 9,
};

const FLAGS: Record<string, keyof Parameters<typeof buildScavioToolkit>[0]> = {
  google: "enableGoogle",
  amazon: "enableAmazon",
  walmart: "enableWalmart",
  youtube: "enableYoutube",
  reddit: "enableReddit",
  tiktok: "enableTiktok",
  tiktokShop: "enableTiktokShop",
  instagram: "enableInstagram",
  x: "enableX",
  linkedin: "enableLinkedin",
};

/** Credits per tool, from the canonical backend cost maps. */
const CREDITS: Record<string, number> = {
  // Google v2: 14 endpoints, 1 credit each.
  GOOGLE_SEARCH: 1,
  GOOGLE_AI_MODE: 1,
  GOOGLE_MAPS_SEARCH: 1,
  GOOGLE_MAPS_PLACE: 1,
  GOOGLE_MAPS_REVIEWS: 1,
  GOOGLE_SHOPPING: 1,
  GOOGLE_SHOPPING_PRODUCT: 1,
  GOOGLE_SHOPPING_STORES: 1,
  GOOGLE_FLIGHTS: 1,
  GOOGLE_HOTELS: 1,
  GOOGLE_HOTELS_DETAIL: 1,
  GOOGLE_NEWS: 1,
  GOOGLE_TRENDS: 1,
  GOOGLE_TRENDING: 1,
  AMAZON_SEARCH: 1,
  AMAZON_PRODUCT: 1,
  AMAZON_OFFERS: 1,
  WALMART_SEARCH: 1,
  WALMART_PRODUCT: 1,
  // YouTube: search and shorts 2, transcript 8, streams 3, everything else 1.
  YOUTUBE_SEARCH: 2,
  YOUTUBE_SHORTS: 2,
  YOUTUBE_SUGGESTIONS: 1,
  YOUTUBE_VIDEO: 1,
  YOUTUBE_COMMENTS: 1,
  YOUTUBE_COMMENT_REPLIES: 1,
  YOUTUBE_TRANSCRIPT: 8,
  YOUTUBE_RELATED: 1,
  YOUTUBE_CHANNEL_SEARCH: 1,
  YOUTUBE_CHANNEL: 1,
  YOUTUBE_CHANNEL_VIDEOS: 1,
  YOUTUBE_CHANNEL_SHORTS: 1,
  YOUTUBE_CHANNEL_COMMUNITY: 1,
  YOUTUBE_CHANNEL_RESOLVE: 1,
  YOUTUBE_STREAMS: 3,
  REDDIT_SEARCH: 1,
  REDDIT_SEARCH_SUGGESTIONS: 1,
  REDDIT_POST: 1,
  REDDIT_POST_COMMENTS: 1,
  REDDIT_COMMENT_REPLIES: 1,
  REDDIT_SUBREDDIT: 1,
  REDDIT_SUBREDDIT_POSTS: 1,
  REDDIT_USER: 1,
  REDDIT_USER_POSTS: 1,
  REDDIT_USER_COMMENTS: 1,
  REDDIT_POPULAR: 1,
  REDDIT_TRENDING: 1,
  TIKTOK_PROFILE: 1,
  TIKTOK_USER_POSTS: 1,
  TIKTOK_VIDEO: 1,
  TIKTOK_VIDEO_COMMENTS: 1,
  TIKTOK_COMMENT_REPLIES: 1,
  TIKTOK_SEARCH_VIDEOS: 1,
  TIKTOK_SEARCH_USERS: 1,
  TIKTOK_HASHTAG: 1,
  TIKTOK_HASHTAG_VIDEOS: 1,
  TIKTOK_USER_FOLLOWERS: 1,
  TIKTOK_USER_FOLLOWINGS: 1,
  TIKTOK_SHOP_SEARCH: 1,
  TIKTOK_SHOP_SEARCH_SUGGESTIONS: 1,
  TIKTOK_SHOP_PRODUCT: 1,
  TIKTOK_SHOP_PRODUCT_REVIEWS: 1,
  TIKTOK_SHOP_CATEGORIES: 1,
  TIKTOK_SHOP_CATEGORY_PRODUCTS: 1,
  TIKTOK_SHOP_SHOP_PRODUCTS: 1,
  TIKTOK_SHOP_RESOLVE: 1,
  // Instagram is per-endpoint, never a flat rate: 10 by default, 8 where there is
  // no fallback leg to hedge, 2 for the V2-primary user/posts.
  INSTAGRAM_PROFILE: 10,
  INSTAGRAM_USER_POSTS: 2,
  INSTAGRAM_USER_REELS: 10,
  INSTAGRAM_USER_TAGGED: 10,
  INSTAGRAM_USER_STORIES: 10,
  INSTAGRAM_POST: 8,
  INSTAGRAM_POST_COMMENTS: 10,
  INSTAGRAM_COMMENT_REPLIES: 8,
  INSTAGRAM_SEARCH_USERS: 10,
  INSTAGRAM_SEARCH_HASHTAGS: 10,
  INSTAGRAM_USER_FOLLOWERS: 10,
  INSTAGRAM_USER_FOLLOWINGS: 10,
  X_SEARCH: 1,
  X_TWEET: 1,
  X_TWEET_COMMENTS: 1,
  X_TWEET_RETWEETERS: 1,
  X_USER: 1,
  X_USER_TWEETS: 1,
  X_USER_REPLIES: 1,
  X_USER_MEDIA: 1,
  X_USER_FOLLOWERS: 1,
  X_USER_FOLLOWINGS: 1,
  X_TRENDING: 1,
  // LinkedIn has three tiers; job is the most expensive endpoint in the API.
  LINKEDIN_PERSON: 1,
  LINKEDIN_PERSON_ABOUT: 1,
  LINKEDIN_PERSON_POSTS: 10,
  LINKEDIN_COMPANY: 1,
  LINKEDIN_COMPANY_POSTS: 10,
  LINKEDIN_SEARCH_JOBS: 10,
  LINKEDIN_JOB: 30,
  LINKEDIN_POST: 1,
  LINKEDIN_POST_COMMENTS: 10,
};

function build(options: Parameters<typeof buildScavioToolkit>[0] = {}) {
  return buildScavioToolkit({ apiKey: "test", ...options });
}

/** Build a toolkit with exactly one provider enabled. */
function only(provider: string) {
  const options: Record<string, unknown> = { apiKey: "test" };
  for (const [ns, flag] of Object.entries(FLAGS)) options[flag] = ns === provider;
  return buildScavioToolkit(options);
}

function slugsOf(toolkit: Toolkit) {
  return toolkit.tools.map((t: Tool) => t.slug);
}

/** A schema-shaped sample input, so every declared param is exercised. */
function sampleInput(schema: z.ZodTypeAny): Record<string, unknown> {
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape ?? {};
  const out: Record<string, unknown> = {};
  for (const [name, field] of Object.entries(shape)) {
    let inner: z.ZodTypeAny = field as z.ZodTypeAny;
    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
      inner = (inner as z.ZodOptional<z.ZodTypeAny>).unwrap
        ? (inner as z.ZodOptional<z.ZodTypeAny>).unwrap()
        : ((inner as unknown as { _def: { innerType: z.ZodTypeAny } })._def.innerType);
    }
    if (inner instanceof z.ZodNumber) out[name] = 1;
    else if (inner instanceof z.ZodBoolean) out[name] = true;
    else if (inner instanceof z.ZodArray) out[name] = ["x"];
    else out[name] = "x";
  }
  return out;
}

beforeEach(() => {
  calls.length = 0;
});

describe("coverage", () => {
  it("registers every live Scavio endpoint exactly once", () => {
    const slugs = slugsOf(build({ all: true }));
    expect(slugs.length).toBe(97);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("registers the expected number of tools per provider", () => {
    const actual: Record<string, number> = {};
    for (const ns of Object.keys(EXPECTED_COUNTS)) actual[ns] = only(ns).tools.length;
    expect(actual).toEqual(EXPECTED_COUNTS);
    expect(Object.values(actual).reduce((a, b) => a + b, 0)).toBe(97);
  });

  it("covers all ten platforms", () => {
    const slugs = slugsOf(build({ all: true }));
    for (const prefix of [
      "GOOGLE_",
      "AMAZON_",
      "WALMART_",
      "YOUTUBE_",
      "REDDIT_",
      "TIKTOK_",
      "TIKTOK_SHOP_",
      "INSTAGRAM_",
      "X_",
      "LINKEDIN_",
    ]) {
      expect(slugs.some((s: string) => s.startsWith(prefix))).toBe(true);
    }
  });

  it("states the credit cost of every tool, and states it correctly", () => {
    for (const tool of build({ all: true }).tools as Tool[]) {
      const expected = CREDITS[tool.slug];
      expect(expected, `no expected credit cost for ${tool.slug}`).toBeDefined();
      const match = /Costs (\d+) credits?\b/.exec(tool.description ?? "");
      expect(match, `${tool.slug} does not state its credit cost`).not.toBeNull();
      expect(Number(match![1]), `${tool.slug} states the wrong credit cost`).toBe(expected);
    }
  });

  it("every tool calls a method that exists on the installed Scavio SDK", async () => {
    const actual = await vi.importActual<typeof import("scavio")>("scavio");
    const real = new actual.Scavio({ apiKey: "test" }) as unknown as Record<
      string,
      Record<string, unknown>
    >;
    for (const tool of build({ all: true }).tools as Tool[]) {
      calls.length = 0;
      await tool.execute(sampleInput(tool.inputParams as z.ZodTypeAny), {} as never);
      expect(calls.length, `${tool.slug} made no SDK call`).toBe(1);
      const { ns, method } = calls[0];
      expect(
        typeof real[ns]?.[method],
        `${tool.slug} calls missing scavio.${ns}.${method}`
      ).toBe("function");
    }
  });
});

describe("gating", () => {
  it("registers only the enabled provider", () => {
    const slugs = new Set(slugsOf(only("reddit")));
    expect(slugs.size).toBe(12);
    expect(slugs.has("REDDIT_SEARCH")).toBe(true);
    expect([...slugs].some((s) => s.startsWith("GOOGLE_"))).toBe(false);
  });

  it("all overrides the individual flags", () => {
    const slugs = new Set(
      slugsOf(build({ all: true, enableReddit: false, enableX: false, enableLinkedin: false }))
    );
    expect(slugs.has("REDDIT_SEARCH")).toBe(true);
    expect(slugs.has("X_SEARCH")).toBe(true);
    expect(slugs.has("LINKEDIN_JOB")).toBe(true);
  });

  it("gates the three new providers independently", () => {
    expect(only("tiktokShop").tools.length).toBe(8);
    expect(only("x").tools.length).toBe(11);
    expect(only("linkedin").tools.length).toBe(9);
  });
});

describe("google v2", () => {
  const googleTool = (slug: string) =>
    (only("google").tools as Tool[]).find((t) => t.slug === slug)!;

  it("speaks v2 params natively and has no v1 vocabulary", () => {
    const shape = Object.keys((googleTool("GOOGLE_SEARCH").inputParams as z.ZodObject<z.ZodRawShape>).shape);
    expect(shape).toContain("gl");
    expect(shape).toContain("hl");
    expect(shape).toContain("start");
    expect(shape).toContain("google_domain");
    expect(shape).toContain("device");
    // v1 retired 2026-08-04 and returns 410; none of its params survive.
    expect(shape).not.toContain("country_code");
    expect(shape).not.toContain("countryCode");
    expect(shape).not.toContain("language");
    expect(shape).not.toContain("page");
    expect(shape).not.toContain("light_request");
  });

  it("passes start through untouched rather than remapping a page number", async () => {
    await googleTool("GOOGLE_SEARCH").execute(
      { query: "ai agents", gl: "us", hl: "en", start: 10 },
      {} as never
    );
    expect(calls[0].method).toBe("search");
    expect(calls[0].args).toEqual({ query: "ai agents", gl: "us", hl: "en", start: 10 });
  });

  it("registers all 14 v2 verticals", () => {
    expect(new Set(slugsOf(only("google")))).toEqual(
      new Set([
        "GOOGLE_SEARCH",
        "GOOGLE_AI_MODE",
        "GOOGLE_MAPS_SEARCH",
        "GOOGLE_MAPS_PLACE",
        "GOOGLE_MAPS_REVIEWS",
        "GOOGLE_SHOPPING",
        "GOOGLE_SHOPPING_PRODUCT",
        "GOOGLE_SHOPPING_STORES",
        "GOOGLE_FLIGHTS",
        "GOOGLE_HOTELS",
        "GOOGLE_HOTELS_DETAIL",
        "GOOGLE_NEWS",
        "GOOGLE_TRENDS",
        "GOOGLE_TRENDING",
      ])
    );
  });
});

describe("wire quirks", () => {
  const find = (provider: string, slug: string) =>
    (only(provider).tools as Tool[]).find((t) => t.slug === slug)!;

  const shapeOf = (tool: Tool) =>
    Object.keys((tool.inputParams as z.ZodObject<z.ZodRawShape>).shape);

  it("X search takes `search`, not `query`", () => {
    const shape = shapeOf(find("x", "X_SEARCH"));
    expect(shape).toContain("search");
    expect(shape).not.toContain("query");
  });

  it("LinkedIn job search takes `search`, not `query`", () => {
    const shape = shapeOf(find("linkedin", "LINKEDIN_SEARCH_JOBS"));
    expect(shape).toContain("search");
    expect(shape).not.toContain("query");
  });

  it("TikTok Shop search takes `search` and no region", () => {
    const shape = shapeOf(find("tiktokShop", "TIKTOK_SHOP_SEARCH"));
    expect(shape).toEqual(["search", "cursor"]);
  });

  it("Amazon product takes the ASIN, Walmart product takes product_id", () => {
    expect(shapeOf(find("amazon", "AMAZON_PRODUCT"))).toContain("asin");
    expect(shapeOf(find("walmart", "WALMART_PRODUCT"))).toContain("product_id");
  });

  it("Instagram search takes `keyword`", () => {
    expect(shapeOf(find("instagram", "INSTAGRAM_SEARCH_USERS"))).toEqual(["keyword", "cursor"]);
  });

  it("Reddit search takes only query and cursor", async () => {
    const tool = find("reddit", "REDDIT_SEARCH");
    expect(shapeOf(tool)).toEqual(["query", "cursor"]);
    await tool.execute({ query: "serpapi alternative", cursor: "c1" }, {} as never);
    expect(calls[0]).toMatchObject({
      ns: "reddit",
      method: "search",
      args: { query: "serpapi alternative", cursor: "c1" },
    });
  });

  it("Reddit comment replies requires a reply cursor", () => {
    const shape = (find("reddit", "REDDIT_COMMENT_REPLIES").inputParams as z.ZodObject<z.ZodRawShape>)
      .shape;
    expect(shape.cursor.isOptional()).toBe(false);
    expect(shape.post_id.isOptional()).toBe(false);
  });

  it("TikTok cursors are strings", () => {
    const shape = (find("tiktok", "TIKTOK_SEARCH_VIDEOS").inputParams as z.ZodObject<z.ZodRawShape>)
      .shape;
    let cursor: z.ZodTypeAny = shape.cursor;
    if (cursor instanceof z.ZodOptional) cursor = cursor.unwrap();
    expect(cursor).toBeInstanceOf(z.ZodString);
  });

  it("LinkedIn post comments paginate by an integer page, not a cursor", () => {
    const shape = shapeOf(find("linkedin", "LINKEDIN_POST_COMMENTS"));
    expect(shape).toContain("page");
    expect(shape).not.toContain("cursor");
  });
});

describe("endpoints that must not be exposed", () => {
  const slugs = new Set(slugsOf(buildScavioToolkit({ apiKey: "test", all: true })));

  it("does not expose the deprecated /youtube/metadata alias", () => {
    expect(slugs.has("YOUTUBE_METADATA")).toBe(false);
    expect(slugs.has("YOUTUBE_VIDEO")).toBe(true);
  });

  it("does not expose the 5 retired LinkedIn endpoints", () => {
    for (const retired of [
      "LINKEDIN_PERSON_CONTACT",
      "LINKEDIN_COMPANY_PEOPLE",
      "LINKEDIN_COMPANY_JOBS",
      "LINKEDIN_SEARCH_PEOPLE",
      "LINKEDIN_SEARCH_POSTS",
    ]) {
      expect(slugs.has(retired), `${retired} returns 410 and must not be a tool`).toBe(false);
    }
  });
});
