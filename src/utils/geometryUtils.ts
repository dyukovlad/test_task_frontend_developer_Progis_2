/**
 * Утилиты для работы с геометрией и координатами
 */

export interface Coordinate {
  lng: number;
  lat: number;
}

export interface PolygonCoordinates {
  type: 'polygon';
  coordinates: Coordinate[][];
}

export interface PointCoordinates {
  type: 'point';
  coordinates: Coordinate;
}

export type GeometryData = PolygonCoordinates | PointCoordinates;

/**
 * Парсит координаты из различных форматов
 */
export function parseCoordinates(value: string): Coordinate[] | null {
  try {
    // Если это JSON с координатами
    if (value.includes('[') && value.includes(']')) {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(coord => {
          if (Array.isArray(coord) && coord.length >= 2) {
            return { lng: coord[0], lat: coord[1] };
          }
          return null;
        }).filter(Boolean) as Coordinate[];
      }
    }
    
    // Если это строка с координатами через запятую
    if (value.includes(',')) {
      const coords = value.split(',').map((coord: string) => parseFloat(coord.trim()));
      if (coords.length >= 6 && coords.length % 2 === 0) {
        // Группируем координаты в пары [lng, lat]
        const pairs: Coordinate[] = [];
        for (let i = 0; i < coords.length; i += 2) {
          pairs.push({ lng: coords[i], lat: coords[i + 1] });
        }
        return pairs;
      }
    }
    
    // Если это WKT формат (POLYGON((lng lat, lng lat, ...)))
    if (value.toUpperCase().includes('POLYGON')) {
      const match = value.match(/POLYGON\s*\(\s*\(\s*([^)]+)\s*\)\s*\)/i);
      if (match) {
        const coordsString = match[1];
        const coords = coordsString.split(',').map((coord: string) => {
          const parts = coord.trim().split(/\s+/);
          if (parts.length >= 2) {
            return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
          }
          return null;
        }).filter(Boolean) as Coordinate[];
        return coords.length > 0 ? coords : null;
      }
    }
    
    return null;
  } catch (error) {
    console.warn('Ошибка при парсинге координат:', error);
    return null;
  }
}

/**
 * Ищет поле с координатами в массиве полей
 */
export function findCoordinatesField(fields: Array<{ userName: string; value: string }>): string | null {
  const coordKeywords = [
    'coord', 'coordinate', 'coordinates',
    'geometry', 'geom',
    'shape', 'polygon', 'polyline',
    'bounds', 'boundary',
    'wkt', 'geojson'
  ];
  
  for (const field of fields) {
    const fieldName = field.userName.toLowerCase();
    if (coordKeywords.some(keyword => fieldName.includes(keyword))) {
      return field.value;
    }
  }
  
  return null;
}

/**
 * Преобразует координаты в формат Leaflet [lat, lng][]
 */
export function coordinatesToLeaflet(coordinates: Coordinate[]): [number, number][] {
  return coordinates.map(coord => [coord.lat, coord.lng]);
}

/**
 * Проверяет, является ли геометрия валидным полигоном
 */
export function isValidPolygon(coordinates: Coordinate[]): boolean {
  return coordinates.length >= 3 && 
         coordinates.every(coord => 
           typeof coord.lng === 'number' && 
           typeof coord.lat === 'number' &&
           !isNaN(coord.lng) && 
           !isNaN(coord.lat)
         );
}

/**
 * Вычисляет центр полигона
 */
export function getPolygonCenter(coordinates: Coordinate[]): Coordinate {
  const sum = coordinates.reduce(
    (acc, coord) => ({ lng: acc.lng + coord.lng, lat: acc.lat + coord.lat }),
    { lng: 0, lat: 0 }
  );
  
  return {
    lng: sum.lng / coordinates.length,
    lat: sum.lat / coordinates.length
  };
}
