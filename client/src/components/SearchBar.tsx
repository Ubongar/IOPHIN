/**
 * SearchBar - Component for searching and filtering LGAs
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import type { HotspotFeature } from '../types';
import { RISK_COLORS } from '../types';

interface SearchBarProps {
  data: HotspotFeature[] | null;
  onSelectLGA: (feature: HotspotFeature | null) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ data, onSelectLGA }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredResults = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2 || !data) {
      return [];
    }

    const term = searchTerm.toLowerCase();
    return data.filter(feature => 
      feature.properties.LGA_Name.toLowerCase().includes(term) ||
      feature.properties.State.toLowerCase().includes(term)
    ).slice(0, 10); // Limit to 10 results
  }, [searchTerm, data]);

  const hasResults = filteredResults.length > 0 && searchTerm.length > 0;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (feature: HotspotFeature) => {
    setSearchTerm('');
    setShowResults(false);
    onSelectLGA(feature);
  };

  const handleClear = () => {
    setSearchTerm('');
    setShowResults(false);
  };

  const handleFocus = () => {
    if (hasResults) {
      setShowResults(true);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <div className="search-input-wrapper">
          <svg className="search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (e.target.value) {
                setShowResults(true);
              }
            }}
            onFocus={handleFocus}
            placeholder="Search LGAs or States..."
            className="search-input"
          />
          {searchTerm && (
            <button onClick={handleClear} className="search-clear-btn" aria-label="Clear search">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showResults && filteredResults.length > 0 && (
        <div className="search-results">
          {filteredResults.map((feature) => (
            <button
              key={`${feature.properties.State}-${feature.properties.LGA_Name}`}
              onClick={() => handleSelect(feature)}
              className="search-result-item"
            >
              <div className="flex-1">
                <div className="search-result-title">{feature.properties.LGA_Name}</div>
                <div className="search-result-subtitle">{feature.properties.State} State</div>
              </div>
              <div className="search-result-badge" style={{ 
                backgroundColor: RISK_COLORS[feature.properties.risk_level]
              }}>
                {feature.properties.risk_level}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
