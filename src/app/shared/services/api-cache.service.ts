import { Injectable } from '@angular/core';
import { StorageService } from './storage.service';

type ApiCacheConfig = {
  url: string;
  itemsPath?: string;
  labelField?: string;
  valueField?: string;
  saveStrategy?: string;
};

type CacheEntry = {
  timestamp: number;
  data: any;
};

@Injectable({
  providedIn: 'root',
})
export class ApiCacheService {
  private readonly STORAGE_KEY = 'form-builder-api-cache';
  private readonly TTL_MS = 30 * 60 * 1000; // 30 minutes
  private cache = new Map<string, CacheEntry>();

  constructor(private storageService: StorageService) {
    this.loadCache();
  }

  get(config: ApiCacheConfig): any | null {
    const key = this.computeKey(config);
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      this.persistCache();
      return null;
    }
    return entry.data;
  }

  set(config: ApiCacheConfig, data: any): void {
    const key = this.computeKey(config);
    this.cache.set(key, { data, timestamp: Date.now() });
    this.persistCache();
  }

  clear(config?: ApiCacheConfig): void {
    if (config) {
      const key = this.computeKey(config);
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
    this.persistCache();
  }

  private computeKey(config: ApiCacheConfig): string {
    const normalized = {
      url: config.url || '',
      itemsPath: config.itemsPath || '',
      labelField: config.labelField || '',
      valueField: config.valueField || '',
      saveStrategy: config.saveStrategy || 'value',
    };
    return JSON.stringify(normalized);
  }

  private loadCache() {
    const stored = this.storageService.getItem<Record<string, CacheEntry>>(
      this.STORAGE_KEY,
    );
    if (stored && typeof stored === 'object') {
      Object.entries(stored).forEach(([key, entry]) => {
        if (
          entry &&
          typeof entry.timestamp === 'number' &&
          entry.data !== undefined
        ) {
          this.cache.set(key, entry);
        }
      });
      this.pruneExpired();
    }
  }

  private persistCache() {
    const serialized: Record<string, CacheEntry> = {};
    this.cache.forEach((entry, key) => {
      serialized[key] = entry;
    });
    this.storageService.setItem(this.STORAGE_KEY, serialized);
  }

  private pruneExpired() {
    let changed = false;
    this.cache.forEach((entry, key) => {
      if (Date.now() - entry.timestamp > this.TTL_MS) {
        this.cache.delete(key);
        changed = true;
      }
    });
    if (changed) {
      this.persistCache();
    }
  }
}
