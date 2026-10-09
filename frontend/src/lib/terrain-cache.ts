import type { FeatureCollection } from "geojson";

export interface TerrainAnalysisConfig {
    danger_percentile?: number;
    safe_percentile?: number;
    minimum_feature_width_m?: number;
    minimum_hotspot_area_m2?: number;
    dataset_version?: string;
}

export interface CachedTerrainEntry {
    cacheKey: string;
    regionId: string;
    datasetVersion: string;
    configFingerprint: string;
    geojson: FeatureCollection;
    createdAt: number;
    lastAccessedAt: number;
}

const DB_NAME = "FloodSightTerrainDB";
const DB_VERSION = 1;
const STORE_NAME = "region_features";
const MAX_CACHE_ENTRIES = 300;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

class TerrainCacheManager {
    private dbPromise: Promise<IDBDatabase | null> | null = null;
    private l1Cache = new Map<string, CachedTerrainEntry>();
    private inFlightRequests = new Map<string, Promise<FeatureCollection | null>>();

    constructor() {
        if (typeof window !== "undefined") {
            this.initDB();
        }
    }

    public getCacheKey(regionId: string, config?: TerrainAnalysisConfig): string {
        const normalizedId = regionId.trim().toLowerCase();
        const dangerP = config?.danger_percentile ?? 33.0;
        const safeP = config?.safe_percentile ?? 67.0;
        const minW = config?.minimum_feature_width_m ?? 20.0;
        const minA = config?.minimum_hotspot_area_m2 ?? 400.0;
        const version = config?.dataset_version ?? "v2.2-merit-hydro";
        return `${version}:${normalizedId}:${dangerP}_${safeP}:${minW}_${minA}`;
    }

