import { useState } from 'react';
import { formatDistance, formatDuration } from '../utils/format';
import TurnByTurn from './TurnByTurn';

function scoreGrade(score) {
  if (score == null) return null;
  const p = Math.round(score * 100);
  if (p >= 68) return { label: 'Great for most users',     bg: '#ECFDF5', color: '#065F46' };
  if (p >= 42) return { label: 'Some barriers present',    bg: '#FEF3C7', color: '#92400E' };
  return       { label: 'Notable accessibility barriers',  bg: '#FEF2F2', color: '#991B1B' };
}

function buildFeatureChips(chosen, featureStats) {
  const chips = [];

  if (featureStats.tactileYes > 0) {
    chips.push({ sym: '✓', text: `${featureStats.tactileYes} tactile crossings`, type: 'good' });
  } else if (featureStats.crossings > 0) {
    chips.push({ sym: '~', text: `${featureStats.crossings} crossings`, type: 'neutral' });
  }

  if ((chosen.stepsMeters || 0) > 5) {
    chips.push({ sym: '!', text: `${Math.round(chosen.stepsMeters)}m steps`, type: 'bad' });
  }

  if (featureStats.lowKerbs > 0) {
    chips.push({ sym: '✓', text: `${featureStats.lowKerbs} low kerbs`, type: 'good' });
  }

  const litM   = chosen.litMeters   || 0;
  const unlitM = chosen.unlitMeters || 0;
  if (litM > 0 || unlitM > 0) {
    chips.push(
      litM > unlitM
        ? { sym: '◉', text: 'Well lit',                        type: 'good' }
        : { sym: '◑', text: `${Math.round(unlitM)}m unlit`,    type: 'warn' }
    );
  }

  if ((chosen.narrowMeters || 0) > 10) {
    chips.push({ sym: '↔', text: `${Math.round(chosen.narrowMeters)}m narrow`, type: 'warn' });
  }

  if ((chosen.busyMeters || 0) > 20) {
    chips.push({ sym: '⊗', text: `${Math.round(chosen.busyMeters)}m busy road`, type: 'warn' });
  }

  return chips;
}

// A single metric card in the breakdown grid
function StatCell({ label, value, variant }) {
  return (
    <div className={`rh-cell${variant ? ` rh-cell--${variant}` : ''}`}>
      <span className="rh-cell-value">{value ?? '—'}</span>
      <span className="rh-cell-label">{label}</span>
    </div>
  );
}

function EvidenceChip({ tone, label, value }) {
  return (
    <span className={`evidence-chip ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  );
}

function formatOptionalDistance(meters) {
  return Number.isFinite(meters) ? formatDistance(Math.max(0, meters)) : '—';
}

function getItemName(item, fallback) {
  return item?.summary || item?.tags?.name || fallback;
}

function getItemNote(item) {
  return item?.summary || item?.tags?.fixture_note || item?.tags?.report_note || item?.tags?.demo_note || item?.tags?.demo_issue || null;
}

function DetailList({ title, items }) {
  if (!items || items.length === 0) return null;

  return (
    <>
      <div className="detail-subsection-title">{title}</div>
      <div className="detail-list">
        {items.map(item => (
          <div key={item.id} className="detail-list-item">
            <div className="detail-list-label">{item.label}</div>
            <div className="detail-list-title">{item.title}</div>
            {item.note && <div className="detail-list-note">{item.note}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

export default function RouteDetails({ chosen, selectedMode, featureStats, filters }) {
  const [expanded, setExpanded] = useState(false);
  if (!chosen || !selectedMode) return null;

  const score    = chosen.score;
  const scorePct = score != null ? Math.round(score * 100) : null;
  const grade    = scoreGrade(score);
  const chips    = buildFeatureChips(chosen, featureStats);

  return (
    <>
      <div className="details-section">
        <div className="section-title">Route health</div>

        {/* ── Score spectrum ─────────────────────────────── */}
        {scorePct != null && (
          <div className="rh-card" style={{ background: grade.bg }}>
            <div className="rh-score-row">
              <div>
                <span className="rh-score-num" style={{ color: grade.color }}>
                  {scorePct}
                </span>
                <span className="rh-score-of" style={{ color: grade.color }}>/100</span>
              </div>
              <span
                className="rh-grade-label"
                style={{ color: grade.color, background: 'rgba(255,255,255,0.6)' }}
              >
                {grade.label}
              </span>
            </div>
            <div
              className="rh-spectrum"
              role="progressbar"
              aria-valuenow={scorePct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Accessibility score: ${scorePct} out of 100. ${grade.label}`}
            >
              <div className="rh-cursor" style={{ left: `${scorePct}%` }} aria-hidden="true" />
            </div>
          </div>
        )}

        {/* ── Feature chips ───────────────────────────────── */}
        {chips.length > 0 && (
          <div className="rh-chips" aria-label="Key route features">
            {chips.map((c, i) => (
              <span key={i} className={`feat-chip feat-chip--${c.type}`}>
                <span aria-hidden="true">{c.sym}</span>
                {c.text}
              </span>
            ))}
          </div>
        )}

        {/* ── Expand / collapse full breakdown ────────────── */}
        <button
          type="button"
          className="rh-toggle-btn"
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          {expanded ? '▲ Hide details' : '▼ Full breakdown'}
        </button>

        {expanded && (
          <div className="rh-breakdown">
            <div className="rh-breakdown-grid">
              <StatCell label="Distance"           value={formatDistance(chosen.route.distance)} />
              <StatCell label="Walk time"          value={formatDuration(chosen.route.duration)} />
              <StatCell label="Crossings"          value={featureStats.crossings} />
              <StatCell
                label="Tactile crossings"
                value={featureStats.tactileYes}
                variant={featureStats.tactileYes > 0 ? 'good' : undefined}
              />
              <StatCell
                label="No tactile"
                value={featureStats.tactileNo}
                variant={featureStats.tactileNo > 0 ? 'bad' : undefined}
              />
              <StatCell
                label="Low kerbs"
                value={featureStats.lowKerbs}
                variant={featureStats.lowKerbs > 0 ? 'good' : undefined}
              />
              {(chosen.stepsMeters > 0) && (
                <StatCell label="Steps" value={`${Math.round(chosen.stepsMeters)} m`} variant="bad" />
              )}
              {(chosen.narrowMeters > 0) && (
                <StatCell label="Narrow pavement" value={`${Math.round(chosen.narrowMeters)} m`} variant="warn" />
              )}
              {(chosen.busyMeters > 0) && (
                <StatCell label="Busy roads" value={`${Math.round(chosen.busyMeters)} m`} variant="warn" />
              )}
              {(chosen.litMeters > 0) && (
                <StatCell label="Lit sections" value={`${Math.round(chosen.litMeters)} m`} variant="good" />
              )}
              {(chosen.unlitMeters > 0) && (
                <StatCell label="Unlit sections" value={`${Math.round(chosen.unlitMeters)} m`} variant="bad" />
              )}
              {(chosen.streetLampCount > 0) && (
                <StatCell label="Street lamps" value={chosen.streetLampCount} />
              )}
              {(chosen.forbiddenMeters > 0) && (
                <StatCell label="Restricted proximity" value={`${Math.round(chosen.forbiddenMeters)} m`} variant="bad" />
              )}
            </div>

            {selectedMode.reasons?.length > 0 && (
              <div className="rh-reasons">
                {selectedMode.reasons.map(r => (
                  <p key={r} className="rh-reason">{r}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <TurnByTurn steps={chosen.route.steps} />
    </>
  );
}
