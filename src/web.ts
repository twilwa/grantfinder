// ABOUTME: Implements public web search and source-page extraction for funding research.
// ABOUTME: These helpers power the PI agent's live opportunity discovery without requiring a paid search API.

import { load } from "cheerio";
import OpenAI from "openai";

import type { SearchResult, SourcePage } from "./types.js";

export interface SearchOptions {
  domains?: string[];
  limit?: number;
  signal?: AbortSignal;
}

interface SearchSource {
  name: string;
  buildUrl: (query: string) => URL;
  referer: string;
  parseResults: (markup: string) => SearchResult[];
}

class RequestTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestTimeoutError";
  }
}

const browserHeaders = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
} as const;

const PUBLIC_SEARCH_TIMEOUT_MS = 3_000;
const OPENAI_SEARCH_TIMEOUT_MS = 8_000;
const PAGE_READ_TIMEOUT_MS = 5_000;

const searchResultFormatSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          url: { type: "string" },
          snippet: { type: "string" },
        },
        required: ["title", "url", "snippet"],
      },
    },
  },
  required: ["results"],
} as const;

let openAIClient: OpenAI | null | undefined;
let openAIClientApiKey: string | null | undefined;

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function createRequestHeaders(referer?: string): Headers {
  const headers = new Headers(browserHeaders);
  if (referer) {
    headers.set("referer", referer);
  }

  return headers;
}

function unwrapDuckDuckGoUrl(rawUrl: string): string {
  if (!rawUrl.startsWith("//duckduckgo.com/l/?uddg=") && !rawUrl.startsWith("/l/?uddg=")) {
    return rawUrl;
  }

  const url = new URL(rawUrl, "https://duckduckgo.com");
  const target = url.searchParams.get("uddg");
  return target ? decodeURIComponent(target) : rawUrl;
}

