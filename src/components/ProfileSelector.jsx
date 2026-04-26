import { PROFILES, matchesProfile } from '../config/profiles';

export default function ProfileSelector({
  activeProfileId,
  paceId,
  customPaceMps,
  modeId,
  filters,
  onApply
}) {
  const matchedId = (() => {
    // If the explicitly-selected profile still matches, keep it selected.
    if (activeProfileId) {
      const p = PROFILES.find(pr => pr.id === activeProfileId);
      if (p && matchesProfile(p, { paceId, customPaceMps, modeId, filters })) return p.id;
    }
    // Otherwise, find any profile whose presets match the current state.
    const found = PROFILES.find(p =>
      matchesProfile(p, { paceId, customPaceMps, modeId, filters })
    );
    return found?.id ?? null;
  })();

  const customised = activeProfileId && matchedId !== activeProfileId;

  return (
    <div className="profiles-section">
      <div className="profiles-head">
        <div className="section-title">Profile</div>
        {customised && (
          <span className="profiles-modified" title="You've changed settings since picking this profile">
            modified
          </span>
        )}
      </div>
      <div className="profiles-row" role="radiogroup" aria-label="Walking profile">
        {PROFILES.map(p => {
          const active = matchedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              className={`profile-chip${active ? ' active' : ''}`}
              onClick={() => onApply(p)}
              title={p.description}
            >
              <span className="profile-chip-icon" aria-hidden="true">{p.icon}</span>
              <span className="profile-chip-label">{p.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
