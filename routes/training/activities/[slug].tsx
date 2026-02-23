import { Head } from "$fresh/runtime.ts";
import { FreshContext, PageProps, Handlers } from "$fresh/src/server/types.ts";
import { DOMParser } from "npm:xmldom";
import { StravaDataService } from "../../../packages/strava.data.service/index.ts";
import { fileExists } from "../../../packages/strava.export-data-reader/helpers/fileExists.ts";
import { parseFitFile } from "../../../packages/strava.export-data-reader/helpers/parseFitFile.ts";
import { IActivity } from "../../../packages/strava.export-data-reader/interface/activity.ts";
import { IProfile } from "../../../packages/strava.export-data-reader/interface/profile.ts";

type NearbyRoute = {
    name: string;
    slug: string;
    distanceKm: number;
};

type Split = {
    label: string;
    distanceKm: number;
    splitSeconds: number;
    paceSecondsPerKm: number;
    elevationGain: number | null;
};

type TrackPoint = {
    lng: number;
    lat: number;
    elevation: number | null;
    timestampMs: number | null;
    heartRate: number | null;
    cadence: number | null;
    distanceKm: number;
    paceSecondsPerKm: number | null;
};

type Props = {
    profile: IProfile;
    activity: IActivity;
    splits: Split[];
    hrCadenceOverlaySvg: string | null;
    nearbyRoutes: NearbyRoute[];
    mapSourceJson: string;
    interactionPointsJson: string;
    hasCombinedSeries: boolean;
};

const asNumber = (value: unknown): number => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const toNullableNumber = (value: unknown): number | null => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const parseTimeMs = (value: unknown): number | null => {
    if (!value) return null;
    const date = new Date(String(value));
    const time = date.getTime();
    return Number.isFinite(time) ? time : null;
};

