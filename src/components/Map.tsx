import React, { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZWSLayer } from '../Layer/ZWSLayer';
import { ZWSService } from '../services/ZWSService';
import { useWfsLayer } from '../hooks/useWfsLayer';
import { DEFAULTS, WINDOW_POPUP } from './defaults';
import { escapeHtml } from '../utils/escapeHtml';

// fix Leaflet default icons in React environments
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:
    'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
});

interface MapProps {
  center?: [number, number];
  zoom?: number;
  height?: string;

  // ZWS
  zwsLayerName?: string;
  zwsEndpoint?: string;
  zwsAuth?: { user: string; pass: string };

  // WMS (tile)
  wmsUrl?: string;
  wmsLayerName?: string;
  wmsOptions?: L.WMSOptions;

  // WFS (XML/GML)
  wfsUrl?: string;
  wfsTypeName?: string;
}

const Map: React.FC<MapProps> = ({
  center = DEFAULTS.center,
  zoom = DEFAULTS.zoom,
  height = DEFAULTS.height,
  zwsLayerName = DEFAULTS.zwsLayerName,
  zwsEndpoint = DEFAULTS.zwsEndpoint,
  zwsAuth = DEFAULTS.zwsAuth,
  wmsUrl,
  wmsLayerName,
  wmsOptions,
  wfsUrl,
  wfsTypeName,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // layer refs
  const zwsLayerRef = useRef<ZWSLayer | null>(null);
  const wmsLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const wfsLayerRef = useRef<L.GeoJSON | null>(null);
  const layerControlRef = useRef<L.Control.Layers | null>(null);

  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // zws service to fetch attributes on click
  const zwsService = useRef(new ZWSService(zwsEndpoint!, zwsAuth)).current;

  const { fetchForBbox } = useWfsLayer({
    mapRef,
    layerControlRef,
    wfsUrl,
    wfsTypeName,
    popupOptions: WINDOW_POPUP,
  });

  const clearMarkers = useCallback(() => {
    markersGroupRef.current?.clearLayers();
  }, []);

  const addMarkerWithPopup = useCallback(
    (latlng: L.LatLngExpression, html: string) => {
      if (!markersGroupRef.current || !mapRef.current) return;
      const marker = L.marker(latlng);
      marker.bindPopup(html, WINDOW_POPUP);
      markersGroupRef.current.addLayer(marker);
      marker.openPopup();
    },
    []
  );

  // load WFS around a point (small bbox)
  const loadWfsAtPoint = useCallback(
    async (lat: number, lng: number) => {
      if (!wfsUrl || !wfsTypeName) return null;
      const delta = 0.0007; // ~ small bbox (~70m)
      const bbox = `${lng - delta},${lat - delta},${lng + delta},${
        lat + delta
      }`;
      try {
        const geojson = await fetchForBbox(bbox);
        return geojson;
      } catch (err) {
        console.warn('WFS point fetch error', err);
        return null;
      }
    },
    [wfsUrl, wfsTypeName, fetchForBbox]
  );

  // click handler: try ZWS -> fallback to WFS (geojson) -> show popup "not found"
  const handleMapClick = useCallback(
    async (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault?.();
      e.originalEvent.stopPropagation?.();

      const map = mapRef.current;
      if (!map) return;

      // abort previous
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const z = map.getZoom();
      const scale = (2 * Math.PI * 6378137.0) / (256 * Math.pow(2, z ?? zoom));

      // clear previous marker (variant 1 behavior)
      clearMarkers();

      try {
        const fields = await zwsService.selectByXY(
          zwsLayerName!,
          e.latlng.lat,
          e.latlng.lng,
          scale,
          abortRef.current.signal
        );

        if (fields === null) {
          // try WFS fallback (small bbox)
          const wfsGeo = await loadWfsAtPoint(e.latlng.lat, e.latlng.lng);
          console.log({ wfsGeo });
          if (wfsGeo && wfsGeo.features && wfsGeo.features.length > 0) {
            const props = wfsGeo.features[0].properties ?? {};
            const html = `<div>${Object.entries(props)
              .map(
                ([k, v]) =>
                  `<strong>${escapeHtml(String(k))}:</strong> ${escapeHtml(
                    String(v)
                  )}`
              )
              .join('<br/>')}</div>`;
            addMarkerWithPopup(e.latlng, html);
            return;
          }

          L.popup()
            .setLatLng(e.latlng)
            .setContent('<div><em>Объект не найден</em></div>')
            .openOn(map);
          return;
        }

        // build popup from fields
        const popupHtml =
          fields.length === 0
            ? '<div><em>Объект найден, но атрибуты недоступны</em></div>'
            : `<div>${fields
                .map(
                  (f) =>
                    `<strong>${escapeHtml(f.userName)}:</strong> ${escapeHtml(
                      f.value
                    )}`
                )
                .join('<br/>')}</div>`;

        addMarkerWithPopup(e.latlng, popupHtml);
      } catch (err) {
        if ((err as any)?.name === 'AbortError') {
          console.info('ZWS aborted');
          return;
        }
        console.error('ZWS error', err);

        // fallback to WFS
        try {
          const wfsGeo = await loadWfsAtPoint(e.latlng.lat, e.latlng.lng);
          if (wfsGeo && wfsGeo.features && wfsGeo.features.length > 0) {
            const props = wfsGeo.features[0].properties ?? {};
            const html = `<div>${Object.entries(props)
              .map(
                ([k, v]) =>
                  `<strong>${escapeHtml(String(k))}:</strong> ${escapeHtml(
                    String(v)
                  )}`
              )
              .join('<br/>')}</div>`;
            addMarkerWithPopup(e.latlng, html);
            return;
          }
        } catch (wfserr) {
          console.warn('WFS fallback error', wfserr);
        }

        L.popup()
          .setLatLng(e.latlng)
          .setContent(
            `<div><strong>Ошибка:</strong> ${(err as Error).message}</div>`
          )
          .openOn(map);
      }
    },
    [
      zwsService,
      zwsLayerName,
      zoom,
      clearMarkers,
      addMarkerWithPopup,
      loadWfsAtPoint,
    ]
  );

  // initialize map and layers
  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current).setView(center, zoom);
    mapRef.current = map;

    // base OSM
    const osm = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    ).addTo(map);

    // markers group for click-selected markers
    markersGroupRef.current = L.layerGroup().addTo(map);

    // create overlays map for LayerControl
    const overlays: Record<string, L.Layer> = {};
    const baseLayers: Record<string, L.Layer> = {
      OpenStreetMap: osm,
    };

    // 1) ZWS layer (raster tiles via custom GridLayer)
    try {
      const zwsLayer = new ZWSLayer({
        zwsLayerName,
        endpoint: zwsEndpoint,
        auth: zwsAuth,
        maxZoom: 18,
        opacity: 1,
      });
      zwsLayerRef.current = zwsLayer;
      // add to map initially
      zwsLayer.addTo(map);
      overlays['ZuluGIS (ZWS)'] = zwsLayer;
    } catch (err) {
      console.warn('Failed to add ZWSLayer', err);
    }

    // 2) WMS layer (if provided) — raster overlay
    if (wmsUrl && wmsLayerName) {
      const defaultWmsOptions: L.WMSOptions = {
        layers: wmsLayerName,
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
      };
      const combinedWmsOptions = {
        ...(defaultWmsOptions as any),
        ...(wmsOptions || {}),
      };
      const wmsLayer = L.tileLayer.wms(wmsUrl, combinedWmsOptions);
      wmsLayerRef.current = wmsLayer;
      // do not add automatically — add option to overlays; uncomment next line to show by default:
      // wmsLayer.addTo(map);
      overlays['WMS Layer'] = wmsLayer;
    }

    // 3) WFS layer: fetch and create GeoJSON layer (toggleable)
    if (wfsUrl && wfsTypeName) {
      // create empty geojson layer (will be populated)
      const geoJsonLayer = L.geoJSON(null, {
        onEachFeature: (feature, layer) => {
          const props = (feature.properties || {}) as Record<string, any>;
          const html = `<div>${Object.entries(props)
            .map(
              ([k, v]) =>
                `<strong>${escapeHtml(String(k))}:</strong> ${escapeHtml(
                  String(v)
                )}`
            )
            .join('<br/>')}</div>`;
          layer.bindPopup(html, WINDOW_POPUP);
        },
        style: () => ({
          color: '#ff7800',
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0.2,
        }),
      });
      wfsLayerRef.current = geoJsonLayer;
      overlays['WFS (GeoJSON)'] = geoJsonLayer;

      // optional: load features in current map bounds to keep payload small
      (async () => {
        try {
          const bounds = map.getBounds();
          const ne = bounds.getNorthEast();
          const sw = bounds.getSouthWest();
          const bbox = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
          const geojson = await fetchForBbox(bbox);
          if (geojson) {
            geoJsonLayer.addData(geojson);
            // auto-fit to loaded data
            try {
              const b = geoJsonLayer.getBounds();
              if (b && b.isValid())
                map.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
            } catch (fitErr) {
              console.warn('fitBounds error', fitErr);
            }
          }
        } catch (err) {
          console.warn('Failed to load WFS initial data', err);
        }
      })();
    }

    // add Layer control (baseLayers + overlays)
    layerControlRef.current = L.control
      .layers(baseLayers, overlays, { collapsed: false })
      .addTo(map);

    // click handler
    map.on('click', handleMapClick);

    // cleanup on unmount
    return () => {
      abortRef.current?.abort();
      map.off('click', handleMapClick);

      // remove control
      if (layerControlRef.current) {
        layerControlRef.current.remove();
        layerControlRef.current = null;
      }

      // remove overlays if added
      if (zwsLayerRef.current) {
        try {
          map.removeLayer(zwsLayerRef.current);
        } catch (e) {}
        zwsLayerRef.current = null;
      }
      if (wmsLayerRef.current) {
        try {
          map.removeLayer(wmsLayerRef.current);
        } catch (e) {}
        wmsLayerRef.current = null;
      }
      if (wfsLayerRef.current) {
        try {
          map.removeLayer(wfsLayerRef.current);
        } catch (e) {}
        wfsLayerRef.current = null;
      }

      // remove markers group and map
      if (markersGroupRef.current) {
        try {
          markersGroupRef.current.clearLayers();
        } catch (e) {}
        markersGroupRef.current = null;
      }

      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    center,
    zoom,
    zwsLayerName,
    zwsEndpoint,
    zwsAuth,
    wmsUrl,
    wmsLayerName,
    wmsOptions,
    wfsUrl,
    wfsTypeName,
    handleMapClick,
  ]);

  return (
    <div style={{ width: '100%' }}>
      <div ref={containerRef} style={{ height, width: '100%' }} />
    </div>
  );
};

export default Map;
