import { useMemo } from 'react';

function pad(n) { return String(n).padStart(2, '0'); }

export default function DeparturePicker({ departureMinutes, onChange }) {
  const nowLabel = useMemo(() => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [departureMinutes]); // recompute on toggle

  const value = departureMinutes == null
    ? nowLabel
    : `${pad(Math.floor(departureMinutes / 60))}:${pad(departureMinutes % 60)}`;

  const isNow = departureMinutes == null;

  return (
    <div className="depart-row">
      <span className="depart-label">Leave at</span>
      <div className="depart-controls">
        <button
          type="button"
          className={`depart-pill${isNow ? ' active' : ''}`}
          onClick={() => onChange(null)}
        >
          Now
        </button>
        <input
          type="time"
          className="depart-input"
          value={value}
          onChange={e => {
            const [h, m] = e.target.value.split(':').map(Number);
            if (Number.isFinite(h) && Number.isFinite(m)) onChange(h * 60 + m);
          }}
        />
      </div>
    </div>
  );
}