const haversineKm = (a: { lng: number; lat: number }, b: { lng: number; lat: number }) => {
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const deltaLat = ((b.lat - a.lat) * Math.PI) / 180;
    const deltaLng = ((b.lng - a.lng) * Math.PI) / 180;

    const sinLat = Math.sin(deltaLat / 2);
    const sinLng = Math.sin(deltaLng / 2);
    const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const secondsToClock = (totalSeconds: number) => {
    const rounded = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(rounded / 3600);
    const minutes = Math.floor((rounded % 3600) / 60);
    const seconds = rounded % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
};

const secondsToPace = (secondsPerKm: number) => {
    const rounded = Math.max(0, Math.floor(secondsPerKm));
    const minutes = Math.floor(rounded / 60);
    const seconds = rounded % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
};

const flattenCoordinates = (geometry: any): number[][] => {
    if (!geometry) return [];

    switch (geometry.type) {
        case "LineString":
            return geometry.coordinates ?? [];
        case "MultiLineString":
            return (geometry.coordinates ?? []).flat();
        case "Point":
            return geometry.coordinates ? [geometry.coordinates] : [];
        case "MultiPoint":
            return geometry.coordinates ?? [];
        case "Polygon":
            return (geometry.coordinates ?? []).flat();
        case "MultiPolygon":
            return (geometry.coordinates ?? []).flat(2);
        default:
            return [];
    }
};

const extractLineCoordinates = (geojson: any): number[][] => {
    const coordinates: number[][] = [];
    for (const feature of geojson?.features ?? []) {
        for (const coordinate of flattenCoordinates(feature?.geometry)) {
            if (!Array.isArray(coordinate) || coordinate.length < 2) continue;
            const lng = asNumber(coordinate[0]);
            const lat = asNumber(coordinate[1]);
            if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
            coordinates.push(coordinate);
        }
    }
    return coordinates;
};

const localName = (nodeName: string | null | undefined) => {
    if (!nodeName) return "";
    return nodeName.includes(":") ? nodeName.split(":").pop() ?? nodeName : nodeName;
};

const findChildText = (node: any, names: string[]) => {
    const target = new Set(names.map((n) => n.toLowerCase()));
    for (const child of Array.from(node?.childNodes ?? []) as any[]) {
        if (child?.nodeType !== 1) continue;
        const name = localName(child.nodeName).toLowerCase();
        if (target.has(name)) {
            const value = child.textContent?.trim();
            if (value) return value;
        }
    }
    return null;
};

const findDescendantText = (node: any, names: string[]): string | null => {
    const target = new Set(names.map((n) => n.toLowerCase()));
    const stack = Array.from(node?.childNodes ?? []);
    while (stack.length > 0) {
        const current: any = stack.shift();
        if (!current || current.nodeType !== 1) continue;
        const name = localName(current.nodeName).toLowerCase();
        if (target.has(name)) {
            const value = current.textContent?.trim();
            if (value) return value;
        }
        for (const child of Array.from(current.childNodes ?? [])) {
            stack.push(child);
        }
    }
    return null;
};

const buildDistanceSeries = (rawPoints: Omit<TrackPoint, "distanceKm" | "paceSecondsPerKm">[]): TrackPoint[] => {
    if (rawPoints.length === 0) return [];
    const points: TrackPoint[] = [];
    let distanceKm = 0;

    for (let i = 0; i < rawPoints.length; i++) {
        if (i > 0) {
            distanceKm += haversineKm(rawPoints[i - 1], rawPoints[i]);
        }
        points.push({
            ...rawPoints[i],
            distanceKm,
            paceSecondsPerKm: null,
        });
    }

    return points;
};

const withPaceSeries = (points: TrackPoint[]): TrackPoint[] => {
    if (points.length < 2) return points;

    const paced = points.map((point) => ({ ...point }));
    for (let i = 1; i < paced.length; i++) {
        const prev = paced[i - 1];
        const curr = paced[i];
        if (prev.timestampMs == null || curr.timestampMs == null) continue;

        const deltaTimeSeconds = (curr.timestampMs - prev.timestampMs) / 1000;
        const deltaDistance = curr.distanceKm - prev.distanceKm;
        if (deltaTimeSeconds <= 0 || deltaDistance <= 0.005) continue;

        const pace = deltaTimeSeconds / deltaDistance;
        if (Number.isFinite(pace) && pace > 60 && pace < 1200) {
            curr.paceSecondsPerKm = pace;
        }
    }

    for (let i = 0; i < paced.length; i++) {
        const values: number[] = [];
        for (let j = Math.max(0, i - 3); j <= Math.min(paced.length - 1, i + 3); j++) {
            const value = paced[j].paceSecondsPerKm;
            if (value != null) values.push(value);
        }
        if (values.length > 0) {
            paced[i].paceSecondsPerKm = values.reduce((sum, value) => sum + value, 0) / values.length;
        }
    }

    return paced;
};

const parseGpxTrackPoints = async (path: string): Promise<TrackPoint[]> => {
    const text = await Deno.readTextFile(path);
    const xml = new DOMParser().parseFromString(text, "text/xml");
    const trkpts = Array.from(xml.getElementsByTagName("trkpt"));
    const points: Omit<TrackPoint, "distanceKm" | "paceSecondsPerKm">[] = [];

    for (const node of trkpts as any[]) {
        const lat = toNullableNumber(node.getAttribute("lat"));
        const lng = toNullableNumber(node.getAttribute("lon"));
        if (lat == null || lng == null) continue;

        const ele = toNullableNumber(findChildText(node, ["ele"]));
        const timestampMs = parseTimeMs(findChildText(node, ["time"]));
        const heartRate = toNullableNumber(findDescendantText(node, ["hr", "heartrate"]));
        const cadence = toNullableNumber(findDescendantText(node, ["cad", "cadence"]));

        points.push({
            lng,
            lat,
            elevation: ele,
            timestampMs,
            heartRate,
            cadence,
        });
    }

    return buildDistanceSeries(points);
};

const semicircleToDegrees = (value: number) => value * (180 / 2 ** 31);

const normalizeCoordinate = (value: number, isLatitude: boolean): number | null => {
    if (!Number.isFinite(value)) return null;
    const max = isLatitude ? 90 : 180;

    if (Math.abs(value) <= max) return value;

    const converted = semicircleToDegrees(value);
    if (Math.abs(converted) <= max) return converted;

    return null;
};

const collectFitRecords = (fitData: any): any[] => {
    const topLevelRecords = Array.isArray(fitData?.records) ? fitData.records : [];
    const nestedSessionRecords = Array.isArray(fitData?.sessions)
        ? fitData.sessions.flatMap((session: any) => Array.isArray(session?.records) ? session.records : [])
        : [];
    const nestedActivitySessionRecords = Array.isArray(fitData?.activity?.sessions)
        ? fitData.activity.sessions.flatMap((session: any) => Array.isArray(session?.records) ? session.records : [])
        : [];
    const nestedLapRecords = Array.isArray(fitData?.activity?.sessions)
        ? fitData.activity.sessions.flatMap((session: any) =>
            Array.isArray(session?.laps)
                ? session.laps.flatMap((lap: any) => Array.isArray(lap?.records) ? lap.records : [])
                : []
        )
        : [];

    return [
        ...topLevelRecords,
        ...nestedSessionRecords,
        ...nestedActivitySessionRecords,
        ...nestedLapRecords,
    ];
};

const parseFitTrackPoints = async (path: string): Promise<TrackPoint[]> => {
    const fitData = await Deno.readFile(path);
    const parsed = await parseFitFile(fitData);
    const records = collectFitRecords(parsed);

    const points: Omit<TrackPoint, "distanceKm" | "paceSecondsPerKm">[] = [];

    for (const record of records) {
        const lat = normalizeCoordinate(asNumber(record?.position_lat), true);
        const lng = normalizeCoordinate(asNumber(record?.position_long), false);
        if (lat == null || lng == null) continue;

        const elevation = toNullableNumber(record?.enhanced_altitude ?? record?.altitude);
        const timestampMs = parseTimeMs(record?.timestamp ?? record?.timestamp_ms ?? record?.time);
        const heartRate = toNullableNumber(record?.heart_rate);
        const cadence = toNullableNumber(record?.cadence ?? record?.enhanced_cadence);

        points.push({
            lng,
            lat,
            elevation,
            timestampMs,
            heartRate,
            cadence,
        });
    }

    return buildDistanceSeries(points);
};

const loadTrackPoints = async (folder: string, activityId: string): Promise<TrackPoint[]> => {
    const gpxPath = `./data/${folder}/activities/${activityId}.gpx`;
    if (await fileExists(gpxPath)) {
        return withPaceSeries(await parseGpxTrackPoints(gpxPath));
    }

    const fitPath = `./data/${folder}/activities/${activityId}.fit`;
    if (await fileExists(fitPath)) {
        try {
            return withPaceSeries(await parseFitTrackPoints(fitPath));
        } catch (error) {
            console.warn(`Failed to parse FIT track points for ${activityId}`, error);
        }
    }

    return [];
};

const interpolateAtDistance = (a: TrackPoint, b: TrackPoint, targetDistance: number) => {
    const segment = b.distanceKm - a.distanceKm;
    if (segment <= 0) {
        return {
            timestampMs: a.timestampMs,
            elevation: a.elevation,
        };
    }

    const ratio = Math.min(1, Math.max(0, (targetDistance - a.distanceKm) / segment));

    const timestampMs =
        a.timestampMs != null && b.timestampMs != null
            ? a.timestampMs + (b.timestampMs - a.timestampMs) * ratio
            : null;

    const elevation =
        a.elevation != null && b.elevation != null
            ? a.elevation + (b.elevation - a.elevation) * ratio
            : null;

    return { timestampMs, elevation };
};

const buildRealSplits = (points: TrackPoint[]): Split[] => {
    if (points.length < 2) return [];
    const firstTime = points.find((point) => point.timestampMs != null)?.timestampMs ?? null;
    const totalDistance = points[points.length - 1]?.distanceKm ?? 0;
    if (!firstTime || totalDistance <= 0) return [];

    const splits: Split[] = [];
    let previousDistance = 0;
    let previousTime = firstTime;
    let previousElevation: number | null = points[0]?.elevation ?? null;

    const targets: number[] = [];
    for (let t = 1; t <= Math.floor(totalDistance); t++) {
        targets.push(t);
    }
    if (totalDistance - Math.floor(totalDistance) > 0.05) {
        targets.push(totalDistance);
    }

    for (const target of targets) {
        const idx = points.findIndex((point) => point.distanceKm >= target);
        if (idx <= 0) continue;

        const left = points[idx - 1];
        const right = points[idx];
        const interpolated = interpolateAtDistance(left, right, target);
        if (interpolated.timestampMs == null) continue;

        const splitDistance = target - previousDistance;
        const splitSeconds = (interpolated.timestampMs - previousTime) / 1000;
        if (splitDistance <= 0 || splitSeconds <= 0) continue;

        let elevationGain: number | null = null;
        if (previousElevation != null && interpolated.elevation != null) {
            elevationGain = Math.max(0, interpolated.elevation - previousElevation);
        }

        const label = Math.abs(splitDistance - 1) < 0.001
            ? `Km ${Math.round(target)}`
            : `Final ${splitDistance.toFixed(2)} km`;

        splits.push({
            label,
            distanceKm: splitDistance,
            splitSeconds,
            paceSecondsPerKm: splitSeconds / splitDistance,
            elevationGain,
        });

        previousDistance = target;
        previousTime = interpolated.timestampMs;
        previousElevation = interpolated.elevation;
    }

    return splits;
};

const buildHrCadenceOverlaySvg = (points: TrackPoint[]): string | null => {
    const timed = points.filter((point) => point.timestampMs != null) as (TrackPoint & { timestampMs: number })[];
    if (timed.length < 2) return null;

    const start = timed[0].timestampMs;
    const end = timed[timed.length - 1].timestampMs;
    const duration = Math.max(1, end - start);

    const hr = timed.filter((point) => point.heartRate != null) as (TrackPoint & { timestampMs: number; heartRate: number })[];
    const cad = timed.filter((point) => point.cadence != null) as (TrackPoint & { timestampMs: number; cadence: number })[];
    if (hr.length < 2 && cad.length < 2) return null;

    const width = 680;
    const height = 180;
    const chartX = 24;
    const chartY = 16;
    const chartW = width - 48;
    const chartH = height - 40;

    const hrMin = hr.length ? Math.min(...hr.map((point) => point.heartRate)) : 0;
    const hrMax = hr.length ? Math.max(...hr.map((point) => point.heartRate)) : 1;
    const cadMin = cad.length ? Math.min(...cad.map((point) => point.cadence)) : 0;
    const cadMax = cad.length ? Math.max(...cad.map((point) => point.cadence)) : 1;

    const hrSpread = Math.max(1, hrMax - hrMin);
    const cadSpread = Math.max(1, cadMax - cadMin);

    const hrLine = hr.map((point) => {
        const x = chartX + ((point.timestampMs - start) / duration) * chartW;
        const y = chartY + chartH - ((point.heartRate - hrMin) / hrSpread) * chartH;
        return `${x},${y}`;
    }).join(" ");

    const cadLine = cad.map((point) => {
        const x = chartX + ((point.timestampMs - start) / duration) * chartW;
        const y = chartY + chartH - ((point.cadence - cadMin) / cadSpread) * chartH;
        return `${x},${y}`;
    }).join(" ");

    return `
<svg viewBox="0 0 ${width} ${height}" class="metric-chart-svg" role="img" aria-label="Heart rate and cadence over time">
  <rect x="${chartX}" y="${chartY}" width="${chartW}" height="${chartH}" fill="#f7f7fa" stroke="#dfdfe8" />
  ${hr.length >= 2 ? `<polyline fill="none" stroke="#d1495b" stroke-width="2" points="${hrLine}" />` : ""}
  ${cad.length >= 2 ? `<polyline fill="none" stroke="#2f81c7" stroke-width="2" points="${cadLine}" />` : ""}
  <text x="${chartX + 4}" y="${chartY + 14}" fill="#d1495b" font-size="11">HR</text>
  <text x="${chartX + 30}" y="${chartY + 14}" fill="#2f81c7" font-size="11">Cadence</text>
  <text x="${chartX}" y="${height - 8}" fill="#565666" font-size="11">Time</text>
</svg>`;
};

const routeSlug = (filename: string) =>
    filename.replace("routes/", "").replace(".gpx", "").replaceAll("\\", "/");

const samplePoints = <T,>(points: T[], max = 160): T[] => {
    if (points.length <= max) return points;
    const step = Math.ceil(points.length / max);
    const sampled: T[] = [];
    for (let i = 0; i < points.length; i += step) sampled.push(points[i]);
    return sampled;
};

const minimumPathDistanceKm = (a: number[][], b: number[][]) => {
    if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
    const aSample = samplePoints(a);
    const bSample = samplePoints(b);

    let min = Number.POSITIVE_INFINITY;
    for (const p1 of aSample) {
        for (const p2 of bSample) {
            const dist = haversineKm(
                { lng: asNumber(p1[0]), lat: asNumber(p1[1]) },
                { lng: asNumber(p2[0]), lat: asNumber(p2[1]) },
            );
            if (dist < min) min = dist;
        }
    }
    return min;
};

const findNearbyRoutes = async (
    strava: StravaDataService,
    activityCoordinates: number[][],
): Promise<NearbyRoute[]> => {
    if (activityCoordinates.length === 0) return [];

    const routes = await strava.routes.list();
    const matches: NearbyRoute[] = [];

    for (const route of routes.slice(0, 300)) {
        try {
            const routeGeoJson = JSON.parse(await strava.routes.getGeoJson(route.filename));
            const routeCoordinates = extractLineCoordinates(routeGeoJson);
            if (routeCoordinates.length === 0) continue;

            const distanceKm = minimumPathDistanceKm(activityCoordinates, routeCoordinates);
            if (!Number.isFinite(distanceKm) || distanceKm > 8) continue;

            matches.push({
                name: route.name,
                slug: routeSlug(route.filename),
                distanceKm,
            });
        } catch {
            // Ignore a single bad route file.
        }
    }

    return matches.sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 8);
};

