import { formatDistance, formatDuration } from '../utils/format';

export default function RouteInstructionCards({ instructions }) {
  if (!instructions || instructions.length === 0) return null;

  return (
    <div className="section">
      <h2>Landmark directions</h2>
      <div className="instruction-card-list">
        {instructions.map((instruction, index) => (
          <div className="instruction-card" key={instruction.id}>
            <div className="instruction-card-header">
              <span className="instruction-card-label">{instruction.label}</span>
              <span className="instruction-card-meta">
                Step {index + 1} · {formatDistance(instruction.distance)} · {formatDuration(instruction.duration)}
              </span>
            </div>
            <strong className="instruction-card-text">{instruction.text}</strong>
            {instruction.cue && <span className="instruction-card-cue">{instruction.cue}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
