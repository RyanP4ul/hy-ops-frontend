import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { Map, MapControls, MapMarker, MapRoute, MarkerContent, MarkerPopup, MarkerTooltip, useMap } from "../components/ui/map";

function MapContents() {
  const { map } = useMap();
  const [position, setPosition] = useState({ lng: 121.02, lat: 14.6 });
  useEffect(() => {
    if (!map) return;
    const pick = (event: { lngLat: { lng: number; lat: number } }) => setPosition(event.lngLat);
    map.on("click", pick);
    return () => { map.off("click", pick); };
  }, [map]);
  return <>
    <MapControls showCompass />
    <button type="button" style={{ position: "absolute", top: 0, left: 0 }} onClick={() => map?.easeTo({ pitch: 55, bearing: 90 })}>3D view</button>
    <output style={{ position: "absolute", bottom: 0, left: 0 }} aria-label="Coordinates">{position.lng.toFixed(5)},{position.lat.toFixed(5)}</output>
    <MapMarker longitude={position.lng} latitude={position.lat} draggable onDragEnd={setPosition}>
      <MarkerContent><button type="button" aria-label="Warehouse pin">Warehouse</button></MarkerContent>
      <MarkerTooltip>Warehouse tooltip</MarkerTooltip>
      <MarkerPopup><p>Warehouse details</p></MarkerPopup>
    </MapMarker>
    <MapRoute coordinates={[[121.02, 14.6], [121.04, 14.61]]} color="#ff0000" dashArray={[2, 2]} />
  </>;
}
function App() {
  const [secondary, setSecondary] = useState(true);
  return <>
    <button type="button" onClick={() => setSecondary(value => !value)}>Toggle second map</button>
    <div style={{ height: 500, width: 700 }}><Map center={[121.02, 14.6]} zoom={12}><MapContents /></Map></div>
    {secondary && <div style={{ height: 150, width: 300 }}><Map center={[121, 14.6]} /></div>}
  </>;
}
createRoot(document.getElementById("root")!).render(<App />);
