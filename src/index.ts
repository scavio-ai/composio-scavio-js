/**
 * Scavio tools for Composio.
 *
 * Scavio is a single Search API over 31 platforms - Google, YouTube, Amazon,
 * Walmart, eBay, Target, Home Depot, Reddit, TikTok, TikTok Shop, Instagram, X,
 * LinkedIn, Threads, Kuaishou, Zillow, Redfin, Booking.com, Airbnb, Tripadvisor,
 * Yelp, Indeed, Glassdoor, the Apple App Store, Google Play, SEC EDGAR, Companies
 * House, G2, Capterra, Google Ads Transparency and the Meta Ad Library - plus a
 * top-level extract() that reads any URL as Markdown, plain text or raw HTML.
 * This toolkit exposes every live endpoint of all of them (189 tools). Build it
 * with `buildScavioToolkit()` and bind it to a session:
 *
 *   import { Composio } from "@composio/core";
 *   import { buildScavioToolkit } from "composio-scavio";
 *
 *   const composio = new Composio();
 *   const scavio = buildScavioToolkit({ apiKey: process.env.SCAVIO_API_KEY });
 *   const session = await composio.create("user_1", {
 *     experimental: { customToolkits: [scavio] },
 *   });
 *   const out = await session.execute("LOCAL_SCAVIO_GOOGLE_SEARCH", { query: "ai agents" });
 *
 * Each provider is gated by an `enable*` flag so an agent only sees the tools it
 * needs. The ten original platforms and `extract` are on by default (104 tools);
 * the 21 verticals added in 0.4.0 are OPT-IN, because registering all 189 at once
 * buries the handful an agent actually wants. Pass `all: true` for everything.
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
  /** The top-level extract() tool: read any URL as Markdown, text or HTML. */
  enableExtract?: boolean;
  // Added in 0.4.0. Opt-in: off unless you ask for them, or pass all.
  enableThreads?: boolean;
  enableKuaishou?: boolean;
  enableEbay?: boolean;
  enableTarget?: boolean;
  enableHomeDepot?: boolean;
  enableZillow?: boolean;
  enableBooking?: boolean;
  enableTripadvisor?: boolean;
  enableIndeed?: boolean;
  enableAirbnb?: boolean;
  enableGlassdoor?: boolean;
  enableYelp?: boolean;
  enableAppStore?: boolean;
  enableGooglePlay?: boolean;
  enableSec?: boolean;
  enableRedfin?: boolean;
  enableCompaniesHouse?: boolean;
  enableG2?: boolean;
  enableCapterra?: boolean;
  enableGoogleAds?: boolean;
  enableMetaAds?: boolean;
  /** Register every tool, ignoring the individual flags. */
  all?: boolean;
}

