// ABOUTME: Verifies the public web search helper can survive provider failures and parse fallback results.
// ABOUTME: These tests keep the live research path stable without relying on real search engines in CI.

import { afterEach, expect, test } from "bun:test";

import { searchWeb } from "../src/web.js";

const originalFetch = globalThis.fetch;
const originalOpenAIKey = process.env.OPENAI_API_KEY;

function installFetchMock(
  handler: (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ) => Response | Promise<Response>,
) {
  globalThis.fetch = (async (input, init) => handler(input, init)) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.OPENAI_API_KEY = originalOpenAIKey;
});

test("searchWeb returns Brave results when the primary provider succeeds", async () => {
  const calls: string[] = [];
  installFetchMock((input) => {
    calls.push(String(input));
    return new Response(
      `
        <div data-type="web">
          <a href="https://www.sba.gov/funding-programs/grants">
            <div class="title">Grants | U.S. Small Business Administration</div>
          </a>
          <div class="generic-snippet">
            <div class="content">SBA does not provide grants for starting and expanding a business.</div>
          </div>
        </div>
      `,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  });

  const results = await searchWeb("small business automation grant", { limit: 3 });

  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("search.brave.com/search");
  expect(results).toEqual([
    {
      title: "Grants | U.S. Small Business Administration",
      url: "https://www.sba.gov/funding-programs/grants",
      snippet: "SBA does not provide grants for starting and expanding a business.",
    },
  ]);
});

test("searchWeb does not fan out into one provider query per preferred domain", async () => {
  const calls: string[] = [];
  installFetchMock((input) => {
    calls.push(String(input));
    return new Response(
      `
        <div data-type="web">
          <a href="https://www.sba.gov/funding-programs/grants">
            <div class="title">SBA Grants</div>
          </a>
          <div class="generic-snippet">
            <div class="content">SBA grant overview.</div>
          </div>
        </div>
      `,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  });

  const results = await searchWeb("small business automation grant", {
    domains: ["grants.gov", "sba.gov", "eda.gov"],
    limit: 3,
  });

  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("search.brave.com/search");
  expect(results).toEqual([
    {
      title: "SBA Grants",
      url: "https://www.sba.gov/funding-programs/grants",
      snippet: "SBA grant overview.",
    },
  ]);
});

test("searchWeb falls back when the primary provider rejects the request", async () => {
  const calls: string[] = [];
  let callCount = 0;

  installFetchMock((input) => {
    calls.push(String(input));
    callCount += 1;

    if (callCount === 1) {
      return new Response("blocked", { status: 503 });
    }

    return new Response(
      `
        <div class="result">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.gov%2Fgrant">Example Grant</a>
          <div class="result__snippet">Grant support for automation projects.</div>
        </div>
      `,
      { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  });

  const results = await searchWeb("small business automation grant", { limit: 3 });

  expect(calls).toHaveLength(2);
  expect(calls[0]).toContain("search.brave.com/search");
  expect(calls[1]).toContain("html.duckduckgo.com/html/");
  expect(results).toEqual([
    {
      title: "Example Grant",
      url: "https://example.gov/grant",
      snippet: "Grant support for automation projects.",
    },
  ]);
});

test("searchWeb returns an empty list when providers respond but do not yield parseable results", async () => {
  installFetchMock(() => {
    return new Response("<html><body><div>No structured result markup</div></body></html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  });

  await expect(searchWeb("query with no results", { limit: 3 })).resolves.toEqual([]);
});

test("searchWeb falls back to OpenAI web search when public providers are blocked", async () => {
  process.env.OPENAI_API_KEY = "test-key";

  const calls: string[] = [];
  let callCount = 0;

  installFetchMock((input) => {
    calls.push(String(input));
    callCount += 1;

    if (callCount === 1) {
      return new Response("rate limited", { status: 429 });
    }

    if (callCount === 2) {
      return new Response("blocked", { status: 403 });
    }

    return new Response(
      JSON.stringify({
        id: "resp_test",
        output_text: JSON.stringify({
          results: [
            {
              title: "Grants | U.S. Small Business Administration",
              url: "https://www.sba.gov/funding-programs/grants",
              snippet:
                "Find out about SBA's limited small business grants for scientific research and exporting.",
            },
          ],
        }),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  });

  const results = await searchWeb("small business automation grant", { limit: 3 });

  expect(calls).toHaveLength(3);
  expect(calls[0]).toContain("search.brave.com/search");
  expect(calls[1]).toContain("html.duckduckgo.com/html/");
  expect(calls[2]).toContain("api.openai.com/v1/responses");
  expect(results).toEqual([
    {
      title: "Grants | U.S. Small Business Administration",
      url: "https://www.sba.gov/funding-programs/grants",
      snippet: "Find out about SBA's limited small business grants for scientific research and exporting.",
    },
  ]);
});
