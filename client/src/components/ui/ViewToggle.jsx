import { useState, useEffect } from 'react';

const STORAGE_KEY = 'sai-view-preference';

export function useViewToggle() {
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'table' || saved === 'cards') return saved;
    return window.matchMedia('(max-width: 767px)').matches ? 'cards' : 'table';
  });

  const setViewAndSave = (v) => {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  };

  const viewClass = view === 'cards' ? 'view-cards' : 'view-table';

  const toggle = (
    <div className="view-toggle-bar">
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
          onClick={() => setViewAndSave('table')}
          title="Table view"
        >
          ☰
        </button>
        <button
          className={`view-toggle-btn ${view === 'cards' ? 'active' : ''}`}
          onClick={() => setViewAndSave('cards')}
          title="Card view"
        >
          ▦
        </button>
      </div>
    </div>
  );

  return { toggle, viewClass };
}