const compactTrackPoints = (points: TrackPoint[], maxPoints = 20000) => {
    const source = points.length > maxPoints ? samplePoints(points, maxPoints) : points;
    return source.map((point, index) => ({
        index,
        lng: point.lng,
        lat: point.lat,
        elevation: point.elevation,
        paceSecondsPerKm: point.paceSecondsPerKm,
        distanceKm: point.distanceKm,
    }));
};

export const handler: Handlers<Props> = {
    async GET(_req: Request, ctx: FreshContext) {
        const folder = (ctx.state?.data as any)?.uid ?? "export";
        const strava = new StravaDataService(folder);

        const { activity, geoJson } = await strava.activities.get(ctx.params.slug);
        const profile = await strava.profile.get();

        const geojson = JSON.parse(geoJson);
        const coordinates = extractLineCoordinates(geojson);
        const trackPoints = await loadTrackPoints(folder, ctx.params.slug);

        const splits = buildRealSplits(trackPoints);
        const interactionPoints = compactTrackPoints(trackPoints.length > 0 ? trackPoints : buildDistanceSeries(
            coordinates.map((coordinate) => ({
                lng: asNumber(coordinate[0]),
                lat: asNumber(coordinate[1]),
                elevation: toNullableNumber(coordinate[2]),
                timestampMs: null,
                heartRate: null,
                cadence: null,
            })),
        ));

        return ctx.render({
            profile,
            activity,
            splits,
            hrCadenceOverlaySvg: buildHrCadenceOverlaySvg(trackPoints),
            nearbyRoutes: await findNearbyRoutes(strava, coordinates),
            mapSourceJson: JSON.stringify(geojson),
            interactionPointsJson: JSON.stringify(interactionPoints),
            hasCombinedSeries: interactionPoints.filter((point) => point.elevation != null || point.paceSecondsPerKm != null).length > 1,
        });
    },
};

