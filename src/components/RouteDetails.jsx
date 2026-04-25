import { useState } from 'react';
import { formatDistance, formatDuration } from '../utils/format';
import TurnByTurn from './TurnByTurn';

function scoreGrade(score) {
  if (score == null) return null;
  const p = Math.round(score * 100);
  if (p >= 68) return { label: 'Great for most users', bg: '#ECFDF5', color: '#065F46' };
  if (p >= 42) return { label: 'Some barriers present', bg: '#FEF3C7', color: '#92400E' };
  return { label: 'Notable accessibility barriers', bg: '#FEF2F2', color: '#991B1B' };
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

  const litMeters = chosen.litMeters || 0;
  const unlitMeters = chosen.unlitMeters || 0;
  if (litMeters > 0 || unlitMeters > 0) {
    chips.push(
      litMeters > unlitMeters
        ? { sym: '◉', text: 'Well lit', type: 'good' }
        : { sym: '◑', text: `${Math.round(unlitMeters)}m unlit`, type: 'warn' }
    );
  }

  if ((chosen.narrowMeters || 0) > 10) {
    chips.push({ sym: '↔', text: `${Math.round(chosen.narrowMeters)}m narrow`, type: 'warn' });
  }

  if ((chosen.busyMeters || 0) > 20) {
    chips.push({ sym: '⊗', text: `${Math.round(chosen.busyMeters)}m busy road`, type: 'warn' });
  }

  if ((chosen.crashHotspotCount || 0) > 0 || (chosen.crashRiskMeters || 0) > 0) {
    chips.push({
      sym: '⚠',
      text: `${chosen.crashHotspotCount || 0} crash hotspots${chosen.crashRiskMeters ? ` · ${Math.round(chosen.crashRiskMeters)}m risk corridor` : ''}`,
      type: 'warn'
    });
  }

  return chips;
}

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
  return item?.summary ||
    item?.tags?.fixture_note ||
    item?.tags?.report_note ||
    item?.tags?.crash_note ||
    item?.tags?.demo_note ||
    item?.tags?.demo_issue ||
    null;
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
            {item.note ? <div className="detail-list-note">{item.note}</div> : null}
          </div>
        ))}
      </div>
    </>
  );
}

