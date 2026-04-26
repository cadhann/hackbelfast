import { useEffect, useState } from 'react';

const CATEGORIES = [
  { id: 'blocked',    label: 'Path blocked / obstruction', icon: '🚧' },
  { id: 'kerb',       label: 'Broken or missing kerb',     icon: '🪨' },
  { id: 'tactile',    label: 'Missing tactile paving',     icon: '🟡' },
  { id: 'signal',     label: 'Crossing signal not working', icon: '🚦' },
  { id: 'lighting',   label: 'Poor lighting / no streetlights', icon: '💡' },
  { id: 'surface',    label: 'Rough or damaged surface',   icon: '🧱' },
  { id: 'safety',     label: 'Safety concern',             icon: '⚠️' },
  { id: 'other',      label: 'Something else',             icon: '📝' }
];

export default function ReportDialog({ open, onClose }) {
  const [category, setCategory] = useState(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setCategory(null);
      setNote('');
      setSubmitted(false);
    }
  }, [open]);

  useEffect(() => {
    if (!submitted) return;
    const t = setTimeout(() => onClose?.(), 1800);
    return () => clearTimeout(t);
  }, [submitted, onClose]);

  if (!open) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!category) return;
    setSubmitted(true);
  };

  return (
    <div className="report-overlay" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="report-card">
        {!submitted ? (
          <>
            <div className="report-head">
              <h2 id="report-title" className="report-title">Report an issue</h2>
              <button
                type="button"
                className="report-close"
                onClick={onClose}
                aria-label="Close report"
              >✕</button>
            </div>
            <p className="report-sub">
              Help others by flagging an accessibility problem on or near your route.
            </p>
            <form onSubmit={handleSubmit}>
              <div className="report-grid" role="radiogroup" aria-label="Issue type">
                {CATEGORIES.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={category === c.id}
                    className={`report-option${category === c.id ? ' active' : ''}`}
                    onClick={() => setCategory(c.id)}
                  >
                    <span className="report-option-icon" aria-hidden="true">{c.icon}</span>
                    <span className="report-option-label">{c.label}</span>
                  </button>
                ))}
              </div>
              <label className="report-note-label">
                <span>Additional detail (optional)</span>
                <textarea
                  className="report-note"
                  rows={3}
                  maxLength={300}
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Where is it? What did you notice?"
                />
              </label>
              <div className="report-actions">
                <button type="button" className="report-btn report-btn-ghost" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="report-btn report-btn-primary"
                  disabled={!category}
                >
                  Submit report
                </button>
              </div>
              <p className="report-foot">
                Reports are visual demo only — nothing is sent or stored.
              </p>
            </form>
          </>
        ) : (
          <div className="report-thanks">
            <div className="report-thanks-icon" aria-hidden="true">✓</div>
            <div className="report-thanks-title">Thanks for the report</div>
            <div className="report-thanks-sub">Other walkers will appreciate the heads up.</div>
          </div>
        )}
      </div>
    </div>
  );
}
