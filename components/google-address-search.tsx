"use client";

import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, onGoogleMapsError } from "@/lib/google-maps";
import { googlePlaceAddress, type GooglePlaceAddress } from "@/lib/google-place-address";

const unavailable = "Google address search is unavailable. Enter the address below.";

export function GoogleAddressSearch({ onSelect, disabled = false }: {
  onSelect: (address: GooglePlaceAddress) => void;
  disabled?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<google.maps.places.PlaceAutocompleteElement | null>(null);
  const disabledRef = useRef(disabled);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    disabledRef.current = disabled;
    if (widget.current) {
      widget.current.disabled = disabled;
      widget.current.toggleAttribute("data-disabled", disabled);
    }
  }, [disabled]);

  useEffect(() => {
    let active = true;
    let selection = 0;
    let autocomplete: google.maps.places.PlaceAutocompleteElement | undefined;
    const unsubscribe = onGoogleMapsError(() => {
      if (active) { selection++; setError(unavailable); setLoading(false); }
    });
    const select = async (event: Event) => {
      if (autocomplete?.disabled) return;
      const current = ++selection;
      setError(null);
      try {
        const place = (event as google.maps.places.PlacePredictionSelectEvent).placePrediction.toPlace();
        await place.fetchFields({ fields: ["addressComponents", "formattedAddress", "location"] });
        if (active && current === selection && !autocomplete?.disabled) onSelect(googlePlaceAddress(place));
      } catch {
        if (active && current === selection) setError("Could not load this address. Try another result or enter it below.");
      }
    };
    const fail = () => { selection++; setError(unavailable); };

    void loadGoogleMaps().then(maps => maps.importLibrary("places")).then(({ PlaceAutocompleteElement }) => {
      if (!active || !container.current) return;
      autocomplete = new PlaceAutocompleteElement({ includedRegionCodes: ["ph"] });
      autocomplete.id = "search_address";
      autocomplete.className = "hyops-address-search";
      autocomplete.setAttribute("aria-label", "Search Address");
      autocomplete.setAttribute("no-input-icon", "");
      autocomplete.placeholder = "Search warehouse address";
      autocomplete.disabled = disabledRef.current;
      autocomplete.toggleAttribute("data-disabled", disabledRef.current);
      autocomplete.style.width = "100%";
      autocomplete.addEventListener("gmp-select", select);
      autocomplete.addEventListener("gmp-error", fail);
      container.current.replaceChildren(autocomplete);
      widget.current = autocomplete;
      setLoading(false);
    }).catch(() => {
      if (active) { setError(unavailable); setLoading(false); }
    });

    return () => {
      active = false;
      unsubscribe();
      autocomplete?.removeEventListener("gmp-select", select);
      autocomplete?.removeEventListener("gmp-error", fail);
      autocomplete?.remove();
      widget.current = null;
    };
  }, [onSelect, attempt]);

  return <div className="space-y-2">
    <div ref={container} />
    {loading && <p role="status" className="text-xs text-muted-foreground">Loading address search...</p>}
    {error && <div role="alert" className="text-xs text-destructive">
      {error}{" "}
      <button type="button" className="underline" disabled={disabled} onClick={() => {
        setError(null); setLoading(true); setAttempt(value => value + 1);
      }}>Retry</button>
    </div>}
  </div>;
}
