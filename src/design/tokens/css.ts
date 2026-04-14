import { rawTokens } from "./raw";
import { semanticTokens } from "./semantic";
import type { TokenCatalogEntry, TokenLeaf, TokenTree } from "./types";

function isTokenTree(value: TokenLeaf | TokenTree): value is TokenTree {
  return typeof value === "object" && value !== null;
}

function flattenTokens(
  tree: TokenTree,
  path: string[] = [],
): Array<{ path: string[]; value: string }> {
  return Object.entries(tree).flatMap(([key, value]) => {
    const nextPath = [...path, key];

    if (isTokenTree(value)) {
      return flattenTokens(value, nextPath);
    }

    return [{ path: nextPath, value: String(value) }];
  });
}

function toCssVarName(path: string[], kind: "raw" | "semantic") {
  const prefix = kind === "raw" ? "--raw-" : "--";
  return `${prefix}${path.join("-")}`;
}

function resolveReferences(value: string) {
  return value.replace(/\{([^}]+)\}/g, (_match, reference) => {
    const path = String(reference)
      .split(".")
      .map((segment) => segment.trim())
      .filter(Boolean);

    return `var(${toCssVarName(path, "raw")})`;
  });
}

function toCatalog(
  tree: TokenTree,
  kind: "raw" | "semantic",
): TokenCatalogEntry[] {
  return flattenTokens(tree).map(({ path, value }) => ({
    group: path.slice(0, -1).join("."),
    name: path.at(-1) ?? "",
    path,
    cssVariable: toCssVarName(path, kind),
    value: kind === "semantic" ? resolveReferences(value) : value,
  }));
}

export const rawTokenCatalog = toCatalog(rawTokens, "raw");
export const semanticTokenCatalog = toCatalog(semanticTokens, "semantic");

export function buildTokenCss() {
  const declarations = [
    ...rawTokenCatalog.map((token) => `  ${token.cssVariable}: ${token.value};`),
    ...semanticTokenCatalog.map(
      (token) => `  ${token.cssVariable}: ${token.value};`,
    ),
  ].join("\n");

  return `:root,\n[data-theme="default"] {\n${declarations}\n}\n`;
}
