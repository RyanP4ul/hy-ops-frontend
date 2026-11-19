import { createRoot } from "react-dom/client";
import { useCallback, useState } from "react";
import { GoogleAddressSearch } from "../components/google-address-search";
import type { GooglePlaceAddress } from "../lib/google-place-address";

function App() {
  const [address, setAddress] = useState<GooglePlaceAddress | null>(null);
  const [disabled, setDisabled] = useState(false);
  const select = useCallback((value: GooglePlaceAddress) => setAddress(value), []);
  return <>
    <GoogleAddressSearch onSelect={select} disabled={disabled} />
    <button onClick={() => setDisabled(value => !value)}>Toggle disabled</button>
    <label>Street address<input defaultValue="Manual street" /></label>
    <output aria-label="Selected address">{JSON.stringify(address)}</output>
  </>;
}

createRoot(document.getElementById("root")!).render(<App />);
