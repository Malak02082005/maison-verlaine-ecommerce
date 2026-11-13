import { useState } from 'react';
import { SearchIcon } from './Icons';

// A list of checkboxes for the shop filters (e.g. Type, Colour). Long lists get a small search
// box: typing narrows the list, so you don't have to scroll through every option.
// Options that are already ticked always stay visible, so they can be unticked.
export default function CheckboxFilter({ title, options, selected, onToggle, searchFrom = 6 }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = options.filter((o) => !q || o.toLowerCase().includes(q) || selected.includes(o));

  return (
    <div className="filter-group">
      <h4>{title}</h4>
      {options.length > searchFrom && (
        <label className="filter-search">
          <SearchIcon size={15} />
          <input
            type="search"
            placeholder={`Search ${title.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${title.toLowerCase()}`}
          />
        </label>
      )}
      {shown.map((o) => (
        <label key={o} className="check">
          <input type="checkbox" checked={selected.includes(o)} onChange={() => onToggle(o)} />
          {o}
        </label>
      ))}
      {shown.length === 0 && <p className="filter-empty">No {title.toLowerCase()} matches “{query}”</p>}
    </div>
  );
}
