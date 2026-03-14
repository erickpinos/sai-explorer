import { useState, useEffect } from 'react';

export function useViewToggle() {
  const [view, setView] = useState('table');

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setView('cards');
    }
  }, []);

  const viewClass = view === 'auto' ? '' : view === 'cards' ? 'view-cards' : 'view-table';

  const toggle = (
    <div className="view-toggle-bar">
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
          onClick={() => setView('table')}
          title="Table view"
        >
          ☰
        </button>
        <button
          className={`view-toggle-btn ${view === 'cards' ? 'active' : ''}`}
          onClick={() => setView('cards')}
          title="Card view"
        >
          ▦
        </button>
      </div>
    </div>
  );

  return { toggle, viewClass };
}
