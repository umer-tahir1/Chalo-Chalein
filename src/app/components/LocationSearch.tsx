import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';
import { PAKISTAN_ERROR_MESSAGE } from '../utils/market';

export interface SelectedLocation {
  lat: number;
  lng: number;
  displayName: string;
  shortName: string;
  countryCode?: string;
}

interface LocationSearchProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: SelectedLocation) => void;
  onError?: (message: string) => void;
  onClear?: () => void;
  variant?: 'pickup' | 'dropoff';
  density?: 'default' | 'compact';
  className?: string;
}

export function LocationSearch({
  placeholder,
  value,
  onChange,
  onSelect,
  onError,
  onClear,
  variant = 'pickup',
  density = 'default',
  className = '',
}: LocationSearchProps) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value || value.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(value)}&format=json&limit=6&addressdetails=1&countrycodes=pk&bounded=1&viewbox=60.8,37.3,77.9,23.5`,
          {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'ChaloChale-App/1.0' },
          }
        );
        const data = await res.json();
        const filtered = (data || []).filter((item: any) => {
          const countryCode = item?.address?.country_code;
          const displayName = String(item?.display_name || '').toLowerCase();
          return countryCode === 'pk' || displayName.includes('pakistan');
        });
        setSuggestions(filtered);
        setIsOpen(filtered.length > 0);
      } catch (err) {
        console.error('Location search error:', err);
      } finally {
        setLoading(false);
      }
    }, 450);
  }, [value]);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const handleSelect = (s: any) => {
    const countryCode = String(s?.address?.country_code || '').toLowerCase();
    if (countryCode && countryCode !== 'pk') {
      onError?.(PAKISTAN_ERROR_MESSAGE);
      return;
    }

    const parts = s.display_name.split(',');
    const shortName = parts.slice(0, 2).join(',').trim();
    onSelect({
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lon),
      displayName: s.display_name,
      shortName,
      countryCode,
    });
    onChange(shortName);
    setIsOpen(false);
  };

  const dotColor = variant === 'pickup' ? 'bg-blue-500' : 'bg-red-500';
  const isCompact = density === 'compact';

  const inputCls = isCompact
    ? 'w-full pl-8 pr-8 py-2.5 border border-neutral-200 rounded-lg bg-white text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm'
    : 'w-full pl-9 pr-8 py-3 border border-neutral-200 rounded-xl bg-white text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent shadow-sm';

  const menuCls = isCompact
    ? 'absolute z-50 left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-neutral-100 overflow-hidden max-h-56 overflow-y-auto'
    : 'absolute z-50 left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-neutral-100 overflow-hidden max-h-60 overflow-y-auto';

  const itemCls = isCompact
    ? 'w-full text-left px-3 py-2 hover:bg-green-50 flex items-start gap-2.5 border-b border-neutral-50 last:border-0 transition-colors'
    : 'w-full text-left px-4 py-3 hover:bg-green-50 flex items-start gap-3 border-b border-neutral-50 last:border-0 transition-colors';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <div className="absolute left-3 flex items-center pointer-events-none z-10">
          <span className={`${isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} rounded-full ${dotColor} ring-2 ring-white shadow`} />
        </div>
        <input
          type="text"
          className={inputCls}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-3">
            <Loader2 className="w-4 h-4 text-green-500 animate-spin" />
          </div>
        )}
        {!loading && value && onClear && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onChange(''); onClear(); setIsOpen(false); setSuggestions([]); }}
            className="absolute right-3 text-neutral-400 hover:text-neutral-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className={menuCls}>
          {suggestions.map((s, i) => {
            const parts = s.display_name.split(',');
            const main = parts[0];
            const sub = parts.slice(1, 3).join(',').trim();
            return (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSelect(s)}
                className={itemCls}
              >
                <MapPin className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className={`${isCompact ? 'text-[13px]' : 'text-sm'} font-medium text-neutral-800 truncate`}>{main}</p>
                  {sub && <p className="text-xs text-neutral-500 truncate">{sub}</p>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
