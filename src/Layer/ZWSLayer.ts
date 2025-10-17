import L from 'leaflet';

export interface ZWSLayerOptions extends L.GridLayerOptions {
  zwsLayerName?: string;
  endpoint?: string;
  auth?: { user: string; pass: string };
  maxZoom?: number;
}

export class ZWSLayer extends L.GridLayer {
  declare options: ZWSLayerOptions;

  constructor(options?: ZWSLayerOptions) {
    super();

    // гарантия: если this.options нет — создаём пустой объект, чтобы L.Util.setOptions мог работать
    if (!(this as any).options) {
      (this as any).options = {};
    }

    L.Util.setOptions(this, options || {});

    if (!this.options.pane) {
      this.options.pane = 'tilePane';
    }
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('img');
    tile.alt = `tile ${coords.x}:${coords.y}:${coords.z}`;
    tile.setAttribute('role', 'presentation');

    const zwsLayerName = this.options.zwsLayerName ?? 'example:demo';
    const endpoint = this.options.endpoint ?? 'http://zs.zulugis.ru:6473/zws';
    const auth = this.options.auth;

    const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<zulu-server service="zws" version="1.0.0">
  <Command>
    <GetLayerTile>
      <X>${coords.x}</X>
      <Y>${coords.y}</Y>
      <Z>${coords.z}</Z>
      <Layer>${zwsLayerName}</Layer>
    </GetLayerTile>
  </Command>
</zulu-server>`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/xml',
    };
    if (auth)
      headers.Authorization = `Basic ${btoa(`${auth.user}:${auth.pass}`)}`;

    fetch(endpoint, {
      method: 'POST',
      headers,
      body: xmlRequest,
      credentials: 'omit',
    })
      .then((resp) => {
        if (!resp.ok)
          throw new Error(`ZWS Tile failed: ${resp.status} ${resp.statusText}`);
        return resp.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);

        tile.onload = () => {
          URL.revokeObjectURL(url);
          done(undefined, tile);
        };

        tile.onerror = () => {
          URL.revokeObjectURL(url);
          done(new Error('Tile image failed to load'));
        };

        tile.src = url;
      })
      .catch((err) => {
        console.error('ZWS Tile Error:', err);
        done(err instanceof Error ? err : new Error(String(err)));
      });

    return tile;
  }
}
