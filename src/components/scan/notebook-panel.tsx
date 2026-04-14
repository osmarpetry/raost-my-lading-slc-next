import type { ScanJob, ScanState, TransportState } from "@/lib/shared/scans";

import { UrlForm } from "@/components/scan/url-form";
import { Button } from "@/components/ui/button";

interface NotebookPanelProps {
  transportState: TransportState;
  scanState: ScanState;
  isBusy: boolean;
  urlInput: string;
  currentScan: ScanJob | null;
  onUrlChange: (value: string) => void;
  onSubmit: () => void;
  onReset: () => void;
}

function providerLabel(scan: ScanJob | null, key: "lighthouse" | "openai") {
  if (!scan) {
    return "pending";
  }

  return scan.providerStatus[key].source;
}

export function NotebookPanel({
  transportState,
  scanState,
  isBusy,
  urlInput,
  currentScan,
  onUrlChange,
  onSubmit,
  onReset,
}: NotebookPanelProps) {
  const topFindings = currentScan?.findings.slice(0, 3) ?? [];
  const targetSummary = currentScan?.finalPayload?.whoItTargets.slice(0, 3).join(", ") ?? "";
  const lastEvents = currentScan?.events.slice(-4).reverse() ?? [];

  return (
    <section className="layout-panel layout-panel--sidebar notebook-panel" aria-label="Scan control panel">
      <div className="notebook-paper">
        <div className="notebook-scroll">
          <div className="editorial-header">
            <p className="kicker">Truthful SLC scan</p>
            <h1 className="notebook-heading">Real audit. Real roast. Real failure.</h1>
            <p className="notebook-lede">
              Lighthouse runs on server. OpenAI writes final prose. If dependency is missing, terminal says so.
            </p>
          </div>

          <div className="status-row" aria-label="session status">
            <span className={`status-pill status-pill--${transportState}`}>transport {transportState}</span>
            <span className={`status-pill status-pill--${scanState}`}>scan {scanState}</span>
            <span className={`status-pill status-pill--neutral`}>lighthouse {providerLabel(currentScan, "lighthouse")}</span>
            <span className={`status-pill status-pill--neutral`}>openai {providerLabel(currentScan, "openai")}</span>
            <span className={`status-pill status-pill--neutral`}>
              persist {currentScan?.persistedState ?? "pending"}
            </span>
          </div>

          <UrlForm value={urlInput} disabled={isBusy} onChange={onUrlChange} onSubmit={onSubmit} />

          <p id="command-help" className="command-help">
            Submit any public landing page URL. Scan normalizes to site root, crawls bounded routes, runs mobile + desktop Lighthouse, then writes one final roast.
          </p>

          <div className="flex flex-wrap gap-3">
            <Button onClick={onSubmit} disabled={isBusy}>
              {isBusy ? "Scanning..." : "Start Scan"}
            </Button>
            <Button tone="ghost" onClick={onReset}>
              Reset
            </Button>
          </div>

          {currentScan ? (
            <div className="summary-card">
              <div className="summary-head">
                <div>
                  <p className="summary-kicker">Latest run</p>
                  <p className="summary-id">{currentScan.persistedRunId ?? currentScan.id}</p>
                </div>
                {currentScan.qualityScore != null ? (
                  <p className="summary-score">
                    {currentScan.qualityScore}
                    <span>/100</span>
                  </p>
                ) : null}
              </div>

              <div className="score-grid">
                <div>
                  <span className="summary-kicker">mobile</span>
                  <strong>{currentScan.lighthouseProfiles.mobile?.score ?? "n/a"}</strong>
                </div>
                <div>
                  <span className="summary-kicker">desktop</span>
                  <strong>{currentScan.lighthouseProfiles.desktop?.score ?? "n/a"}</strong>
                </div>
                <div>
                  <span className="summary-kicker">source</span>
                  <strong>{currentScan.providerStatus.lighthouse.source}</strong>
                </div>
              </div>

              {currentScan.finalPayload?.whatSiteSells ? (
                <p className="summary-copy">
                  <strong>Sells:</strong> {currentScan.finalPayload.whatSiteSells}
                </p>
              ) : null}
              {targetSummary ? (
                <p className="summary-copy">
                  <strong>Targets:</strong> {targetSummary}
                </p>
              ) : null}
              {currentScan.previewRoast ? <p className="summary-copy">{currentScan.previewRoast}</p> : null}
              {currentScan.errorMessage ? (
                <p className="summary-copy summary-copy--error">{currentScan.errorMessage}</p>
              ) : null}

              {topFindings.length > 0 ? (
                <ul className="summary-list">
                  {topFindings.map((finding) => (
                    <li key={finding.code}>
                      [{finding.severity}] {finding.title}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {currentScan ? (
            <div className="artifact-card">
              <p className="summary-kicker">Artifacts</p>
              <p className="summary-copy">
                Debug route: <code>{`/api/scans/${currentScan.id}/artifacts`}</code>
              </p>
              <p className="summary-copy">
                Persisted: {currentScan.persistedState ?? "pending"} · Lighthouse {currentScan.providerStatus.lighthouse.source} · OpenAI{" "}
                {currentScan.providerStatus.openai.source}
              </p>
            </div>
          ) : null}

          {lastEvents.length > 0 ? (
            <div className="timeline-card">
              <p className="summary-kicker">What happened</p>
              <ul className="summary-list">
                {lastEvents.map((event) => (
                  <li key={`${event.scanId}-${event.seq}`}>
                    {event.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
