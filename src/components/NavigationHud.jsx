import { useState } from 'react';
import { VOICES } from '../services/elevenlabs';
import { formatDistance } from '../utils/format';

const MODIFIER_ARROW = {
  left:          '←',
  right:         '→',
  'sharp left':  '↰',
  'sharp right': '↱',
  'slight left': '↖',
  'slight right':'↗',
  straight:      '↑',
  uturn:         '↺',
};

function arrowForStep(step, arrived) {
  if (arrived) return '●';
  if (!step) return '↑';
  if (step.instruction === 'roundabout' || step.instruction === 'rotary') return '↻';
  if (step.instruction === 'arrive') return '●';
  return MODIFIER_ARROW[step.modifier] || '↑';
}

export default function NavigationHud({
  instruction,
  distanceToNext,
  currentStep,
  arrived,
  simulating,
  gpsError,
  accessible,
  apiKey,
  voiceId,
  onEnd,
  onToggleSimulate,
  onApiKeyChange,
  onVoiceChange,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [keyDraft, setKeyDraft] = useState(apiKey || '');

  if (!instruction && !arrived) return null;

  const arrow    = arrowForStep(currentStep, arrived);
  const distText = distanceToNext != null ? formatDistance(distanceToNext) : null;

  return (
    <div
      className={[
        'nav-hud',
        arrived    ? 'nav-hud--arrived' : '',
        accessible ? 'nav-hud--a11y'   : '',
      ].filter(Boolean).join(' ')}
      role="region"
      aria-label="Turn-by-turn navigation"
      aria-live="polite"
    >
      {/* ── Main instruction row ── */}
      <div className="nav-hud-main">
        <div className="nav-hud-arrow" aria-hidden="true">{arrow}</div>
        <div className="nav-hud-info">
          <div className="nav-hud-instr">{arrived ? 'You have arrived!' : instruction}</div>
          {!arrived && distText && (
            <div className="nav-hud-dist">In {distText}</div>
          )}
          {gpsError && (
            <div className="nav-hud-gps-warn">⚠ GPS: {gpsError}</div>
          )}
        </div>
        <button
          type="button"
          className="nav-hud-end"
          onClick={onEnd}
          aria-label="End navigation"
          title="End navigation"
        >
          ✕
        </button>
      </div>

      {/* ── Action bar ── */}
      <div className="nav-hud-bar">
        <button
          type="button"
          className={`nav-hud-btn${simulating ? ' active' : ''}`}
          onClick={onToggleSimulate}
          title={simulating ? 'Stop simulation' : 'Simulate walking the route'}
        >
          {simulating ? '⏹ Stop sim' : '▶ Simulate'}
        </button>
        <button
          type="button"
          className={`nav-hud-btn${showSettings ? ' active' : ''}`}
          onClick={() => setShowSettings(s => !s)}
          title="Voice settings"
        >
          ⚙ Voice
        </button>
      </div>

      {/* ── Settings panel ── */}
      {showSettings && (
        <div className="nav-settings">
          <label className="nav-settings-label">
            ElevenLabs API Key
            <input
              className="nav-settings-input"
              type="password"
              placeholder="Paste key — leave blank for browser TTS"
              value={keyDraft}
              onChange={e => setKeyDraft(e.target.value)}
              onBlur={() => onApiKeyChange(keyDraft.trim())}
            />
          </label>
          <label className="nav-settings-label">
            Voice
            <select
              className="nav-settings-select"
              value={voiceId}
              onChange={e => onVoiceChange(e.target.value)}
            >
              {VOICES.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </label>
          <p className="nav-settings-note">
            {apiKey
              ? '✓ Using ElevenLabs TTS'
              : '⚠ Using browser TTS — add an ElevenLabs key for richer audio'}
          </p>
        </div>
      )}
    </div>
  );
}
