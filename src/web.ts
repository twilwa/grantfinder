// ABOUTME: Implements public web search and source-page extraction for funding research.
// ABOUTME: These helpers power the PI agent's live opportunity discovery without requiring a paid search API.

import { load } from "cheerio";

import type { SearchResult, SourcePage } from "./types.js";

export interface SearchOptions {
  domains?: string[];
  limit?: number;
  signal?: AbortSignal;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

function unwrapDuckDuckGoUrl(rawUrl: string): string {
  if (!rawUrl.startsWith("//duckduckgo.com/l/?uddg=") && !rawUrl.startsWith("/l/?uddg=")) {
    return rawUrl;
  }

  const url = new URL(rawUrl, "https://duckduckgo.com");
  const target = url.searchParams.get("uddg");
  return target ? decodeURIComponent(target) : rawUrl;
}

async function searchSingleQuery(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const searchUrl = new URL("https://html.duckduckgo.com/html/");
  searchUrl.searchParams.set("q", query);

  const response = await fetch(searchUrl, {
    signal,
    headers: {
      "user-agent": "grantfinder/0.1 (+https://github.com/badlogic/pi-mono)",
    },
  });

  if (!response.ok) {
    throw new Error(`Search failed for query "${query}" with status ${response.status}`);
  }

  const markup = await response.text();
  const $ = load(markup);

  return $(".result")
    .map((_index, element) => {
      const link = $(element).find(".result__a").first();
      const snippet = $(element).find(".result__snippet").first();
      const title = normalizeWhitespace(link.text());
      const href = link.attr("href");

      if (!title || !href) {
        return null;
      }

      return {
        title,
        url: unwrapDuckDuckGoUrl(href),
        snippet: normalizeWhitespace(snippet.text()),
      } satisfies SearchResult;
    })
    .get()
    .filter((result): result is SearchResult => result !== null);
}

export async function searchWeb(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
  const domains = options.domains?.filter(Boolean) ?? [];
  const limit = options.limit ?? 5;
  const queries =
    domains.length === 0
      ? [query]
      : domains.slice(0, 4).map((domain) => `${query} site:${domain}`);

  const seenUrls = new Set<string>();
  const results: SearchResult[] = [];

  for (const searchQuery of queries) {
    const partialResults = await searchSingleQuery(searchQuery, options.signal);
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
  }

  return results;
}

export async function readWebPage(
  url: string,
  options: { maxChars?: number; signal?: AbortSignal } = {},
): Promise<SourcePage> {
  const response = await fetch(url, {
    signal: options.signal,
    headers: {
      "user-agent": "grantfinder/0.1 (+https://github.com/badlogic/pi-mono)",
    },
  });

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
}
