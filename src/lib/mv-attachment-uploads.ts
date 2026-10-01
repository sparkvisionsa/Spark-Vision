import { enqueueUpload, uploadOwner, type UploadJob } from "./mv-background-uploads";

export async function enqueueAttachments(user: { id: string; companyId?: string | null }, projectId: string,
  label: string, files: File[], attachment: NonNullable<UploadJob["attachment"]>) {
  if (!files.length) return;
  return enqueueUpload({ owner: uploadOwner(user), projectId, parentId: "", folders: [], label, attachment,
    items: files.map(file => ({ file, name: file.name, path: file.webkitRelativePath || file.name })) });
}

type KnownIds = { sources: string[]; images: string[] };
const editBases = new WeakMap<object, KnownIds>();
export function attachmentKnownIds(store: unknown): KnownIds {
  if (store && typeof store === "object" && editBases.has(store)) return editBases.get(store)!;
  const value = store as { sources?: { id: string }[]; images?: { id: string }[] } | undefined;
  return { sources: value?.sources?.map(row => row.id) ?? [], images: value?.images?.map(row => row.id) ?? [] };
}

/** Retain the editor's actual baseline, including deletions across debounced edits. */
export function rememberAttachmentEdit(current: object, next: object) {
  const known = attachmentKnownIds(current);
  const rows = current as { sources: { id: string }[]; images: { id: string }[] };
  editBases.set(next, {
    sources: [...new Set([...known.sources, ...rows.sources.map(row => row.id)])],
    images: [...new Set([...known.images, ...rows.images.map(row => row.id)])],
  });
}

/** Capture entries synchronously while DataTransfer is readable; traverse every directory batch. */
export function readDroppedAttachmentFiles(transfer: DataTransfer): Promise<File[]> {
  const entries = Array.from(transfer.items).map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  const fallback = Array.from(transfer.files);
  const visit = async (entry: FileSystemEntry, path = ""): Promise<File[]> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject));
      if (path) Object.defineProperty(file, "webkitRelativePath", { value: `${path}${file.name}` });
      return [file];
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const result: File[] = [];
    while (true) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      if (!batch.length) break;
      for (const child of batch) result.push(...await visit(child, `${path}${entry.name}/`));
    }
    return result;
  };
  return entries.length ? Promise.all(entries.map(entry => visit(entry!))).then(groups => groups.flat()) : Promise.resolve(fallback);
}