export default function RouteDetails({ chosen, selectedMode, featureStats, filters }) {
  const [expanded, setExpanded] = useState(false);
  if (!chosen || !selectedMode) return null;

  const score = chosen.score;
  const scorePct = score != null ? Math.round(score * 100) : null;
  const grade = scoreGrade(score);
  const chips = buildFeatureChips(chosen, featureStats);
  const evidence = chosen.evidenceSummary || {};
  const hasEvidenceSummary = [evidence.known, evidence.reported, evidence.unknown].some(value => value > 0);

  const nearbySupportItems = [
    ...(chosen.toiletsNear || []).map(item => ({
      id: `toilet-${item.id}`,
      label: 'Toilet',
      title: getItemName(item, 'Nearby toilet'),
      note: getItemNote(item)
    })),
    ...(chosen.seatingNear || []).map(item => ({
      id: `seat-${item.id}`,
      label: 'Seating',
      title: getItemName(item, 'Nearby seating'),
      note: getItemNote(item)
    })),
    ...(chosen.stationAccessNear || []).map(item => ({
      id: `station-${item.id}`,
      label: 'Station access',
      title: getItemName(item, 'Nearby station access'),
      note: getItemNote(item)
    }))
  ].slice(0, 6);

  const nearbyCrashItems = (chosen.crashHotspotsNear || []).map(item => ({
    id: `crash-${item.id}`,
    label: 'Crash hotspot',
    title: getItemName(item, 'Collision-prone junction'),
    note: getItemNote(item)
  })).slice(0, 4);

  const nearbyReportItems = (chosen.communityReportsNear || []).map(item => ({
    id: `report-${item.id}`,
    label: item.verification === 'verified' || item.tags?.report_verification === 'verified' ? 'Verified report' : 'User report',
    title: getItemName(item, 'Accessibility report'),
    note: getItemNote(item)
  })).slice(0, 4);

  return (
    <>
      <div className="details-section">
        <div className="section-title">Route health</div>

        {scorePct != null ? (
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
        ) : null}

        {chips.length > 0 ? (
          <div className="rh-chips" aria-label="Key route features">
            {chips.map((chip, index) => (
              <span key={`${chip.text}-${index}`} className={`feat-chip feat-chip--${chip.type}`}>
                <span aria-hidden="true">{chip.sym}</span>
                {chip.text}
              </span>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="rh-toggle-btn"
          onClick={() => setExpanded(value => !value)}
          aria-expanded={expanded}
        >
          {expanded ? '▲ Hide details' : '▼ Full breakdown'}
        </button>

        {expanded ? (
          <div className="rh-breakdown">
            <div className="rh-breakdown-grid">
              <StatCell label="Mode" value={selectedMode.shortLabel} />
              <StatCell label="Distance" value={formatDistance(chosen.route.distance)} />
              <StatCell label="Walk time" value={formatDuration(chosen.route.duration)} />
              <StatCell label="Crossings" value={featureStats.crossings} />
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
              {(chosen.stepsMeters > 0 || filters.avoid_steps) ? (
                <StatCell label="Steps" value={`${Math.round(chosen.stepsMeters || 0)} m`} variant={chosen.stepsMeters > 0 ? 'bad' : undefined} />
              ) : null}
              {(chosen.narrowMeters > 0 || filters.pavement_width) ? (
                <StatCell label="Narrow pavement" value={`${Math.round(chosen.narrowMeters || 0)} m`} variant={chosen.narrowMeters > 0 ? 'warn' : undefined} />
              ) : null}
              {(chosen.busyMeters > 0 || filters.avoid_busy) ? (
                <StatCell label="Busy roads" value={`${Math.round(chosen.busyMeters || 0)} m`} variant={chosen.busyMeters > 0 ? 'warn' : undefined} />
              ) : null}
              {(chosen.litMeters > 0 || filters.streetlights) ? (
                <StatCell label="Lit sections" value={`${Math.round(chosen.litMeters || 0)} m`} variant={chosen.litMeters > 0 ? 'good' : undefined} />
              ) : null}
              {(chosen.unlitMeters > 0 || filters.streetlights) ? (
                <StatCell label="Unlit sections" value={`${Math.round(chosen.unlitMeters || 0)} m`} variant={chosen.unlitMeters > 0 ? 'bad' : undefined} />
              ) : null}
              {(chosen.streetLampCount > 0 || filters.streetlights) ? (
                <StatCell label="Street lamps" value={chosen.streetLampCount || 0} />
              ) : null}
              {chosen.forbiddenMeters > 0 ? (
                <StatCell label="Restricted proximity" value={`${Math.round(chosen.forbiddenMeters)} m`} variant="bad" />
              ) : null}
              {(chosen.roughMeters > 0 || filters.surface_quality) ? (
                <StatCell label="Rough surface" value={`${Math.round(chosen.roughMeters || 0)} m`} variant={chosen.roughMeters > 0 ? 'warn' : undefined} />
              ) : null}
              {(chosen.steepMeters > 0 || filters.gentle_slope) ? (
                <StatCell label="Steep segments" value={`${Math.round(chosen.steepMeters || 0)} m`} variant={chosen.steepMeters > 0 ? 'warn' : undefined} />
              ) : null}
              {(chosen.decisionPoints > 0 || filters.simple_navigation) ? (
                <StatCell label="Decision points" value={chosen.decisionPoints || 0} variant={chosen.decisionPoints > 0 ? 'warn' : undefined} />
              ) : null}
              {chosen.complexityBand ? (
                <StatCell label="Complexity" value={chosen.complexityBand} />
              ) : null}
              {(chosen.crashHotspotCount > 0 || chosen.crashRiskMeters > 0 || Number.isFinite(chosen.nearestCrashMeters) || filters.avoid_crash) ? (
                <StatCell
                  label="Crash risk"
                  value={`${chosen.crashHotspotCount || 0}${chosen.crashRiskMeters ? ` · ${Math.round(chosen.crashRiskMeters)}m` : ''}`}
                  variant={(chosen.crashHotspotCount > 0 || chosen.crashRiskMeters > 0) ? 'bad' : undefined}
                />
              ) : null}
              {(chosen.toiletCount > 0 || Number.isFinite(chosen.nearestToiletMeters) || filters.rest_points) ? (
                <StatCell
                  label="Toilets"
                  value={`${chosen.toiletCount || 0}${Number.isFinite(chosen.nearestToiletMeters) ? ` · ${formatOptionalDistance(chosen.nearestToiletMeters)}` : ''}`}
                  variant={chosen.accessibleToiletCount > 0 ? 'good' : undefined}
                />
              ) : null}
              {(chosen.seatingCount > 0 || Number.isFinite(chosen.nearestSeatingMeters) || filters.rest_points) ? (
                <StatCell
                  label="Seating"
                  value={`${chosen.seatingCount || 0}${Number.isFinite(chosen.nearestSeatingMeters) ? ` · ${formatOptionalDistance(chosen.nearestSeatingMeters)}` : ''}`}
                  variant={chosen.seatingCount > 0 ? 'good' : undefined}
                />
              ) : null}
              {(chosen.accessibleStationCount > 0 || Number.isFinite(chosen.nearestStationMeters) || filters.station_access) ? (
                <StatCell
                  label="Station links"
                  value={`${chosen.accessibleStationCount || 0}${Number.isFinite(chosen.nearestStationMeters) ? ` · ${formatOptionalDistance(chosen.nearestStationMeters)}` : ''}`}
                  variant={chosen.accessibleStationCount > 0 ? 'good' : undefined}
                />
              ) : null}
              {(chosen.reportCount > 0 || filters.verified_reports) ? (
                <StatCell
                  label="Route reports"
                  value={`${chosen.reportCount || 0}${chosen.verifiedReportCount ? ` · ${chosen.verifiedReportCount} verified` : ''}`}
                  variant={chosen.reportCount > 0 ? 'warn' : undefined}
                />
              ) : null}
            </div>

            {hasEvidenceSummary ? (
              <div className="evidence-row" aria-label="Data confidence">
                <EvidenceChip tone="known" label="Known" value={evidence.known || 0} />
                <EvidenceChip tone="reported" label="Reported" value={evidence.reported || 0} />
                <EvidenceChip tone="unknown" label="Unknown" value={evidence.unknown || 0} />
              </div>
            ) : null}

            {selectedMode.reasons?.length > 0 ? (
              <div className="rh-reasons">
                {selectedMode.reasons.map(reason => (
                  <p key={reason} className="rh-reason">{reason}</p>
                ))}
              </div>
            ) : null}

            <DetailList title="Nearby support places" items={nearbySupportItems} />
            <DetailList title="Crash-risk hotspots" items={nearbyCrashItems} />
            <DetailList title="Recent route reports" items={nearbyReportItems} />
          </div>
        ) : null}
      </div>

      <TurnByTurn steps={chosen.route.steps} />
    </>
  );
}
