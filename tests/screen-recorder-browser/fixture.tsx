import { useState } from "react";
import { createRoot } from "react-dom/client";
import { useScreenRecorder } from "../../src/hooks/use-screen-recorder";

function Fixture() {
  const recorder = useScreenRecorder({ microphone: "off", systemAudio: true });
  const [conversationOpen, setConversationOpen] = useState(true);
  return <>
    {conversationOpen && <button onClick={() => setConversationOpen(false)}>Close conversation</button>}
    <button onClick={() => void recorder.start()}>Start</button>
    <button onClick={recorder.stop}>Stop</button>
    <button onClick={recorder.reset}>Reset</button>
    <output data-state>{recorder.state}</output>
    <output data-size>{recorder.blob?.size ?? 0}</output>
    <output data-error>{recorder.error}</output>
  </>;
}

createRoot(document.getElementById("root")!).render(<Fixture />);
