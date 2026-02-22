import { useState } from "react";
import StartScreen from "../screens/StartScreen";
import PermissionsScreen from "../screens/PermissionsScreen";
import ScanningScreen from "../screens/ScanningScreen";
import AnalysisScreen from "../screens/AnalysisScreen";
import ReportSuccessScreen from "../screens/ReportSuccessScreen";

export default function DetectorContainer() {

  const [screen, setScreen] = useState("start");

  const renderScreen = () => {
    switch (screen) {
      case "permissions":
        return <PermissionsScreen setScreen={setScreen} />;

      case "scanning":
        return <ScanningScreen setScreen={setScreen} />;

      case "analysis":
        return <AnalysisScreen setScreen={setScreen} />;

      case "reported":
        return <ReportSuccessScreen setScreen={setScreen} />;

      default:
        return <StartScreen setScreen={setScreen} />;
    }
  };

  return (
    <div className="detector-container">
      {renderScreen()}
    </div>
  );
}
<DetectorContainer />
