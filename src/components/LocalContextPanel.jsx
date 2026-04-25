export default function LocalContextPanel({ notes }) {
  if (!notes || notes.length === 0) return null;

  return (
    <div className="section">
      <h2>Belfast seed notes</h2>
      <div className="local-note-list">
        {notes.map(note => (
          <div className="local-note" key={note.id}>
            <span className="local-note-label">{note.label} · {note.area}</span>
            <strong>{note.title}</strong>
            <span>{note.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
