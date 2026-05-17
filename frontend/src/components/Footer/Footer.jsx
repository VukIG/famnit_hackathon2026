import "./Footer.css";

export default function Footer({ generatedAt, locationName }) {
  const timeStr = new Date(generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <footer className="footer">
      <span className="micro">Last updated {timeStr}</span>
      <span className="micro">Removing the guesswork from underwater viewing · {locationName}</span>
    </footer>
  );
}
