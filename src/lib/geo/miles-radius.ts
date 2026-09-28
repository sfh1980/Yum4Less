export function milesToDegreeRadii(
  latitude: number,
  miles: number,
): { rx: number; ry: number } {
  const latRadians = (latitude * Math.PI) / 180;
  const milesPerDegreeLongitude = Math.max(69 * Math.cos(latRadians), 1);
  return {
    rx: miles / milesPerDegreeLongitude,
    ry: miles / 69,
  };
}
