/**
 * Boot — the kernel comes up, then the plugins are asked to appear.
 *
 * Order matters: document first (so a plugin's register() sees real geometry),
 * then autosave, then plugins. A plugin that throws disables itself and raises
 * a toast; the shell never goes white (SPEC.md §4.5).
 */
import {
  createSeedDocument,
  indexedDbAdapter,
  loadPlugins,
  mockExecutor,
  replaceDocument,
  startAutosave,
  type AutosaveHandle,
  type PluginHost,
  type StorageAdapter,
} from '@/kernel';
import { toast } from '@/components/ui/sonner';
import { flags } from './flags';
import { PLUGIN_LIST } from './plugins';

const LAST_DOC_KEY = 'maquette:lastDocumentId';

export interface BootResult {
  host: PluginHost;
  autosave: AutosaveHandle;
  documentId: string;
}

let booted: Promise<BootResult> | null = null;

async function loadOrSeed(adapter: StorageAdapter) {
  let lastId: string | null = null;
  try {
    lastId = localStorage.getItem(LAST_DOC_KEY);
  } catch {
    /* private mode: start fresh every time */
  }

  if (lastId) {
    try {
      const existing = await adapter.load(lastId);
      if (existing) return existing;
    } catch (err) {
      console.warn('[maquette] stored document could not be read; seeding a new one', err);
    }
  }

  const seeded = createSeedDocument();
  await adapter.save(seeded);
  return seeded;
}

export function boot(adapter: StorageAdapter = indexedDbAdapter): Promise<BootResult> {
  booted ??= (async (): Promise<BootResult> => {
    const doc = await loadOrSeed(adapter);
    replaceDocument(doc);
    try {
      localStorage.setItem(LAST_DOC_KEY, doc.id);
    } catch {
      /* ignore */
    }

    const autosave = startAutosave(adapter, {
      onError: (err) => console.error('[maquette] autosave failed', err),
    });

    const host = loadPlugins(PLUGIN_LIST, {
      flags,
      jobs: mockExecutor,
      onError: (plugin, err) => {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[maquette] plugin "${plugin.id}" failed to load`, err);
        toast.error(`Plugin “${plugin.name}” disabled`, { description: reason });
      },
    });

    return { host, autosave, documentId: doc.id };
  })();

  return booted;
}

/** Test seam: forget the memoised boot. */
export function __resetBootForTests(): void {
  booted = null;
}
