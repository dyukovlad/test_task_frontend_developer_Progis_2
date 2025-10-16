export interface ZWSAuth {
  user: string;
  pass: string;
}

export interface ZWSField {
  userName: string;
  value: string;
}

export class ZWSService {
  endpoint: string;
  auth?: ZWSAuth;

  constructor(endpoint: string, auth?: ZWSAuth) {
    this.endpoint = endpoint;
    this.auth = auth;
  }

  buildSelectElemXml(
    layerName: string,
    lat: number,
    lng: number,
    scale: number
  ) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<zulu-server service='zws' version='1.0.0'>
  <Command>
    <SelectElemByXY>
      <Layer>${layerName}</Layer>
      <X>${lat}</X>
      <Y>${lng}</Y>
      <Scale>${scale}</Scale>
      <CRS>'EPSG:4326'</CRS>
    </SelectElemByXY>
  </Command>
</zulu-server>`;
  }

  basicAuthHeader() {
    if (!this.auth) return undefined;
    return `Basic ${btoa(`${this.auth.user}:${this.auth.pass}`)}`;
  }

  async selectByXY(
    layerName: string,
    lat: number,
    lng: number,
    scale: number,
    signal?: AbortSignal
  ): Promise<ZWSField[] | null> {
    const xml = this.buildSelectElemXml(layerName, lat, lng, scale);

    const headers: Record<string, string> = {
      'Content-Type': 'application/xml',
    };
    const authHeader = this.basicAuthHeader();
    if (authHeader) headers.Authorization = authHeader;

    const resp = await fetch(this.endpoint, {
      method: 'POST',
      headers,
      body: xml,
      signal,
      credentials: 'omit',
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(
        `ZWS responded: ${resp.status} ${resp.statusText} ${text}`
      );
    }

    const text = await resp.text();
    return this.parseFields(text);
  }

  parseFields(xmlText: string): ZWSField[] | null {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError)
      throw new Error('XML parse error: ' + (parseError.textContent ?? ''));

    const element = xmlDoc.querySelector('Element');
    if (!element) return null;

    const fields = Array.from(element.querySelectorAll('Field')).map((f) => {
      const userName = f.querySelector('UserName')?.textContent ?? 'Unknown';
      const value = f.querySelector('Value')?.textContent ?? '';
      return { userName, value };
    });

    return fields;
  }
}
