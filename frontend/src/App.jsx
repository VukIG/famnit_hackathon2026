import { useState } from "react";
import "./index.css";
import { MOCK_FORECAST, TIDE_CURVE } from "./data/mock";
import Background from "./components/Background/Background";
import Header from "./components/Header/Header";
import Hero from "./components/Hero/Hero";
import WindowChecker from "./components/WindowChecker/WindowChecker";
import ConditionsNow from "./components/ConditionsNow/ConditionsNow";
import TideCurve from "./components/TideCurve/TideCurve";
import DayStrip from "./components/DayStrip/DayStrip";
import DetailPanel from "./components/DetailPanel/DetailPanel";
import Footer from "./components/Footer/Footer";

export default function App() {
  const [selectedWin, setSelectedWin] = useState(null);
  const hero = MOCK_FORECAST.windows[0];

  const selected = selectedWin
    ? MOCK_FORECAST.windows.find((w) => w.id === selectedWin)
    : null;

  return (
    <>
      <Background />
      <div style={{ position: "relative", zIndex: 10 }}>
        <Header locationName={MOCK_FORECAST.locationName} />
        <Hero window={hero} />
        <WindowChecker />
        <ConditionsNow factors={hero.factors} />
        <TideCurve
          data={TIDE_CURVE}
          optimalStart={hero.startsAt}
          optimalEnd={hero.endsAt}
          conditions={hero.factors}
        />
        <DayStrip
          windows={MOCK_FORECAST.windows}
          selectedId={selectedWin}
          onSelect={(id) => setSelectedWin(selectedWin === id ? null : id)}
        />
        {selected && (
          <DetailPanel window={selected} onClose={() => setSelectedWin(null)} />
        )}
        <Footer
          generatedAt={MOCK_FORECAST.generatedAt}
          locationName={MOCK_FORECAST.locationName}
        />
      </div>
    </>
  );
}
