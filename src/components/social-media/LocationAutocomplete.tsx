import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MapPin, Loader2, X, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface Place {
  id: string;
  name: string;
  location?: {
    city?: string;
    country?: string;
    state?: string;
    street?: string;
  };
}

interface LocationAutocompleteProps {
  value: string;
  locationId: string;
  onChange: (name: string, id: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function LocationAutocomplete({
  value,
  locationId,
  onChange,
  placeholder = "Buscar localização...",
  disabled = false,
}: LocationAutocompleteProps) {
  const { currentWorkspace } = useWorkspace();
  const [inputValue, setInputValue] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync external value
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Traduz códigos de erro para mensagens amigáveis em português
  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      NO_SOCIAL_ACCOUNTS: 'Para buscar localizações automaticamente, conecte sua conta do Facebook ou Instagram nas configurações de Redes Sociais.',
      TOKEN_MISSING: 'Sua conta conectada está sem permissão/token válido. Reconecte a conta nas configurações de Redes Sociais e tente novamente.',
      FB_API_ERROR: 'Não foi possível buscar localizações no momento. Tente novamente em alguns segundos.',
      DB_ERROR: 'Não foi possível acessar as configurações de conexão agora. Tente novamente em alguns segundos.',
      NETWORK_ERROR: 'Erro de conexão. Verifique sua internet e tente novamente.',
    };
    return errorMessages[errorCode] || 'Ocorreu um erro ao buscar localizações. Tente novamente.';
  };

  const searchPlaces = useCallback(async (query: string) => {
    if (!query || query.length < 2 || !currentWorkspace?.id) {
      setPlaces([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('social-places-search', {
        body: {
          query,
          workspaceId: currentWorkspace.id,
        },
      });

      if (error) {
        console.error('Edge function error:', error);
        setError(getErrorMessage('NETWORK_ERROR'));
        setPlaces([]);
        return;
      }

      if (data?.error || data?.errorCode) {
        setError(getErrorMessage(data.errorCode || data.error));
        setPlaces([]);
        return;
      }

      setPlaces(data?.places || []);
      if (data?.places?.length > 0) {
        setIsOpen(true);
      }
    } catch (err) {
      console.error('Error searching places:', err);
      setError(getErrorMessage('NETWORK_ERROR'));
      setPlaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentWorkspace?.id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Clear selection if user is typing
    if (locationId && newValue !== value) {
      onChange(newValue, '');
    }

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      searchPlaces(newValue);
    }, 300);
  };

  const handleSelectPlace = (place: Place) => {
    const displayName = place.location?.city 
      ? `${place.name}, ${place.location.city}${place.location.state ? `, ${place.location.state}` : ''}`
      : place.name;
    
    setInputValue(displayName);
    onChange(displayName, place.id);
    setIsOpen(false);
    setPlaces([]);
  };

  const handleClear = () => {
    setInputValue('');
    onChange('', '');
    setPlaces([]);
    inputRef.current?.focus();
  };

  const formatLocation = (place: Place) => {
    const parts: string[] = [];
    if (place.location?.street) parts.push(place.location.street);
    if (place.location?.city) parts.push(place.location.city);
    if (place.location?.state) parts.push(place.location.state);
    if (place.location?.country) parts.push(place.location.country);
    return parts.join(', ');
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => places.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-16"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {inputValue && !isLoading && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          {locationId && (
            <div className="h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && places.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
          <ScrollArea className="max-h-[200px]">
            <div className="p-1">
              {places.map((place) => (
                <button
                  key={place.id}
                  type="button"
                  onClick={() => handleSelectPlace(place)}
                  className={cn(
                    "w-full flex items-start gap-3 p-2 rounded-md text-left transition-colors",
                    "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{place.name}</p>
                    {place.location && (
                      <p className="text-xs text-muted-foreground truncate">
                        {formatLocation(place)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Error/Info message */}
      {error && (
        <p className="text-xs text-muted-foreground mt-1">{error}</p>
      )}

      {/* Hint when no location selected */}
      {!error && !locationId && inputValue && !isLoading && places.length === 0 && inputValue.length >= 2 && (
        <p className="text-xs text-muted-foreground mt-1">
          Nenhum local encontrado. A localização será salva como texto.
        </p>
      )}
    </div>
  );
}
