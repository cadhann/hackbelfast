import { formatDistance, formatDuration } from '../utils/format';
import TurnByTurn from './TurnByTurn';

function Stat({ label, value }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
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
  if (!chosen || !selectedMode) return null;

  const evidence = chosen.evidenceSummary || {};
  const hasEvidenceSummary = [evidence.known, evidence.reported, evidence.unknown].some(value => value > 0);
  const hasEnvironmentDetail = (
    chosen.decisionPoints > 0 ||
    chosen.roughMeters > 0 ||
    chosen.steepMeters > 0 ||
    chosen.reportCount > 0 ||
    chosen.toiletCount > 0 ||
    chosen.seatingCount > 0 ||
    chosen.accessibleStationCount > 0 ||
    Number.isFinite(chosen.nearestToiletMeters) ||
    Number.isFinite(chosen.nearestSeatingMeters) ||
    Number.isFinite(chosen.nearestStationMeters)
  );
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
  const nearbyReportItems = (chosen.communityReportsNear || []).map(item => ({
    id: `report-${item.id}`,
    label: item.verification === 'verified' || item.tags?.report_verification === 'verified' ? 'Verified report' : 'User report',
    title: getItemName(item, 'Accessibility report'),
    note: getItemNote(item)
  })).slice(0, 4);

  return (
    <>
      <div className="details-section">
        <div className="section-title">{selectedMode.title} detail</div>
        <div className="details-card">
          <Stat label="Mode" value={selectedMode.shortLabel} />
          <Stat label="Distance" value={formatDistance(chosen.route.distance)} />
          <Stat label="Walking time" value={formatDuration(chosen.route.duration)} />
          <Stat label="Crossings near route" value={featureStats.crossings} />
          <Stat label="Tactile paving (yes)" value={featureStats.tactileYes} />
          <Stat label="Tactile paving (no)" value={featureStats.tactileNo} />
          <Stat label="Low / flush kerbs" value={featureStats.lowKerbs} />
          {filters.avoid_busy && <Stat label="Busy-road meters" value={`${Math.round(chosen.busyMeters)} m`} />}
          {(filters.avoid_steps || chosen.stepsMeters > 0) && (
            <Stat label="Steps along route" value={`${Math.round(chosen.stepsMeters || 0)} m`} />
          )}
          {(filters.pavement_width || chosen.narrowMeters > 0) && (
            <Stat label="Narrow pavement (< 1.5 m)" value={`${Math.round(chosen.narrowMeters || 0)} m`} />
          )}
          {filters.streetlights && (
            <>
              <Stat label="Lit segments" value={`${Math.round(chosen.litMeters || 0)} m`} />
              <Stat label="Unlit segments" value={`${Math.round(chosen.unlitMeters || 0)} m`} />
              <Stat label="Street lamps nearby" value={chosen.streetLampCount || 0} />
            </>
          )}
          {chosen.forbiddenMeters > 0 && (
            <Stat label="Restricted-way proximity" value={`${Math.round(chosen.forbiddenMeters)} m`} />
          )}
          {hasEnvironmentDetail && (
            <>
              <div className="detail-subsection-title">Route conditions</div>
              {chosen.decisionPoints > 0 && (
                <Stat label="Decision points" value={chosen.decisionPoints} />
              )}
              {chosen.decisionPoints > 0 && chosen.complexityBand && (
                <Stat label="Route complexity" value={chosen.complexityBand} />
              )}
              {chosen.roughMeters > 0 && (
                <Stat label="Rough / uneven surface" value={`${Math.round(chosen.roughMeters)} m`} />
              )}
              {chosen.steepMeters > 0 && (
                <Stat label="Steeper segments" value={`${Math.round(chosen.steepMeters)} m`} />
              )}
              {(chosen.toiletCount > 0 || Number.isFinite(chosen.nearestToiletMeters)) && (
                <Stat
                  label="Toilets near route"
                  value={`${chosen.toiletCount || 0}${Number.isFinite(chosen.nearestToiletMeters) ? ` · nearest ${formatOptionalDistance(chosen.nearestToiletMeters)}` : ''}`}
                />
              )}
              {(chosen.seatingCount > 0 || Number.isFinite(chosen.nearestSeatingMeters)) && (
                <Stat
                  label="Seating / rest points"
                  value={`${chosen.seatingCount || 0}${Number.isFinite(chosen.nearestSeatingMeters) ? ` · nearest ${formatOptionalDistance(chosen.nearestSeatingMeters)}` : ''}`}
                />
              )}
              {(chosen.accessibleStationCount > 0 || Number.isFinite(chosen.nearestStationMeters)) && (
                <Stat
                  label="Accessible station links"
                  value={`${chosen.accessibleStationCount || 0}${Number.isFinite(chosen.nearestStationMeters) ? ` · nearest ${formatOptionalDistance(chosen.nearestStationMeters)}` : ''}`}
                />
              )}
              {chosen.reportCount > 0 && (
                <Stat
                  label="Accessibility reports"
                  value={`${chosen.reportCount}${chosen.verifiedReportCount ? ` · ${chosen.verifiedReportCount} verified` : ''}${chosen.reportedReportCount ? ` · ${chosen.reportedReportCount} recent user reports` : ''}`}
                />
              )}
            </>
          )}
          {chosen.score !== null && (
            <>
              <div className="detail-subsection-title">Accessibility score</div>
              <div className="stat-row" style={{ marginTop: 0 }}>
                <span className="stat-label">Accessibility score</span>
                <span className="stat-value">{Math.round(chosen.score * 100)} / 100</span>
              </div>
              <div className="score-bar" aria-hidden="true">
                <div className="score-fill" style={{ width: `${chosen.score * 100}%` }} />
              </div>
            </>
          )}
          {hasEvidenceSummary && (
            <div className="evidence-row" aria-label="Data confidence">
              <EvidenceChip tone="known" label="Known" value={evidence.known || 0} />
              <EvidenceChip tone="reported" label="Reported" value={evidence.reported || 0} />
              <EvidenceChip tone="unknown" label="Unknown" value={evidence.unknown || 0} />
            </div>
          )}
          {selectedMode.reasons?.length > 0 && (
            <div className="reasons-list">
              {selectedMode.reasons.map(reason => <div key={reason}>{reason}</div>)}
            </div>
          )}
          <DetailList title="Nearby support places" items={nearbySupportItems} />
          <DetailList title="Recent route reports" items={nearbyReportItems} />
        </div>
      </div>
      <TurnByTurn steps={chosen.route.steps} />
    </>
  );
}
