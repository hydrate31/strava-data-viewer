export type SavedView = {
  name: string;
  filters: Record<string, string>;
  createdAt: string;
};

export type SavedViewsFile = Record<string, SavedView[]>;

const pathFor = (folder: string) => `./data/${folder}/saved-views.json`;

export const readSavedViews = async (
  folder: string,
): Promise<SavedViewsFile> => {
  try {
    const text = await Deno.readTextFile(pathFor(folder));
    const json = JSON.parse(text);
    return json && typeof json === "object" ? json as SavedViewsFile : {};
  } catch {
    return {};
  }
};

export const listSavedViews = async (
  folder: string,
  key: string,
): Promise<SavedView[]> => {
  const json = await readSavedViews(folder);
  const list = json[key];
  return Array.isArray(list) ? list : [];
};

export const saveView = async (
  folder: string,
  key: string,
  name: string,
  filters: Record<string, string>,
) => {
  const trimmed = name.trim();
  if (!trimmed) return;

  const json = await readSavedViews(folder);
  const list = Array.isArray(json[key]) ? json[key] : [];

  const next = list.filter((entry) => entry.name !== trimmed);
  next.unshift({
    name: trimmed,
    filters,
    createdAt: new Date().toISOString(),
  });

  json[key] = next.slice(0, 25);
  await Deno.writeTextFile(pathFor(folder), JSON.stringify(json, null, 2));
};

export const deleteView = async (folder: string, key: string, name: string) => {
  const json = await readSavedViews(folder);
  const list = Array.isArray(json[key]) ? json[key] : [];
  json[key] = list.filter((entry) => entry.name !== name);
  await Deno.writeTextFile(pathFor(folder), JSON.stringify(json, null, 2));
};
