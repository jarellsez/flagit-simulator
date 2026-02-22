export default function StartScreen({ setScreen }) {

  return (
    <div className="detector-card">

      <div className="detector-header">
        <h2>FlagIt</h2>
      </div>

      <button
        className="primary-button"
        onClick={() => setScreen("permissions")}
      >
        Start Fishing for Phishes
      </button>

      <div className="detector-visual">
        <p>Scanning Gmail, Teams, Telegram</p>
      </div>

      <a className="detector-link">Go to Website</a>

    </div>
  );
}