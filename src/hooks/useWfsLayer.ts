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

      // abort previous request explicitly (we want only last one live)
      try {
        abortRef.current?.abort();
      } catch (e) {
        // ignore
      }

      // create a new controller and use it locally
      const controller = new AbortController();
      abortRef.current = controller;

      // defensive: if someone aborted controller synchronously (unlikely) — bail out
      if (controller.signal.aborted) {
        console.info('WFS fetch cancelled before start');
        return null;
      }

      try {
        const resp = await fetch(url, { signal: controller.signal });
        if (!resp.ok) {
          console.warn('WFS fetch failed', resp.status, resp.statusText, url);
          return null;
        }
        const text = await resp.text();
        const fc = parseWfsXmlToGeoJson(text);
        return fc;
      } catch (err: any) {
        if (err && err.name === 'AbortError') {
          // expected — cancelled
          console.info('WFS fetch aborted', url);
          return null;
        }
        console.error('WFS fetch error', err, url);
        return null;
      }
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

    try {
      layerControlRef.current?.addOverlay(layer, `WFS: ${wfsTypeName}`);
    } catch (e) {
      // some Leaflet builds don't expose addOverlay in the same way — ignore
    }

    // handlers
    const onOverlayAdd = async (ev: L.LayersControlEvent) => {
      if (ev.layer !== layer) return;
      if (!map) return;
      try {
        const b = map.getBounds();
        const bbox = `${b.getSouthWest().lng},${b.getSouthWest().lat},${
          b.getNorthEast().lng
        },${b.getNorthEast().lat}`;
        const fc = await fetchForBbox(bbox);
        if (fc && fc.features && fc.features.length) {
          layer.clearLayers();
          layer.addData(fc);
          try {
            const bounds = layer.getBounds();
            if (bounds && bounds.isValid())
              map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
          } catch (fitErr) {
            console.warn('WFS fitBounds failed', fitErr);
          }
        } else {
          console.info('WFS overlay loaded 0 features or fetch was cancelled');
        }
        if (!map.hasLayer(layer)) layer.addTo(map);
      } catch (err) {
        if ((err as any)?.name !== 'AbortError') {
          console.warn('WFS overlay load failed', err);
        }
      }
    };

    const onOverlayRemove = (ev: L.LayersControlEvent) => {
      if (ev.layer !== layer) return;
      // cancel in-flight requests and remove layer from map
      try {
        abortRef.current?.abort();
      } catch (e) {}
      try {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      } catch (e) {}
    };

    // debounce on moveend
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
      try {
        abortRef.current?.abort();
      } catch (e) {}
      // remove layer from map/control
      try {
        if (map.hasLayer(layer)) map.removeLayer(layer);
      } catch (e) {}
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
