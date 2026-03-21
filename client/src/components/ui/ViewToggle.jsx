import { useState, useEffect } from 'react';
import { List, LayoutGrid } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'sai-view-preference';
const mq = window.matchMedia('(max-width: 767px)');

export function useViewToggle(tableKey) {
  const storageKey = tableKey ? `${STORAGE_KEY_PREFIX}-${tableKey}` : STORAGE_KEY_PREFIX;
  const [view, setView] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'table' || saved === 'cards') {
      return saved;
    }
    return mq.matches ? 'cards' : 'table';
  });

  useEffect(() => {
    const handler = (e) => {
      localStorage.removeItem(storageKey);
      setView(e.matches ? 'cards' : 'table');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [storageKey]);

  const setViewAndSave = (v) => {
    setView(v);
    localStorage.setItem(storageKey, v);
  };

  const viewClass = view === 'cards' ? 'view-cards' : 'view-table';

  const toggle = (
    <div className="view-toggle-bar">
      <div className="view-toggle">
        <button
          className={`view-toggle-btn ${view === 'table' ? 'active' : ''}`}
          onClick={() => setViewAndSave('table')}
          title="Table view"
          aria-label="Table view"
        >
          <List size={16} />
        </button>
        <button
          className={`view-toggle-btn ${view === 'cards' ? 'active' : ''}`}
          onClick={() => setViewAndSave('cards')}
          title="Card view"
          aria-label="Card view"
        >
          <LayoutGrid size={16} />
        </button>
      </div>
    </div>
  );

  return { toggle, viewClass };
}
