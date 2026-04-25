// Icon metadata for each preference filter
const PREF_META = {
  tactile:        { sym: '⠿', bg: '#EDE9FE', fg: '#6D28D9' }, // tactile bumps / braille
  audio:          { sym: '◎', bg: '#DBEAFE', fg: '#1D4ED8' }, // audio signal
  kerb:           { sym: '⌇', bg: '#CFFAFE', fg: '#0369A1' }, // kerb/ramp
  avoid_busy:     { sym: '⊗', bg: '#FEE2E2', fg: '#B91C1C' }, // no busy roads
  avoid_steps:    { sym: '↗', bg: '#FEF3C7', fg: '#B45309' }, // step-free
  pavement_width: { sym: '↔', bg: '#D1FAE5', fg: '#065F46' }, // wide pavement
  streetlights:   { sym: '◉', bg: '#FEF9C3', fg: '#A16207' }, // street lighting
  avoid_crash:    { sym: '⚠', bg: '#F3F4F6', fg: '#9CA3AF' }, // crash risk (soon)
};

export default function PreferenceList({ filters, filterOptions, onChange }) {
  const activeCount = filterOptions.filter(f => !f.disabled && filters[f.id]).length;

  return (
    <div className="prefs-section">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Accessibility preferences</span>
        {activeCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1558c0', background: '#e8f0fe', padding: '2px 8px', borderRadius: 999, letterSpacing: 0 }}>
            {activeCount} on
          </span>
        )}
      </div>

      <div className="pref-list" role="group" aria-label="Accessibility preference toggles">
        {filterOptions.map(f => {
          const active = !f.disabled && !!filters[f.id];
          const meta = PREF_META[f.id] || { sym: '•', bg: '#F3F4F6', fg: '#6B7280' };
          return (
            <button
              key={f.id}
              type="button"
              className={[
                'pref-row',
                active       ? 'pref-row--on'       : '',
                f.disabled   ? 'pref-row--disabled'  : '',
              ].filter(Boolean).join(' ')}
              disabled={!!f.disabled}
              onClick={() => !f.disabled && onChange(f.id, !filters[f.id])}
              aria-pressed={active}
              title={f.desc}
            >
              <span
                className="pref-icon"
                style={{ background: meta.bg, color: meta.fg }}
                aria-hidden="true"
              >
                {meta.sym}
              </span>

              <span className="pref-label">
                <span className="pref-title">{f.title}</span>
                {f.disabled && <span className="pref-soon">Soon</span>}
              </span>

              {/* Visual toggle — the aria-pressed on the button is the accessible signal */}
              <span className={`pref-toggle${active ? ' pref-toggle--on' : ''}`} aria-hidden="true">
                <span className="pref-toggle-thumb" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
