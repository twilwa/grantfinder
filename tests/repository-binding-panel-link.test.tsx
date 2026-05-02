// ABOUTME: Verifies the repository binding panel forwards the GitHub link action to its handler prop.
// ABOUTME: The test uses a minimal React hook mock so the component body can run without a DOM harness.

import { expect, mock, test } from "bun:test";

const useState = (initialValue: unknown) => [typeof initialValue === "function" ? (initialValue as () => unknown)() : initialValue, () => undefined] as const;

mock.module("react", () => ({
  useEffect: () => undefined,
  useState,
}));

const { RepositoryBindingPanel } = await import("../src/client-shared.js");

function findElementByTypeAndText(
  element: unknown,
  type: string,
  text: string,
): Record<string, unknown> | null {
  if (!element || typeof element !== "object") {
    return null;
  }

  const record = element as {
    type?: string;
    props?: {
      children?: unknown;
    };
  };

  if (record.type === type && typeof record.props?.children === "string" && record.props.children.includes(text)) {
    return element as Record<string, unknown>;
  }

  const children = record.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const match = findElementByTypeAndText(child, type, text);
      if (match) {
        return match;
      }
    }
  } else if (children && typeof children === "object") {
    const match = findElementByTypeAndText(children, type, text);
    if (match) {
      return match;
    }
  }

  return null;
}

test("RepositoryBindingPanel forwards the GitHub link click to the handler prop", () => {
  const onLinkGithubAccount = mock(() => undefined);

  const tree = RepositoryBindingPanel({
    surfaceKind: "tracked_grant",
    binding: null,
    bindingSource: null,
    providerConnections: [],
    githubAccountId: null,
    githubAccountLabel: null,
    busy: false,
    onSubmit: () => undefined,
    onClear: () => undefined,
    onLinkGithubAccount,
  });

  const button = findElementByTypeAndText(tree, "button", "Link GitHub account");
  expect(button).not.toBeNull();

  const onClick = button?.props?.onClick;
  expect(typeof onClick).toBe("function");

  onClick?.({ preventDefault: () => undefined });

  expect(onLinkGithubAccount).toHaveBeenCalledTimes(1);
});
