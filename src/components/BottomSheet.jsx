export default function BottomSheet({ open, onToggle, peek, children }) {
  return (
    <section
      className={`bottom-sheet${open ? ' is-open' : ' is-peek'}`}
      aria-label="Route details"
    >
      <button
        type="button"
        className="sheet-handle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="sheet-grabber" aria-hidden="true" />
      </button>
      <div className="sheet-peek">{peek}</div>
      <div className="sheet-body" role="region">{children}</div>
    </section>
  );
}
