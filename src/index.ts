/**
 * Scavio tools for Composio.
 *
 * Scavio is a single Search API over Google, YouTube, Amazon, Walmart, Reddit, TikTok,
 * TikTok Shop, Instagram, X and LinkedIn. This toolkit exposes all ten platforms as a
 * Composio custom toolkit. Build it with `buildScavioToolkit()` and bind it to a session:
 *
 *   import { Composio } from "@composio/core";
 *   import { buildScavioToolkit } from "@scavio/composio";
 *
 *   const composio = new Composio();
 *   const scavio = buildScavioToolkit({ apiKey: process.env.SCAVIO_API_KEY });
 *   const session = await composio.create("user_1", {
 *     experimental: { customToolkits: [scavio] },
 *   });
 *   const out = await session.execute("LOCAL_SCAVIO_GOOGLE_SEARCH", { query: "ai agents" });
 *
 * Each provider is gated by an `enable*` flag so an agent only sees the tools it needs.
 */
import {
  experimental_createTool,
  experimental_createToolkit,
} from "@composio/core";
import { Scavio } from "scavio";
import { z } from "zod";

export interface BuildScavioToolkitOptions {
  /** Scavio API key. Falls back to the SCAVIO_API_KEY env var. */
  apiKey?: string;
  enableGoogle?: boolean;
  enableAmazon?: boolean;
  enableWalmart?: boolean;
  enableYoutube?: boolean;
  enableReddit?: boolean;
  enableTiktok?: boolean;
  enableTiktokShop?: boolean;
  enableInstagram?: boolean;
  enableX?: boolean;
  enableLinkedin?: boolean;
  /** Register every tool, ignoring the individual flags. */
  all?: boolean;
}

const str = (d: string) => z.string().describe(d);
const ostr = (d: string) => z.string().optional().describe(d);
const onum = (d: string) => z.number().optional().describe(d);
const obool = (d: string) => z.boolean().optional().describe(d);

// The Scavio SDK types several option fields as string-literal unions (e.g.
// sort orders, device profiles). Tool schemas keep them as free-form strings so
// the agent stays flexible and the API validates the value; this extracts an SDK
// method's options type so a validated input can be handed through unchanged.
type SdkOpts<M> = M extends (o: infer O) => unknown ? O : never;

// Google params shared across the v2 family. v1 (/api/v1/google) was retired on
// 2026-08-04 and answers 410, so none of its vocabulary survives here: no
// country_code/language/page, no light_request, no search_type. v2 speaks
// gl/hl/start/google_domain/device natively and they are exposed as-is. `start`
// in particular is a RESULT OFFSET, not a page number - remapping a 1-based page
// onto it silently fetches the wrong page, so no such mapping exists.
const gl = ostr("Country of the search (ISO 3166-1 alpha-2, e.g. 'us', 'gb', 'de').");
const hl = ostr("UI language (ISO 639-1, e.g. 'en').");
const googleDomain = ostr("Regional Google domain, e.g. 'google.co.uk'.");
const location = ostr("Canonical location name, e.g. 'Austin, Texas, United States'. Encoded server-side.");
const device = ostr("Device to emulate: 'desktop' or 'mobile'.");
const currency = ostr("Currency code (ISO 4217, e.g. 'USD').");
const checkInDate = str("Check-in date (YYYY-MM-DD).");
const checkOutDate = str("Check-out date (YYYY-MM-DD).");

/**
 * Build a Composio custom toolkit exposing Scavio search tools.
 *
 * Scavio is a single Search API over Google, YouTube, Amazon, Walmart, Reddit,
 * TikTok, TikTok Shop, Instagram, X and LinkedIn; this toolkit covers all ten.
 * Pass to `composio.create(userId, { experimental:
 * { customToolkits: [toolkit] } })`. Agent-facing slugs are prefixed `LOCAL_SCAVIO_`.
 */
