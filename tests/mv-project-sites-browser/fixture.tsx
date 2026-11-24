import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "../../src/components/ui/toaster";
import {
  MvProjectSitesEditor,
  type MvProjectSitesEditorHandle,
  type MvProjectSitesEditorState,
} from "../../src/components/workspace/workspace-sections/machine-valuation/mv-project-sites-editor";
import type { MvProject } from "../../src/components/workspace/workspace-sections/machine-valuation/types";

const project = (window as unknown as { __PROJECT__: MvProject }).__PROJECT__;

function Fixture() {
  const editorRef = useRef<MvProjectSitesEditorHandle | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [state, setState] = useState<MvProjectSitesEditorState | null>(null);
  const [flushed, setFlushed] = useState("");
  const [listCopy, setListCopy] = useState<Partial<MvProject>>({});

  return (
    <main className="mx-auto min-h-screen max-w-4xl bg-white p-4" dir="rtl" ref={setHost}>
      <MvProjectSitesEditor
        ref={editorRef}
        project={project}
        pickerPopoverHost={host}
        onProjectChange={(patch) => setListCopy((current) => ({ ...current, ...patch }))}
        onStateChange={setState}
      />
      <button type="button" onClick={async () => setFlushed(String(await editorRef.current?.flush()))}>
        flush
      </button>
      <output data-testid="status">{state?.status ?? ""}</output>
      <output data-testid="pending">{state?.pendingUploads ?? 0}</output>
      <output data-testid="flushed">{flushed}</output>
      <output data-testid="list-files">{listCopy.inspectorFiles?.length ?? ""}</output>
      <Toaster />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
