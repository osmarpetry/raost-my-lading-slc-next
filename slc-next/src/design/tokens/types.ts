export type TokenLeaf = string | number;

export type TokenTree = {
  [key: string]: TokenLeaf | TokenTree;
};

export interface TokenCatalogEntry {
  group: string;
  name: string;
  path: string[];
  cssVariable: string;
  value: string;
}
