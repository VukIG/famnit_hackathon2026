import "./SourceTag.css";

export default function SourceTag({ source }) {
  return <span className={`source-tag source-tag--${source}`}>{source}</span>;
}
