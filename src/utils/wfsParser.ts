export const parseWfsXmlToGeoJson = (
  xmlText: string
): GeoJSON.FeatureCollection | null => {
  if (!xmlText) return null;
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');

  const findAll = (names: string[], context: Document | Element = xml) => {
    for (const n of names) {
      const els = Array.from(
        (context as Document).getElementsByTagName(
          n
        ) as HTMLCollectionOf<Element>
      );
      if (els.length) return els;
    }
    return [] as Element[];
  };

  // find members
  let members = findAll([
    'featureMember',
    'gml:featureMember',
    'member',
    'gml:member',
  ]);
  if (members.length === 0) {
    const fm = xml.getElementsByTagName('featureMembers');
    if (fm && fm.length > 0 && fm[0].children.length > 0)
      members = Array.from(fm[0].children);
  }
  if (members.length === 0) {
    members = Array.from(xml.documentElement.children).filter((el) => {
      const ln = (el.localName || '').toLowerCase();
      return ![
        'boundedby',
        'featurecollection',
        'wfs:featurecollection',
        'gml:featurecollection',
      ].includes(ln);
    });
  }

  const parsePosList = (text: string) => {
    const nums = text
      .trim()
      .split(/\s+/)
      .map(Number)
      .filter((n) => !isNaN(n));
    const coords: number[][] = [];
    for (let i = 0; i < nums.length - 1; i += 2)
      coords.push([nums[i], nums[i + 1]]);
    return coords;
  };
  const parsePos = (text: string) => {
    const nums = text.trim().split(/\s+/).map(Number);
    return nums.length >= 2 ? [nums[0], nums[1]] : null;
  };

  const parseGeometryFromElement = (el: Element | null) => {
    if (!el) return null;

    // Point
    const pointEl =
      el.getElementsByTagName('Point')[0] ||
      el.getElementsByTagName('gml:Point')[0];
    if (pointEl) {
      const pos =
        pointEl.getElementsByTagName('pos')[0] ||
        pointEl.getElementsByTagName('gml:pos')[0];
      const coordsText =
        pos?.textContent ||
        pointEl.getElementsByTagName('coordinates')[0]?.textContent;
      if (coordsText) {
        const p = parsePos(coordsText);
        if (p) return { type: 'Point', coordinates: p } as GeoJSON.Point;
      }
    }

    // LineString
    const lineEl =
      el.getElementsByTagName('LineString')[0] ||
      el.getElementsByTagName('gml:LineString')[0];
    if (lineEl) {
      const posList =
        lineEl.getElementsByTagName('posList')[0] ||
        lineEl.getElementsByTagName('gml:posList')[0];
      const coordsText =
        posList?.textContent ||
        lineEl.getElementsByTagName('coordinates')[0]?.textContent;
      if (coordsText) {
        if (posList && posList.textContent) {
          const coords = parsePosList(posList.textContent);
          return {
            type: 'LineString',
            coordinates: coords,
          } as GeoJSON.LineString;
        } else {
          const pairs = coordsText
            .trim()
            .split(/\s+/)
            .map((s) => s.split(',').map(Number));
          return {
            type: 'LineString',
            coordinates: pairs as number[][],
          } as GeoJSON.LineString;
        }
      }
    }

    // Polygon
    const polyEl =
      el.getElementsByTagName('Polygon')[0] ||
      el.getElementsByTagName('gml:Polygon')[0];
    if (polyEl) {
      const exterior =
        polyEl.getElementsByTagName('exterior')[0] ||
        polyEl.getElementsByTagName('gml:exterior')[0];
      let ringCoords: number[][] = [];
      if (exterior) {
        const linearRing =
          exterior.getElementsByTagName('LinearRing')[0] ||
          exterior.getElementsByTagName('gml:LinearRing')[0];
        const posList =
          linearRing?.getElementsByTagName('posList')[0] ||
          linearRing?.getElementsByTagName('gml:posList')[0];
        const coordsText =
          posList?.textContent ||
          linearRing?.getElementsByTagName('coordinates')[0]?.textContent;
        if (coordsText) ringCoords = parsePosList(coordsText);
      } else {
        const posList =
          polyEl.getElementsByTagName('posList')[0] ||
          polyEl.getElementsByTagName('gml:posList')[0];
        if (posList && posList.textContent)
          ringCoords = parsePosList(posList.textContent);
      }
      if (ringCoords.length)
        return {
          type: 'Polygon',
          coordinates: [ringCoords],
        } as GeoJSON.Polygon;
    }

    const anyPosList =
      el.getElementsByTagName('posList')[0] ||
      el.getElementsByTagName('gml:posList')[0];
    if (anyPosList && anyPosList.textContent) {
      const coords = parsePosList(anyPosList.textContent);
      if (coords.length === 1)
        return { type: 'Point', coordinates: coords[0] } as GeoJSON.Point;
      return { type: 'LineString', coordinates: coords } as GeoJSON.LineString;
    }

    return null;
  };

  const features: GeoJSON.Feature[] = [];
  for (const member of members) {
    const memberEl = member as Element;
    const actualFeatureEl =
      (Array.from(memberEl.children).find((c) => {
        const ln = (c.localName || '').toLowerCase();
        return !['boundedby', 'the_geom', 'geometry', 'envelope'].includes(ln);
      }) as Element) ||
      (memberEl.firstElementChild as Element | null) ||
      memberEl;

    if (!actualFeatureEl) continue;

    const props: Record<string, any> = {};
    for (const child of Array.from(actualFeatureEl.children)) {
      const ln = (child.localName || '').toLowerCase();
      const skip = [
        'point',
        'linestring',
        'polygon',
        'pos',
        'poslist',
        'the_geom',
        'geometry',
        'coordinates',
        'linearring',
        'boundedby',
        'envelope',
      ].includes(ln);
      const childHasGeom =
        child.getElementsByTagName('posList').length ||
        child.getElementsByTagName('pos').length ||
        child.getElementsByTagName('Point').length ||
        child.getElementsByTagName('LineString').length ||
        child.getElementsByTagName('Polygon').length;
      if (skip || childHasGeom) continue;
      const key = child.localName || child.nodeName;
      props[key] = (child.textContent || '').trim();
    }

    let geometry = parseGeometryFromElement(actualFeatureEl);
    if (!geometry) {
      const allChildren = Array.from(actualFeatureEl.getElementsByTagName('*'));
      for (const c of allChildren) {
        const ln = (c.localName || '').toLowerCase();
        if (
          [
            'point',
            'linestring',
            'polygon',
            'poslist',
            'pos',
            'coordinates',
          ].includes(ln)
        ) {
          const g = parseGeometryFromElement(c);
          if (g) {
            geometry = g;
            break;
          }
        }
      }
    }

    features.push({
      type: 'Feature',
      properties: props,
      geometry: (geometry as any) || null,
    });
  }

  return { type: 'FeatureCollection', features };
};
