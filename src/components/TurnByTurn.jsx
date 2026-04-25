import { useState } from 'react';
import { formatDistance } from '../utils/format';

const ARROWS = {
  left: '\u2190',
  right: '\u2192',
  'sharp left': '\u21B0',
  'sharp right': '\u21B1',
  'slight left': '\u2196',
  'slight right': '\u2197',
  straight: '\u2191',
  uturn: '\u21BA'
};

function describe(step, index, total) {
  const road = step.name && step.name.trim() ? step.name : 'unnamed way';
  const type = step.instruction;
  const mod = step.modifier;
  if (index === 0 || type === 'depart') return `Head off along ${road}`;
  if (type === 'arrive' || index === total - 1) return `Arrive at your destination`;
  if (type === 'roundabout' || type === 'rotary') return `Take the roundabout onto ${road}`;
  if (type === 'merge') return `Merge onto ${road}`;
  if (type === 'fork') return `Keep ${mod || 'ahead'} onto ${road}`;
  if (mod) return `Turn ${mod} onto ${road}`;
  return `Continue onto ${road}`;
}

export default function TurnByTurn({ steps }) {
  const [expanded, setExpanded] = useState(false);
  if (!steps || steps.length === 0) return null;

  const visible = expanded ? steps : steps.slice(0, 6);

  return (
    <div className="details-section">
      <div className="section-title">Turn-by-turn</div>
      <ol className="turn-list">
        {visible.map((step, i) => {
          const arrow = ARROWS[step.modifier] || ARROWS[step.instruction] || '•';
          return (
            <li key={i} className="turn-item">
              <span className="turn-arrow" aria-hidden="true">{arrow}</span>
              <span className="turn-text">
                <span className="turn-instr">{describe(step, i, steps.length)}</span>
                {step.distance > 0 && (
                  <span className="turn-meta">{formatDistance(step.distance)}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {steps.length > 6 && (
        <button
          type="button"
          className="link-btn"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? 'Show fewer steps' : `Show all ${steps.length} steps`}
        </button>
      )}
    </div>
  );
}