const UnitDisplay = (
    { value, unit, description }: { value: string; unit: string; description: string },
) => <div class="unit-display">
    <span class="value">{value}</span>
    <span class="unit">{unit}</span>
    <span class="description">{description}</span>
</div>;

export const Activity = ({ data }: PageProps<Props>) => {
    const movingSeconds = asNumber(data.activity.moving_time || data.activity.elapsed_time);
    const distanceKm = Math.max(asNumber(data.activity.distance), 0.01);
    const pace = secondsToPace(movingSeconds / distanceKm);

    const interactionScript = `
(() => {
  const source = ${data.mapSourceJson};
  const points = ${data.interactionPointsJson};
  const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: points.length ? [points[0].lng, points[0].lat] : [-2.6276908, 53.9690089],
    zoom: 8
  });
  map.addControl(new maplibregl.NavigationControl());

  const elevationWrap = document.getElementById("elevation-chart-wrap");
  const paceWrap = document.getElementById("pace-chart-wrap");
  const chartEmpty = document.getElementById("elevation-chart-empty");
  const elevationSvg = document.getElementById("elevation-chart-svg");
  const paceSvg = document.getElementById("pace-chart-svg");
  const elevationLine = document.getElementById("elevation-chart-line");
  const paceLine = document.getElementById("pace-chart-line");
  const elevationDot = document.getElementById("elevation-chart-dot");
  const paceDot = document.getElementById("pace-chart-dot");

  const viewBoxWidth = 900;
  const elevationViewBoxHeight = 210;
  const paceViewBoxHeight = 110;
  const margin = { left: 18, right: 14, top: 12, bottom: 20 };
  const chartW = viewBoxWidth - margin.left - margin.right;
  const elevationChartH = elevationViewBoxHeight - margin.top - margin.bottom;
  const paceChartH = paceViewBoxHeight - margin.top - margin.bottom;
  let elevationPoints = [];
  let pacePoints = [];
  let projectCache = [];
  let elevationRange = null;
  let paceRange = null;

  const getMaxDistance = () => {
    if (!points.length) return 1;
    return Math.max(0.001, points[points.length - 1].distanceKm || 0.001);
  };

  const updateChartAtIndex = (index) => {
    const point = points[index];
    if (!point) return;
    const maxDistance = getMaxDistance();
    const x = margin.left + (point.distanceKm / maxDistance) * chartW;

    if (elevationDot) {
      if (point.elevation != null && elevationRange) {
        const y = margin.top + elevationChartH - ((point.elevation - elevationRange.min) / elevationRange.spread) * elevationChartH;
        elevationDot.setAttribute("cx", String(x));
        elevationDot.setAttribute("cy", String(y));
        elevationDot.setAttribute("display", "block");
      } else {
        elevationDot.setAttribute("display", "none");
      }
    }

    if (paceDot) {
      if (point.paceSecondsPerKm != null && paceRange) {
        const y = margin.top + ((point.paceSecondsPerKm - paceRange.min) / paceRange.spread) * paceChartH;
        paceDot.setAttribute("cx", String(x));
        paceDot.setAttribute("cy", String(y));
        paceDot.setAttribute("display", "block");
      } else {
        paceDot.setAttribute("display", "none");
      }
    }
  };

  const hoverFeature = {
    type: "FeatureCollection",
    features: []
  };

  const updateMapAtIndex = (index) => {
    const point = points[index];
    if (!point) return;
    hoverFeature.features = [{
      type: "Feature",
      geometry: { type: "Point", coordinates: [point.lng, point.lat] },
      properties: {}
    }];
    const source = map.getSource("hover-point");
    if (source) source.setData(hoverFeature);
  };

  const setHoverIndex = (index) => {
    if (index < 0 || index >= points.length) return;
    updateMapAtIndex(index);
    updateChartAtIndex(index);
  };

  const rebuildProjectCache = () => {
    projectCache = points.map((point) => {
      const projected = map.project([point.lng, point.lat]);
      return { x: projected.x, y: projected.y };
    });
  };

  const nearestPointFromScreen = (x, y) => {
    if (!projectCache.length) return -1;
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < projectCache.length; i++) {
      const dx = projectCache[i].x - x;
      const dy = projectCache[i].y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDistance) {
        bestDistance = d2;
        bestIndex = i;
      }
    }
    return bestIndex;
  };

  const renderCharts = () => {
    if (!chartEmpty) return;
    elevationPoints = points.filter((p) => p.elevation != null);
    pacePoints = points.filter((p) => p.paceSecondsPerKm != null);
    if (elevationPoints.length < 2) {
      if (elevationWrap) elevationWrap.style.display = "none";
      elevationRange = null;
    } else if (elevationWrap) {
      elevationWrap.style.display = "block";
    }
    if (pacePoints.length < 2) {
      if (paceWrap) paceWrap.style.display = "none";
      paceRange = null;
    } else if (paceWrap) {
      paceWrap.style.display = "block";
    }

    if (elevationPoints.length < 2 && pacePoints.length < 2) {
      chartEmpty.style.display = "block";
      return;
    }

    chartEmpty.style.display = "none";

    const maxDistance = getMaxDistance();
    if (elevationLine) {
      if (elevationPoints.length > 1) {
        const elevations = elevationPoints.map((p) => p.elevation);
        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const spread = Math.max(1, maxElev - minElev);
        elevationRange = { min: minElev, spread };
        const pointsStr = elevationPoints.map((point) => {
          const x = margin.left + (point.distanceKm / maxDistance) * chartW;
          const y = margin.top + elevationChartH - ((point.elevation - minElev) / spread) * elevationChartH;
          return String(x) + "," + String(y);
        }).join(" ");
        elevationLine.setAttribute("points", pointsStr);
        elevationLine.setAttribute("display", "block");
      } else {
        elevationLine.setAttribute("display", "none");
      }
    }

    if (paceLine) {
      if (pacePoints.length > 1) {
        const paces = pacePoints.map((p) => p.paceSecondsPerKm);
        const minPace = Math.min(...paces);
        const maxPace = Math.max(...paces);
        const spread = Math.max(1, maxPace - minPace);
        paceRange = { min: minPace, spread };
        const pointsStr = pacePoints.map((point) => {
          const x = margin.left + (point.distanceKm / maxDistance) * chartW;
          const y = margin.top + ((point.paceSecondsPerKm - minPace) / spread) * paceChartH;
          return String(x) + "," + String(y);
        }).join(" ");
        paceLine.setAttribute("points", pointsStr);
        paceLine.setAttribute("display", "block");
      } else {
        paceLine.setAttribute("display", "none");
      }
    }
  };

  map.on("load", () => {
    map.addSource("my-geojson", { type: "geojson", data: source });
    map.addLayer({
      id: "geojson-layer",
      type: "line",
      source: "my-geojson",
      paint: { "line-color": "#2f81c7", "line-width": 2.5 }
    });

    map.addSource("hover-point", {
      type: "geojson",
      data: hoverFeature
    });

    map.addLayer({
      id: "hover-point-layer",
      type: "circle",
      source: "hover-point",
      paint: {
        "circle-radius": 6,
        "circle-color": "#ffffff",
        "circle-stroke-color": "#fc5200",
        "circle-stroke-width": 2.5
      }
    });

    const bounds = new maplibregl.LngLatBounds();
    source.features.forEach((feature) => {
      const coords = feature?.geometry?.coordinates ?? [];
      if (Array.isArray(coords[0])) {
        coords.forEach((coord) => {
          if (Array.isArray(coord[0])) {
            coord.forEach((sub) => bounds.extend(sub));
          } else {
            bounds.extend(coord);
          }
        });
      }
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 20 });

    rebuildProjectCache();
    renderCharts();
    if (points.length > 0) setHoverIndex(0);

    map.on("move", rebuildProjectCache);
    map.on("zoom", rebuildProjectCache);

    map.on("mousemove", "geojson-layer", (event) => {
      const i = nearestPointFromScreen(event.point.x, event.point.y);
      if (i >= 0) setHoverIndex(i);
    });
  });

  if (elevationSvg) {
    elevationSvg.addEventListener("mousemove", (event) => {
      if (!points.length || elevationPoints.length < 2) return;
      const rect = elevationSvg.getBoundingClientRect();
      const xPx = event.clientX - rect.left;
      const x = rect.width > 0 ? (xPx / rect.width) * viewBoxWidth : 0;
      const clamped = Math.max(margin.left, Math.min(viewBoxWidth - margin.right, x));
      const ratio = chartW > 0 ? (clamped - margin.left) / chartW : 0;
      const targetDistance = ratio * getMaxDistance();

      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs((points[i].distanceKm || 0) - targetDistance);
        if (d < bestDistance) {
          bestDistance = d;
          bestIndex = i;
        }
      }
      setHoverIndex(bestIndex);
    });
  }

  if (paceSvg) {
    paceSvg.addEventListener("mousemove", (event) => {
      if (!points.length || (elevationPoints.length < 2 && pacePoints.length < 2)) return;
      const rect = paceSvg.getBoundingClientRect();
      const xPx = event.clientX - rect.left;
      const x = rect.width > 0 ? (xPx / rect.width) * viewBoxWidth : 0;
      const clamped = Math.max(margin.left, Math.min(viewBoxWidth - margin.right, x));
      const ratio = chartW > 0 ? (clamped - margin.left) / chartW : 0;
      const targetDistance = ratio * getMaxDistance();

      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i < points.length; i++) {
        const d = Math.abs((points[i].distanceKm || 0) - targetDistance);
        if (d < bestDistance) {
          bestDistance = d;
          bestIndex = i;
        }
      }
      setHoverIndex(bestIndex);
    });
  }

  window.addEventListener("resize", () => {
    renderCharts();
    rebuildProjectCache();
  });
})();
`;

    return <>
        <Head>
            <title>{data.activity.activity_name}</title>
            <link href="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css" rel="stylesheet" />
            <script src="https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.js"></script>
        </Head>

        <details open>
            <summary>
                <h1>{data.profile.first_name} {data.profile.last_name} - {data.activity.activity_type}</h1>
            </summary>
            <section class="header">
                <time>{data.activity.activity_date}</time>
                <h2>{data.activity.activity_name}</h2>
                {data.activity.activity_description !== ""
                    ? <p>{data.activity.activity_description}</p>
                    : <button disabled>No description</button>}
            </section>
        </details>

        <section class="map">
            <div id="map" style="width: 100%; height: 24rem; display: inline-block;"></div>
            <div class="elevation-interactive" id="elevation-chart-wrap">
                <svg id="elevation-chart-svg" class="elevation-chart-svg" viewBox="0 0 900 210" preserveAspectRatio="none" role="img" aria-label="Elevation profile">
                    <rect x="18" y="12" width="868" height="178" fill="#f7f7fa" stroke="#dfdfe8" />
                    <polyline id="elevation-chart-line" fill="none" stroke="#2f81c7" stroke-width="2.5" points="" />
                    <circle id="elevation-chart-dot" r="5" fill="#ffffff" stroke="#fc5200" stroke-width="2.5" display="none" />
                    <text x="28" y="26" fill="#2f81c7" font-size="11">Elevation</text>
                </svg>
            </div>
            <div class="pace-interactive" id="pace-chart-wrap">
                <svg id="pace-chart-svg" class="pace-chart-svg" viewBox="0 0 900 110" preserveAspectRatio="none" role="img" aria-label="Pace profile">
                    <rect x="18" y="12" width="868" height="78" fill="#f7f7fa" stroke="#dfdfe8" />
                    <polyline id="pace-chart-line" fill="none" stroke="#fc5200" stroke-width="2.5" points="" />
                    <circle id="pace-chart-dot" r="4.5" fill="#ffffff" stroke="#2f81c7" stroke-width="2.2" display="none" />
                    <text x="28" y="26" fill="#fc5200" font-size="11">Pace</text>
                </svg>
            </div>
            <div id="elevation-chart-empty" class="metric-card" style={data.hasCombinedSeries ? "display:none" : "display:block"}>
                <h3>Elevation / Pace</h3>
                <p>No per-point elevation or pace data found in this activity file.</p>
            </div>
            <script dangerouslySetInnerHTML={{ __html: interactionScript }}></script>
        </section>

        <section class="activity-detail-grid">
            <article class="metric-card">
                <h3>Overview</h3>
                <div class="unit-row">
                    <UnitDisplay unit="km" description="Distance" value={data.activity.distance} />
                    <UnitDisplay unit="" description="Moving Time" value={secondsToClock(movingSeconds)} />
                    <UnitDisplay unit="/km" description="Average Pace" value={pace.replace(" /km", "")} />
                    <UnitDisplay unit="m" description="Elevation Gain" value={data.activity.elevation_gain} />
                </div>
                <p><strong>Max speed:</strong> {data.activity.max_speed} km/h</p>
                <p><strong>Average speed:</strong> {data.activity.average_speed} km/h</p>
                <p><strong>Calories:</strong> {data.activity.calories}</p>
            </article>

            <article class="metric-card">
                <h3>Splits</h3>
                {data.splits.length > 0 && <table class="compact-table">
                    <thead>
                        <tr>
                            <th>Split</th>
                            <th>Distance</th>
                            <th>Time</th>
                            <th>Pace</th>
                            <th>Elev Gain</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.splits.map((split) => <tr>
                            <td>{split.label}</td>
                            <td>{split.distanceKm.toFixed(2)} km</td>
                            <td>{secondsToClock(split.splitSeconds)}</td>
                            <td>{secondsToPace(split.paceSecondsPerKm)}</td>
                            <td>{split.elevationGain == null ? "-" : `${split.elevationGain.toFixed(0)} m`}</td>
                        </tr>)}
                    </tbody>
                </table>}
                {data.splits.length === 0 && <p>Split detail unavailable in this activity file.</p>}
            </article>
        </section>

        <section class="activity-detail-grid">
            <article class="metric-card">
                <h3>HR / Cadence Overlay</h3>
                {data.hrCadenceOverlaySvg && <div dangerouslySetInnerHTML={{ __html: data.hrCadenceOverlaySvg }} />}
                {!data.hrCadenceOverlaySvg && <p>Heart rate or cadence time-series not present in this file.</p>}
                <p>
                    HR avg/max: {data.activity.average_heart_rate || "-"} / {data.activity.max_heart_rate2 || data.activity.max_heart_rate || "-"} bpm
                    <br />
                    Cadence avg/max: {data.activity.average_cadence || "-"} / {data.activity.max_cadence || "-"} rpm
                </p>
            </article>
        </section>

        <section class="activity-detail-grid">
            <article class="metric-card">
                <h3>Nearby Routes</h3>
                {data.nearbyRoutes.length > 0 && <ul class="nearby-route-list">
                    {data.nearbyRoutes.map((route) => <li>
                        <a href={`/routes/${route.slug}`}>{route.name}</a>
                        <span>{route.distanceKm.toFixed(1)} km away</span>
                    </li>)}
                </ul>}
                {data.nearbyRoutes.length === 0 && <p>No nearby routes detected from route geometry.</p>}
            </article>
        </section>
    </>;
};

export default Activity;
