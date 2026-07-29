// Decoder para o formato "encoded polyline" do Google/Strava.
// Referência: https://developers.google.com/maps/documentation/utilities/polylinealgorithm

export function decodePolyline(str: string, precision = 5): [number, number][] {
  if (!str) return [];
  const factor = Math.pow(10, precision);
  let index = 0, lat = 0, lng = 0;
  const coords: [number, number][] = [];
  while (index < str.length) {
    let result = 0, shift = 0, b: number;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dLat;
    result = 0; shift = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dLng;
    coords.push([lat / factor, lng / factor]);
  }
  return coords;
}
