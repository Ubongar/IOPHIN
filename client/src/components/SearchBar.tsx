/**
 * SearchBar - Component for searching and filtering LGAs
 * Shows dynamic risk levels based on tiering mode (absolute vs relative)
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import type { HotspotFeature } from '../types';
import { RISK_COLORS } from '../types';
import { useFilterStore } from '../store';
import { getDynamicRiskLevel } from '../utils/riskTiers';

interface SearchBarProps {
  data: HotspotFeature[] | null;
  onSelectLGA: (feature: HotspotFeature | null) => void;
  onSearchTermChange?: (term: string) => void;
  placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({ data, onSelectLGA, onSearchTermChange, placeholder = 'Search LGAs...' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const resultsId = 'search-results-list';
  const tieringMode = useFilterStore((s) => s.tieringMode);

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


  // Reset focused index when results change
  useEffect(() => {
    setFocusedIndex(-1);
  }, [filteredResults]);

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
    onSearchTermChange?.('');
    onSelectLGA(feature);
  };

  const handleClear = () => {
    setSearchTerm('');
    setShowResults(false);
    onSearchTermChange?.('');
    onSelectLGA(null);
  };

  const handleFocus = () => {
    if (searchTerm.length >= 2) {
      setShowResults(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || filteredResults.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => 
          prev < filteredResults.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredResults.length) {
          handleSelect(filteredResults[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowResults(false);
        setFocusedIndex(-1);
        break;
    }
  };

  return (
    <div ref={searchRef} className="search-bar-root relative w-full">
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
              onSearchTermChange?.(e.target.value);
              if (e.target.value) {
                setShowResults(true);
              }
            }}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="search-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showResults && filteredResults.length > 0}
            aria-controls={resultsId}
            aria-activedescendant={
              focusedIndex >= 0 ? `search-result-${focusedIndex}` : undefined
            }
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

      {showResults && searchTerm.length >= 2 && (
        <div 
          id={resultsId}
          className="search-results"
          role="listbox"
          aria-label="Search results"
        >
          {filteredResults.length > 0 ? (
            filteredResults.map((feature, index) => {
              // Use dynamic risk level based on tiering mode
              const dynamicRisk = getDynamicRiskLevel(feature, tieringMode);
              return (
                <button
                  id={`search-result-${index}`}
                  key={`${feature.properties.State}-${feature.properties.LGA_Name}`}
                  onClick={() => handleSelect(feature)}
                  className={`search-result-item ${index === focusedIndex ? 'focused' : ''}`}
                  role="option"
                  type="button"
                  aria-selected={index === focusedIndex}
                >
                  <div className="flex-1">
                    <div className="search-result-title">{feature.properties.LGA_Name}</div>
                    <div className="search-result-subtitle">{feature.properties.State} State</div>
                  </div>
                  <div className="search-result-badge" style={{ 
                    backgroundColor: RISK_COLORS[dynamicRisk]
                  }}>
                    {dynamicRisk}
                  </div>
                </button>
              );
            })
          ) : (
            <div className="search-no-results">
              <p>No results for &ldquo;{searchTerm}&rdquo;</p>
              <p className="search-no-results-hint">Try a different LGA or state name</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