const str = (d: string) => z.string().describe(d);
const ostr = (d: string) => z.string().optional().describe(d);
const onum = (d: string) => z.number().optional().describe(d);
const obool = (d: string) => z.boolean().optional().describe(d);
const arrstr = (d: string) => z.array(z.string()).describe(d);
const oarrstr = (d: string) => z.array(z.string()).optional().describe(d);
const oarrnum = (d: string) => z.array(z.number()).optional().describe(d);
// Booking's property_type is a named enum OR a raw numeric accommodation-type id.
const ostrnum = (d: string) => z.union([z.string(), z.number()]).optional().describe(d);
// SEC filters take a single value, a list, or the comma-joined string.
const ostrarr = (d: string) =>
  z.union([z.string(), z.array(z.string())]).optional().describe(d);

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
    enableExtract = true,
    enableThreads = false,
    enableKuaishou = false,
    enableEbay = false,
    enableTarget = false,
    enableHomeDepot = false,
    enableZillow = false,
    enableBooking = false,
    enableTripadvisor = false,
    enableIndeed = false,
    enableAirbnb = false,
    enableGlassdoor = false,
    enableYelp = false,
    enableAppStore = false,
    enableGooglePlay = false,
    enableSec = false,
    enableRedfin = false,
    enableCompaniesHouse = false,
    enableG2 = false,
    enableCapterra = false,
    enableGoogleAds = false,
    enableMetaAds = false,
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
      ),
      tool(
        "AMAZON_OPTIONS",
        "Scavio Amazon Options",
        "Supported Amazon marketplaces, as 'domains' and 'countries'. 'languages' and 'currencies' remain in the payload but are always empty: neither is a request param any more. Needs no API key and costs no credits.",
        z.object({}),
        () => client.amazon.options()
      )
    );
  }

  // Walmart runs on the scrape.do rebuild: device, delivery_zip and store_id
  // never existed on it, start_page is now page, and it is BODY-PRICED - 1 credit
  // on domain com/ca, 2 on com.mx, so search and category alone carry a domain.
  if (all || enableWalmart) {
    tools.push(
      tool(
        "WALMART_SEARCH",
        "Scavio Walmart Search",
        "Search Walmart and get structured product rows (products, products_count and the store the results were priced against). Costs 1 credit on domain 'com' or 'ca' and 2 credits on 'com.mx' - the price is a function of the request body, not a constant for the route.",
        z.object({
          query: str("Product search query (1-500 characters)."),
          domain: ostr("Marketplace: 'com' (US, default, 1 credit), 'ca' (1 credit), 'com.mx' (2 credits). Sets the currency and product URLs of the response."),
          page: onum("Results page, 1-based (integer >= 1). One page per call."),
          start_page: onum("Deprecated alias for page; send page instead."),
          sort_by: ostr("Result sort order. Defaults to 'best_match'. Accepted values: 'best_match', 'price_low', 'price_high', 'best_seller', 'rating_high', 'new'."),
          min_price: onum("Minimum price filter in the marketplace's own currency; decimals allowed (e.g. 19.99)."),
          max_price: onum("Maximum price filter in the marketplace's own currency; decimals allowed (e.g. 199.5)."),
          fulfillment_speed: ostr("Only items deliverable today, or by tomorrow. '2_days' and 'anytime' are not accepted - for anytime, omit this parameter."),
          fulfillment_type: ostr("Set to 'in_store' to return only items available for in-store pickup."),
        }),
        (i) => client.walmart.search(i as SdkOpts<typeof client.walmart.search>)
      ),
      tool(
        "WALMART_PRODUCT",
        "Scavio Walmart Product",
        "Full detail for a single Walmart product: price, rating, images, specifications, availability and seller. US marketplace only - walmart.ca product pages could not be fetched at all, so this endpoint takes no domain. Costs 1 credit: Walmart is body-priced through `domain`, but this endpoint takes no domain, so it is always 1.",
        z.object({
          product_id: str("Walmart item id (usItemId), e.g. '13544111159'."),
        }),
        (i) => client.walmart.product(i as SdkOpts<typeof client.walmart.product>)
      ),
      tool(
        "WALMART_REVIEWS",
        "Scavio Walmart Reviews",
        "Customer reviews for a Walmart product with ratings, text, author, date and the rating breakdown. 10 reviews per page; paginate with page. Costs 1 credit: Walmart is body-priced through `domain`, but this endpoint takes no domain, so it is always 1.",
        z.object({
          product_id: str("Walmart item id (usItemId), e.g. '13544111159'."),
          page: onum("Reviews page, 1-based (integer >= 1). 10 reviews per page."),
          sort: ostr("Review sort order. Omit for Walmart's own default ordering. Accepted values: 'relevancy', 'submission-desc', 'submission-asc', 'rating-desc', 'rating-asc', 'helpful-desc'."),
        }),
        (i) => client.walmart.reviews(i as SdkOpts<typeof client.walmart.reviews>)
      ),
      tool(
        "WALMART_CATEGORY",
        "Scavio Walmart Category",
        "Products within a Walmart category, in the same product shape as search. Costs 1 credit on domain 'com' or 'ca' and 2 credits on 'com.mx' - the price is a function of the request body, not a constant for the route.",
        z.object({
          category_id: str("Walmart category id: either a leaf id ('1095191') or the full underscore-joined path ('3944_133251_1095191'). Both are accepted."),
          domain: ostr("Marketplace: 'com' (US, default, 1 credit), 'ca' (1 credit), 'com.mx' (2 credits). Sets the currency and product URLs of the response."),
          page: onum("Results page, 1-based (integer >= 1). One page per call."),
          limit: onum("Trim the returned products to at most this many (integer >= 1). Applied after fetching, so it does not reduce the credit cost of the call."),
          sort_by: ostr("Result sort order. Defaults to 'best_match'. Accepted values: 'best_match', 'price_low', 'price_high', 'best_seller', 'rating_high', 'new'."),
          min_price: onum("Minimum price filter in the marketplace's own currency; decimals allowed (e.g. 19.99)."),
          max_price: onum("Maximum price filter in the marketplace's own currency; decimals allowed (e.g. 199.5)."),
          fulfillment_speed: ostr("Only items deliverable today, or by tomorrow. '2_days' and 'anytime' are not accepted - for anytime, omit this parameter."),
        }),
        (i) => client.walmart.category(i as SdkOpts<typeof client.walmart.category>)
      ),
      tool(
        "WALMART_OFFERS",
        "Scavio Walmart Offers",
        "The buy-box offer for a Walmart product: price, seller, condition and buy-box flag. BUY-BOX SELLER ONLY - this is not the full offer list, and there is no way to page through the other sellers. Costs 1 credit: Walmart is body-priced through `domain`, but this endpoint takes no domain, so it is always 1.",
        z.object({
          product_id: str("Walmart item id (usItemId), e.g. '2979510112'."),
        }),
        (i) => client.walmart.offers(i as SdkOpts<typeof client.walmart.offers>)
      ),
      tool(
        "WALMART_SELLER",
        "Scavio Walmart Seller",
        "Marketplace seller storefront: name, rating, review count, Pro Seller badge and business details. Costs 1 credit: Walmart is body-priced through `domain`, but this endpoint takes no domain, so it is always 1.",
        z.object({
          seller_id: str("Numeric Walmart catalog seller id, as returned in `seller_catalog_id` on a product, search or offers response (e.g. '101480084'). The GUID `seller_id` is not accepted here - it 404s."),
        }),
        (i) => client.walmart.seller(i as SdkOpts<typeof client.walmart.seller>)
      ),
      tool(
        "WALMART_SELLER_PRODUCTS",
        "Scavio Walmart Seller Products",
        "A marketplace seller's catalog. Roughly the first 40 items are server-rendered and returned; total_count reports the seller's real catalog size. There is no pagination - the rest of the catalog is not reachable. Costs 1 credit: Walmart is body-priced through `domain`, but this endpoint takes no domain, so it is always 1.",
        z.object({
          seller_id: str("Numeric Walmart catalog seller id, as returned in `seller_catalog_id` on a product, search or offers response (e.g. '101480084'). The GUID `seller_id` 404s."),
        }),
        (i) => client.walmart.sellerProducts(i as SdkOpts<typeof client.walmart.sellerProducts>)
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

  // Threads is BODY-PRICED: 2 credits addressed by user_id, 4 by username,
  // because the handle has to be resolved through people search first.
  if (all || enableThreads) {
    tools.push(
      tool(
        "THREADS_PROFILE",
        "Scavio Threads Profile",
        "Profile details for a Threads user. Costs 2 credits addressed by user_id and 4 credits addressed by username - the price is a function of the request body, not a constant for the route; pass user_id whenever you have it.",
        z.object({
          user_id: ostr("Numeric Threads user id, e.g. '63625256886'. The cheap path: 2 credits."),
          username: ostr("Threads handle without the @ (1-60 characters). Costs 2 extra credits (4 total): the upstream handle lookup is down, so the handle is resolved through people search first. Pass user_id instead to avoid that."),
        }),
        (i) => client.threads.profile(i as SdkOpts<typeof client.threads.profile>)
      ),
      tool(
        "THREADS_USER_POSTS",
        "Scavio Threads User Posts",
        "A user's Threads posts, cursor-paginated via next_cursor. Costs 2 credits addressed by user_id and 4 credits addressed by username - the price is a function of the request body, not a constant for the route; pass user_id whenever you have it.",
        z.object({
          user_id: ostr("Numeric Threads user id, e.g. '63625256886'. The cheap path: 2 credits."),
          username: ostr("Threads handle without the @ (1-60 characters). Costs 2 extra credits (4 total) because the handle has to be resolved through people search first."),
          cursor: ostr("Pagination cursor from a prior response's next_cursor. Omit for the first page."),
        }),
        (i) => client.threads.userPosts(i as SdkOpts<typeof client.threads.userPosts>)
      ),
      tool(
        "THREADS_USER_REPLIES",
        "Scavio Threads User Replies",
        "A user's Threads replies, cursor-paginated via next_cursor. Costs 2 credits addressed by user_id and 4 credits addressed by username - the price is a function of the request body, not a constant for the route; pass user_id whenever you have it.",
        z.object({
          user_id: ostr("Numeric Threads user id, e.g. '63625256886'. The cheap path: 2 credits."),
          username: ostr("Threads handle without the @ (1-60 characters). Costs 2 extra credits (4 total) because the handle has to be resolved through people search first."),
          cursor: ostr("Pagination cursor from a prior response's next_cursor. Omit for the first page."),
        }),
        (i) => client.threads.userReplies(i as SdkOpts<typeof client.threads.userReplies>)
      ),
      tool(
        "THREADS_POST",
        "Scavio Threads Post",
        "A single Threads post, addressed by post_id or by its threads.net URL. Costs 2 credits: Threads is body-priced by identifier, but this endpoint has no username form, so it is always 2.",
        z.object({
          post_id: ostr("Threads post id, e.g. '3349029093483693129'."),
          url: ostr("Full threads.net post URL (e.g. 'https://www.threads.net/@natgeo/post/C8xY'), as an alternative to post_id."),
        }),
        (i) => client.threads.post(i as SdkOpts<typeof client.threads.post>)
      ),
      tool(
        "THREADS_POST_COMMENTS",
        "Scavio Threads Post Comments",
        "Replies to a Threads post, cursor-paginated via next_cursor. Costs 2 credits: Threads is body-priced by identifier, but this endpoint has no username form, so it is always 2.",
        z.object({
          post_id: str("Threads post id, e.g. '3349029093483693129'."),
          cursor: ostr("Pagination cursor from a prior response's next_cursor. Omit for the first page."),
        }),
        (i) => client.threads.postComments(i as SdkOpts<typeof client.threads.postComments>)
      ),
      tool(
        "THREADS_SEARCH_USERS",
        "Scavio Threads Search Users",
        "Search Threads profiles by name or handle. This is the only search Threads exposes - there is no post or content search - and it returns a single unpaginated page. Costs 2 credits: Threads is body-priced by identifier, but this endpoint has no username form, so it is always 2.",
        z.object({
          query: str("Name or handle to search for (1-200 characters)."),
        }),
        (i) => client.threads.searchUsers(i as SdkOpts<typeof client.threads.searchUsers>)
      )
    );
  }

  // Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.
  // Kwai international (kwai.com) is not served upstream; only kuaishou.com links
  // resolve. Upstream hides failures inside HTTP 200, so check the payload.
  if (all || enableKuaishou) {
    tools.push(
      tool(
        "KUAISHOU_PROFILE",
        "Scavio Kuaishou Profile",
        "Profile details for a Kuaishou user. Costs 10 credits, the dearest single-object call on the platform: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          user_id: str("Kuaishou user id (non-empty); get one from user_resolve or search_users."),
        }),
        (i) => client.kuaishou.profile(i as SdkOpts<typeof client.kuaishou.profile>)
      ),
      tool(
        "KUAISHOU_USER_POSTS",
        "Scavio Kuaishou User Posts",
        "A Kuaishou user's top posts, cursor-paginated via next_cursor. Costs 1 credit: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          user_id: str("Kuaishou user id (non-empty); get one from user_resolve or search_users."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
        }),
        (i) => client.kuaishou.userPosts(i as SdkOpts<typeof client.kuaishou.userPosts>)
      ),
      tool(
        "KUAISHOU_USER_LIVE",
        "Scavio Kuaishou User Live",
        "A Kuaishou user's current live-stream status. Not paginated. Costs 1 credit: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          user_id: str("Kuaishou user id (non-empty); get one from user_resolve or search_users."),
        }),
        (i) => client.kuaishou.userLive(i as SdkOpts<typeof client.kuaishou.userLive>)
      ),
      tool(
        "KUAISHOU_USER_RESOLVE",
        "Scavio Kuaishou User Resolve",
        "Turns a Kuaishou share link into a user id. Only kuaishou.com and v.kuaishou.com links are accepted; Kwai international (kwai.com) is not served upstream. Costs 1 credit: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          share_link: str("A kuaishou.com or v.kuaishou.com URL; kwai.com links are rejected."),
        }),
        (i) => client.kuaishou.userResolve(i as SdkOpts<typeof client.kuaishou.userResolve>)
      ),
      tool(
        "KUAISHOU_VIDEO",
        "Scavio Kuaishou Video",
        "A single Kuaishou video by photo id or URL. Provide photo_id or url. Costs 2 credits: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          photo_id: ostr("Kuaishou photo (video) id, non-empty."),
          url: ostr("Full kuaishou.com video URL, as an alternative to photo_id."),
        }),
        (i) => client.kuaishou.video(i as SdkOpts<typeof client.kuaishou.video>)
      ),
      tool(
        "KUAISHOU_VIDEO_COMMENTS",
        "Scavio Kuaishou Video Comments",
        "Comments on a Kuaishou video, cursor-paginated via next_cursor. Costs 1 credit: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          photo_id: str("Kuaishou photo (video) id, non-empty."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
        }),
        (i) => client.kuaishou.videoComments(i as SdkOpts<typeof client.kuaishou.videoComments>)
      ),
      tool(
        "KUAISHOU_COMMENT_REPLIES",
        "Scavio Kuaishou Comment Replies",
        "Replies under a root comment on a Kuaishou video, cursor-paginated via next_cursor; count sizes the page (1-50). Costs 1 credit: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          photo_id: str("Kuaishou photo (video) id, non-empty."),
          root_comment_id: str("Id of the top-level comment whose replies you want, from video_comments."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
          count: onum("Replies per page, 1-50. Omit to use the upstream default."),
        }),
        (i) => client.kuaishou.commentReplies(i as SdkOpts<typeof client.kuaishou.commentReplies>)
      ),
      tool(
        "KUAISHOU_VIDEOS_BATCH",
        "Scavio Kuaishou Videos Batch",
        "Several Kuaishou videos in one call, hard-capped at 20 photo ids. Costs 40 credits, the dearest call on the platform: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          photo_ids: arrstr("Kuaishou photo (video) ids, 1-20 per call; more than 20 is rejected."),
        }),
        (i) => client.kuaishou.videosBatch(i as SdkOpts<typeof client.kuaishou.videosBatch>)
      ),
      tool(
        "KUAISHOU_SEARCH",
        "Scavio Kuaishou Search",
        "Mixed-result search across Kuaishou, cursor-paginated via next_cursor. Costs 10 credits per page: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          keyword: str("Search keyword, 1-200 characters."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
        }),
        (i) => client.kuaishou.search(i as SdkOpts<typeof client.kuaishou.search>)
      ),
      tool(
        "KUAISHOU_SEARCH_VIDEOS",
        "Scavio Kuaishou Search Videos",
        "Kuaishou video search results, cursor-paginated via next_cursor. Costs 10 credits per page: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          keyword: str("Search keyword, 1-200 characters."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
        }),
        (i) => client.kuaishou.searchVideos(i as SdkOpts<typeof client.kuaishou.searchVideos>)
      ),
      tool(
        "KUAISHOU_SEARCH_USERS",
        "Scavio Kuaishou Search Users",
        "Kuaishou user search results, cursor-paginated via next_cursor. Costs 10 credits per page: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          keyword: str("Search keyword, 1-200 characters."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
        }),
        (i) => client.kuaishou.searchUsers(i as SdkOpts<typeof client.kuaishou.searchUsers>)
      ),
      tool(
        "KUAISHOU_SEARCH_LIVE",
        "Scavio Kuaishou Search Live",
        "Kuaishou live-stream search results, cursor-paginated via next_cursor. Costs 10 credits per page: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          keyword: str("Search keyword, 1-200 characters."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
        }),
        (i) => client.kuaishou.searchLive(i as SdkOpts<typeof client.kuaishou.searchLive>)
      ),
      tool(
        "KUAISHOU_TAG_FEED",
        "Scavio Kuaishou Tag Feed",
        "Posts under a Kuaishou hashtag, cursor-paginated via next_cursor. Costs 1 credit: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          tag: str("Hashtag text without the leading '#', 1-200 characters."),
          cursor: ostr("Opaque next_cursor from a prior response; omit for the first page."),
        }),
        (i) => client.kuaishou.tagFeed(i as SdkOpts<typeof client.kuaishou.tagFeed>)
      ),
      tool(
        "KUAISHOU_TRENDING",
        "Scavio Kuaishou Trending",
        "Kuaishou hot / live / shopping / brand / music leaderboards. One board per call, not paginated. Costs 1 credit: Kuaishou is priced PER ENDPOINT (1, 2, 10 or 40), never per platform.",
        z.object({
          board: ostr("Leaderboard to return; defaults to 'hot' when omitted. Accepted values: 'hot', 'live', 'shopping', 'brand', 'music'."),
        }),
        (i) => client.kuaishou.trending(i as SdkOpts<typeof client.kuaishou.trending>)
      )
    );
  }

  if (all || enableEbay) {
    tools.push(
      tool(
        "EBAY_SEARCH",
        "Scavio eBay Search",
        "Search live or SOLD eBay listings: price, condition, bids, shipping, seller, feedback. Provide query or seller; per_page accepts only 60, 120 or 240. Costs 1 credit.",
        z.object({
          query: ostr("Keyword to search (1-500 characters). Optional: a seller-only search pages that seller's whole catalogue."),
          seller: ostr("Restrict results to one seller's listings (1-64 characters), as in ebay.com/usr/<name>. Can be sent with no query."),
          page: onum("Results page, 1-based."),
          sort_by: ostr("Result sort order. Defaults to 'best_match'. eBay's 'Distance: nearest first' is deliberately unsupported (it ranks against our proxy exit, not the caller). Accepted values: 'best_match', 'ending_soonest', 'newly_listed', 'price_low', 'price_high'."),
          min_price: onum("Minimum price, inclusive. Must be 0 or greater."),
          max_price: onum("Maximum price, inclusive. Must be 0 or greater."),
          condition: ostr("Item condition filter. 'refurbished' is eBay's parent condition, not one of its three graded tiers. Accepted values: 'new', 'open_box', 'refurbished', 'used', 'for_parts'."),
          buying_format: ostr("Listing format: auction, fixed price (buy_it_now), or fixed price accepting offers (best_offer)."),
          free_shipping: obool("Only listings with free shipping."),
          sold: obool("Search completed listings that actually SOLD, for price research. eBay publishes no headline count on this view, so total_results is null."),
          category_id: ostr("eBay category id; must be numeric (e.g. '112529'). An unrecognised id returns the UNFILTERED set under a 200."),
          per_page: onum("Listings per page: 60, 120 or 240 only. Defaults to 60; eBay silently falls back to 60 for anything else."),
        }),
        (i) => client.ebay.search(i as SdkOpts<typeof client.ebay.search>)
      ),
      tool(
        "EBAY_PRODUCT",
        "Scavio eBay Product",
        "One eBay listing in full: price, condition, images, item specifics, shipping, returns, auction state, seller. Costs 1 credit.",
        z.object({
          item_id: str("eBay item number (e.g. '168591664725'), or a full ebay.com/itm/... listing URL; tracking parameters on a pasted URL are discarded."),
        }),
        (i) => client.ebay.product(i as SdkOpts<typeof client.ebay.product>)
      ),
      tool(
        "EBAY_SELLER",
        "Scavio eBay Seller",
        "eBay seller profile card: store name, feedback score and %, items sold, followers, location, categories. Profile only: page a catalogue with search(seller=...). Costs 1 credit.",
        z.object({
          seller: str("eBay username as it appears in ebay.com/usr/<name> (1-64 characters), which is what seller_name on a search or product result returns."),
        }),
        (i) => client.ebay.seller(i as SdkOpts<typeof client.ebay.seller>)
      )
    );
  }

  if (all || enableTarget) {
    tools.push(
      tool(
        "TARGET_SEARCH",
        "Scavio Target Search",
        "Search Target.com, the US retailer: prices, ratings, badges and promotions. Up to 28 results per page; rendered upstream, so expect around 9 seconds. Costs 1 credit.",
        z.object({
          keyword: str("Search keyword (1-500 characters)."),
          page: onum("Results page, 1-based."),
          count: onum("Results per page, 1-28. Defaults to 24; Target rejects anything above 28 outright."),
          sort: ostr("Result sort order. Defaults to 'relevance'. Accepted values: 'relevance', 'featured', 'price_low', 'price_high', 'rating_high', 'best_seller', 'newest'."),
          store_id: ostr("Numeric Target store id whose prices and availability the response reflects. Defaults to '3991', the store target.com uses with no store context."),
        }),
        (i) => client.target.search(i as SdkOpts<typeof client.target.search>)
      ),
      tool(
        "TARGET_CATEGORY",
        "Scavio Target Category",
        "Products in a Target category, same shape as search plus the category breadcrumb. Up to 28 per page; the slowest Target endpoint at around 37 seconds. Costs 1 credit.",
        z.object({
          category_id: str("Target category id: the segment after 'N-' in a target.com /c/ URL (target.com/c/apple/-/N-5xtg6 -> '5xtg6')."),
          page: onum("Results page, 1-based."),
          count: onum("Results per page, 1-28. Defaults to 24; Target rejects anything above 28 outright."),
          sort: ostr("Result sort order. Defaults to 'relevance'. Accepted values: 'relevance', 'featured', 'price_low', 'price_high', 'rating_high', 'best_seller', 'newest'."),
          store_id: ostr("Numeric Target store id whose prices and availability the response reflects. Defaults to '3991'."),
        }),
        (i) => client.target.category(i as SdkOpts<typeof client.target.category>)
      ),
      tool(
        "TARGET_PRODUCT",
        "Scavio Target Product",
        "Target product details by TCIN: price, rating, images, specifications, variants, return policy, fulfillment. seller_id/seller_name are null for stock sold by Target. Costs 1 credit.",
        z.object({
          tcin: str("Target catalog id (tcin, e.g. '1010453160'). A colour/size child tcin is answered by its variation parent, with the child present in 'variants'."),
          store_id: ostr("Numeric Target store id whose prices and availability the response reflects. Defaults to '3991'."),
        }),
        (i) => client.target.product(i as SdkOpts<typeof client.target.product>)
      ),
      tool(
        "TARGET_REVIEWS",
        "Scavio Target Reviews",
        "Target reviews with the rating breakdown, per-attribute averages and guest photos. 8 review bodies maximum and no paging; expect around 40 seconds. Costs 1 credit.",
        z.object({
          tcin: str("Target catalog id (tcin, e.g. '1010453160')."),
          limit: onum("Trim the returned reviews to at most this many (1 or greater). Target publishes 8 anonymously and offers no paging, so this only trims."),
          store_id: ostr("Numeric Target store id whose prices and availability the response reflects. Defaults to '3991'."),
        }),
        (i) => client.target.reviews(i as SdkOpts<typeof client.target.reviews>)
      )
    );
  }

  if (all || enableHomeDepot) {
    tools.push(
      tool(
        "HOME_DEPOT_SEARCH",
        "Scavio Home Depot Search",
        "Search Home Depot: price and promotions, brand and model, ratings, badges, per-store pickup/delivery. Page size is fixed at 12 and cannot be changed. Costs 2 credits.",
        z.object({
          query: str("Search keyword (1-500 characters)."),
          page: onum("Results page, 1-based. Home Depot serves 12 products per page and offers no way to change that, so paging is the only way to read further."),
          sort_by: ostr("Result sort order. Defaults to 'best_match'. Closed enum: Home Depot answers an unknown sort with an empty page that is still billed. 'Newest' is absent - it is rejected on keyword search. Accepted values: 'best_match', 'top_sellers', 'top_rated', 'price_low', 'price_high'."),
          min_price: onum("Minimum price, inclusive. Must be 0 or greater."),
          max_price: onum("Maximum price, inclusive. Must be 0 or greater."),
        }),
        (i) => client.homeDepot.search(i as SdkOpts<typeof client.homeDepot.search>)
      ),
      tool(
        "HOME_DEPOT_PRODUCT",
        "Scavio Home Depot Product",
        "Full Home Depot item detail: pricing, images and videos, spec table, dimensions, bullets, documents, return policy. Carries a 10-review preview only. Costs 2 credits.",
        z.object({
          item_id: str("Home Depot item id (e.g. '325479354'), or a full homedepot.com/p/... product URL; tracking parameters on a pasted URL are discarded."),
        }),
        (i) => client.homeDepot.product(i as SdkOpts<typeof client.homeDepot.product>)
      ),
      tool(
        "HOME_DEPOT_REVIEWS",
        "Scavio Home Depot Reviews",
        "One page of full Home Depot review bodies, the rating distribution, per-attribute ratings, photos and seller responses. 30 reviews per page. Costs 2 credits.",
        z.object({
          item_id: str("Home Depot item id (e.g. '325479354'), or a full homedepot.com/p/... product URL; tracking parameters on a pasted URL are discarded."),
          page: onum("Reviews page, 1-based. 30 reviews per page; 'total_pages' in the response is the last one that exists, and asking past it is a 404."),
        }),
        (i) => client.homeDepot.reviews(i as SdkOpts<typeof client.homeDepot.reviews>)
      )
    );
  }

  if (all || enableZillow) {
    tools.push(
      tool(
        "ZILLOW_SEARCH",
        "Scavio Zillow Search",
        "Zillow listings in a region: price, beds, baths, living area, Zestimate, coordinates, images, days on market. A bare ZIP works alone but cannot be combined with a filter or a sort. Costs 1 credit.",
        z.object({
          location: str("Region to search (1-200 characters): a Zillow slug ('austin-tx'), a human form ('Austin, TX'), a ZIP, or a pasted zillow.com search URL. A ZIP works alone but cannot be combined with a filter or sort; an unresolvable region is a 404."),
          listing_status: ostr("Which listings to return. Defaults to 'for_sale'. Accepted values: 'for_sale', 'for_rent', 'sold'."),
          page: onum("Results page, 1-based."),
          sort: ostr("Result sort order. Sorts that rank against a signed-in profile (saved/featured/personalised) are unsupported - we are never signed in. Accepted values: 'relevance', 'recommended', 'newest', 'price_low', 'price_high', 'payment_low', 'payment_high', 'beds', 'baths', 'sqft', 'lot_size', 'zestimate_low', 'zestimate_high', 'recent_change'."),
          min_price: onum("Minimum price, inclusive (0 or greater). On listing_status='for_rent' this is MONTHLY RENT - Zillow files rent under its payment filter."),
          max_price: onum("Maximum price, inclusive (0 or greater). On listing_status='for_rent' this is MONTHLY RENT."),
          beds_min: onum("Minimum bedrooms; whole number, 0 or greater."),
          beds_max: onum("Maximum bedrooms; whole number, 0 or greater."),
          baths_min: onum("Minimum bathrooms, 0 or greater. Half-baths are allowed (1.5)."),
          baths_max: onum("Maximum bathrooms, 0 or greater. Half-baths are allowed (1.5)."),
          sqft_min: onum("Minimum living area in square feet; whole number, 0 or greater."),
          sqft_max: onum("Maximum living area in square feet; whole number, 0 or greater."),
          lot_size_min: onum("Minimum lot size in square feet; whole number, 0 or greater."),
          lot_size_max: onum("Maximum lot size in square feet; whole number, 0 or greater."),
          year_built_min: onum("Earliest year built; whole number, 0 or greater."),
          year_built_max: onum("Latest year built; whole number, 0 or greater."),
          max_hoa: onum("Maximum monthly HOA fee in dollars, 0 or greater."),
          home_type: ostr("Property type filter. Accepted values: 'houses', 'townhomes', 'multi_family', 'condos', 'apartments', 'manufactured', 'lots_land'."),
          days_on_zillow: ostr("Listed - or, with listing_status='sold', sold - within the last N days. Closed enum: an unrecognised value returns the UNFILTERED set under a 200. Accepted values: '1', '7', '14', '30', '90', '6m', '12m', '24m', '36m'."),
          keywords: ostr("Free-text match against the listing description (1-200 characters)."),
          has_pool: obool("Only listings with a pool."),
          has_garage: obool("Only listings with a garage."),
          has_air_conditioning: obool("Only listings with air conditioning."),
          is_waterfront: obool("Only waterfront listings."),
          has_basement: obool("Only listings with a basement."),
          is_new_construction: obool("Only new-construction listings."),
          has_open_house: obool("Only listings with an upcoming open house."),
          price_reduced: obool("Only listings whose price was reduced."),
          is_3d_tour: obool("Only listings with a 3D tour."),
        }),
        (i) => client.zillow.search(i as SdkOpts<typeof client.zillow.search>)
      ),
      tool(
        "ZILLOW_PROPERTY",
        "Scavio Zillow Property",
        "Full Zillow listing: price and price history, Zestimate, tax history, RESO facts, rooms, schools, open houses, photos. Rental buildings return floor plans instead. Costs 1 credit.",
        z.object({
          zpid: str("Zillow property id (e.g. '29414894'), a full /homedetails/ URL, or a rental building URL (zillow.com/apartments/...). The building form is required for buildings: they have no zpid a caller can see."),
        }),
        (i) => client.zillow.property(i as SdkOpts<typeof client.zillow.property>)
      ),
      tool(
        "ZILLOW_AGENT_REVIEWS",
        "Scavio Zillow Agent Reviews",
        "A Zillow AGENT's profile and reviews: rating, bodies with sub-ratings, specialties, licenses, service areas, sales counts. Zillow server-renders the first five. Costs 1 credit.",
        z.object({
          screen_name: str("Zillow agent profile screen name as it appears in zillow.com/profile/<name>/ (1-200 characters, may contain spaces), or a full profile URL."),
        }),
        (i) => client.zillow.agentReviews(i as SdkOpts<typeof client.zillow.agentReviews>)
      )
    );
  }

  if (all || enableBooking) {
    tools.push(
      tool(
        "BOOKING_SEARCH",
        "Scavio Booking.com Search",
        "Booking.com properties for a destination and stay: live nightly price, review score, star rating, location, room type, deal badges. 25 properties per page. Provide destination or dest_id. Costs 1 credit.",
        z.object({
          destination: ostr("Destination to search, e.g. 'Paris' (1-200 characters). Required unless dest_id is given."),
          dest_id: ostr("Numeric Booking.com destination id, as an alternative to destination."),
          dest_type: ostr("What dest_id refers to. Requires dest_id and is rejected without it, because Booking silently ignores a lone dest_type. Accepted values: 'city', 'region', 'country', 'district', 'landmark', 'airport', 'hotel'."),
          page: onum("Results page, 1-based. 25 properties per page, 1 credit each."),
          sort_by: ostr("Result sort order (default 'popularity'). Accepted values: 'popularity', 'price_low', 'price_high', 'stars_high', 'stars_low', 'stars_and_price', 'distance', 'review_score'."),
          min_price: onum("Minimum price PER NIGHT in `currency`, >= 0. Must not exceed max_price."),
          max_price: onum("Maximum price PER NIGHT in `currency`, >= 0."),
          stars: oarrnum("Star ratings to include, each 1-5, 1-5 values, OR'd together (e.g. [4, 5])."),
          min_review_score: ostr("Minimum guest review score. Only '6', '7', '8' and '9' exist upstream; any other threshold is silently dropped."),
          property_type: ostrnum("Accommodation type by name, or a raw numeric Booking accommodation-type id (>= 1). Accepted values: 'apartments', 'hostels', 'hotels', 'motels', 'resorts', 'bed_and_breakfasts', 'villas', 'campgrounds', 'vacation_homes', 'lodges', 'homestays'."),
          free_cancellation: obool("Only properties offering free cancellation."),
          no_prepayment: obool("Only properties that take no prepayment."),
          breakfast_included: obool("Only rates that include breakfast."),
          checkin: ostr("Check-in date, YYYY-MM-DD. Must be sent together with checkout: a lone checkin is ignored and Booking prices a default range of its own."),
          checkout: ostr("Check-out date, YYYY-MM-DD. Must be later than checkin and sent together with it."),
          adults: onum("Adult guests, >= 1 (default 2)."),
          children_ages: oarrnum("AGES of accompanying children, each 0-17, max 10 entries. Ages, not a count."),
          rooms: onum("Rooms required, >= 1 (default 1)."),
          currency: ostr("ISO 4217 currency for prices, 3 letters (default 'USD'). Without it Booking prices off the proxy exit and identical requests disagree."),
        }),
        (i) => client.booking.search(i as SdkOpts<typeof client.booking.search>)
      ),
      tool(
        "BOOKING_HOTEL",
        "Scavio Booking.com Hotel",
        "One Booking.com property in full: rooms and rate plans, facilities, house rules, check-in windows, policies, images, location and review scores, priced for the stay asked for. Chaining the `url` a search row returns is cheaper than a bare slug. Costs 1 credit.",
        z.object({
          hotel: str("Booking.com property URL or the bare page slug (1-500 characters); query params are discarded."),
          country_code: ostr("Two-letter country code for the property page (default 'us'). Only consulted for a bare slug, where a wrong one is a real, BILLED 404."),
          checkin: ostr("Check-in date, YYYY-MM-DD. Must be sent together with checkout; omitting both prices a two-night range Booking chose, echoed back in the response."),
          checkout: ostr("Check-out date, YYYY-MM-DD. Must be later than checkin and sent together with it."),
          adults: onum("Adult guests, >= 1 (default 2)."),
          children_ages: oarrnum("AGES of accompanying children, each 0-17, max 10 entries. Ages, not a count."),
          rooms: onum("Rooms required, >= 1 (default 1)."),
          currency: ostr("ISO 4217 currency for prices, 3 letters (default 'USD'). Without it Booking prices off the proxy exit and identical requests disagree."),
        }),
        (i) => client.booking.hotel(i as SdkOpts<typeof client.booking.hotel>)
      ),
      tool(
        "BOOKING_REVIEWS",
        "Scavio Booking.com Reviews",
        "Booking.com guest reviews for a property with the score breakdown by category and Booking's own praise/complaint summary. No page param: total_count is the whole review history, count is what this response holds. Costs 1 credit.",
        z.object({
          hotel: str("Booking.com property URL or the bare page slug (1-500 characters); query params are discarded."),
          country_code: ostr("Two-letter country code for the property page (default 'us'). Only consulted for a bare slug, where a wrong one is a real, BILLED 404."),
          checkin: ostr("Check-in date, YYYY-MM-DD. Must be sent together with checkout; it prices the stay the review page is rendered for."),
          checkout: ostr("Check-out date, YYYY-MM-DD. Must be later than checkin and sent together with it."),
          adults: onum("Adult guests, >= 1 (default 2)."),
          children_ages: oarrnum("AGES of accompanying children, each 0-17, max 10 entries. Ages, not a count."),
          rooms: onum("Rooms required, >= 1 (default 1)."),
          currency: ostr("ISO 4217 currency for prices, 3 letters (default 'USD')."),
        }),
        (i) => client.booking.reviews(i as SdkOpts<typeof client.booking.reviews>)
      )
    );
  }

  // Tripadvisor is keyed by geo_id + location_id: resolve a name with
  // TRIPADVISOR_LOCATIONS first, or nothing else on the platform is reachable.
  if (all || enableTripadvisor) {
    tools.push(
      tool(
        "TRIPADVISOR_LOCATIONS",
        "Scavio Tripadvisor Locations",
        "START HERE: resolve a place or business NAME to the TripAdvisor geo_id / location_id pair every other TripAdvisor endpoint is keyed by. Up to 20 rows. Costs 2 credits.",
        z.object({
          query: str("Place or business name to resolve (1-120 characters)."),
          limit: onum("Rows to return, 1-20 (default 12). Sizes the response only; there is no paging here."),
        }),
        (i) => client.tripadvisor.locations(i as SdkOpts<typeof client.tripadvisor.locations>)
      ),
      tool(
        "TRIPADVISOR_SEARCH",
        "Scavio Tripadvisor Search",
        "Restaurants, hotels or attractions in a TripAdvisor geo, TripAdvisor-ranked: rating, review count, price band, address, coordinates, phone, hours, Travelers' Choice badge; each row carries the location_id + geo_id pair. 30 locations per page. Provide geo_id or url. Costs 2 credits.",
        z.object({
          geo_id: ostr("TripAdvisor geo id (1-500 characters): 30196, g30196, or a URL carrying one. Required unless url is given."),
          category: ostr("Listing family to search (default 'restaurants'). Accepted values: 'restaurants', 'hotels', 'attractions'."),
          page: onum("Results page, 1-based. 30 locations per page; a page beyond the last is a 404, not an empty result."),
          url: ostr("Full tripadvisor.com listing URL (1-500 characters), as an alternative to geo_id; country sites are accepted."),
        }),
        (i) => client.tripadvisor.search(i as SdkOpts<typeof client.tripadvisor.search>)
      ),
      tool(
        "TRIPADVISOR_LOCATION",
        "Scavio Tripadvisor Location",
        "One TripAdvisor location in full: rating, review histogram and per-aspect sub-ratings, city ranking, price band, cuisines, amenities, address, coordinates, contact, photos, and the FIRST PAGE OF REVIEWS. Provide location_id or url. Costs 2 credits.",
        z.object({
          location_id: ostr("TripAdvisor location id (1-500 characters): 1899234, d1899234, or a full _Review URL. Required unless url is given."),
          geo_id: ostr("Geo the location sits in; required when location_id is a bare d-id."),
          category: ostr("Location family (default 'restaurants'); match the location's own type. Accepted values: 'restaurants', 'hotels', 'attractions'."),
          url: ostr("Full tripadvisor.com _Review URL (1-500 characters), as an alternative to location_id."),
        }),
        (i) => client.tripadvisor.location(i as SdkOpts<typeof client.tripadvisor.location>)
      ),
      tool(
        "TRIPADVISOR_REVIEWS",
        "Scavio Tripadvisor Reviews",
        "A page of TripAdvisor reviews: rating, trip date and type, reviewer home town and contribution count, management response. Page 1 already rides along in location(), so use this to page PAST it; consecutive pages can repeat one review at the boundary, so de-duplicate on review_id. Provide location_id or url. Costs 2 credits.",
        z.object({
          location_id: ostr("TripAdvisor location id (1-500 characters): 1899234, d1899234, or a full _Review URL. Required unless url is given."),
          geo_id: ostr("Geo the location sits in; required when location_id is a bare d-id."),
          category: ostr("Location family (default 'restaurants'). It sets the page size, so it must match the location's own type on any page past the first. Accepted values: 'restaurants', 'hotels', 'attractions'."),
          url: ostr("Full tripadvisor.com _Review URL (1-500 characters), as an alternative to location_id."),
          page: onum("Reviews page, 1-based. 15 per page for restaurants, 10 for hotels and attractions; past the last page is a 404."),
        }),
        (i) => client.tripadvisor.reviews(i as SdkOpts<typeof client.tripadvisor.reviews>)
      )
    );
  }

  if (all || enableIndeed) {
    tools.push(
      tool(
        "INDEED_SEARCH",
        "Scavio Indeed Search",
        "Indeed job postings: title, employer, rating, location, salary range, job type, benefits, posting age, apply route. 10 postings per page. Provide query or location - a location-only search (every posting in a metro) is valid. Costs 2 credits.",
        z.object({
          query: ostr("Job title, keywords or employer (1-500 characters). Required unless location is given."),
          location: ostr("City and state, postal code, state, country, or 'Remote' (1-200 characters). Valid on its own with no query."),
          page: onum("Results page, 1-based. 10 postings per page, 1 call each."),
          radius: onum("Search radius in miles around location. Closed set: Indeed IGNORES any other value and returns the unfiltered set. Upstream default 50. Accepted values: 0, 5, 10, 15, 25, 35, 50, 100."),
          max_age_days: onum("Maximum posting age in days. Closed set: Indeed IGNORES any other value and returns postings of every age. Accepted values: 1, 3, 7, 14."),
          job_type: ostr("Employment type filter. Accepted values: 'full_time', 'part_time', 'contract', 'temporary', 'internship'."),
          min_salary: onum("Minimum annual salary, >= 0. Filters on INDEED'S OWN ESTIMATE for the role, not a posted figure, so postings publishing no salary still match."),
          remote: obool("Remote postings only."),
        }),
        (i) => client.indeed.search(i as SdkOpts<typeof client.indeed.search>)
      ),
      tool(
        "INDEED_JOB",
        "Scavio Indeed Job",
        "One Indeed posting in full: description text and HTML, structured salary, employment types, benefits, geocoded address, employer rating, applicant count, original ATS link. An unknown job key is a real 404 that is still billed. Costs 2 credits.",
        z.object({
          job_id: str("16-hex Indeed job key, or any indeed.com URL carrying jk= (/viewjob, /rc/clk, /pagead/clk)."),
        }),
        (i) => client.indeed.job(i as SdkOpts<typeof client.indeed.job>)
      ),
      tool(
        "INDEED_COMPANY",
        "Scavio Indeed Company",
        "Indeed employer profile: description, industry, HQ, size, revenue, CEO approval, overall and per-category ratings, reported salaries, open roles, locations. An unknown slug is a real 404 that is still billed. Costs 2 credits.",
        z.object({
          company: str("indeed.com/cmp/<slug> slug or a full profile URL (1-200 characters); slugs are untidy, e.g. 'Tata-Consultancy-Services-(tcs)'."),
        }),
        (i) => client.indeed.company(i as SdkOpts<typeof client.indeed.company>)
      ),
      tool(
        "INDEED_COMPANY_REVIEWS",
        "Scavio Indeed Company Reviews",
        "Indeed employee reviews, 20 per page, with per-category ratings, pros/cons, reviewer job title and location, plus aggregated sentiment and topic/location/job-title breakdowns. Costs 2 credits.",
        z.object({
          company: str("indeed.com/cmp/<slug> slug or a full profile URL (1-200 characters)."),
          page: onum("Reviews page, 1-based. 20 reviews per page."),
        }),
        (i) => client.indeed.companyReviews(i as SdkOpts<typeof client.indeed.companyReviews>)
      )
    );
  }

  if (all || enableAirbnb) {
    tools.push(
      tool(
        "AIRBNB_SEARCH",
        "Scavio Airbnb Search",
        "Airbnb stays: stay-total and per-night price with the full discount ledger, rating and review count, bedrooms/beds/baths, coordinates, badges, images, dates_are_defaulted. 18 listings per page; page and cursor are mutually exclusive. Costs 1 credit.",
        z.object({
          location: str("City, region, ZIP, or a pasted airbnb.com/s/ URL (1-200 characters). An unresolvable location is a 404."),
          check_in: ostr("Check-in date, YYYY-MM-DD. Must be sent with check_out; omitting both defaults to +30 days and flags dates_are_defaulted in the response."),
          check_out: ostr("Check-out date, YYYY-MM-DD. Must be later than check_in; defaults to check_in plus 5 nights when omitted."),
          adults: onum("Adult guests, >= 1."),
          children: onum("Children aged 2-12, >= 0."),
          infants: onum("Infants under 2, >= 0."),
          pets: onum("Pets, >= 0."),
          min_price: onum("Minimum price for the WHOLE STAY in `currency`, not per night, >= 0. Must not exceed max_price."),
          max_price: onum("Maximum price for the WHOLE STAY in `currency`, not per night, >= 0."),
          room_type: ostr("Room type. Validated before the scrape, because an unrecognised value returns the UNFILTERED set under a 200. Accepted values: 'entire_home', 'private_room', 'shared_room', 'hotel_room'."),
          min_bedrooms: onum("Minimum bedrooms, >= 0."),
          min_beds: onum("Minimum beds, >= 0."),
          min_bathrooms: onum("Minimum bathrooms, >= 0."),
          superhost: obool("Superhost listings only."),
          instant_book: obool("Instant Book listings only."),
          guest_favorite: obool("Guest Favorite listings only."),
          free_cancellation: obool("Listings with free cancellation only."),
          amenities: ostr("Comma-separated amenities (1-200 characters): wifi, air_conditioning, pool, kitchen, free_parking, washer, self_check_in, tv, or raw numeric Airbnb amenity ids. An unrecognised NAME is rejected before the scrape."),
          currency: ostr("ISO 4217 currency for prices, 3 letters (default 'USD'). Without it Airbnb prices off the proxy exit and identical requests disagree."),
          page: onum("Results page, 1-based. 18 listings per page. Cannot be combined with cursor."),
          cursor: ostr("next_cursor from a previous response (1-500 characters); wins over page, so sending both is rejected."),
        }),
        (i) => client.airbnb.search(i as SdkOpts<typeof client.airbnb.search>)
      ),
      tool(
        "AIRBNB_LISTING",
        "Scavio Airbnb Listing",
        "One Airbnb listing in full: description, property/room type, capacity and room counts, the complete grouped amenity list (including what the place does NOT have), host profile and stats, house rules, cancellation policy, sleeping arrangements, photo tour and the RATING BREAKDOWN. Carries NO nightly price - prices are search-only. Costs 1 credit.",
        z.object({
          listing_id: str("Airbnb listing id or a full /rooms/ URL (1-500 characters); query params are discarded, since they carry someone else's dates."),
          check_in: ostr("Check-in date, YYYY-MM-DD. Must be sent with check_out. Does not produce a price: the room page has no nightly rate."),
          check_out: ostr("Check-out date, YYYY-MM-DD. Must be later than check_in and sent together with it."),
          adults: onum("Adult guests, >= 1."),
          children: onum("Children aged 2-12, >= 0."),
          infants: onum("Infants under 2, >= 0."),
          pets: onum("Pets, >= 0."),
          currency: ostr("ISO 4217 currency, 3 letters (default 'USD')."),
        }),
        (i) => client.airbnb.listing(i as SdkOpts<typeof client.airbnb.listing>)
      ),
      tool(
        "AIRBNB_REVIEWS",
        "Scavio Airbnb Reviews",
        "Airbnb review BODIES with per-review rating, date and reviewer name/photo/location, limit/offset paged at up to 50 per call. `count` is the listing's TOTAL review count, `returned` is how many this page holds. The rating breakdown lives on listing(), not here. Costs 1 credit.",
        z.object({
          listing_id: str("Airbnb listing id or a full /rooms/ URL (1-500 characters)."),
          currency: ostr("ISO 4217 currency, 3 letters (default 'USD')."),
          limit: onum("Reviews to return, 1-50 (default 30). Upstream returns a fixed 7 when no explicit limit is sent."),
          offset: onum("Reviews to skip before this page, >= 0 (default 0)."),
        }),
        (i) => client.airbnb.reviews(i as SdkOpts<typeof client.airbnb.reviews>)
      )
    );
  }

  // Glassdoor is keyed by employer_id: resolve a name with GLASSDOOR_COMPANIES first.
  if (all || enableGlassdoor) {
    tools.push(
      tool(
        "GLASSDOOR_COMPANIES",
        "Scavio Glassdoor Companies",
        "START HERE. Resolve a company NAME to the employer_id every other Glassdoor method is keyed by, ranked by Glassdoor and de-duplicated. Costs 1 credit.",
        z.object({
          query: str("Company name to resolve (1-120 characters)."),
        }),
        (i) => client.glassdoor.companies(i as SdkOpts<typeof client.glassdoor.companies>)
      ),
      tool(
        "GLASSDOOR_COMPANY",
        "Scavio Glassdoor Company",
        "Glassdoor employer profile: description, mission, industry, sector, HQ, size and revenue bands, stock symbol, year founded, overall and per-category ratings, star distribution, CEO approval, awards, FAQ and the five server-rendered reviews. Also returns reviews_url and salaries_url, which reviews() and salaries() accept as url to save a fetch. Provide employer_id or url. Costs 1 credit.",
        z.object({
          employer_id: ostr("Glassdoor employer id (1-50 characters) in any form Glassdoor writes it: '1699', 'E1699' or 'IE1699'. Must be a STRING - a JSON number is rejected."),
          company: ostr("Employer name as it appears in a Glassdoor slug (1-200 characters). COSMETIC: the profile resolves on employer_id alone, it is ignored entirely when url is set, and it does not satisfy the employer_id-or-url requirement."),
          url: ostr("Any glassdoor.com employer URL (1-500 characters): /Overview/, /Reviews/ or /Salary/. A non-glassdoor.com host is rejected."),
        }),
        (i) => client.glassdoor.company(i as SdkOpts<typeof client.glassdoor.company>)
      ),
      tool(
        "GLASSDOOR_REVIEWS",
        "Scavio Glassdoor Reviews",
        "Up to THREE full Glassdoor reviews - the cap is Glassdoor's login wall - with per-axis scores, pros, cons, advice, job title, location, employment status and employer response, plus complete rating statistics, star distribution, aggregate pro/con highlight terms and per-job-title review counts. There is no page param: move the window with category and employment_status. Provide employer_id or url. Costs 1 credit.",
        z.object({
          employer_id: ostr("Glassdoor employer id (1-50 characters): '1699', 'E1699' or 'IE1699'. Must be a STRING - a JSON number is rejected. Addressing by id costs two upstream fetches; the customer price is unchanged."),
          company: ostr("Employer name as it appears in a Glassdoor slug (1-200 characters). COSMETIC: ignored when url is set, and it does not satisfy the employer_id-or-url requirement."),
          url: ostr("Any glassdoor.com employer URL (1-500 characters). Pass back reviews_url from company() to skip the resolve fetch. A non-glassdoor.com host is rejected."),
          category: ostr("Restrict to reviews Glassdoor files under one topic. Closed enum: Glassdoor IGNORES an unknown value and serves the unfiltered set under a 200. Read filtered_review_count on the response to see how many match. Accepted values: 'career_development', 'compensation', 'culture', 'diversity_and_inclusion', 'management', 'work_life_balance'."),
          employment_status: ostr("Restrict to one kind of employment. Closed enum for the same reason as category; FREELANCE is deliberately absent because it was never confirmed to change the result set. Accepted values: 'full_time', 'part_time', 'contract', 'intern'."),
        }),
        (i) => client.glassdoor.reviews(i as SdkOpts<typeof client.glassdoor.reviews>)
      ),
      tool(
        "GLASSDOOR_SALARIES",
        "Scavio Glassdoor Salaries",
        "Glassdoor salaries by job title, 10 titles per page: base-pay and total-pay percentiles P10-P90 with medians called out, sample counts, currency, pay period and last-reported date. The figures are Glassdoor's ESTIMATES for the title, not individual reported salaries. Provide employer_id or url. Costs 1 credit.",
        z.object({
          employer_id: ostr("Glassdoor employer id (1-50 characters): '1699', 'E1699' or 'IE1699'. Must be a STRING - a JSON number is rejected. Addressing by id costs two upstream fetches; the customer price is unchanged."),
          company: ostr("Employer name as it appears in a Glassdoor slug (1-200 characters). COSMETIC: ignored when url is set, and it does not satisfy the employer_id-or-url requirement."),
          url: ostr("Any glassdoor.com employer URL (1-500 characters). Pass back salaries_url from company() to skip the resolve fetch. A non-glassdoor.com host is rejected."),
          page: onum("Results page, 1-based. Ten job titles per page; page_count on the response is how many pages exist."),
        }),
        (i) => client.glassdoor.salaries(i as SdkOpts<typeof client.glassdoor.salaries>)
      )
    );
  }

  if (all || enableYelp) {
    tools.push(
      tool(
        "YELP_SEARCH",
        "Scavio Yelp Search",
        "Businesses in Yelp's ranked order: rating, review count, price band, categories, address, contact rails, hours, photos and a review snippet; every row carries both business_id and alias. Yelp fixes the page size at 10. Provide term and location, or url. Costs 2 credits.",
        z.object({
          term: ostr("What to look for (1-200 characters): a category ('plumbers'), a dish, or a business name. Required together with location unless url is given."),
          location: ostr("Where to look (1-200 characters): city and region, a full address, or a postcode. Effectively required - Yelp geolocates a location-less search off the proxy exit, so the same request answers about a different metro run to run."),
          page: onum("Results page, 1-based. Yelp fixes the page size at 10."),
          sort: ostr("Result ordering (upstream default 'recommended'). Closed enum: Yelp IGNORES an unrecognised sortby and serves default ranking under a 200, billing a premium scrape for a sort that never ran. Accepted values: 'recommended', 'rating', 'review_count'."),
          price: oarrnum("Price bands to include, 1 ($) to 4 ($$$$); 1-4 values, combined freely - [1, 2] means $ or $$. Accepted values: 1, 2, 3, 4."),
          open_now: obool("Only businesses open at the moment of the request."),
          attributes: oarrstr("Raw Yelp filter aliases, max 20, each 1-100 characters ('RestaurantsDelivery', 'GoodForKids', 'WheelchairAccessible'). A deliberate PASSTHROUGH, not an enum - Yelp's vocabulary runs to ~117 values per vertical and an alias it does not know is ignored upstream, returning unfiltered results."),
          url: ostr("A full yelp.com/search URL (1-1000 characters) as an alternative to term + location; the query, offset and sort are read out of it and the URL is rebuilt."),
        }),
        (i) => client.yelp.search(i as SdkOpts<typeof client.yelp.search>)
      ),
      tool(
        "YELP_BUSINESS",
        "Scavio Yelp Business",
        "One business in full: rating and per-star histogram, review count, price band, categories, address and coordinates, phone, website and menu links, hours and holidays, amenities, photos and videos, popular items, health inspections, Q&A, licences and claim status - plus the first page of reviews at no extra cost. Provide business_id or url. Costs 2 credits.",
        z.object({
          business_id: ostr("A Yelp business alias ('desnudo-coffee-austin-2'), its opaque encid, or any yelp.com/biz URL carrying one (1-500 characters). Search rows return both id forms."),
          url: ostr("A full yelp.com/biz URL (1-1000 characters) as an alternative to business_id."),
        }),
        (i) => client.yelp.business(i as SdkOpts<typeof client.yelp.business>)
      ),
      tool(
        "YELP_REVIEWS",
        "Scavio Yelp Reviews",
        "A page of reviews: rating, full text, language, author profile and expertise counts, attached photos, reaction counts and owner response. 10 per page. PAGE 1 IS REDUNDANT - it re-fetches the document business() already returned - so start at page 2. Provide business_id or url. Costs 2 credits.",
        z.object({
          business_id: ostr("A Yelp business alias ('desnudo-coffee-austin-2'), its opaque encid, or any yelp.com/biz URL carrying one (1-500 characters)."),
          url: ostr("A full yelp.com/biz URL (1-1000 characters) as an alternative to business_id."),
          page: onum("Reviews page, 1-based, 10 per page. Page 1 duplicates the reviews business() already returned and costs another 2 credits - start at 2. A page past the last review is a 404, not an empty result."),
          sort: ostr("Review ordering (upstream default 'relevance'). Closed enum: Yelp IGNORES an unrecognised value and serves default ranking under a billed 200. Accepted values: 'relevance', 'newest', 'oldest', 'rating_high', 'rating_low', 'elites'."),
          rating: onum("Only reviews at this star rating, 1-5. Changes filtered_review_count on the response, not review_count. Accepted values: 1, 2, 3, 4, 5."),
        }),
        (i) => client.yelp.reviews(i as SdkOpts<typeof client.yelp.reviews>)
      )
    );
  }

  if (all || enableAppStore) {
    tools.push(
      tool(
        "APP_STORE_SEARCH",
        "Scavio App Store Search",
        "Search the App Store and get up to 200 fully-shaped app rows - the same 43-field row as app() - so a search doubles as a bulk metadata fetch and as a publisher lookup. NO PAGINATION: raise limit, there is no second page. Costs 1 credit.",
        z.object({
          term: str("What to search for (1-500 characters). Apple matches an app name, a keyword OR a publisher name, so searching a developer returns their catalogue."),
          limit: onum("Apps to return, 1-200 (default 25). The ONLY lever on result volume: the search API has no pagination and every offset spelling is silently ignored."),
          country: ostr("Two-letter ISO storefront code (default 'us'); decides price, currency, localised title and whether the app is sold there at all. Anything that is not exactly two letters is rejected with a free 400."),
          entity: ostr("Which catalogue to search: iPhone/iPad apps ('software', the default), iPad apps, or Mac App Store apps. These are separate stores, not a filter - Mac rows carry no iPad/Apple TV screenshots, advisories, features, supported devices or Game Center flag, returning them empty rather than absent. Accepted values: 'software', 'ipad_software', 'mac_software'."),
          lang: ostr("Listing text language as a five-letter code ('en_us', 'ja_jp'); any other shape is rejected. Independent of country: the storefront sets the price, this sets the words."),
        }),
        (i) => client.appStore.search(i as SdkOpts<typeof client.appStore.search>)
      ),
      tool(
        "APP_STORE_APP",
        "Scavio App Store App",
        "Full App Store listing: title, description, developer and seller identity, price and currency, all-time and current-version ratings, version and release notes, genres, content rating and advisories, icons at three sizes, screenshots, download size, minimum OS, languages, supported devices and the Game Center and VPP flags. Costs 1 credit.",
        z.object({
          app_id: str("App Store id - the digits after 'id' in an apps.apple.com URL - or the app's bundle id ('notion.id', 'com.burbn.instagram'); both resolve to the identical payload. 1-255 characters matching ^[A-Za-z0-9][A-Za-z0-9._-]*$, so a pasted apps.apple.com URL is rejected with a free 400. An id Apple cannot resolve is a billed 404."),
          country: ostr("Two-letter ISO storefront code (default 'us'); decides price, currency, localised title and whether the app is sold there at all. Anything that is not exactly two letters is rejected with a free 400."),
        }),
        (i) => client.appStore.app(i as SdkOpts<typeof client.appStore.app>)
      ),
      tool(
        "APP_STORE_REVIEWS",
        "Scavio App Store Reviews",
        "A page of App Store reviews: star rating, title, full text, author and the APP VERSION the review was written against. 50 per page, hard-stopped at page 10 - 500 reviews per storefront is Apple's anonymous ceiling. This endpoint cannot 404: an unknown id and a real app with no reviews return the same empty feed. Costs 1 credit.",
        z.object({
          app_id: str("App Store id, NUMERIC ONLY - unlike app(), the reviews feed has no bundle-id form."),
          country: ostr("Two-letter ISO storefront code (default 'us'). Anything that is not exactly two letters is rejected with a free 400. Ask a different country to reach past the 500-review ceiling."),
          page: onum("Reviews page, 1-10, 50 reviews each (default 1). Apple hard-stops at page 10."),
          sort: ostr("Review ordering (default 'most_recent'). The choice decides whether the vote fields mean anything: under most_recent almost every review is too new to have been voted on and returns zeroes, while most_helpful returns them densely populated."),
        }),
        (i) => client.appStore.reviews(i as SdkOpts<typeof client.appStore.reviews>)
      )
    );
  }

  if (all || enableGooglePlay) {
    tools.push(
      tool(
        "GOOGLE_PLAY_SEARCH",
        "Scavio Google Play Search",
        "Ranked Google Play apps: package name, title, developer, rating, install count, price and IAP range, content rating, icon and screenshots. A branded query returns the hero card as result 1 in the same row shape, plus Play's related-query rail. NO PAGINATION - one shelf of about 30 apps. Costs 2 credits.",
        z.object({
          query: str("What to search the store for (1-200 characters): an app name, a publisher, or a category phrase. Apps only - games are folded into the apps vertical, but books and films use a different card shape and are not covered."),
          hl: ostr("UI language, 2-20 characters (default 'en'). Changes the STOREFRONT, not only the strings: at hl=pt-BR the title, description, install formatting and content rating all move with it. Play silently falls back to English on a value it does not serve."),
          gl: ostr("Country code, 2-10 characters (default 'us'), deciding which storefront's price and availability are returned. Play silently falls back to the US storefront on a country it does not serve."),
        }),
        (i) => client.googlePlay.search(i as SdkOpts<typeof client.googlePlay.search>)
      ),
      tool(
        "GOOGLE_PLAY_APP",
        "Scavio Google Play App",
        "Full Google Play store listing: installs including the REAL count Play publishes but never renders, rating and star histogram, description, developer identity and legal contact, price and IAPs, categories and gameplay tags, screenshots and trailer, version and Android requirement, release and update dates, changelog, the full permission tree, the Data safety table, the 20 server-rendered reviews and the similar-apps and more-by-developer rails. Costs 2 credits.",
        z.object({
          app_id: str("Android package name ('com.spotify.music') or any play.google.com URL carrying one in its id param (1-500 characters)."),
          hl: ostr("UI language, 2-20 characters (default 'en'). Changes the STOREFRONT, not only the strings: title, description, install formatting and content rating all move with it. Play silently falls back to English on a value it does not serve."),
          gl: ostr("Country code, 2-10 characters (default 'us'), deciding which storefront's price and availability are returned. Play silently falls back to the US storefront on a country it does not serve."),
        }),
        (i) => client.googlePlay.app(i as SdkOpts<typeof client.googlePlay.app>)
      ),
      tool(
        "GOOGLE_PLAY_REVIEWS",
        "Scavio Google Play Reviews",
        "A page of Google Play reviews: star score, full text, author, thumbs-up count, developer reply and the APP VERSION the reviewer was running. Paged by cursor, up to 200 per call. app() already returns the 20 reviews Play server-renders; use this to page past them or sort differently. Costs 2 credits.",
        z.object({
          app_id: str("Android package name ('com.spotify.music') or any play.google.com URL carrying one in its id param (1-500 characters)."),
          sort: ostr("Review ordering (default 'newest'). Closed enum. The cursor encodes the sort, so keep this identical when paging. Accepted values: 'relevance', 'newest', 'rating'."),
          count: onum("Reviews to return, 1-200 (default 50); 200 is our cap, not Play's. Play honours more, but a single page that large is megabytes for one credit - page with cursor instead."),
          cursor: ostr("Continuation token from a prior response's next_cursor (1-4000 characters). Opaque and SINGLE-USE, and it encodes the sort as well as the position - send it back with the SAME sort it came from. A cursor past the last review is a 404, not an empty page."),
          hl: ostr("UI language, 2-20 characters (default 'en'). Changes the STOREFRONT, not only the strings. Play silently falls back to English on a value it does not serve."),
          gl: ostr("Country code, 2-10 characters (default 'us'), deciding which storefront's price and availability are returned. Play silently falls back to the US storefront on a country it does not serve."),
        }),
        (i) => client.googlePlay.reviews(i as SdkOpts<typeof client.googlePlay.reviews>)
      )
    );
  }

  // SEC EDGAR is keyed by CIK: resolve a ticker with SEC_LOOKUP first.
  if (all || enableSec) {
    tools.push(
      tool(
        "SEC_LOOKUP",
        "Scavio SEC Lookup",
        "START HERE. Resolve a company name or ticker (AAPL) to the CIK (0000320193) every other SEC EDGAR endpoint is keyed by. Up to 100 rows, tiered by match quality. Costs 1 credit.",
        z.object({
          query: str("Ticker ('AAPL', 'BRK.B'), company name, or a fragment of one (1-200 characters); each row carries its match tier as 'match'."),
          limit: onum("Rows to return, 1-100. Defaults to 10. Sizes the response; it is not a page param."),
          exchange: ostr("Restrict to one listing venue; matched case-insensitively, so 'Nasdaq' also works. Filers the SEC lists with no exchange at all are excluded by any value. Accepted values: 'NASDAQ', 'NYSE', 'OTC', 'CBOE'."),
        }),
        (i) => client.sec.lookup(i as SdkOpts<typeof client.sec.lookup>)
      ),
      tool(
        "SEC_COMPANY",
        "Scavio SEC Company",
        "SEC filer profile: legal and former names, SIC industry, filer category, EIN, LEI, state of incorporation, fiscal year end, addresses, every ticker with its exchange, and a preview of its 10 most recent filings. Provide cik or ticker. Costs 1 credit.",
        z.object({
          cik: ostr("Filer CIK in any spelling (1-20 characters): 320193, 0000320193 or CIK0000320193. A ticker is accepted here too."),
          ticker: ostr("Ticker symbol (1-20 characters), dotted or dashed (BRK.B / BRK-B). Wins over cik when both are given."),
        }),
        (i) => client.sec.company(i as SdkOpts<typeof client.sec.company>)
      ),
      tool(
        "SEC_FILINGS",
        "Scavio SEC Filings",
        "A page of one filer's filings: accession number, form and root form, filing and period dates, 8-K item codes, direct links to the primary document, filing index and attachment directory. Up to 500 per page. Provide cik or ticker. Costs 1 credit.",
        z.object({
          cik: ostr("Filer CIK, zero-padded or bare (1-20 characters). A ticker is accepted here too."),
          ticker: ostr("Ticker symbol (1-20 characters), as an alternative to cik."),
          form: ostrarr("Form types to keep: '10-K', ['10-K', '10-Q'] or the comma-joined '10-K,8-K'; each value 1-50 characters, at most 25 values. Matched against the form AND its root form, so 10-K also returns 10-K/A amendments; ask for '10-K/A' to get only amendments."),
          date_from: ostr("Earliest filing date, inclusive (YYYY-MM-DD)."),
          date_to: ostr("Latest filing date, inclusive (YYYY-MM-DD)."),
          page: onum("Results page, 1-based; page size is whatever limit is set to. No upper bound."),
          limit: onum("Filings per page, 1-500. Defaults to 50."),
          include_history: obool("Also fetch the archived filing history beyond EDGAR's 'recent' block, which is not a fixed window (a decade for a quiet filer, about a year for a prolific one). Off by default; at most 10 archived shards are fetched, history_truncated says when a filer had more, and it is still 1 credit."),
        }),
        (i) => client.sec.filings(i as SdkOpts<typeof client.sec.filings>)
      ),
      tool(
        "SEC_CONCEPT",
        "Scavio SEC Concept",
        "Every value a filer reported for one XBRL concept, newest period first, with the form and filing each number came from. Restatements are kept, not collapsed. Up to 2000 rows. Provide cik or ticker. Costs 1 credit.",
        z.object({
          concept: str("XBRL concept tag, CASE-SENSITIVE (1-120 characters, ^[A-Za-z][A-Za-z0-9]*$): 'NetIncomeLoss' matches, 'netincomeloss' is a 404 upstream. Use facts() to list what a filer actually reports."),
          cik: ostr("Filer CIK, zero-padded or bare (1-20 characters). A ticker is accepted here too."),
          ticker: ostr("Ticker symbol (1-20 characters), as an alternative to cik."),
          taxonomy: ostr("Reporting taxonomy (1-40 characters, ^[A-Za-z][A-Za-z0-9-]*$): us-gaap, dei, ifrs-full or srt. Defaults to 'us-gaap'."),
          unit: ostr("Unit of measure to keep (1-40 characters), e.g. 'USD' vs 'USD/shares'."),
          form: ostr("Form to keep (1-50 characters). EXACT match here, unlike filings(), so '10-K' excludes 10-K/A."),
          limit: onum("Rows to return, 1-2000. Defaults to 250. Sizes the response; it is not a page param."),
        }),
        (i) => client.sec.concept(i as SdkOpts<typeof client.sec.concept>)
      ),
      tool(
        "SEC_FACTS",
        "Scavio SEC Facts",
        "The index of every XBRL concept a filer reports - tag, label, description, units and most recent value - across us-gaap, dei and any other taxonomy it uses. This is how you find what to ask concept() for. Up to 2000 rows. Provide cik or ticker. Costs 1 credit.",
        z.object({
          cik: ostr("Filer CIK, zero-padded or bare (1-20 characters). A ticker is accepted here too."),
          ticker: ostr("Ticker symbol (1-20 characters), as an alternative to cik."),
          taxonomy: ostr("Restrict to one taxonomy (1-40 characters), e.g. 'us-gaap' or 'dei'."),
          query: ostr("Case-insensitive substring matched against the tag name and label (1-200 characters)."),
          limit: onum("Rows to return, 1-2000. Defaults to 250. Sizes the response; it is not a page param."),
        }),
        (i) => client.sec.facts(i as SdkOpts<typeof client.sec.facts>)
      ),
      tool(
        "SEC_SEARCH",
        "Scavio SEC Search",
        "EDGAR full-text search, coverage starting 2001: each hit is the matching DOCUMENT with its URL, form, filing date and filer identity, plus facets by company, form, industry and state. 100 documents per page, last page is 100. Costs 1 credit.",
        z.object({
          query: ostr("Full-text query over filing documents (1-500 characters); a quoted phrase is matched exactly, bare words as a bag of terms. Optional - a cik, ticker, form or date filter on its own is a valid search."),
          cik: ostrarr("Restrict to one or more filers by CIK: a single value, a list, or a comma-joined string; each 1-20 characters, at most 25 values. Tickers are accepted here too."),
          ticker: ostrarr("Restrict to one or more filers by ticker symbol: a single value, a list, or a comma-joined string; each 1-20 characters, at most 25 values."),
          form: ostrarr("Form types to keep: '8-K', ['10-K', '10-Q'] or the comma-joined '10-K,10-Q'; each 1-50 characters, at most 25 values."),
          date_from: ostr("Earliest filing date, inclusive (YYYY-MM-DD). Full-text coverage starts in 2001."),
          date_to: ostr("Latest filing date, inclusive (YYYY-MM-DD)."),
          location: ostrarr("Filer business-address locations as EDGAR's own 2-character codes (CA, NY, and its alphanumeric codes for foreign jurisdictions): a single value, a list, or a comma-joined string; at most 25 values."),
          sort: ostr("Result ordering. Defaults to the index's own relevance ranking. Accepted values: 'relevance', 'newest', 'oldest'."),
          page: onum("Results page, 1-based, 1-100, 100 documents per page. The SEC's index refuses a result window past 10,000, so 100 is the last page for any query."),
        }),
        (i) => client.sec.search(i as SdkOpts<typeof client.sec.search>)
      )
    );
  }

  if (all || enableRedfin) {
    tools.push(
      tool(
        "REDFIN_SEARCH",
        "Scavio Redfin Search",
        "Redfin listings: price, price per sqft, beds, baths, living area, lot size, year built, coordinates, listing remarks and full photo galleries, for sale, sold or for rent. Up to 350 per page. Provide location, or region_id together with region_type. Costs 1 credit.",
        z.object({
          location: ostr("A redfin.com region URL (/city/, /neighborhood/, /county/, /zipcode/) or a bare 5-digit ZIP (1-500 characters). CITY NAMES ARE NOT ACCEPTED - Redfin's own name lookup is blocked to us; use region_id + region_type instead."),
          region_id: onum("Redfin internal region id (>= 1), used together with region_type. NOT a ZIP code - the two are different number spaces and a ZIP here resolves to another city rather than failing."),
          region_type: onum("Region kind that region_id belongs to: 1 neighborhood, 2 ZIP, 5 county, 6 city. Must be sent together with region_id or both are ignored in favour of location."),
          listing_status: ostr("Market to search. Defaults to 'for_sale'. Accepted values: 'for_sale', 'sold', 'for_rent'."),
          sold_within_days: onum("Sold within the last N days (>= 1). REJECTED unless listing_status='sold', where it defaults to 90."),
          page: onum("Results page, 1-based; page size is whatever limit is set to. No upper bound."),
          limit: onum("Listings per page, 1-350. Defaults to 100."),
          sort: ostr("Result sort order. Defaults to 'recommended', Redfin's own ranking. Accepted values: 'recommended', 'price_low', 'price_high', 'newest', 'oldest', 'sqft_low', 'sqft_high', 'price_per_sqft_low', 'price_per_sqft_high'."),
          min_price: onum("Minimum price, inclusive (>= 0). Monthly rent when listing_status='for_rent'."),
          max_price: onum("Maximum price, inclusive (>= 0). Monthly rent when listing_status='for_rent'."),
          beds_min: onum("Minimum bedrooms (whole number >= 0); fractional values are rejected."),
          beds_max: onum("Maximum bedrooms (whole number >= 0); fractional values are rejected."),
          baths_min: onum("Minimum bathrooms (whole number >= 0). WHOLE BATHS ONLY - 1.5 is rejected rather than silently truncated to 1. There is no baths_max."),
          sqft_min: onum("Minimum living area in square feet (whole number >= 0)."),
          sqft_max: onum("Maximum living area in square feet (whole number >= 0)."),
          lot_size_min: onum("Minimum lot size in square feet (whole number >= 0). There is no lot_size_max."),
          year_built_min: onum("Earliest year built (whole number >= 0)."),
          year_built_max: onum("Latest year built (whole number >= 0)."),
          max_hoa: onum("Maximum monthly HOA fee in dollars (>= 0)."),
          property_type: ostr("Restrict to one property type. Accepted values: 'house', 'condo', 'townhouse', 'multi_family', 'land', 'other', 'co_op'."),
          has_pool: obool("Only listings with a pool."),
          max_days_on_market: onum("Listed at most N days ago (whole number >= 0). Cannot be combined with min_days_on_market - Redfin expresses both bounds through one param."),
          min_days_on_market: onum("Listed at least N days ago (whole number >= 0). Cannot be combined with max_days_on_market."),
        }),
        (i) => client.redfin.search(i as SdkOpts<typeof client.redfin.search>)
      ),
      tool(
        "REDFIN_PROPERTY",
        "Scavio Redfin Property",
        "One Redfin listing in full: price, Redfin Estimate and rental estimate, complete MLS fact sheet, price and tax history, listing agents, open houses, schools, climate risk, walkability, sun exposure, monthly weather, permits, zoning, comparable sales and photos. Costs 1 credit.",
        z.object({
          property_id: str("Redfin property id, or any redfin.com listing URL carrying one (1-500 characters)."),
        }),
        (i) => client.redfin.property(i as SdkOpts<typeof client.redfin.property>)
      ),
      tool(
        "REDFIN_MARKET",
        "Scavio Redfin Market",
        "Redfin housing-market stats for a region: median list and sale price, price per sqft, sale-to-list ratio, average offers and days on market, YoY movement, 0-100 compete score, live inventory by property type and by bedroom count, and Redfin agent presence. Provide location, or region_id together with region_type. Costs 1 credit.",
        z.object({
          location: ostr("A redfin.com region URL (/city/, /neighborhood/, /county/, /zipcode/) or a bare 5-digit ZIP (1-500 characters). City names are not accepted."),
          region_id: onum("Redfin internal region id (>= 1), used together with region_type. Not a ZIP code."),
          region_type: onum("Region kind that region_id belongs to: 1 neighborhood, 2 ZIP, 5 county, 6 city. Must be sent together with region_id or both are ignored in favour of location."),
        }),
        (i) => client.redfin.market(i as SdkOpts<typeof client.redfin.market>)
      )
    );
  }

  if (all || enableCompaniesHouse) {
    tools.push(
      tool(
        "COMPANIES_HOUSE_SEARCH",
        "Scavio Companies House Search",
        "START HERE. Search the UK register by name and get the company_number every other Companies House endpoint is keyed by, plus status, incorporation or dissolution date, registered office and matched former names. 20 per page, last page is 50. Costs 1 credit.",
        z.object({
          query: str("Company name or fragment (1-200 characters, non-blank). Matches CURRENT AND FORMER names."),
          page: onum("Results page, 1-based, 1-50, 20 results per page. Defaults to 1. The register serves only a 1000-result window per term whatever hit count it prints, and answers page 51 with HTTP 416."),
        }),
        (i) => client.companiesHouse.search(i as SdkOpts<typeof client.companiesHouse.search>)
      ),
      tool(
        "COMPANIES_HOUSE_COMPANY",
        "Scavio Companies House Company",
        "Full UK register entry: status, type, incorporation and dissolution dates, registered office, SIC codes, previous names, accounts and confirmation-statement due dates with overdue flags, and whether it has charges, insolvency history, officers or UK establishments. Costs 1 credit.",
        z.object({
          company_number: str("UK company number (1-20 characters), zero-padded and upper-cased for you, so '445790' and 'sc090312' both work. Registry prefixes supported: SC, NI, OC, SO, NC, FC, BR, CE."),
        }),
        (i) => client.companiesHouse.company(i as SdkOpts<typeof client.companiesHouse.company>)
      ),
      tool(
        "COMPANIES_HOUSE_OFFICERS",
        "Scavio Companies House Officers",
        "UK company officers, current and resigned, 35 per page: name, role, appointment and resignation dates, correspondence address, nationality, country of residence, month-and-year date of birth and identity-verification status. Costs 1 credit.",
        z.object({
          company_number: str("UK company number (1-20 characters), zero-padded and upper-cased for you."),
          page: onum("Results page, 1-based, 35 per page. Defaults to 1. No upper bound: past the last page the register answers an ordinary 200 with an empty list, identical to a company with no officers."),
        }),
        (i) => client.companiesHouse.officers(i as SdkOpts<typeof client.companiesHouse.officers>)
      ),
      tool(
        "COMPANIES_HOUSE_FILING_HISTORY",
        "Scavio Companies House Filing History",
        "UK filings, most recent first: date, filing type code (AA, CS01, SH03), description, register annotations and child documents, and a link to the filed PDF with its page count. A filing the register has not finished processing carries a processing_note instead of a document. Costs 1 credit.",
        z.object({
          company_number: str("UK company number (1-20 characters), zero-padded and upper-cased for you."),
          page: onum("Results page, 1-based. Defaults to 1. No upper bound: past the last page the register answers an ordinary 200 with an empty list."),
        }),
        (i) => client.companiesHouse.filingHistory(i as SdkOpts<typeof client.companiesHouse.filingHistory>)
      )
    );
  }

  if (all || enableG2) {
    tools.push(
      tool(
        "G2_SEARCH",
        "Scavio G2 Search",
        "Search G2, the B2B software review site, for products: star rating, review count, vendor, categories, seller description and logo, with product_id and slug on every row. Up to 100 results per page (server default 20) and page-paginated; total_results is G2's Products-tab headline and caps at 10000, while total_by_type splits the query across products, sellers, categories and discussions. Provide query or url. Costs 5 credits.",
        z.object({
          query: ostr("Search term (1-200 characters). Provide this or url."),
          page: onum("1-based page number; page size follows limit (server default 20). G2 keeps paginating well past its own widget's page links."),
          limit: onum("Results per page (1-100; server default 20). The 100 ceiling is ours, to keep a single request inside the 60s deadline; G2 itself paginates at any size."),
          sort: ostr("Result sort order (server default 'relevance'). Closed enum: G2 silently accepts an unknown sort and answers 200 with an unstated ordering. Accepted values: 'relevance', 'popular', 'alphabetical', 'rating'."),
          rating: onum("Only products at or above this star rating (1-5, sent as an integer). Omit for no rating floor. Accepted values: 1, 2, 3, 4, 5."),
          url: ostr("Full g2.com/search URL, as an alternative to query (1-1000 characters; the host is checked by the transport)."),
        }),
        (i) => client.g2.search(i as SdkOpts<typeof client.g2.search>)
      ),
      tool(
        "G2_PRODUCT",
        "Scavio G2 Product",
        "Full G2 product profile: rating with per-star histogram, review count, vendor, description and seller website, pricing editions with parsed amounts, feature groups, categories and breadcrumbs, supported languages, integrations, alternatives, head-to-head comparisons, media, community discussions and G2's AI-derived pros and cons. Carries NO review text at all -- G2 loads review bodies in a separate frame, so call reviews() for those. Provide product_id or url. Costs 5 credits.",
        z.object({
          product_id: ostr("G2 product slug ('notion') or the numeric G2 id ('82623') as a string (1-200 characters); both resolve on the same upstream path."),
          url: ostr("Full g2.com product URL, as an alternative to product_id (1-1000 characters)."),
        }),
        (i) => client.g2.product(i as SdkOpts<typeof client.g2.product>)
      ),
      tool(
        "G2_REVIEWS",
        "Scavio G2 Reviews",
        "A page of G2 reviews: rating, title, likes and dislikes, problems solved, reviewer job title, industry and company size, validated and incentivized flags -- plus what the profile page has no form of: exact per-star counts, pros and cons with per-theme counts, and company-size, role, industry, region and category facets with counts. Fixed at 10 reviews per page and paginates well past the 10 pages G2's own widget links to. Provide product_id or url. Costs 5 credits.",
        z.object({
          product_id: ostr("G2 product slug or numeric G2 id as a string (1-200 characters)."),
          url: ostr("Full g2.com reviews URL, as an alternative to product_id (1-1000 characters)."),
          page: onum("1-based page number; fixed at 10 reviews per page."),
          sort: ostr("Review sort order (server default 'relevance'). Closed enum: an unknown sort is silently accepted upstream and never runs. Accepted values: 'relevance', 'newest', 'most_helpful', 'rating_high', 'rating_low'."),
          rating: onum("Only reviews in this star bucket (1-5, sent as an integer). Buckets are half- star-inclusive: 1 returns 0, 0.5 and 1-star reviews. Accepted values: 1, 2, 3, 4, 5."),
          company_size: ostr("Reviewer company size: small_business is 50 employees or fewer, mid_market 51-1000, enterprise over 1000. Closed enum -- an unknown value matches nothing and returns a billed 'Reviews (0)'."),
          role: ostr("Reviewer role. Closed enum -- an unknown value matches nothing rather than erroring. Accepted values: 'user', 'administrator', 'executive_sponsor', 'internal_consultant', 'consultant', 'agency', 'industry_analyst'."),
          region: ostr("Reviewer region. Closed enum -- an unknown value matches nothing rather than erroring. Accepted values: 'north_america', 'europe', 'asia', 'latin_america', 'anz', 'middle_east', 'africa'."),
          query: ostr("Full-text search within this product's reviews (1-200 characters); narrows the review list AND every facet count."),
        }),
        (i) => client.g2.reviews(i as SdkOpts<typeof client.g2.reviews>)
      )
    );
  }

  if (all || enableCapterra) {
    tools.push(
      tool(
        "CAPTERRA_SEARCH",
        "Scavio Capterra Search",
        "Search Capterra, the B2B software review site: 20 ranked products with name, vendor description, rating, review count, logo and paid-placement flag, each row carrying product_id and slug. The result set is fixed at 20 and does NOT paginate -- Capterra serves identical rows for page 2, so there is deliberately no page parameter. Provide query or url. Costs 2 credits.",
        z.object({
          query: ostr("Search term (1-200 characters). Required in practice: a term-less Capterra search serves a fixed popular-products list unrelated to the caller."),
          url: ostr("Full capterra.com search URL, as an alternative to query (1-1000 characters; the transport also accepts capterra.co.uk and capterra.com.br hosts)."),
        }),
        (i) => client.capterra.search(i as SdkOpts<typeof client.capterra.search>)
      ),
      tool(
        "CAPTERRA_PRODUCT",
        "Scavio Capterra Product",
        "Full Capterra profile: rating with per-star histogram and the four scored criteria, likelihood to recommend, review sentiment and topics, the complete pricing table with every plan and its features, every rated feature and integration, AI-derived pros and cons with the quoted review, FAQs, screenshots, badges and awards, competitor comparisons and alternatives, and the buyer profile by company size, industry and job function -- PLUS the 25 most recent reviews at no extra cost. vendor is always null here: Capterra does not publish it as structured data on the product page. Provide product_id or url. Costs 2 credits.",
        z.object({
          product_id: ostr("The number in a Capterra product path such as /p/186596/Notion/ (1-50 characters). Must be a STRING -- a JSON number is rejected."),
          slug: ostr("Product slug (1-200 characters). Cosmetic on this endpoint -- a wrong slug still returns the right profile -- but load-bearing on reviews()."),
          url: ostr("Full Capterra product URL, as an alternative to product_id (1-1000 characters)."),
        }),
        (i) => client.capterra.product(i as SdkOpts<typeof client.capterra.product>)
      ),
      tool(
        "CAPTERRA_REVIEWS",
        "Scavio Capterra Reviews",
        "A page of Capterra reviews: overall score plus five per-criterion scores, title, pros, cons, advice, usage duration, incentivized flag, alternatives considered and what they switched from, reviewer job title, industry and company size, and the vendor response -- plus a competitor list richer than the profile's, each alternative with its own rating histogram and starting price. 25 reviews per page, capped at page 100. Page 1 already rides along inside product(), so use this to page past it. Provide product_id or url. Costs 2 credits.",
        z.object({
          product_id: ostr("Capterra product id as a string (1-50 characters)."),
          slug: ostr("Product slug (1-200 characters). LOAD-BEARING here: it is case-sensitive upstream and a wrong one silently serves page one under a billed 200. Pass back the slug from search() or product()."),
          url: ostr("Full Capterra reviews URL, as an alternative to product_id (1-1000 characters). Passing back reviews_url from product() is the reliable way to page."),
          page: onum("1-based page number (1-100); 25 reviews per page. 100 is a hard cap whatever the review count says -- past it Capterra answers 200 with page one."),
        }),
        (i) => client.capterra.reviews(i as SdkOpts<typeof client.capterra.reviews>)
      )
    );
  }

  // Google Ads Transparency is keyed by advertiser_id: resolve a brand with
  // GOOGLE_ADS_ADVERTISERS first.
  if (all || enableGoogleAds) {
    tools.push(
      tool(
        "GOOGLE_ADS_ADVERTISERS",
        "Scavio Google Ads Advertisers",
        "Resolve a brand name or domain to the advertiser_id that search() and creative() are keyed by. Returns two row kinds in one list: 'advertiser' rows carrying the id, verified name, verification country and total ad count as a range, and 'domain' rows carrying a website. A name query returns both kinds; a domain-shaped query returns domains only. Autocomplete-backed, roughly 20 rows per arm, and it does not paginate. Costs 1 credit.",
        z.object({
          query: str("Brand name or domain to resolve (1-200 characters)."),
          region: ostr("ISO 3166-1 alpha-2 country ('US', 'GB', 'DE') or a Google geo criteria id as a string (2-12 characters). Default: no region filter."),
          limit: onum("Rows per arm (1-20; server default 10). Advertisers and domains are capped separately, so a name query can return up to twice this many rows."),
        }),
        (i) => client.googleAds.advertisers(i as SdkOpts<typeof client.googleAds.advertisers>)
      ),
      tool(
        "GOOGLE_ADS_SEARCH",
        "Scavio Google Ads Search",
        "Every ad Google Ads Transparency holds for one advertiser: the creative (archived image, rich-media bundle, Google's renderer link, dimensions), advertiser id and name, format, first and last seen dates and days actually run, plus total_ads_min and total_ads_max -- Google publishes the advertiser's ad total as a range, never an exact figure. Up to 100 ads per page (server default 40); paginate by sending next_cursor back as cursor alongside the SAME filters. Provide domain or advertiser_id. Costs 1 credit.",
        z.object({
          domain: ostr("Advertiser website (1-253 characters): bare host, www host or full URL, reduced to the registrable host. The only way to get `domain` back on each row."),
          advertiser_id: ostr("Google advertiser id, e.g. 'AR16735076323512287233' (3-40 characters). The shape is checked before any request, so a typo costs no credits. Querying by id drops `domain` from every row."),
          region: ostr("ISO 3166-1 alpha-2 country ('US', 'GB', 'DE') or a Google geo criteria id as a string (2-12 characters). Scopes the deep links on every row, and the same advertiser can share zero creatives between two countries. Default: worldwide."),
          format: ostr("Creative format. The three sets are disjoint -- an advertiser's text, image and video ads share no creatives. Default: all formats."),
          platform: ostr("Google surface the ad ran on. Default: all surfaces. Accepted values: 'play', 'maps', 'search', 'shopping', 'youtube'."),
          topic: ostr("Ad topic (server default 'all'). Accepted values: 'all', 'political'."),
          limit: onum("Ads per page (1-100; server default 40). 100 is a hard upstream ceiling, not our policy: Google answers a larger request with zero rows rather than an error."),
          cursor: ostr("next_cursor from the previous response (1-4000 characters), 100 ads per page. Re-send the same filters alongside it; next_cursor is null once exhausted."),
        }),
        (i) => client.googleAds.search(i as SdkOpts<typeof client.googleAds.search>)
      ),
      tool(
        "GOOGLE_ADS_CREATIVE",
        "Scavio Google Ads Creative",
        "One creative in full, and the only endpoint carrying its history: every size variation of the asset, the impression bucket, the per-region breakdown with first and last shown dates and a per-surface impression split inside each region, the format, Google's category label and the funder disclosure on political ads. Impressions and first_shown are EEA-only (DSA-compelled) and come back null for US creatives, and an impression bucket may carry only a lower or only an upper bound. Costs 1 credit.",
        z.object({
          advertiser_id: str("Google advertiser id, e.g. 'AR16735076323512287233' (3-40 characters)."),
          creative_id: str("Creative id (3-40 characters). It must belong to the advertiser_id sent with it -- the lookup is keyed by the pair and a mismatched pair is a 404."),
        }),
        (i) => client.googleAds.creative(i as SdkOpts<typeof client.googleAds.creative>)
      )
    );
  }

  // Meta Ad Library is served from /api/v1/meta-ads/* - HYPHENATED. The path is
  // never derived from the namespace key.
  if (all || enableMetaAds) {
    tools.push(
      tool(
        "META_ADS_SEARCH",
        "Scavio Meta Ads Search",
        "Search the Meta Ad Library by keyword: 30 ads on page 1 with the full creative -- page name, ad copy, headline, CTA, images and videos, the platforms each ran on and its run dates -- then 10 ads per cursor page, walking has_next_page to the end of the query. total_results caps at 50000 with total_is_capped true, because Meta only reports '>50,000'; never present it as an exact count. Every page costs 1 credit.",
        z.object({
          query: str("Keyword to search the ad library for (1-200 characters)."),
          country: ostr("Ad library country as an exactly 2-character ISO 3166-1 alpha-2 code (server default 'US')."),
          active_status: ostr("Whether the ad is still running (server default 'all'). Accepted values: 'all', 'active', 'inactive'."),
          ad_type: ostr("Set 'political_and_issue_ads' to expose spend, reach, impressions and the paid-for-by disclosure; commercial ads leave all four null (server default 'all')."),
          media_type: ostr("Creative media filter. Default: no media filter. Accepted values: 'all', 'image', 'video', 'meme', 'image_and_meme', 'none'."),
          search_type: ostr("How the query is matched (server default 'keyword_unordered'). Accepted values: 'keyword_unordered', 'keyword_exact_phrase'."),
          cursor: ostr("next_cursor from the previous response: page 1 is 30 ads, every cursor page is 10. The cursor is a self-contained blob, so ALL other filters are ignored when it is present."),
        }),
        (i) => client.metaAds.search(i as SdkOpts<typeof client.metaAds.search>)
      ),
      tool(
        "META_ADS_ADVERTISER",
        "Scavio Meta Ads Advertiser",
        "Every ad a Facebook Page is running, by numeric page id: 30 ads on page 1 with the same creative detail as search(), then 10 ads per cursor page, walking has_next_page to the end of the advertiser. Every page costs 1 credit.",
        z.object({
          page_id: str("The advertiser's numeric Facebook Page id (3-25 digits, as a string)."),
          country: ostr("Ad library country as an exactly 2-character ISO 3166-1 alpha-2 code (server default 'US')."),
          active_status: ostr("Whether the ad is still running (server default 'all'). Accepted values: 'all', 'active', 'inactive'."),
          ad_type: ostr("Set 'political_and_issue_ads' to expose spend, reach, impressions and the paid-for-by disclosure; commercial ads leave all four null (server default 'all')."),
          media_type: ostr("Creative media filter. Default: no media filter. Accepted values: 'all', 'image', 'video', 'meme', 'image_and_meme', 'none'."),
          cursor: ostr("next_cursor from the previous response: page 1 is 30 ads, every cursor page is 10. ALL other filters are ignored when it is present."),
        }),
        (i) => client.metaAds.advertiser(i as SdkOpts<typeof client.metaAds.advertiser>)
      ),
      tool(
        "META_ADS_AD",
        "Scavio Meta Ads Ad",
        "One Meta ad in full by archive id: creative, advertiser, run dates, the platforms it ran on, and the political disclosure when the ad carries one. Commercial ads leave spend, reach and impressions null. Costs 1 credit.",
        z.object({
          ad_archive_id: str("Meta ad archive id (3-25 digits, as a string)."),
        }),
        (i) => client.metaAds.ad(i as SdkOpts<typeof client.metaAds.ad>)
      )
    );
  }

  // extract is a CORE endpoint, not a platform: the top-level client.extract(),
  // never client.extract.extract(). It is the agent's 'read this page' primitive.
  if (all || enableExtract) {
    tools.push(
      tool(
        "EXTRACT",
        "Scavio Extract",
        "Read any URL and get the page back as raw HTML, readability Markdown or plain text: { url, format, mode, content, content_length }. Tier-priced by mode: 'normal' and 'advanced' cost 1 credit, 'ultra' costs 2. Only a successful extraction is billed - a dead link, bot wall or timeout costs nothing.",
        z.object({
          url: str("Page to read (1-2048 characters). http(s) only; a bare host is upgraded to https, and loopback, private, link-local and metadata hosts are rejected with a 400."),
          format: ostr("Output format: 'html' is the raw page, 'markdown' a readability extraction, 'text' that markdown flattened to plain text (server default 'markdown')."),
          mode: ostr("Fetch tier, and the price-bearing parameter: 'normal' plain datacenter fetch (1 credit), 'advanced' full browser render (1 credit), 'ultra' the hardest-target tier (2 credits). Server default 'normal'."),
        }),
        (i) => client.extract(i as SdkOpts<typeof client.extract>)
      )
    );
  }

  return experimental_createToolkit("SCAVIO", {
    name: "Scavio",
    description:
      "Real-time structured search over 31 platforms - Google (SERP, AI Mode, Maps, Shopping, Flights, Hotels, News, Trends), YouTube, Amazon, Walmart, eBay, Target, Home Depot, Reddit, TikTok, TikTok Shop, Instagram, X, LinkedIn, Threads, Kuaishou, Zillow, Redfin, Booking.com, Airbnb, Tripadvisor, Yelp, Indeed, Glassdoor, the Apple App Store, Google Play, SEC EDGAR, Companies House, G2, Capterra, Google Ads Transparency and the Meta Ad Library - plus extract, which reads any URL as Markdown, plain text or raw HTML.",
    tools,
  });
}

export default buildScavioToolkit;
