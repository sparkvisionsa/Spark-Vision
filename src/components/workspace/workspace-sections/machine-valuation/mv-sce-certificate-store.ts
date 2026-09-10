import {
  clientDocumentsStorageKey,
  emptyClientDocumentsStore,
  parseClientDocumentsStoreFromApi,
  type MvClientDocumentsStore,
} from "./mv-client-documents-store";

export type MvSceCertificateStore = MvClientDocumentsStore;

function certificateStorageKey(projectId: string) {
  return clientDocumentsStorageKey("sce-certificate:" + projectId);
}

export function emptySceCertificateStore(): MvSceCertificateStore {
  return emptyClientDocumentsStore();
}

export function readSceCertificateStore(projectId: string): MvSceCertificateStore {
  if (typeof window === "undefined") return emptySceCertificateStore();
  try {
    const key = certificateStorageKey(projectId);
    const raw = window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    return raw ? parseClientDocumentsStoreFromApi(JSON.parse(raw)) ?? emptySceCertificateStore() : emptySceCertificateStore();
  } catch {
    return emptySceCertificateStore();
  }
}

export function writeSceCertificateStore(projectId: string, store: MvSceCertificateStore): boolean {
  if (typeof window === "undefined") return true;
  const value: MvSceCertificateStore = {
    ...store,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  const raw = JSON.stringify(value);
  const key = certificateStorageKey(projectId);
  try {
    window.localStorage.setItem(key, raw);
    window.sessionStorage.setItem(key, raw);
    return true;
  } catch {
    try {
      window.sessionStorage.setItem(key, raw);
      return true;
    } catch {
      return false;
    }
  }
}
