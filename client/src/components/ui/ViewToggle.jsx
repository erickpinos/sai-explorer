import { useState } from 'react';

export function useViewToggle() {
  const [view, setView] = useState('auto');

  const viewClass = view === 'auto' ? '' : view === 'cards' ? 'view-cards' : 'view-table';

  const toggle = (
    <div className="view-toggle-bar">
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
          onClick={() => setView(view === 'table' ? 'auto' : 'table')}
          title="Table view"
        >
          ☰
        </button>
        <button
          className={`view-toggle-btn ${view === 'cards' ? 'active' : ''}`}
          onClick={() => setView(view === 'cards' ? 'auto' : 'cards')}
          title="Card view"
        >
          ▦
        </button>
      </div>
    </div>
  );

  return { toggle, viewClass };
}
