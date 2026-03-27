import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";

export interface RegistryEntry {
  readonly name: string;
  readonly displayName: string;
  readonly description: string;
  readonly specUrl: string;
  readonly baseUrl: string;
  readonly authType: "apiKey" | "bearer" | "basic" | "none";
  readonly authEnvVar?: string;
  readonly authHeaderName?: string;
  readonly tags: readonly string[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = join(__dirname, "..", "..", "registry");

let cachedEntries: readonly RegistryEntry[] | null = null;

export async function listRegistry(): Promise<readonly RegistryEntry[]> {
  if (cachedEntries) return cachedEntries;

  const entries: RegistryEntry[] = [];

  try {
    const files = await readdir(REGISTRY_DIR);
    for (const file of files.filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))) {
      const content = await readFile(join(REGISTRY_DIR, file), "utf-8");
      const parsed = parseYaml(content) as RegistryEntry;
      entries.push(parsed);
    }
  } catch {
    // Registry dir may not exist in dev
  }

  cachedEntries = entries;
  return entries;
}

export async function searchRegistry(query: string): Promise<readonly RegistryEntry[]> {
  const entries = await listRegistry();
  const q = query.toLowerCase();
  return entries.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.displayName.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.tags.some((t) => t.toLowerCase().includes(q)),
  );
}

export async function getRegistryEntry(name: string): Promise<RegistryEntry | undefined> {
  const entries = await listRegistry();
  return entries.find((e) => e.name === name);
}