export function buildScavioToolkit(options: BuildScavioToolkitOptions = {}) {
  const {
    apiKey,
    enableGoogle = true,
    enableAmazon = true,
    enableWalmart = true,
    enableYoutube = true,
    enableReddit = true,
    enableTiktok = true,
    enableTiktokShop = true,
    enableInstagram = true,
    enableX = true,
    enableLinkedin = true,
    all = false,
  } = options;

  const client = new Scavio({ apiKey: apiKey ?? process.env.SCAVIO_API_KEY });

  function tool<T extends z.ZodTypeAny>(
    slug: string,
    name: string,
    description: string,
    inputParams: T,
    call: (input: z.infer<T>) => Promise<Record<string, unknown>>
  ) {
    return experimental_createTool(slug, {
      name,
      description,
      inputParams,
      execute: async (input: z.infer<T>) => call(input),
    });
  }

  const tools = [];

  // Google runs on /api/v2/google. Responses are FLAT - the provider payload is
  // spread at the top level next to response_time and credits_used, with no
  // `data` wrapper. All 14 endpoints cost 1 credit.
  if (all || enableGoogle) {
    tools.push(
      tool(
        "GOOGLE_SEARCH",
        "Scavio Google Search",
        "Search Google for real-time web results. Returns organic_results (each with title, link and snippet) plus knowledge_graph, related_questions, ads and the AI Overview when Google shows one. The body is flat - read organic_results at the top level, not under data. Costs 1 credit.",
        z.object({
          query: str("The search query (1-500 characters)."),
          gl,
          hl,
          google_domain: googleDomain,
          location,
          device,
          start: onum("Result offset, NOT a page number: 0 is page 1, 10 is page 2, up to 990."),
          time_period: ostr("Restrict results to a recent time window: 'last_hour', 'last_day', 'last_week', 'last_month', or 'last_year'."),
          safe: ostr("Turn SafeSearch on with 'active'."),
          nfpr: obool("Disable spelling correction and auto-fixes when true."),
        }),
        (i) => client.google.search(i as SdkOpts<typeof client.google.search>)
      ),
      tool(
        "GOOGLE_AI_MODE",
        "Scavio Google AI Mode",
        "Ask Google AI Mode a question. Returns Google's generated answer with its cited sources - use this for a synthesized answer and GOOGLE_SEARCH for a ranked result list. Costs 1 credit.",
        z.object({
          query: str("Question or prompt (1-500 characters)."),
          gl,
          hl,
          google_domain: googleDomain,
          location,
          device,
          safe: ostr("Turn SafeSearch on with 'active'."),
        }),
        (i) => client.google.aiMode(i as SdkOpts<typeof client.google.aiMode>)
      ),
      tool(
        "GOOGLE_MAPS_SEARCH",
        "Scavio Google Maps Search",
        "Search Google Maps for local businesses and places. Returns local results with ratings, review counts, addresses, phone numbers and place ids. Feed a place_id into GOOGLE_MAPS_PLACE or GOOGLE_MAPS_REVIEWS. Costs 1 credit.",
        z.object({
          query: str("Search query, e.g. 'coffee shops in Austin' (1-500 characters)."),
          ll: ostr("Map centre as '@lat,lng,zoomz'; controls which area results come from. Maps localizes by map centre, not gl."),
          start: onum("Result offset; must be a multiple of 20 (0, 20, 40, ...)."),
          gl,
          hl,
          google_domain: googleDomain,
        }),
        (i) => client.google.mapsSearch(i)
      ),
      tool(
        "GOOGLE_MAPS_PLACE",
        "Scavio Google Maps Place",
        "Fetch one Google Maps place in full: hours, address, phone, website, rating, price level and photos. Provide place_id or data_cid. Costs 1 credit.",
        z.object({
          place_id: ostr("Place ID (starts with ChIJ). Provide this or data_cid."),
          data_cid: ostr("Numeric CID. Provide this or place_id."),
        }),
        (i) => client.google.mapsPlace(i)
      ),
      tool(
        "GOOGLE_MAPS_REVIEWS",
        "Scavio Google Maps Reviews",
        "List Google Maps reviews for a place. Provide data_id or place_id. Page with next_page_token; each page costs another credit. Costs 1 credit.",
        z.object({
          place_id: ostr("Place ID (starts with ChIJ). Provide this or data_id."),
          data_id: ostr("Data ID in 0xHEX:0xHEX form. Provide this or place_id."),
          num: onum("Reviews per page (1-20)."),
          sort_by: ostr("Review sort order: 'relevance', 'newest', 'highest_rating', or 'lowest_rating'."),
          next_page_token: ostr("Pagination cursor from a prior response."),
          gl,
          hl,
          google_domain: googleDomain,
        }),
        (i) => client.google.mapsReviews(i as SdkOpts<typeof client.google.mapsReviews>)
      ),
      tool(
        "GOOGLE_SHOPPING",
        "Scavio Google Shopping",
        "Search Google Shopping. Returns product cards with prices, merchants, ratings and catalog ids across retailers - use this for cross-retailer price comparison and AMAZON_SEARCH or WALMART_SEARCH for a single marketplace. Costs 1 credit.",
        z.object({
          query: str("Product search query (1-500 characters)."),
          min_price: onum("Minimum price filter."),
          max_price: onum("Maximum price filter."),
          sort_by: onum("0 = relevance, 1 = price ascending, 2 = price descending."),
          free_shipping: obool("Only items with free shipping."),
          on_sale: obool("Only items on sale."),
          start: onum("Result offset."),
          gl,
          hl,
          google_domain: googleDomain,
          location,
          device,
        }),
        (i) => client.google.shopping(i as SdkOpts<typeof client.google.shopping>)
      ),
      tool(
        "GOOGLE_SHOPPING_PRODUCT",
        "Scavio Google Shopping Product",
        "Fetch one Google Shopping product: specs, reviews, and the sellers carrying it. Pass catalog_id together with query for full detail and the seller list. Costs 1 credit.",
        z.object({
          catalog_id: ostr("Durable product catalog id from a shopping search."),
          query: ostr("Product query. Required when catalog_id is set."),
          product_id: ostr("Product id, as an alternative to catalog_id."),
          page_token: ostr("Immersive product page token."),
          sort_by: ostr("Seller sort order: 'base_price', 'total_price', 'promotion', or 'seller_rating'."),
          load_all_stores: obool("Load every available store."),
          more_stores: obool("Fetch additional stores."),
          gl,
          hl,
          google_domain: googleDomain,
          location,
          device: ostr("Device to emulate: 'desktop', 'mobile', or 'tablet'."),
        }),
        (i) => client.google.shoppingProduct(i as SdkOpts<typeof client.google.shoppingProduct>)
      ),
      tool(
        "GOOGLE_SHOPPING_STORES",
        "Scavio Google Shopping Stores",
        "Fetch the next page of sellers for a Google Shopping product. Continuation of GOOGLE_SHOPPING_PRODUCT: pass the same catalog_id plus that response's next_page_token. Costs 1 credit.",
        z.object({
          catalog_id: str("Durable product catalog id."),
          next_page_token: str("Pagination cursor from GOOGLE_SHOPPING_PRODUCT."),
        }),
        (i) => client.google.shoppingStores(i)
      ),
      tool(
        "GOOGLE_FLIGHTS",
        "Scavio Google Flights",
        "Search Google Flights. Returns itineraries with prices, airlines, stops, durations and carbon emissions. Airports are IATA codes; dates are YYYY-MM-DD. Costs 1 credit.",
        z.object({
          departure_id: str("Departure IATA code(s), comma-separated allowed, e.g. 'JFK'."),
          arrival_id: str("Arrival IATA code(s), comma-separated allowed, e.g. 'LHR'."),
          outbound_date: str("Outbound date (YYYY-MM-DD)."),
          return_date: ostr("Return date (YYYY-MM-DD). Required when type is 1."),
          type: onum("1 = round trip (default), 2 = one way, 3 = multi-city."),
          adults: onum("Number of adults (1-9)."),
          children: onum("Number of children (0-9)."),
          infants_in_seat: onum("Infants in seat (0-4)."),
          infants_on_lap: onum("Infants on lap (0-4)."),
          travel_class: onum("1 = economy, 2 = premium economy, 3 = business, 4 = first."),
          stops: onum("0 = any, 1 = nonstop, 2 = one stop or fewer, 3 = two or fewer."),
          sort_by: onum("1 = top, 2 = price, 3 = departure, 4 = arrival, 5 = duration, 6 = emissions."),
          include_airlines: ostr("Comma-separated airline or alliance codes to include."),
          exclude_airlines: ostr("Comma-separated airline or alliance codes to exclude."),
          currency,
          gl,
          hl,
        }),
        (i) => client.google.flights(i)
      ),
      tool(
        "GOOGLE_HOTELS",
        "Scavio Google Hotels",
        "Search Google Hotels. Returns properties with nightly prices, ratings, amenities and a detail_token for GOOGLE_HOTELS_DETAIL. Phrase the query as '<City> hotels'. Costs 1 credit.",
        z.object({
          query: str("Search query; use a '<City> hotels' form."),
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          sort_by: onum("3 = lowest price, 8 = highest rating, 13 = most reviewed."),
          min_price: onum("Minimum nightly price."),
          max_price: onum("Maximum nightly price."),
          rating: onum("7 = 3.5+, 8 = 4.0+, 9 = 4.5+."),
          hotel_class: ostr("Comma-separated star ratings (2-5)."),
          amenities: ostr("Comma-separated amenity ids."),
          property_types: ostr("Comma-separated property-type ids, e.g. '12' for vacation rentals."),
          free_cancellation: obool("Only properties with free cancellation."),
          eco_certified: obool("Only eco-certified properties."),
          special_offers: obool("Only properties with special offers."),
          limit: onum("Number of properties to return (1-20)."),
          next_page_token: ostr("Pagination cursor from a prior response."),
          currency,
          gl,
          hl,
        }),
        (i) => client.google.hotels(i)
      ),
      tool(
        "GOOGLE_HOTELS_DETAIL",
        "Scavio Google Hotels Detail",
        "Fetch one Google Hotels property in full: room types, per-night prices by provider, amenities, photos and reviews. Needs a detail_token from GOOGLE_HOTELS and the same stay dates. Costs 1 credit.",
        z.object({
          detail_token: str("Property detail token from a hotels listing."),
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          currency,
          gl,
          hl,
        }),
        (i) => client.google.hotelsDetail(i)
      ),
      tool(
        "GOOGLE_NEWS",
        "Scavio Google News",
        "Fetch Google News. Pass query to search, or a topic_token / story_token / publication_token from an earlier response to browse a topic, a full story or one publisher. Costs 1 credit.",
        z.object({
          query: ostr("Keyword search."),
          topic_token: ostr("Browse a news topic."),
          section_token: ostr("Browse a topic section."),
          story_token: ostr("Fetch full coverage of one story."),
          publication_token: ostr("Browse one publication."),
          kgmid: ostr("Knowledge Graph entity id."),
          so: onum("Sort: 0 = relevance, 1 = date. Only applies with query or kgmid."),
          gl,
          hl,
          google_domain: googleDomain,
        }),
        (i) => client.google.news(i)
      ),
      tool(
        "GOOGLE_TRENDS",
        "Scavio Google Trends",
        "Fetch Google Trends interest data. Comma-separate the query to compare terms, and pick the dataset with data_type: TIMESERIES for interest over time, GEO_MAP for interest by region, RELATED_QUERIES or RELATED_TOPICS for rising searches. Costs 1 credit.",
        z.object({
          query: str("Search term(s); comma-separated to compare up to five."),
          data_type: ostr("Which trends dataset to return: 'TIMESERIES', 'GEO_MAP', 'GEO_MAP_0', 'RELATED_QUERIES', or 'RELATED_TOPICS'."),
          geo: ostr("Location code, e.g. 'US', 'GB', 'US-CA'. Omit for worldwide."),
          date: ostr("Time range, e.g. 'today 12-m', 'now 7-d'."),
          cat: ostr("Category id."),
          gprop: ostr("Restrict to a Google property: 'images', 'news', 'youtube', or 'froogle'."),
          region: ostr("Resolution for GEO_MAP data: 'COUNTRY', 'REGION', 'DMA', or 'CITY'."),
          tz: ostr("Timezone offset in minutes."),
          hl,
        }),
        (i) => client.google.trends(i as SdkOpts<typeof client.google.trends>)
      ),
      tool(
        "GOOGLE_TRENDING",
        "Scavio Google Trending",
        "List what is trending on Google right now for one country. geo is required. Use GOOGLE_TRENDS instead when you already know the term you care about. Costs 1 credit.",
        z.object({
          geo: str("Country code, e.g. 'US'."),
          hours: onum("Trending window in hours: 4, 24, 48 or 168."),
          cat: onum("Category id (0-20)."),
          sort: ostr("Sort order: 'relevance', 'search_volume', 'recency', or 'title'."),
          status: ostr("Filter by trend status: 'all' or 'active'."),
          hl,
        }),
        (i) => client.google.trending(i as SdkOpts<typeof client.google.trending>)
      )
    );
  }

  // Amazon moved upstream in 2026-07: sort_by, pages, category_id, merchant_id,
  // language, currency, device, zip_code and autoselect_variant no longer exist.
  // Removed rather than kept as no-ops - sort_by was verified to return the
  // identical unordered set for every value. `domain` still works on the wire
  // as a deprecated alias but is not offered: one spelling per param.
  if (all || enableAmazon) {
    tools.push(
      tool(
        "AMAZON_SEARCH",
        "Scavio Amazon Search",
        "Search Amazon for products matching a query. Results are unsorted and cannot be filtered by category, merchant or price. Costs 1 credit.",
        z.object({
          query: str("The product search query."),
          country: ostr("Marketplace country code (ISO 3166-1 alpha-2), not a domain: 'us' (default), 'gb' (the UK is gb, not uk), 'ca', 'de', 'fr', 'es', 'it', 'jp', 'in', 'au', 'br', 'mx', 'nl', 'pl', 'se', 'sg', 'ae', 'sa', 'eg', 'cn', 'be', 'tr'. An unknown code falls back to us."),
          page: onum("Result page, 1-based. One page per call, 1 credit each."),
        }),
        (i) => client.amazon.search(i as SdkOpts<typeof client.amazon.search>)
      ),
      tool(
        "AMAZON_PRODUCT",
        "Scavio Amazon Product",
        "Fetch full Amazon product details by ASIN. price is the buy-box price only. Costs 1 credit.",
        z.object({
          asin: str("Amazon Standard Identification Number (ASIN) of the product."),
          country: ostr("Marketplace country code (ISO 3166-1 alpha-2), not a domain: 'us' (default), 'gb' (the UK is gb, not uk), 'ca', 'de', 'fr', 'es', 'it', 'jp', 'in', 'au', 'br', 'mx', 'nl', 'pl', 'se', 'sg', 'ae', 'sa', 'eg', 'cn', 'be', 'tr'. An unknown code falls back to us."),
        }),
        (i) => client.amazon.product(i as SdkOpts<typeof client.amazon.product>)
      ),
      tool(
        "AMAZON_OFFERS",
        "Scavio Amazon Offers",
        "List every seller offer for one Amazon ASIN: price, seller, condition, shipping, and which offer holds the buy box. Page 1 only. Use this instead of AMAZON_PRODUCT when comparing sellers or checking who owns the buy box. Costs 1 credit.",
        z.object({
          asin: str("Amazon Standard Identification Number (ASIN) of the product."),
          country: ostr("Marketplace country code (ISO 3166-1 alpha-2), not a domain: 'us' (default), 'gb' (the UK is gb, not uk), 'ca', 'de', 'fr', 'es', 'it', 'jp', 'in', 'au', 'br', 'mx', 'nl', 'pl', 'se', 'sg', 'ae', 'sa', 'eg', 'cn', 'be', 'tr'. An unknown code falls back to us."),
        }),
        (i) => client.amazon.offers(i as SdkOpts<typeof client.amazon.offers>)
      )
    );
  }

  if (all || enableWalmart) {
    tools.push(
      tool(
        "WALMART_SEARCH",
        "Scavio Walmart Search",
        "Search Walmart for products matching a query. Costs 1 credit.",
        z.object({
          query: str("The product search query."),
          domain: ostr("Walmart domain."),
          device: ostr("Device profile: 'desktop' or 'mobile'."),
          sort_by: ostr("Sort order for results."),
          start_page: onum("First page to return."),
          min_price: onum("Minimum price filter."),
          max_price: onum("Maximum price filter."),
          fulfillment_speed: ostr("Fulfillment speed filter."),
          fulfillment_type: ostr("Fulfillment type filter."),
          delivery_zip: ostr("Delivery ZIP/postal code."),
          store_id: ostr("Restrict to a store id."),
        }),
        (i) => client.walmart.search(i as SdkOpts<typeof client.walmart.search>)
      ),
      tool(
        "WALMART_PRODUCT",
        "Scavio Walmart Product",
        "Fetch full Walmart product details by product id. Costs 1 credit.",
        z.object({
          product_id: str("Walmart product id."),
          domain: ostr("Walmart domain."),
          device: ostr("Device profile: 'desktop' or 'mobile'."),
          delivery_zip: ostr("Delivery ZIP/postal code."),
          store_id: ostr("Restrict to a store id."),
        }),
        (i) => client.walmart.product(i as SdkOpts<typeof client.walmart.product>)
      )
    );
  }

  // /youtube/metadata is a deprecated alias of /youtube/video and is deliberately
  // not exposed - two tools for one endpoint only makes an agent pick wrong.
  if (all || enableYoutube) {
    tools.push(
      tool(
        "YOUTUBE_SEARCH",
        "Scavio YouTube Search",
        "Search YouTube for videos, channels, or playlists. Costs 2 credits.",
        z.object({
          query: str("The video search query."),
          upload_date: ostr("Upload date filter: 'last_hour', 'today', 'this_week', 'this_month', 'this_year'."),
          type: ostr("Result type: 'video', 'channel', 'playlist', or 'movie'."),
          duration: ostr("Duration filter: 'short', 'medium', or 'long'."),
          sort_by: ostr("Sort order: 'relevance', 'date', 'view_count', or 'rating'."),
          features: z.array(z.string()).optional().describe("Feature filters, e.g. ['hd', '4k', 'subtitles', 'creative_commons', 'live', '360', '3d', 'hdr', 'vr180']."),
          cursor: ostr("Pagination cursor from a prior response."),
          hd: obool("Restrict to HD videos when true."),
          subtitles: obool("Restrict to videos with subtitles when true."),
          creative_commons: obool("Restrict to Creative Commons videos when true."),
          live: obool("Restrict to live videos when true."),
        }),
        (i) => client.youtube.search(i as SdkOpts<typeof client.youtube.search>)
      ),
      tool(
        "YOUTUBE_SHORTS",
        "Scavio YouTube Shorts",
        "Search YouTube Shorts. Costs 2 credits.",
        z.object({
          query: str("The Shorts search query."),
          sort_by: ostr("Sort order: 'relevance', 'date', 'view_count', or 'rating'."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.shorts(i as SdkOpts<typeof client.youtube.shorts>)
      ),
      tool(
        "YOUTUBE_SUGGESTIONS",
        "Scavio YouTube Suggestions",
        "Get YouTube search autocomplete suggestions for a partial query. Costs 1 credit.",
        z.object({
          query: str("The partial query to autocomplete."),
          language: ostr("Suggestion language (ISO 639-1, default 'en')."),
          region: ostr("Region code (ISO 3166-1 alpha-2, default 'US')."),
        }),
        (i) => client.youtube.suggestions(i)
      ),
      tool(
        "YOUTUBE_VIDEO",
        "Scavio YouTube Video",
        "Fetch full metadata for a YouTube video by id or watch URL. Costs 1 credit.",
        z.object({ video_id: str("YouTube video id or a full watch URL.") }),
        (i) => client.youtube.video(i)
      ),
      tool(
        "YOUTUBE_COMMENTS",
        "Scavio YouTube Comments",
        "List top-level comments on a YouTube video. Costs 1 credit.",
        z.object({
          video_id: str("YouTube video id or a full watch URL."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.comments(i)
      ),
      tool(
        "YOUTUBE_COMMENT_REPLIES",
        "Scavio YouTube Comment Replies",
        "List replies to a YouTube comment using its reply cursor. Costs 1 credit.",
        z.object({
          video_id: str("YouTube video id or a full watch URL."),
          reply_cursor: str("Reply cursor from a parent comment's 'reply_cursor' field."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.commentReplies(i)
      ),
      tool(
        "YOUTUBE_TRANSCRIPT",
        "Scavio YouTube Transcript",
        "Fetch the transcript or timed captions for a YouTube video. Costs 8 credits.",
        z.object({
          video_id: str("YouTube video id or a full watch URL."),
          language: ostr("Caption language code (default 'en')."),
          format: ostr("'text' for a plain transcript or 'srt' for timed subtitles (default 'text')."),
        }),
        (i) => client.youtube.transcript(i as SdkOpts<typeof client.youtube.transcript>)
      ),
      tool(
        "YOUTUBE_RELATED",
        "Scavio YouTube Related",
        "List videos related to a YouTube video. Costs 1 credit.",
        z.object({
          video_id: str("YouTube video id or a full watch URL."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.related(i)
      ),
      tool(
        "YOUTUBE_CHANNEL_SEARCH",
        "Scavio YouTube Channel Search",
        "Search YouTube channels by keyword. Costs 1 credit.",
        z.object({
          query: str("The channel search query."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.channelSearch(i)
      ),
      tool(
        "YOUTUBE_CHANNEL",
        "Scavio YouTube Channel",
        "Fetch YouTube channel details by id, @handle, or URL. Costs 1 credit.",
        z.object({ channel_id: str("YouTube channel id, @handle, or channel URL.") }),
        (i) => client.youtube.channel(i)
      ),
      tool(
        "YOUTUBE_CHANNEL_VIDEOS",
        "Scavio YouTube Channel Videos",
        "List videos uploaded by a YouTube channel. Costs 1 credit.",
        z.object({
          channel_id: str("YouTube channel id."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.channelVideos(i)
      ),
      tool(
        "YOUTUBE_CHANNEL_SHORTS",
        "Scavio YouTube Channel Shorts",
        "List Shorts posted by a YouTube channel. Costs 1 credit.",
        z.object({
          channel_id: str("YouTube channel id."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.channelShorts(i)
      ),
      tool(
        "YOUTUBE_CHANNEL_COMMUNITY",
        "Scavio YouTube Channel Community",
        "List community posts from a YouTube channel. Costs 1 credit.",
        z.object({
          channel_id: str("YouTube channel id."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.youtube.channelCommunity(i)
      ),
      tool(
        "YOUTUBE_CHANNEL_RESOLVE",
        "Scavio YouTube Channel Resolve",
        "Resolve a YouTube @handle or channel URL to a channel id. Costs 1 credit.",
        z.object({ channel: str("A channel @handle or channel URL to resolve to a channel id.") }),
        (i) => client.youtube.channelResolve(i)
      ),
      tool(
        "YOUTUBE_STREAMS",
        "Scavio YouTube Streams",
        "Fetch playable or downloadable stream formats for a YouTube video. Costs 3 credits.",
        z.object({ video_id: str("YouTube video id or a full watch URL.") }),
        (i) => client.youtube.streams(i)
      )
    );
  }

  // /reddit/search takes ONLY query + cursor. `type` and `sort` were never real:
  // the API strips unknown fields, so they filtered nothing while making the agent
  // believe the result set was narrowed. Removed rather than kept as no-ops.
  // Sort defaults differ per endpoint (TOP for comments, HOT for a subreddit feed,
  // NEW for a user feed) and values are UPPERCASE; only the subreddit feed accepts
  // RISING. All twelve endpoints cost 1 credit.
  if (all || enableReddit) {
    tools.push(
      tool(
        "REDDIT_SEARCH",
        "Scavio Reddit Search",
        "Search Reddit posts. Returns data.results with next_cursor and has_more; page with cursor. Results cannot be filtered or sorted. Costs 1 credit.",
        z.object({
          query: str("The Reddit search query."),
          cursor: ostr("Pagination cursor: pass 'next_cursor' from a prior response."),
        }),
        (i) => client.reddit.search(i as SdkOpts<typeof client.reddit.search>)
      ),
      tool(
        "REDDIT_SEARCH_SUGGESTIONS",
        "Scavio Reddit Search Suggestions",
        "Get Reddit search autocomplete suggestions for a query. Returns data.suggestions (plain strings) and total_count. Costs 1 credit.",
        z.object({ query: str("The partial or full query to expand.") }),
        (i) => client.reddit.searchSuggestions(i)
      ),
      tool(
        "REDDIT_POST",
        "Scavio Reddit Post",
        "Fetch one Reddit post by URL or post id. Returns a FLAT post object under data (post_id, title, text, url, subreddit, author, score, upvote_ratio, num_comments, created_at, is_nsfw, is_video, thumbnail, media); comments are NOT included - call REDDIT_POST_COMMENTS for those. Costs 1 credit.",
        z.object({
          url: ostr("Full URL of the Reddit post. Provide this or post_id."),
          post_id: ostr("Post fullname (t3_...) or bare id. Provide this or url."),
        }),
        (i) => client.reddit.post(i)
      ),
      tool(
        "REDDIT_POST_COMMENTS",
        "Scavio Reddit Post Comments",
        "List top-level comments on a Reddit post. Returns data.comments with next_cursor and has_more; each comment carries a reply_cursor for REDDIT_COMMENT_REPLIES. Costs 1 credit.",
        z.object({
          post_id: str("Post fullname (t3_...), bare id, or post URL."),
          sort: ostr("Comment sort order (UPPERCASE): 'HOT', 'NEW', 'TOP', 'BEST', or 'CONTROVERSIAL'. Defaults to TOP."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.reddit.postComments(i as SdkOpts<typeof client.reddit.postComments>)
      ),
      tool(
        "REDDIT_COMMENT_REPLIES",
        "Scavio Reddit Comment Replies",
        "List replies to one Reddit comment. cursor is REQUIRED here and must be a comment's 'reply_cursor' from REDDIT_POST_COMMENTS, not a 'next_cursor'. Costs 1 credit.",
        z.object({
          post_id: str("Post fullname (t3_...) the comment belongs to."),
          cursor: str("A comment's 'reply_cursor' from REDDIT_POST_COMMENTS. Required."),
          sort: ostr("Comment sort order (UPPERCASE): 'HOT', 'NEW', 'TOP', 'BEST', or 'CONTROVERSIAL'. Defaults to TOP."),
        }),
        (i) => client.reddit.commentReplies(i as SdkOpts<typeof client.reddit.commentReplies>)
      ),
      tool(
        "REDDIT_SUBREDDIT",
        "Scavio Reddit Subreddit",
        "Fetch a subreddit's profile: title, description, subscribers, active_count, type, icon, banner and created_at. Costs 1 credit.",
        z.object({ subreddit: str("Subreddit name without the r/ prefix, e.g. 'AskReddit'.") }),
        (i) => client.reddit.subreddit(i)
      ),
      tool(
        "REDDIT_SUBREDDIT_POSTS",
        "Scavio Reddit Subreddit Posts",
        "List posts in a subreddit feed. Returns data.posts with next_cursor and has_more. This feed shape has no text and no thumbnail - use REDDIT_POST for a post's body. Costs 1 credit.",
        z.object({
          subreddit: str("Subreddit name without the r/ prefix."),
          sort: ostr("Feed sort order (UPPERCASE): 'BEST', 'HOT', 'NEW', 'TOP', 'CONTROVERSIAL', or 'RISING'. Defaults to HOT. This is the only endpoint accepting RISING."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.reddit.subredditPosts(i as SdkOpts<typeof client.reddit.subredditPosts>)
      ),
      tool(
        "REDDIT_USER",
        "Scavio Reddit User",
        "Fetch a redditor's profile: karma split, account_type, avatar, description, verification flags and created_at. Costs 1 credit.",
        z.object({ username: str("Redditor username without the u/ prefix, e.g. 'spez'.") }),
        (i) => client.reddit.user(i)
      ),
      tool(
        "REDDIT_USER_POSTS",
        "Scavio Reddit User Posts",
        "List posts submitted by a redditor. Returns data.posts with next_cursor and has_more. Costs 1 credit.",
        z.object({
          username: str("Redditor username without the u/ prefix."),
          sort: ostr("Sort order (UPPERCASE): 'HOT', 'NEW', 'TOP', 'BEST', or 'CONTROVERSIAL'. Defaults to NEW."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.reddit.userPosts(i as SdkOpts<typeof client.reddit.userPosts>)
      ),
      tool(
        "REDDIT_USER_COMMENTS",
        "Scavio Reddit User Comments",
        "List comments written by a redditor. Returns data.comments with next_cursor and has_more; each item nests the post it belongs to. Costs 1 credit.",
        z.object({
          username: str("Redditor username without the u/ prefix."),
          sort: ostr("Sort order (UPPERCASE): 'HOT', 'NEW', 'TOP', 'BEST', or 'CONTROVERSIAL'. Defaults to NEW."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.reddit.userComments(i as SdkOpts<typeof client.reddit.userComments>)
      ),
      tool(
        "REDDIT_POPULAR",
        "Scavio Reddit Popular",
        "List the site-wide r/popular feed. Returns data.posts with next_cursor and has_more. Costs 1 credit.",
        z.object({ cursor: ostr("Pagination cursor from a prior response. Omit for page 1.") }),
        (i) => client.reddit.popular(i)
      ),
      tool(
        "REDDIT_TRENDING",
        "Scavio Reddit Trending",
        "List Reddit's currently trending searches. Returns data.trending (query plus raw_query) and total_count. Takes no parameters. Costs 1 credit.",
        z.object({}),
        () => client.reddit.trending()
      )
    );
  }

  if (all || enableTiktok) {
    tools.push(
      tool(
        "TIKTOK_PROFILE",
        "Scavio TikTok Profile",
        "Fetch a TikTok user profile by username or secUid. Costs 1 credit.",
        z.object({
          username: ostr("TikTok username (without @). Provide this or sec_user_id."),
          sec_user_id: ostr("TikTok secUid. Provide this or username."),
        }),
        (i) => client.tiktok.profile(i)
      ),
      tool(
        "TIKTOK_USER_POSTS",
        "Scavio TikTok User Posts",
        "List a TikTok user's posts by secUid. Costs 1 credit.",
        z.object({
          sec_user_id: str("TikTok secUid of the user."),
          cursor: ostr("Pagination cursor."),
          count: onum("Number of posts to return."),
          sort_type: ostr("Sort order for posts."),
        }),
        (i) => client.tiktok.userPosts(i as SdkOpts<typeof client.tiktok.userPosts>)
      ),
      tool(
        "TIKTOK_VIDEO",
        "Scavio TikTok Video",
        "Fetch a TikTok video by id. Costs 1 credit.",
        z.object({ video_id: str("TikTok video id.") }),
        (i) => client.tiktok.video(i)
      ),
      tool(
        "TIKTOK_VIDEO_COMMENTS",
        "Scavio TikTok Video Comments",
        "List comments on a TikTok video. Costs 1 credit.",
        z.object({
          video_id: str("TikTok video id."),
          cursor: ostr("Pagination cursor."),
          count: onum("Number of comments to return."),
        }),
        (i) => client.tiktok.videoComments(i)
      ),
      tool(
        "TIKTOK_COMMENT_REPLIES",
        "Scavio TikTok Comment Replies",
        "List replies to a TikTok video comment. Costs 1 credit.",
        z.object({
          video_id: str("TikTok video id."),
          comment_id: str("Parent comment id."),
          cursor: ostr("Pagination cursor."),
          count: onum("Number of replies to return."),
        }),
        (i) => client.tiktok.commentReplies(i)
      ),
      tool(
        "TIKTOK_SEARCH_VIDEOS",
        "Scavio TikTok Search Videos",
        "Search TikTok videos by keyword. Costs 1 credit.",
        z.object({
          keyword: str("Search keyword."),
          cursor: ostr("Pagination cursor."),
          count: onum("Number of videos to return."),
          sort_type: ostr("Sort order for results."),
          publish_time: ostr("Publish-time filter."),
        }),
        (i) => client.tiktok.searchVideos(i as SdkOpts<typeof client.tiktok.searchVideos>)
      ),
      tool(
        "TIKTOK_SEARCH_USERS",
        "Scavio TikTok Search Users",
        "Search TikTok users by keyword. Costs 1 credit.",
        z.object({
          keyword: str("Search keyword."),
          cursor: ostr("Pagination cursor."),
          count: onum("Number of users to return."),
        }),
        (i) => client.tiktok.searchUsers(i)
      ),
      tool(
        "TIKTOK_HASHTAG",
        "Scavio TikTok Hashtag",
        "Fetch a TikTok hashtag by name or id. Costs 1 credit.",
        z.object({
          hashtag_name: ostr("Hashtag name (without #). Provide this or hashtag_id."),
          hashtag_id: ostr("Hashtag id. Provide this or hashtag_name."),
        }),
        (i) => client.tiktok.hashtag(i)
      ),
      tool(
        "TIKTOK_HASHTAG_VIDEOS",
        "Scavio TikTok Hashtag Videos",
        "List videos for a TikTok hashtag by id. Costs 1 credit.",
        z.object({
          hashtag_id: str("Hashtag id."),
          cursor: ostr("Pagination cursor."),
          count: onum("Number of videos to return."),
        }),
        (i) => client.tiktok.hashtagVideos(i)
      ),
      tool(
        "TIKTOK_USER_FOLLOWERS",
        "Scavio TikTok User Followers",
        "List a TikTok user's followers by secUid. Costs 1 credit.",
        z.object({
          sec_user_id: str("TikTok secUid of the user."),
          count: onum("Number of followers to return."),
          page_token: ostr("Pagination token."),
          min_time: onum("Minimum timestamp filter."),
        }),
        (i) => client.tiktok.userFollowers(i)
      ),
      tool(
        "TIKTOK_USER_FOLLOWINGS",
        "Scavio TikTok User Followings",
        "List the accounts a TikTok user follows, by secUid. Costs 1 credit.",
        z.object({
          sec_user_id: str("TikTok secUid of the user."),
          count: onum("Number of followings to return."),
          page_token: ostr("Pagination token."),
          min_time: onum("Minimum timestamp filter."),
        }),
        (i) => client.tiktok.userFollowings(i)
      )
    );
  }

  // TikTok Shop: 8 endpoints, 1 credit each. Two different region enums on
  // purpose - the listing endpoints serve US and GB only, everything else serves
  // the full eight, and /tiktok-shop/search takes no region at all (US catalog).
  // Cursors are opaque blobs from a prior next_cursor; a foreign cursor 400s.
  if (all || enableTiktokShop) {
    tools.push(
      tool(
        "TIKTOK_SHOP_SEARCH",
        "Scavio TikTok Shop Search",
        "Search TikTok Shop products by keyword (US catalog only), up to 30 per page with exact prices, ratings and shop details. One of the three endpoints that return exact prices. Paginate with next_cursor and dedupe by product_id across pages. Costs 1 credit.",
        z.object({
          search: str("Search query (1-200 characters). The keyword field is named 'search', not 'query'."),
          cursor: ostr("Opaque cursor from a prior response's next_cursor."),
        }),
        (i) => client.tiktokShop.search(i)
      ),
      tool(
        "TIKTOK_SHOP_SEARCH_SUGGESTIONS",
        "Scavio TikTok Shop Search Suggestions",
        "Expand a partial TikTok Shop query into keyword suggestions across 8 marketplace regions. Suggestions are not guaranteed prefix matches: a misspelling returns typo corrections, and results can include brand and shop names. Costs 1 credit.",
        z.object({
          search: str("Partial query to expand (1-100 characters). The field is 'search', not 'query'."),
          region: ostr("Marketplace region: 'US' (default), 'GB', 'SG', 'MY', 'PH', 'TH', 'VN', or 'ID'."),
        }),
        (i) => client.tiktokShop.searchSuggestions(i as SdkOpts<typeof client.tiktokShop.searchSuggestions>)
      ),
      tool(
        "TIKTOK_SHOP_PRODUCT",
        "Scavio TikTok Shop Product",
        "Full TikTok Shop product detail: description, images, variants with stock, shipping, shop profile, category path and top reviews. Two limits: it does NOT return a price (upstream masks it - get prices from TIKTOK_SHOP_SEARCH, TIKTOK_SHOP_SHOP_PRODUCTS or TIKTOK_SHOP_CATEGORY_PRODUCTS), and it resolves only about 44% of the product ids returned by search, so a 404 is a normal outcome to skip rather than retry. Costs 1 credit.",
        z.object({
          product_id: str("TikTok Shop product id (6-25 digits)."),
          region: ostr("Marketplace region: 'US' (default), 'GB', 'SG', 'MY', 'PH', 'TH', 'VN', or 'ID'."),
        }),
        (i) => client.tiktokShop.product(i as SdkOpts<typeof client.tiktokShop.product>)
      ),
      tool(
        "TIKTOK_SHOP_PRODUCT_REVIEWS",
        "Scavio TikTok Shop Product Reviews",
        "Paginated TikTok Shop product reviews with text, images, star histogram and verified-purchase flags, up to 200 per call. total_reviews drifts between calls and must NOT be used to compute a page count - page with has_more instead. Often works for ids TIKTOK_SHOP_PRODUCT cannot resolve. Costs 1 credit.",
        z.object({
          product_id: str("TikTok Shop product id (6-25 digits)."),
          page: onum("1-based page number (1-500, default 1)."),
          page_size: onum("Reviews per page (1-200, default 20)."),
          sort: ostr("'relevant' (default) is text-complete and image-heavy; 'recent' is fresher but far more text-sparse."),
          rating: onum("Only reviews with this star rating (1-5)."),
          has_media: obool("Only reviews with a photo or video. Shares one upstream slot with verified_only, and wins when both are set."),
          verified_only: obool("Only verified purchases. Ignored when has_media is also set."),
          region: ostr("Marketplace region: 'US' (default), 'GB', 'SG', 'MY', 'PH', 'TH', 'VN', or 'ID'."),
        }),
        (i) => client.tiktokShop.productReviews(i as SdkOpts<typeof client.tiktokShop.productReviews>)
      ),
      tool(
        "TIKTOK_SHOP_CATEGORIES",
        "Scavio TikTok Shop Categories",
        "The global TikTok Shop category tree: 28 top-level categories, 240 nodes, two levels deep. Category ids are identical in every region and names are always English. Takes no parameters. Costs 1 credit.",
        z.object({}),
        () => client.tiktokShop.categories()
      ),
      tool(
        "TIKTOK_SHOP_CATEGORY_PRODUCTS",
        "Scavio TikTok Shop Category Products",
        "Products listed under a category id from TIKTOK_SHOP_CATEGORIES, with exact prices. Level 1 or 2 ids both work. Page size is inconsistent upstream (15 to 20), so always paginate with next_cursor; when has_more turns false after a few pages that is the end of a shallow listing, not an error. Costs 1 credit.",
        z.object({
          category_id: str("Category id from TIKTOK_SHOP_CATEGORIES; level 1 or 2 both work."),
          cursor: ostr("Opaque cursor from a prior response's next_cursor."),
          region: ostr("Marketplace region, 'US' (default) or 'GB' only - not the 8-region list."),
        }),
        (i) => client.tiktokShop.categoryProducts(i as SdkOpts<typeof client.tiktokShop.categoryProducts>)
      ),
      tool(
        "TIKTOK_SHOP_SHOP_PRODUCTS",
        "Scavio TikTok Shop Shop Products",
        "A shop's TikTok Shop catalog, 30 per page, with exact prices. Shop follower count, location and shop-level rating are not available here - call TIKTOK_SHOP_PRODUCT for the full shop profile. Costs 1 credit.",
        z.object({
          shop_id: str("TikTok Shop seller id (also called seller_id elsewhere on TikTok)."),
          cursor: ostr("Opaque cursor from a prior response's next_cursor."),
          region: ostr("Marketplace region: 'US' (default), 'GB', 'SG', 'MY', 'PH', 'TH', 'VN', or 'ID'."),
        }),
        (i) => client.tiktokShop.shopProducts(i as SdkOpts<typeof client.tiktokShop.shopProducts>)
      ),
      tool(
        "TIKTOK_SHOP_RESOLVE",
        "Scavio TikTok Shop Resolve",
        "Resolve any TikTok Shop URL or share link to a product_id or shop_id, ready for the other TikTok Shop tools. Accepts shop.tiktok.com product and store pages, tiktok.com/view links, affiliate share links, and vt.tiktok.com short links. Costs 1 credit.",
        z.object({ url: str("A TikTok Shop product or store URL, affiliate share link, or vt.tiktok.com short link.") }),
        (i) => client.tiktokShop.resolve(i)
      )
    );
  }

  if (all || enableInstagram) {
    tools.push(
      tool(
        "INSTAGRAM_PROFILE",
        "Scavio Instagram Profile",
        "Fetch an Instagram profile by username or user id. Costs 10 credits.",
        z.object({
          username: ostr("Instagram username. Provide this or user_id."),
          user_id: ostr("Instagram user id. Provide this or username."),
        }),
        (i) => client.instagram.profile(i)
      ),
      tool(
        "INSTAGRAM_USER_POSTS",
        "Scavio Instagram User Posts",
        "List an Instagram user's posts. Costs 2 credits, the cheapest Instagram endpoint.",
        z.object({
          username: ostr("Instagram username. Provide this or user_id."),
          user_id: ostr("Instagram user id. Provide this or username."),
          count: onum("Number of posts to return."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.userPosts(i)
      ),
      tool(
        "INSTAGRAM_USER_REELS",
        "Scavio Instagram User Reels",
        "List an Instagram user's reels. Costs 10 credits.",
        z.object({
          username: ostr("Instagram username. Provide this or user_id."),
          user_id: ostr("Instagram user id. Provide this or username."),
          count: onum("Number of reels to return."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.userReels(i)
      ),
      tool(
        "INSTAGRAM_USER_TAGGED",
        "Scavio Instagram User Tagged",
        "List posts an Instagram user is tagged in. Costs 10 credits.",
        z.object({
          username: ostr("Instagram username. Provide this or user_id."),
          user_id: ostr("Instagram user id. Provide this or username."),
          count: onum("Number of tagged posts to return."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.userTagged(i)
      ),
      tool(
        "INSTAGRAM_USER_STORIES",
        "Scavio Instagram User Stories",
        "Fetch an Instagram user's current stories. Costs 10 credits.",
        z.object({
          username: ostr("Instagram username. Provide this or user_id."),
          user_id: ostr("Instagram user id. Provide this or username."),
        }),
        (i) => client.instagram.userStories(i)
      ),
      tool(
        "INSTAGRAM_POST",
        "Scavio Instagram Post",
        "Fetch an Instagram post by URL, media id, or shortcode. Costs 8 credits.",
        z.object({
          url: ostr("Post URL. Provide one of url, media_id, or shortcode."),
          media_id: ostr("Post media id. Provide one of url, media_id, or shortcode."),
          shortcode: ostr("Post shortcode. Provide one of url, media_id, or shortcode."),
        }),
        (i) => client.instagram.post(i)
      ),
      tool(
        "INSTAGRAM_POST_COMMENTS",
        "Scavio Instagram Post Comments",
        "List comments on an Instagram post by shortcode or URL. Costs 10 credits.",
        z.object({
          shortcode: ostr("Post shortcode. Provide this or url."),
          url: ostr("Post URL. Provide this or shortcode."),
          cursor: ostr("Pagination cursor."),
          sort_order: ostr("Comment sort order."),
        }),
        (i) => client.instagram.postComments(i as SdkOpts<typeof client.instagram.postComments>)
      ),
      tool(
        "INSTAGRAM_COMMENT_REPLIES",
        "Scavio Instagram Comment Replies",
        "List replies to an Instagram post comment. Costs 8 credits.",
        z.object({
          media_id: str("Post media id."),
          comment_id: str("Parent comment id."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.commentReplies(i)
      ),
      tool(
        "INSTAGRAM_SEARCH_USERS",
        "Scavio Instagram Search Users",
        "Search Instagram users by keyword. Costs 10 credits.",
        z.object({
          keyword: str("Search keyword."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.searchUsers(i)
      ),
      tool(
        "INSTAGRAM_SEARCH_HASHTAGS",
        "Scavio Instagram Search Hashtags",
        "Search Instagram hashtags by keyword. Costs 10 credits.",
        z.object({
          keyword: str("Search keyword."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.searchHashtags(i)
      ),
      tool(
        "INSTAGRAM_USER_FOLLOWERS",
        "Scavio Instagram User Followers",
        "List an Instagram user's followers. Costs 10 credits.",
        z.object({
          username: ostr("Instagram username. Provide this or user_id."),
          user_id: ostr("Instagram user id. Provide this or username."),
          count: onum("Number of followers to return."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.userFollowers(i)
      ),
      tool(
        "INSTAGRAM_USER_FOLLOWINGS",
        "Scavio Instagram User Followings",
        "List the accounts an Instagram user follows. Costs 10 credits.",
        z.object({
          username: ostr("Instagram username. Provide this or user_id."),
          user_id: ostr("Instagram user id. Provide this or username."),
          count: onum("Number of followings to return."),
          cursor: ostr("Pagination cursor."),
        }),
        (i) => client.instagram.userFollowings(i)
      )
    );
  }

  // X (Twitter): 11 endpoints, 1 credit each. The keyword field on search is
  // `search`, not `query`. search_type values are Capitalized while the comment
  // `rank` values are lowercase - that asymmetry is upstream's, not a typo.
  if (all || enableX) {
    tools.push(
      tool(
        "X_SEARCH",
        "Scavio X Search",
        "Search X (Twitter) posts. Returns data.timeline with next_cursor, prev_cursor and has_more. Costs 1 credit.",
        z.object({
          search: str("Search query (1-500 characters). The field is 'search', not 'query'."),
          search_type: ostr("Result category (Capitalized): 'Top' (default), 'Latest', 'People', 'Photos', or 'Videos'."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.search(i as SdkOpts<typeof client.x.search>)
      ),
      tool(
        "X_TWEET",
        "Scavio X Tweet",
        "Fetch one X post by id. Returns the tweet object plus reply_to, in_reply_to_screen_name, in_reply_to_status_id, in_reply_to_user_id and sensitive. Costs 1 credit.",
        z.object({ tweet_id: str("Numeric post id as a string, e.g. '1808168603721650364'.") }),
        (i) => client.x.tweet(i)
      ),
      tool(
        "X_TWEET_COMMENTS",
        "Scavio X Tweet Comments",
        "List replies to an X post. Returns data.timeline with next_cursor, prev_cursor and has_more. rank switches the upstream feed: 'latest' is chronological, 'top' is ranked. Costs 1 credit.",
        z.object({
          tweet_id: str("Numeric post id as a string."),
          rank: ostr("Reply ordering (lowercase): 'top' (default, ranked) or 'latest' (chronological)."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.tweetComments(i as SdkOpts<typeof client.x.tweetComments>)
      ),
      tool(
        "X_TWEET_RETWEETERS",
        "Scavio X Tweet Retweeters",
        "List the accounts that reposted an X post. Returns data.retweeters with next_cursor and has_more. Costs 1 credit.",
        z.object({
          tweet_id: str("Numeric post id as a string."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.tweetRetweeters(i)
      ),
      tool(
        "X_USER",
        "Scavio X User",
        "Fetch an X profile by handle: followers_count, friends_count, statuses_count, media_count, blue_verified, location, website, avatar, header_image and pinned_tweet_ids. Costs 1 credit.",
        z.object({ screen_name: str("An X handle WITHOUT the @, e.g. 'elonmusk'.") }),
        (i) => client.x.user(i)
      ),
      tool(
        "X_USER_TWEETS",
        "Scavio X User Tweets",
        "List an X user's posts. Returns data.timeline plus pinned and user; there is no has_more on this endpoint, so page on next_cursor. Costs 1 credit.",
        z.object({
          screen_name: str("An X handle WITHOUT the @."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.userTweets(i)
      ),
      tool(
        "X_USER_REPLIES",
        "Scavio X User Replies",
        "List an X user's replies. Returns data.timeline with next_cursor and prev_cursor; no has_more. Costs 1 credit.",
        z.object({
          screen_name: str("An X handle WITHOUT the @."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.userReplies(i)
      ),
      tool(
        "X_USER_MEDIA",
        "Scavio X User Media",
        "List an X user's posts that carry photos or videos. Returns data.timeline with next_cursor and prev_cursor; no has_more. Costs 1 credit.",
        z.object({
          screen_name: str("An X handle WITHOUT the @."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.userMedia(i)
      ),
      tool(
        "X_USER_FOLLOWERS",
        "Scavio X User Followers",
        "List an X user's followers. Returns data.followers with followers_count, next_cursor and has_more. Costs 1 credit.",
        z.object({
          screen_name: str("An X handle WITHOUT the @."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.userFollowers(i)
      ),
      tool(
        "X_USER_FOLLOWINGS",
        "Scavio X User Followings",
        "List the accounts an X user follows. The response array is data.following (singular), not followings, and there is no following_count. Costs 1 credit.",
        z.object({
          screen_name: str("An X handle WITHOUT the @."),
          cursor: ostr("Pagination cursor from a prior response."),
        }),
        (i) => client.x.userFollowings(i)
      ),
      tool(
        "X_TRENDING",
        "Scavio X Trending",
        "List what is trending on X for one country. Returns data.trends with no cursor and no has_more. Costs 1 credit.",
        z.object({ country: ostr("Country NAME, not an ISO code, e.g. 'UnitedStates' (the default).") }),
        (i) => client.x.trending(i)
      )
    );
  }

  // LinkedIn: 9 live endpoints on three credit tiers - 1 for person, person/about,
  // company and post; 10 for the feeds, job search and post comments; 30 for job,
  // the most expensive endpoint in the API. The five retired endpoints
  // (person/contact, company/people, company/jobs, search/people, search/posts)
  // return 410 unbilled and are deliberately NOT exposed: an agent-facing tool
  // that can only fail is worse than no tool.
  if (all || enableLinkedin) {
    tools.push(
      tool(
        "LINKEDIN_PERSON",
        "Scavio LinkedIn Person",
        "Fetch a full LinkedIn profile: headline, about, location, follower and connection counts, current_company, experiences, educations, honors_and_awards, bio_links and similar profiles. Costs 1 credit.",
        z.object({
          username: ostr("Public identifier / vanity handle, e.g. 'williamhgates'. Provide this or url."),
          url: ostr("Full LinkedIn profile URL. Provide this or username."),
        }),
        (i) => client.linkedin.person(i)
      ),
      tool(
        "LINKEDIN_PERSON_ABOUT",
        "Scavio LinkedIn Person About",
        "The about-only slice of a LinkedIn profile: about, headline, education_summary, experiences, educations, honors_and_awards and bio_links. Same upstream call as LINKEDIN_PERSON, shaped down. Costs 1 credit.",
        z.object({
          username: ostr("Public identifier / vanity handle. Provide this or url."),
          url: ostr("Full LinkedIn profile URL. Provide this or username."),
        }),
        (i) => client.linkedin.personAbout(i)
      ),
      tool(
        "LINKEDIN_PERSON_POSTS",
        "Scavio LinkedIn Person Posts",
        "A member's LinkedIn feed - their own posts, or posts they commented on or reacted to via type. 50 per page; advance with next_cursor. Costs 10 credits.",
        z.object({
          username: ostr("Public identifier / vanity handle. Provide this or url."),
          url: ostr("Full LinkedIn profile URL. Provide this or username."),
          type: ostr("Which feed: 'posts' (default), 'comments' (posts they commented on), or 'reactions' (posts they reacted to)."),
          cursor: ostr("Opaque cursor from a prior response's next_cursor."),
        }),
        (i) => client.linkedin.personPosts(i as SdkOpts<typeof client.linkedin.personPosts>)
      ),
      tool(
        "LINKEDIN_COMPANY",
        "Scavio LinkedIn Company",
        "Fetch a LinkedIn company profile: description, website, industries, specialties, employee and follower counts, headquarters, locations, similar and affiliated companies, and featured_employees (a 4-6 person sample, the documented substitute for the retired employee directory). Costs 1 credit.",
        z.object({
          company: ostr("Company universal name / slug, e.g. 'microsoft'. Provide this or url."),
          url: ostr("Full LinkedIn company URL. Provide this or company."),
        }),
        (i) => client.linkedin.company(i)
      ),
      tool(
        "LINKEDIN_COMPANY_POSTS",
        "Scavio LinkedIn Company Posts",
        "Recent posts from a LinkedIn company page, 50 per page; advance with next_cursor. There is no type selector here - that is person-only. Costs 10 credits.",
        z.object({
          company: ostr("Company universal name / slug. Provide this or url."),
          url: ostr("Full LinkedIn company URL. Provide this or company."),
          cursor: ostr("Opaque cursor from a prior response's next_cursor."),
        }),
        (i) => client.linkedin.companyPosts(i)
      ),
      tool(
        "LINKEDIN_SEARCH_JOBS",
        "Scavio LinkedIn Search Jobs",
        "Search LinkedIn job listings, 25 per page; advance with next_cursor. Upstream rotates its result set so pages overlap - dedupe by job id. Costs 10 credits.",
        z.object({
          search: str("Search keyword, e.g. 'software engineer'. The field is 'search', not 'query'."),
          location: ostr("Geographic filter; omit to search everywhere."),
          cursor: ostr("Opaque cursor from a prior response's next_cursor."),
        }),
        (i) => client.linkedin.searchJobs(i)
      ),
      tool(
        "LINKEDIN_JOB",
        "Scavio LinkedIn Job",
        "Full detail for one LinkedIn job listing, including the hiring company. The most expensive endpoint in the API - about 1 in 5 ids from LINKEDIN_SEARCH_JOBS has no detail record upstream and answers 404 unbilled, so skip rather than retry. Costs 30 credits.",
        z.object({
          job_id: ostr("Job listing id, e.g. '4415427228'. Provide this or url."),
          url: ostr("Full LinkedIn job URL. Provide this or job_id."),
        }),
        (i) => client.linkedin.job(i)
      ),
      tool(
        "LINKEDIN_POST",
        "Scavio LinkedIn Post",
        "Full detail for one LinkedIn post: text, media, hashtags, tagged companies and people, reaction and comment counts, author, and its top visible comments. Costs 1 credit.",
        z.object({
          post_id: ostr("Post id or activity urn, e.g. '7488618410256523265'. Provide this or url."),
          url: ostr("Full LinkedIn post URL. Provide this or post_id."),
        }),
        (i) => client.linkedin.post(i)
      ),
      tool(
        "LINKEDIN_POST_COMMENTS",
        "Scavio LinkedIn Post Comments",
        "Comments on a LinkedIn post with their replies. This is the only LinkedIn endpoint paginated by a 1-based integer page rather than a cursor, and page size varies upstream - keep paging until a page comes back empty. Costs 10 credits.",
        z.object({
          post_id: ostr("Post id or activity urn. Provide this or url."),
          url: ostr("Full LinkedIn post URL. Provide this or post_id."),
          page: onum("1-based page number (default 1). Page size varies, so page until empty."),
        }),
        (i) => client.linkedin.postComments(i)
      )
    );
  }

  return experimental_createToolkit("SCAVIO", {
    name: "Scavio",
    description:
      "Real-time structured search over Google (SERP, AI Mode, Maps, Shopping, Flights, Hotels, News, Trends), YouTube, Amazon, Walmart, Reddit, TikTok, TikTok Shop, Instagram, X and LinkedIn.",
    tools,
  });
}

export default buildScavioToolkit;
