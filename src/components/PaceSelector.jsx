import { PACE_PRESETS, mpsToKmh, clampCustomMps } from '../config/walkingPace';

export default function PaceSelector({ paceId, customMps, onChangePaceId, onChangeCustomMps }) {
  const isCustom = paceId === 'custom';

  return (
    <div className="pace-section">
      <div className="section-title">Walking pace</div>
      <div className="pace-grid" role="radiogroup" aria-label="Walking pace">
        {PACE_PRESETS.map(p => {
          const active = paceId === p.id;
          const detail = p.id === 'custom'
            ? (customMps ? `${mpsToKmh(customMps).toFixed(1)} km/h` : 'pick a speed')
            : p.hint;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`pace-option${active ? ' active' : ''}`}
              onClick={() => onChangePaceId(p.id)}
            >
              <span className="pace-option-label">{p.label}</span>
              <span className="pace-option-hint">{detail}</span>
            </button>
          );
        })}
      </div>
      {isCustom && (
        <label className="pace-custom-row">
          <span>Custom speed</span>
          <span className="pace-custom-input">
            <input
              type="number"
              min="1.0"
              max="10.0"
              step="0.1"
              value={customMps ? mpsToKmh(customMps).toFixed(1) : ''}
              placeholder="km/h"
              onChange={e => {
                const kmh = Number(e.target.value);
                if (!Number.isFinite(kmh) || kmh <= 0) {
                  onChangeCustomMps(null);
                  return;
                }
                onChangeCustomMps(clampCustomMps(kmh / 3.6));
              }}
            />
            <span className="pace-custom-unit">km/h</span>
          </span>
        </label>
      )}
      <p className="pace-foot">
        Times include an estimated wait at signalised crossings and a small penalty per turn.
      </p>
    </div>
  );
}
