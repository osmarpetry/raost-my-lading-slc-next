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
  const topFindings = currentScan?.findings.slice(0, 2) ?? [];

  return (
    <section className="layout-panel layout-panel--sidebar notebook-panel" aria-label="Notebook content">
      <div className="notebook-paper">
        <div className="notebook-deco-sticker notebook-deco-sticker--roast" aria-hidden="true">
          <span className="sticker-icon">🔥</span>
          <span className="sticker-label">
            ROAST
            <br />
            MASTER
          </span>
        </div>
        <div className="notebook-deco-badge" aria-hidden="true">
          <span className="badge-text">404</span>
          <span className="badge-sub">AVOIDANCE SQUAD</span>
        </div>
        <div className="notebook-deco-mug" aria-hidden="true" />

        <p className="kicker">SLC / LIVE SSH</p>
        <h1 className="notebook-heading">PASTE URL. GET ROASTED.</h1>
        <p className="notebook-lede">Live scan. Brutal honesty. No fake AI theater.</p>

        <div className="status-row" aria-label="session status">
          <span className={`status-pill status-pill--${transportState}`}>
            transport {transportState}
          </span>
          <span className={`status-pill status-pill--${scanState}`}>scan {scanState}</span>
        </div>

        <UrlForm
          value={urlInput}
          disabled={isBusy}
          onChange={onUrlChange}
          onSubmit={onSubmit}
        />

        <p id="command-help" className="command-help">
          Press Enter or hit start to run the scan against the live endpoint.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onSubmit} disabled={isBusy}>
            {isBusy ? "Scanning..." : "Start Roast"}
          </Button>
          <Button tone="ghost" onClick={onReset}>
            Reset
          </Button>
        </div>

        <p className="notebook-stamp">LESS FLUFF. MORE SIGNAL.</p>

        {currentScan ? (
          <div className="summary-card">
            <p className="summary-kicker">Latest verdict</p>
            {currentScan.qualityScore != null ? (
              <p className="summary-score">
                {currentScan.qualityScore}/100
                {currentScan.qualityBand ? ` · ${currentScan.qualityBand}` : ""}
              </p>
            ) : null}
            {currentScan.previewRoast ? (
              <p className="summary-copy">{currentScan.previewRoast}</p>
            ) : null}
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
      </div>
    </section>
  );
}
