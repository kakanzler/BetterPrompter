"use client";

import type { LintFinding } from "@/lib/lint";

type Props = {
  findings: LintFinding[];
};

export default function LintPanel({ findings }: Props) {
  const warnings = findings.filter((finding) => finding.severity === "warn").length;

  return (
    <details className="lint-panel" open={warnings > 0}>
      <summary>
        チェック
        <span className="lint-summary">
          {findings.length === 0
            ? "問題なし"
            : `${findings.length}件${warnings > 0 ? `（うち要対応 ${warnings}件）` : ""}`}
        </span>
      </summary>

      {findings.length === 0 ? (
        <p className="lint-clear">気になる点は見つかりませんでした。</p>
      ) : (
        <ul className="lint-list">
          {findings.map((finding) => (
            <li key={finding.id} className={`lint-item lint-${finding.severity}`}>
              <span className="lint-badge">{finding.severity === "warn" ? "要対応" : "ヒント"}</span>
              <span className="lint-body">
                <strong>{finding.message}</strong>
                <span className="lint-hint">{finding.hint}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