    private initDB(): Promise<IDBDatabase | null> {
        if (this.dbPromise) return this.dbPromise;
        if (typeof window === "undefined" || !("indexedDB" in window)) {
            this.dbPromise = Promise.resolve(null);
            return this.dbPromise;
        }

        this.dbPromise = new Promise(resolve => {
            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);
                request.onupgradeneeded = event => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains(STORE_NAME)) {
                        const store = db.createObjectStore(STORE_NAME, { keyPath: "cacheKey" });
                        store.createIndex("regionId", "regionId", { unique: false });
                        store.createIndex("lastAccessedAt", "lastAccessedAt", { unique: false });
                    }
                };
                request.onsuccess = event => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    resolve(db);
                };
                request.onerror = () => {
                    console.warn("IndexedDB initialization failed; using in-memory terrain cache fallback.");
                    resolve(null);
                };
            } catch (_) {
                resolve(null);
            }
        });
        return this.dbPromise;
    }

    public async getRegion(regionId: string, config?: TerrainAnalysisConfig): Promise<FeatureCollection | null> {
        const cacheKey = this.getCacheKey(regionId, config);
        const now = Date.now();

        // 1. Check L1 Memory Cache (Instant 0ms)
        const memoryEntry = this.l1Cache.get(cacheKey);
        if (memoryEntry) {
            if (now - memoryEntry.createdAt > CACHE_TTL_MS) {
                this.l1Cache.delete(cacheKey);
            } else {
                memoryEntry.lastAccessedAt = now;
                return memoryEntry.geojson;
            }
        }

        // 2. Check IndexedDB Persistent Storage
        const db = await this.initDB();
        if (!db) return null;

        return new Promise(resolve => {
            try {
                const tx = db.transaction(STORE_NAME, "readwrite");
                const store = tx.objectStore(STORE_NAME);
                const request = store.get(cacheKey);

                request.onsuccess = () => {
                    const entry: CachedTerrainEntry | undefined = request.result;
                    if (!entry) {
                        resolve(null);
                        return;
                    }

                    if (now - entry.createdAt > CACHE_TTL_MS) {
                        store.delete(cacheKey);
                        resolve(null);
                        return;
                    }

                    entry.lastAccessedAt = now;
                    store.put(entry); // update timestamp
                    this.l1Cache.set(cacheKey, entry);
                    resolve(entry.geojson);
                };
                request.onerror = () => resolve(null);
            } catch (_) {
                resolve(null);
            }
        });
    }

    public async getRegionsSyncOrCached(
        regionIds: string[],
        config?: TerrainAnalysisConfig,
    ): Promise<{ cached: Map<string, FeatureCollection>; missing: string[] }> {
        const cachedMap = new Map<string, FeatureCollection>();
        const missing: string[] = [];

        await Promise.all(
            regionIds.map(async id => {
                const geojson = await this.getRegion(id, config);
                if (geojson) {
                    cachedMap.set(id, geojson);
                } else {
                    missing.push(id);
                }
            }),
        );

        return { cached: cachedMap, missing };
    }

    public async setRegion(
        regionId: string,
        geojson: FeatureCollection,
        config?: TerrainAnalysisConfig,
    ): Promise<void> {
        const cacheKey = this.getCacheKey(regionId, config);
        const now = Date.now();
        const entry: CachedTerrainEntry = {
            cacheKey,
            regionId: regionId.trim().toLowerCase(),
            datasetVersion: config?.dataset_version ?? "v1.0-hydrosheds",
            configFingerprint: `${config?.danger_percentile ?? 33}_${config?.safe_percentile ?? 67}`,
            geojson,
            createdAt: now,
            lastAccessedAt: now,
        };

        // Populate L1 Memory
        this.l1Cache.set(cacheKey, entry);

        // Populate IndexedDB
        const db = await this.initDB();
        if (!db) return;

        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.put(entry);

            // Trigger LRU Eviction check if necessary
            const countReq = store.count();
            countReq.onsuccess = () => {
                if (countReq.result > MAX_CACHE_ENTRIES) {
                    this.evictOldestEntries(db);
                }
            };
        } catch (err) {
            console.warn("Failed to write terrain cache to IndexedDB", err);
        }
    }

    private evictOldestEntries(db: IDBDatabase): void {
        try {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const index = store.index("lastAccessedAt");
            const request = index.openCursor(null, "next"); // oldest first

            let evicted = 0;
            request.onsuccess = event => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && evicted < 50) {
                    this.l1Cache.delete(cursor.value.cacheKey);
                    cursor.delete();
                    evicted++;
                    cursor.continue();
                }
            };
        } catch (_) {
            // Eviction fail ignored
        }
    }

    public async fetchAndCacheRegion(
        apiBaseUrl: string,
        regionId: string,
        config?: TerrainAnalysisConfig,
        signal?: AbortSignal,
    ): Promise<FeatureCollection | null> {
        const cacheKey = this.getCacheKey(regionId, config);

        // 1. Check existing cache
        const existing = await this.getRegion(regionId, config);
        if (existing) {
            return existing;
        }

        // 2. In-flight request deduplication
        if (this.inFlightRequests.has(cacheKey)) {
            return this.inFlightRequests.get(cacheKey)!;
        }

        // 3. Initiate single network request
        const fetchPromise = (async (): Promise<FeatureCollection | null> => {
            try {
                const params = new URLSearchParams({ region_id: regionId });
                if (config?.minimum_feature_width_m) params.set("minimum_feature_width_m", config.minimum_feature_width_m.toString());
                if (config?.minimum_hotspot_area_m2) params.set("minimum_hotspot_area_m2", config.minimum_hotspot_area_m2.toString());
                if (config?.danger_percentile) params.set("danger_percentile", config.danger_percentile.toString());
                if (config?.safe_percentile) params.set("safe_percentile", config.safe_percentile.toString());

                const cleanBaseUrl = apiBaseUrl.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
                const res = await fetch(`${cleanBaseUrl}/api/v1/terrain/elevation-safety?${params}`, {
                    signal,
                });
                if (!res.ok) return null;
                const data = await res.json();
                if (data && data.type === "FeatureCollection" && Array.isArray(data.features)) {
                    await this.setRegion(regionId, data, config);
                    return data;
                }
            } catch (error) {
                if (signal?.aborted) return null;
                console.error(`Error fetching region ${regionId}:`, error);
            } finally {
                this.inFlightRequests.delete(cacheKey);
            }
            return null;
        })();

        this.inFlightRequests.set(cacheKey, fetchPromise);
        return fetchPromise;
    }

    public clearCache(): void {
        this.l1Cache.clear();
        this.inFlightRequests.clear();
        if (this.dbPromise) {
            this.dbPromise.then(db => {
                if (!db) return;
                try {
                    const tx = db.transaction(STORE_NAME, "readwrite");
                    tx.objectStore(STORE_NAME).clear();
                } catch (_) {}
            });
        }
    }
}

export const terrainCache = new TerrainCacheManager();
