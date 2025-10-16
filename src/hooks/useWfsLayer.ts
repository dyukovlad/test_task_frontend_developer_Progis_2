import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import { parseWfsXmlToGeoJson } from '../utils/wfsParser';

export const useWfsLayer = (options: {
  mapRef: React.MutableRefObject<L.Map | null>;
  layerControlRef: React.MutableRefObject<L.Control.Layers | null>;
  wfsUrl?: string;
  wfsTypeName?: string;
  popupOptions?: L.PopupOptions;
}) => {
  const { mapRef, layerControlRef, wfsUrl, wfsTypeName, popupOptions } =
    options;
  const geoJsonRef = useRef<L.GeoJSON | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchForBbox = useCallback(
    async (bbox?: string) => {
      if (!wfsUrl || !wfsTypeName) return null;
      const bboxParam = bbox ? `&bbox=${bbox},EPSG:4326` : '';
      const url = `${wfsUrl}?service=WFS&version=1.1.0&request=GetFeature&typeName=${wfsTypeName}${bboxParam}`;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const resp = await fetch(url, { signal: abortRef.current.signal });
      if (!resp.ok) throw new Error(`WFS failed ${resp.status}`);
      const text = await resp.text();
      return parseWfsXmlToGeoJson(text);
    },
    [wfsUrl, wfsTypeName]
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !wfsUrl || !wfsTypeName) return;

    // create layer
    const layer = L.geoJSON(null, {
      onEachFeature: (feature, layer) => {
        const props = (feature.properties || {}) as Record<string, any>;
        const html = `<div>${Object.entries(props)
          .map(([k, v]) => `<strong>${k}</strong>: ${String(v)}`)
          .join('<br/>')}</div>`;
        layer.bindPopup(html, popupOptions);
      },
      style: () => ({
        color: '#ff7800',
        weight: 2,
        opacity: 0.9,
        fillOpacity: 0.2,
      }),
    });
    geoJsonRef.current = layer;

    // add to control (but don't add to map yet)
    layerControlRef.current?.addOverlay(layer, `WFS: ${wfsTypeName}`);

    // listeners
    const onOverlayAdd = async (ev: L.LayersControlEvent) => {
      if (ev.layer !== layer) return;
      try {
        const b = map.getBounds();
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
        const fc = await fetchForBbox(bbox);
        if (fc && fc.features && fc.features.length) {
          layer.clearLayers();
          layer.addData(fc);
          map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 16 });
        }
        // ensure layer is added to map
        if (!map.hasLayer(layer)) layer.addTo(map);
      } catch (err) {
        if ((err as any)?.name !== 'AbortError')
          console.warn('WFS overlay load failed', err);
      }
    };

    const onOverlayRemove = (ev: L.LayersControlEvent) => {
      if (ev.layer !== layer) return;
      // keep data but remove from map
      abortRef.current?.abort();
      try {
        map.removeLayer(layer);
      } catch (e) {}
    };

    // debounce moveend
    let moveTimer: any = null;
    const onMoveEnd = () => {
      if (!map.hasLayer(layer)) return;
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(async () => {
        try {
          const b = map.getBounds();
          const bbox = `${b.getSouthWest().lng},${b.getSouthWest().lat},${
            b.getNorthEast().lng
          },${b.getNorthEast().lat}`;
          const fc = await fetchForBbox(bbox);
          if (fc) {
            layer.clearLayers();
            layer.addData(fc);
          }
        } catch (err) {
          if ((err as any)?.name !== 'AbortError')
            console.warn('WFS reload failed', err);
        }
      }, 350);
    };

    map.on('overlayadd', onOverlayAdd);
    map.on('overlayremove', onOverlayRemove);
    map.on('moveend', onMoveEnd);

    return () => {
      map.off('overlayadd', onOverlayAdd);
      map.off('overlayremove', onOverlayRemove);
      map.off('moveend', onMoveEnd);
      abortRef.current?.abort();
      try {
        layerControlRef.current?.removeLayer?.(layer);
      } catch (e) {}
    };
  }, [
    mapRef,
    layerControlRef,
    wfsUrl,
    wfsTypeName,
    popupOptions,
    fetchForBbox,
  ]);

  return {
    geoJsonLayer: geoJsonRef,
    fetchForBbox,
  };
};
