import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppDatabaseState } from '../types/domain';
import { INITIAL_DATABASE_STATE } from '../data/seedData';

const STORAGE_KEY = 'lt_auto_os_db_v3_calendar';
const IDB_NAME = 'LTAutoOS_IndexedDB';
const IDB_STORE = 'app_state';

/**
 * IndexedDB Helper for Local-First Durability on Android / Desktop PWA
 */
async function saveToIndexedDB(state: AppDatabaseState): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(state, 'root');
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Repository Pattern Data Access Layer
 * Works out-of-the-box with LocalStorage + IndexedDB, and provides a ready-to-connect
 * Supabase (PostgreSQL) cloud sync adapter.
 */
export class LTAutoRepository {
  private supabaseClient: SupabaseClient | null = null;

  public loadState(): AppDatabaseState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.saveState(INITIAL_DATABASE_STATE);
        return INITIAL_DATABASE_STATE;
      }
      const parsed = JSON.parse(raw) as Partial<AppDatabaseState>;
      return {
        customers: parsed.customers ?? INITIAL_DATABASE_STATE.customers,
        vehicles: parsed.vehicles ?? INITIAL_DATABASE_STATE.vehicles,
        serviceCatalog: parsed.serviceCatalog ?? INITIAL_DATABASE_STATE.serviceCatalog,
        modifiersCatalog: parsed.modifiersCatalog ?? INITIAL_DATABASE_STATE.modifiersCatalog,
        workOrders: parsed.workOrders ?? INITIAL_DATABASE_STATE.workOrders,
        flipCars: parsed.flipCars ?? INITIAL_DATABASE_STATE.flipCars,
        settings: { ...INITIAL_DATABASE_STATE.settings, ...(parsed.settings ?? {}) },
      };
    } catch {
      return INITIAL_DATABASE_STATE;
    }
  }

  public saveState(state: AppDatabaseState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      void saveToIndexedDB(state);
    } catch (e) {
      console.error('Failed to persist state locally:', e);
    }
  }

  public resetToSeedData(): AppDatabaseState {
    this.saveState(INITIAL_DATABASE_STATE);
    return INITIAL_DATABASE_STATE;
  }

  public initSupabase(url?: string, anonKey?: string): SupabaseClient | null {
    if (!url || !anonKey) {
      this.supabaseClient = null;
      return null;
    }
    try {
      this.supabaseClient = createClient(url, anonKey);
      return this.supabaseClient;
    } catch {
      this.supabaseClient = null;
      return null;
    }
  }

  public async syncWithSupabase(state: AppDatabaseState): Promise<{ ok: boolean; message: string }> {
    const { supabaseUrl, supabaseAnonKey, enableSupabaseSync } = state.settings;
    if (!enableSupabaseSync || !supabaseUrl || !supabaseAnonKey) {
      return {
        ok: false,
        message: 'Supabase sync is disabled or missing credentials. Operating in Local-First mode.',
      };
    }

    const client = this.initSupabase(supabaseUrl, supabaseAnonKey);
    if (!client) {
      return { ok: false, message: 'Failed to initialize Supabase client.' };
    }

    try {
      const { error } = await client
        .from('lt_auto_snapshots')
        .upsert({
          id: 'livingston_hq',
          updated_at: new Date().toISOString(),
          payload: state,
        });

      if (error) {
        return { ok: false, message: `Supabase Error: ${error.message}` };
      }

      return { ok: true, message: 'Synced with Supabase PostgreSQL cloud successfully!' };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : 'Unknown network error during sync.',
      };
    }
  }
}

export const repository = new LTAutoRepository();
