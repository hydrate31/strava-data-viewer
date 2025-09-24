
function haversineDistance(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000; // Earth radius in meters
  const [lat1, lon1] = a.map(toRad);
  const [lat2, lon2] = b.map(toRad);
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function removeErroneousPoints(coords: [number, number][], maxDistance = 500): [number, number][] {
  const cleaned: [number, number][] = [];
  for (let i = 0; i < coords.length; i++) {
    if (i === 0 || haversineDistance(coords[i - 1], coords[i]) <= maxDistance) {
      cleaned.push(coords[i]);
    }
  }
  return cleaned;
}

export class GeoJsonManipulator {
    private getPerpendicularDistance(point: [number, number], lineStart: [number, number], lineEnd: [number, number]): number {
        const [x, y] = point;
        const [x1, y1] = lineStart;
        const [x2, y2] = lineEnd;

        const dx = x2 - x1;
        const dy = y2 - y1;

        if (dx === 0 && dy === 0) {
            return Math.hypot(x - x1, y - y1);
        }

        const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.hypot(x - projX, y - projY);
    }

    private douglasPeucker(points: [number, number][], tolerance: number): [number, number][] {
        if (points.length <= 2) return points;

        let maxDist = 0;
        let index = 0;

        for (let i = 1; i < points.length - 1; i++) {
            const dist = this.getPerpendicularDistance(points[i], points[0], points[points.length - 1]);
            if (dist > maxDist) {
            index = i;
            maxDist = dist;
            }
        }

        if (maxDist > tolerance) {
            const left = this.douglasPeucker(points.slice(0, index + 1), tolerance);
            const right = this.douglasPeucker(points.slice(index), tolerance);
            return [...left.slice(0, -1), ...right];
        } else {
            return [points[0], points[points.length - 1]];
        }
    }

    private simplifyGeometry(geometry: any, tolerance: number): any {
        switch (geometry.type) {
        case "LineString":
            return { ...geometry, coordinates: this.douglasPeucker(geometry.coordinates, tolerance) };
        case "MultiLineString":
            return { ...geometry, coordinates: geometry.coordinates.map((line: any) => this.douglasPeucker(line, tolerance)) };
        case "Polygon":
            return { ...geometry, coordinates: geometry.coordinates.map((ring: any) => this.douglasPeucker(ring, tolerance)) };
        case "MultiPolygon":
            return {
            ...geometry,
            coordinates: geometry.coordinates.map((poly: any) =>
                poly.map((ring: any) => this.douglasPeucker(ring, tolerance))
            )
            };
        default:
            return geometry;
        }
    }

    public async convertFromFit(fitFile: string, gpxFile: string) {
        try {
            const command = new Deno.Command("fit2gpx", {
                args: [fitFile, ">", gpxFile],
                stdout: "piped",
                stderr: "piped"
            });
    
            const { success, stdout, stderr } = await command.output();
    
            if (success) {
                console.log(":: Fit file converted to GPX: " + fitFile);
            } else {
                console.error("Error:", new TextDecoder().decode(stderr));
            }
        }
        catch {
            // console.error("Error:", "fit2gpx is not installed or cannot be found.");
        }
    }

    public smooth(geojson: any, windowSize = 3): any {
        function smoothCoords(coords: [number, number][]): [number, number][] {
            const smoothed: [number, number][] = [];
            for (let i = 0; i < coords.length; i++) {
                const start = Math.max(0, i - Math.floor(windowSize / 2));
                const end = Math.min(coords.length, i + Math.ceil(windowSize / 2));
                const slice = coords.slice(start, end);
                const avgLat = slice.reduce((sum, [lat]) => sum + lat, 0) / slice.length;
                const avgLon = slice.reduce((sum, [, lon]) => sum + lon, 0) / slice.length;
                smoothed.push([avgLat, avgLon]);
            }
            return smoothed;
        }

        function processGeometry(geometry: any): any {
            switch (geometry.type) {
                case "LineString":
                    return { ...geometry, coordinates: smoothCoords(geometry.coordinates) };
                case "MultiLineString":
                    return {
                    ...geometry,
                    coordinates: geometry.coordinates.map(smoothCoords),
                    };
                case "Polygon":
                    return {
                    ...geometry,
                    coordinates: geometry.coordinates.map(smoothCoords),
                    };
                case "MultiPolygon":
                    return {
                    ...geometry,
                    coordinates: geometry.coordinates.map((poly : any) =>
                        poly.map(smoothCoords)
                    ),
                    };
                default:
                    return geometry; // Leave Point, MultiPoint, etc. untouched
            }
        }

        return {
            ...geojson,
            features: geojson.features.map((feature: any) => ({
                ...feature,
                geometry: processGeometry(feature.geometry),
            })),
        };
    }

    public simplify(geojson: any, tolerance = 0.0001): any {
        return {
            ...geojson,
            features: geojson.features.map((feature: any) => ({
                ...feature,
                geometry: this.simplifyGeometry(feature.geometry, tolerance)
            }))
        };
    }

    public clean(geojson: any, thresholdKm = 80): any {
  function haversineKm([lon1, lat1]: number[], [lon2, lat2]: number[]): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function removeFarOutliers(coords: number[][]): number[][] {
    if (coords.length < 3) return coords;

    return coords.filter((point, i, arr) => {
      const distances = arr
        .filter((_, j) => j !== i)
        .map(other => haversineKm(point, other));
      const minDistance = Math.min(...distances);
      return minDistance <= thresholdKm;
    });
  }

  function cleanGeometry(geometry: any): any {
    switch (geometry.type) {
      case "LineString":
        return { ...geometry, coordinates: removeFarOutliers(geometry.coordinates) };
      case "MultiLineString":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((line: any) => removeFarOutliers(line))
        };
      case "Polygon":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((ring: any) => removeFarOutliers(ring))
        };
      case "MultiPolygon":
        return {
          ...geometry,
          coordinates: geometry.coordinates.map((poly: any) =>
            poly.map((ring: any) => removeFarOutliers(ring))
          )
        };
      default:
        return geometry;
    }
  }

  return {
    ...geojson,
    features: geojson.features.map((feature: any) => ({
      ...feature,
      geometry: cleanGeometry(feature.geometry)
    }))
  };
}


}