type Point = [number, number];
type Line = Point[];
type ProjectedPoint = [number, number];

const TILE_SIZE = 256;
const MAX_TILE_ZOOM = 19;
const DEFAULT_TILE_SERVER = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_ROUTE_COLOR = "#2f81c7";

export interface GenerateSvgOptions {
    width?: number;
    height?: number;
    padding?: number;
    stroke?: string;
    strokeWidth?: number;
    color?: string;
    colour?: string;
    lineThickness?: number;
    tilingServer?: string;
    tileServer?: string;
    tileZoom?: number;
    embedTiles?: boolean;
}

const extractLines = (geojson: any): Line[] => {
    const lines: Line[] = [];
    for (const feature of geojson?.features ?? []) {
        const geometry = feature?.geometry;
        if (!geometry?.coordinates) continue;

        switch (geometry.type) {
            case "Point":
                lines.push([geometry.coordinates]);
                break;
            case "MultiPoint":
                for (const point of geometry.coordinates) lines.push([point]);
                break;
            case "LineString":
                lines.push(geometry.coordinates);
                break;
            case "MultiLineString":
                for (const line of geometry.coordinates) lines.push(line);
                break;
            case "Polygon":
                for (const ring of geometry.coordinates) lines.push(ring);
                break;
            case "MultiPolygon":
                for (const polygon of geometry.coordinates) {
                    for (const ring of polygon) lines.push(ring);
                }
                break;
        }
    }

    return lines
        .map((line) => line
            .map((point: any) => [Number(point[0]), Number(point[1])] as Point)
            .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])))
        .filter((line) => line.length > 0);
};

const bytesToBase64 = (bytes: Uint8Array): string => {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
};

const fetchTileAsDataUri = async (url: string): Promise<string | null> => {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const contentType = response.headers.get("content-type") ?? "image/png";
        const data = new Uint8Array(await response.arrayBuffer());
        return `data:${contentType};base64,${bytesToBase64(data)}`;
    } catch {
        return null;
    }
};

export const generateSVG = async (
    geojson: any,
    options: GenerateSvgOptions = {},
): Promise<string | null> => {
    const width = options.width ?? 200;
    const height = options.height ?? 120;
    const padding = options.padding ?? 8;
    const stroke = options.color ?? options.colour ?? options.stroke ?? DEFAULT_ROUTE_COLOR;
    const strokeWidth = options.lineThickness ?? options.strokeWidth ?? 1.6;
    const tileServer = options.tilingServer ?? options.tileServer ?? DEFAULT_TILE_SERVER;
    const embedTiles = options.embedTiles ?? true;
    const useProjectedYAsDown = Boolean(tileServer);

    const lines = extractLines(geojson);
    const points = lines.flat();
    if (points.length === 0) return null;

    const drawableW = width - padding * 2;
    const drawableH = height - padding * 2;

    const projectLinear = (point: Point): ProjectedPoint => [point[0], point[1]];
    const projectMercator = (point: Point): ProjectedPoint => {
        const lon = Math.max(-180, Math.min(180, point[0]));
        const lat = Math.max(-85.05112878, Math.min(85.05112878, point[1]));
        const x = (lon + 180) / 360;
        const latRad = lat * Math.PI / 180;
        const y = (1 - Math.log(Math.tan(latRad) + (1 / Math.cos(latRad))) / Math.PI) / 2;
        return [x, y];
    };

    const projectedLines = lines.map((line) =>
        line.map(tileServer ? projectMercator : projectLinear)
    );
    const projectedPoints = projectedLines.flat();
    const xs = projectedPoints.map((point) => point[0]);
    const ys = projectedPoints.map((point) => point[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = Math.max(maxX - minX, 1e-9);
    const spanY = Math.max(maxY - minY, 1e-9);

    const scale = Math.min(drawableW / spanX, drawableH / spanY);
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;

    const pathData = projectedLines.map((line) => {
        const commands = line.map((point, index) => {
            const x = ((point[0] - minX) * scale + offsetX).toFixed(2);
            const y = (useProjectedYAsDown
                ? ((point[1] - minY) * scale + offsetY)
                : ((maxY - point[1]) * scale + offsetY))
                .toFixed(2);
            return `${index === 0 ? "M" : "L"}${x} ${y}`;
        });
        return commands.join(" ");
    }).join(" ");

    const escapeXml = (value: string): string =>
        value
            .replaceAll("&", "&amp;")
            .replaceAll("\"", "&quot;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;");

    let tileImages = "";
    if (tileServer) {
        const normalizedSpanX = spanX;
        const normalizedSpanY = spanY;
        const targetZoom = Math.log2(Math.min(
            drawableW / (TILE_SIZE * normalizedSpanX),
            drawableH / (TILE_SIZE * normalizedSpanY),
        ));
        const tileZoom = Math.max(
            0,
            Math.min(
                MAX_TILE_ZOOM,
                Number.isFinite(options.tileZoom) ? Math.trunc(options.tileZoom as number) : Math.round(targetZoom),
            ),
        );
        const tilesPerAxis = 2 ** tileZoom;
        const tileSizeNormalized = 1 / tilesPerAxis;
        const viewportMinX = minX + (0 - offsetX) / scale;
        const viewportMaxX = minX + (width - offsetX) / scale;
        const viewportMinY = minY + (0 - offsetY) / scale;
        const viewportMaxY = minY + (height - offsetY) / scale;

        const paddedMinX = viewportMinX - tileSizeNormalized;
        const paddedMaxX = viewportMaxX + tileSizeNormalized;
        const paddedMinY = viewportMinY - tileSizeNormalized;
        const paddedMaxY = viewportMaxY + tileSizeNormalized;

        const minTileX = Math.floor(paddedMinX * tilesPerAxis);
        const maxTileX = Math.ceil(paddedMaxX * tilesPerAxis) - 1;
        const minTileY = Math.floor(paddedMinY * tilesPerAxis);
        const maxTileY = Math.ceil(paddedMaxY * tilesPerAxis) - 1;

        const buildTileUrl = (x: number, y: number): string => {
            const wrappedX = ((x % tilesPerAxis) + tilesPerAxis) % tilesPerAxis;
            const clampedY = Math.max(0, Math.min(tilesPerAxis - 1, y));
            return tileServer
                .replaceAll("{z}", String(tileZoom))
                .replaceAll("{x}", String(wrappedX))
                .replaceAll("{y}", String(clampedY));
        };

        const images: string[] = [];
        for (let tileX = minTileX; tileX <= maxTileX; tileX++) {
            for (let tileY = minTileY; tileY <= maxTileY; tileY++) {
                const tileLeft = tileX * tileSizeNormalized;
                const tileTop = tileY * tileSizeNormalized;
                const x = ((tileLeft - minX) * scale + offsetX).toFixed(2);
                const y = ((tileTop - minY) * scale + offsetY).toFixed(2);
                const size = (tileSizeNormalized * scale).toFixed(2);
                const tileUrl = buildTileUrl(tileX, tileY);
                const tileHref = embedTiles
                    ? (await fetchTileAsDataUri(tileUrl)) ?? tileUrl
                    : tileUrl;
                const href = escapeXml(tileHref);
                images.push(`<image href="${href}" x="${x}" y="${y}" width="${size}" height="${size}" preserveAspectRatio="none"/>`);
            }
        }
        tileImages = images.join("");
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${tileImages}<path d="${pathData}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};

export default {
    generateSVG,
};
