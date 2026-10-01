type SelectableImage = {
  _id: string;
  displayOnlyPicAssetImage?: boolean;
  downloadFileId?: string;
  sourceUrl?: string;
  picAssetSubProjectId?: string;
};

// Display rows use array indexes in their IDs. Selection must survive reordering
// without accidentally selecting whichever image later occupies that index.
export function assetBulkSelectionKey(file: SelectableImage): string {
  const fileId = file.displayOnlyPicAssetImage ? file.downloadFileId?.trim() : file._id;
  if (fileId) return `file:${fileId}`;
  let source = file.sourceUrl?.trim() ?? "";
  try {
    const url = new URL(source);
    source = `${url.origin}${url.pathname}`;
  } catch {
    // Preserve non-URL sources verbatim.
  }
  return JSON.stringify([file.picAssetSubProjectId, source || file._id]);
}

export function toggleAssetBulkSelection(
  current: ReadonlySet<string>,
  files: readonly SelectableImage[],
): Set<string> {
  const keys = files.map(assetBulkSelectionKey);
  const remove = keys.every((key) => current.has(key));
  const next = new Set(current);
  for (const key of keys) {
    if (remove) next.delete(key);
    else next.add(key);
  }
  return next;
}

export type BulkFolderNode = {
  path: string;
  isSynthetic?: boolean;
  folders: BulkFolderNode[];
};

// Virtual groups select their real children; a real folder selects itself,
// including empty folders. Media loading never controls folder selection.
export function bulkFolderTargets(node: BulkFolderNode): string[] {
  if (node.path !== "__pv_root__" && !node.isSynthetic) return [node.path];
  return node.folders.flatMap(bulkFolderTargets);
}

export function toggleBulkFolders(current: ReadonlySet<string>, node: BulkFolderNode): Set<string> {
  const ids = bulkFolderTargets(node);
  const remove = ids.every((id) => current.has(id));
  const next = new Set(current);
  for (const id of ids) {
    if (remove) next.delete(id);
    else next.add(id);
  }
  return next;
}

// Delete a selected parent once; its selected descendants are already included.
export function bulkFolderRoots<T extends BulkFolderNode>(
  nodes: readonly T[], selected: ReadonlySet<string>,
): T[] {
  return nodes.flatMap((node) => selected.has(node.path)
    ? [node]
    : bulkFolderRoots(node.folders as T[], selected));
}
