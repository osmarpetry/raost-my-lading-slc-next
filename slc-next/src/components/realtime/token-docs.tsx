import { semanticTokenCatalog } from "@/design/tokens";

export function TokenDocs() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {semanticTokenCatalog.map((token) => {
        const isColor = token.cssVariable.startsWith("--color-");

        return (
          <article
            key={token.cssVariable}
            className="rounded-card border border-border-subtle bg-surface-panel p-4 shadow-floating"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-text-secondary">
                  {token.group}
                </p>
                <h3 className="font-mono text-sm text-text-primary">
                  {token.cssVariable}
                </h3>
              </div>
              {isColor ? (
                <span
                  className="h-12 w-12 rounded-card border border-border-subtle"
                  style={{ background: `var(${token.cssVariable})` }}
                />
              ) : null}
            </div>
            <p className="font-mono text-xs text-text-secondary">{token.value}</p>
          </article>
        );
      })}
    </div>
  );
}
