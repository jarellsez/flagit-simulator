import { useState } from "react";

export default function ScanningScreen({ setScreen }) {

  const [paused, setPaused] = useState(false);

  return (
    <div className="detector-card">

      <h3>
        Fishing for Phishes {paused ? "(Paused)" : "..."}
      </h3>

      <button
        onClick={() => setPaused(!paused)}
      >
        {paused ? "Resume" : "Pause"}
      </button>

      <button
        onClick={() => setScreen("analysis")}
      >
        Simulate Result
      </button>

    </div>
  );
}