function normalizeSearchResultUrl(rawUrl: string, baseUrl: string): string | null {
  try {
    const url = new URL(unwrapDuckDuckGoUrl(rawUrl), baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function withTimeoutSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(signal?.reason);
  const timeoutId = setTimeout(() => {
    controller.abort(new RequestTimeoutError(`Request timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromParent);
    },
  };
}

function raceWithSignal<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason ?? new DOMException("The operation was aborted.", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });

    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function isPreferredDomain(url: string, domains: string[]): boolean {
  if (domains.length === 0) {
    return false;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function prioritizePreferredDomains(results: SearchResult[], domains: string[]): SearchResult[] {
  if (domains.length === 0) {
    return results;
  }

  return [...results].sort((left, right) => {
    const leftPreferred = isPreferredDomain(left.url, domains) ? 1 : 0;
    const rightPreferred = isPreferredDomain(right.url, domains) ? 1 : 0;
    return rightPreferred - leftPreferred;
  });
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY ?? null;
  if (!apiKey) {
    openAIClient = null;
    openAIClientApiKey = null;
    return null;
  }

  if (openAIClient && openAIClientApiKey === apiKey) {
    return openAIClient;
  }

  openAIClient = new OpenAI({ apiKey });
  openAIClientApiKey = apiKey;
  return openAIClient;
}

function parseDuckDuckGoResults(markup: string): SearchResult[] {
  const $ = load(markup);

  return $(".result")
    .map((_index, element) => {
      const link = $(element).find(".result__a").first();
      const snippet = $(element).find(".result__snippet").first();
      const title = normalizeWhitespace(link.text());
      const href = link.attr("href");
      const url = href ? normalizeSearchResultUrl(href, "https://duckduckgo.com") : null;

      if (!title || !url) {
        return null;
      }

      return {
        title,
        url,
        snippet: normalizeWhitespace(snippet.text()),
      } satisfies SearchResult;
    })
    .get()
    .filter((result): result is SearchResult => result !== null);
}

function parseBraveResults(markup: string): SearchResult[] {
  const $ = load(markup);

  return $('[data-type="web"]')
    .map((_index, element) => {
      const container = $(element);
      const link = container.find("a[href]").first();
      const title =
        normalizeWhitespace(container.find(".title").first().text()) || normalizeWhitespace(link.text());
      const href = link.attr("href");
      const url = href ? normalizeSearchResultUrl(href, "https://search.brave.com") : null;

      if (!title || !url) {
        return null;
      }

      return {
        title,
        url,
        snippet: normalizeWhitespace(container.find(".generic-snippet .content").first().text()),
      } satisfies SearchResult;
    })
    .get()
    .filter((result): result is SearchResult => result !== null);
}

const searchSources = [
  {
    name: "brave",
    buildUrl: (query: string) => {
      const searchUrl = new URL("https://search.brave.com/search");
      searchUrl.searchParams.set("q", query);
      return searchUrl;
    },
    referer: "https://search.brave.com/",
    parseResults: parseBraveResults,
  },
  {
    name: "duckduckgo",
    buildUrl: (query: string) => {
      const searchUrl = new URL("https://html.duckduckgo.com/html/");
      searchUrl.searchParams.set("q", query);
      return searchUrl;
    },
    referer: "https://duckduckgo.com/",
    parseResults: parseDuckDuckGoResults,
  },
] satisfies SearchSource[];

async function searchWithOpenAI(
  query: string,
  options: { domains: string[]; limit: number; signal?: AbortSignal },
): Promise<SearchResult[]> {
  const client = getOpenAIClient();
  if (!client) {
    return [];
  }

  const domainHint =
    options.domains.length > 0
      ? `Strongly prefer results from these domains when they are relevant: ${options.domains.join(", ")}.`
      : "";

  const request = withTimeoutSignal(options.signal, OPENAI_SEARCH_TIMEOUT_MS);

  try {
    const response = await raceWithSignal(
      client.responses.create(
        {
          model: "gpt-4o-mini",
          instructions:
            "You turn web search results into structured search hits for a funding research agent. Return only current, source-backed program pages or sponsor pages. If there are no credible matches, return an empty results array.",
          input: `Find up to ${options.limit} funding program or sponsor pages relevant to: "${query}". Prefer authoritative sponsor pages over summaries. ${domainHint} Return concise snippets explaining why each result is relevant.`,
          tools: [
          {
            type: "web_search",
            search_context_size: "medium",
            user_location: {
              type: "approximate",
              country: "US",
                timezone: "America/Los_Angeles",
              },
            },
        ],
        text: {
          verbosity: "medium",
          format: {
            type: "json_schema",
            name: "search_results",
              strict: true,
              schema: searchResultFormatSchema,
            },
          },
        },
        { signal: request.signal },
      ),
      request.signal,
    );

    const payload = JSON.parse(response.output_text || '{"results": []}') as {
      results?: Array<{ title?: string; url?: string; snippet?: string }>;
    };

    return (payload.results ?? [])
      .map((result) => {
        const title = normalizeWhitespace(result.title ?? "");
        const url = result.url ? normalizeSearchResultUrl(result.url, "https://api.openai.com") : null;
        if (!title || !url) {
          return null;
        }

        return {
          title,
          url,
          snippet: normalizeWhitespace(result.snippet ?? ""),
        } satisfies SearchResult;
      })
      .filter((result): result is SearchResult => result !== null)
      .slice(0, options.limit);
  } finally {
    request.dispose();
  }
}

async function searchSingleQuery(
  query: string,
  options: { limit: number; signal?: AbortSignal },
): Promise<SearchResult[]> {
  let receivedMarkup = false;

  for (const source of searchSources) {
    const request = withTimeoutSignal(options.signal, PUBLIC_SEARCH_TIMEOUT_MS);

    try {
      const response = await raceWithSignal(
        fetch(source.buildUrl(query), {
          signal: request.signal,
          headers: createRequestHeaders(source.referer),
        }),
        request.signal,
      );

      if (!response.ok) {
        continue;
      }

      receivedMarkup = true;
      const markup = await response.text();
      const results = source.parseResults(markup);
      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      if (options.signal?.aborted) {
        throw error;
      }
    } finally {
      request.dispose();
    }
  }

    if (receivedMarkup) {
      return [];
    }

    return [];
  }

export async function searchWeb(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const domains = options.domains?.filter(Boolean) ?? [];
  const limit = options.limit ?? 5;
  const seenUrls = new Set<string>();
  const results: SearchResult[] = [];

  const partialResults = prioritizePreferredDomains(
    await searchSingleQuery(query, {
      limit,
      signal: options.signal,
    }),
    domains,
  );

  for (const result of partialResults) {
    if (seenUrls.has(result.url)) {
      continue;
    }

    seenUrls.add(result.url);
    results.push(result);

    if (results.length >= limit) {
      return results;
    }
  }

  if (results.length === 0) {
    try {
      const openAIResults = await searchWithOpenAI(query, {
        domains,
        limit,
        signal: options.signal,
      });
      for (const result of openAIResults) {
        if (seenUrls.has(result.url)) {
          continue;
        }

        seenUrls.add(result.url);
        results.push(result);

        if (results.length >= limit) {
          return results;
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
    }
  }

  return results;
}

export async function readWebPage(
  url: string,
  options: { maxChars?: number; signal?: AbortSignal } = {},
): Promise<SourcePage> {
  const request = withTimeoutSignal(options.signal, PAGE_READ_TIMEOUT_MS);

  try {
    const response = await raceWithSignal(
      fetch(url, {
        signal: request.signal,
        headers: createRequestHeaders(url),
      }),
      request.signal,
    );

    if (!response.ok) {
      throw new Error(`Unable to read ${url}: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const body = await response.text();

    if (!contentType.includes("html")) {
      return {
        url,
        title: url,
        text: `Non-HTML content returned with content type ${contentType}.`,
        contentType,
      };
    }

    const $ = load(body);
    $("script, style, noscript, svg").remove();

    return {
      url,
      title: normalizeWhitespace($("title").first().text()) || url,
      text: normalizeWhitespace($("body").text()).slice(0, options.maxChars ?? 6000),
      contentType,
    };
  } finally {
    request.dispose();
  }
}
