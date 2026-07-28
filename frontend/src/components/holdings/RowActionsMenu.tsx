import { useEffect, useRef, useState } from 'react';

interface RowActionsMenuProps {
  label: string;
  sellLabel: string;
  onSell: () => void;
  onRemove: () => void;
}

export function RowActionsMenu({ label, sellLabel, onSell, onRemove }: RowActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="row-actions-menu" ref={containerRef}>
      <button
        type="button"
        className="row-actions-trigger"
        aria-label={`Actions for ${label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="12" cy="19" r="1.6" />
        </svg>
      </button>
      {isOpen && (
        <div className="row-actions-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="row-actions-item"
            onClick={() => {
              setIsOpen(false);
              onSell();
            }}
          >
            {sellLabel}
          </button>
          <button
            type="button"
            role="menuitem"
            className="row-actions-item row-actions-item-danger"
            onClick={() => {
              setIsOpen(false);
              onRemove();
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
