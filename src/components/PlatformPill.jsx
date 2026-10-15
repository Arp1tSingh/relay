import { BRAND_MARKS } from '../lib/brands.jsx';

export default function PlatformPill({ platform, label, url, pending }) {
  const mark = BRAND_MARKS[platform.key] ?? null;

  if (pending || !url) {
    return (
      <span className="pill pill--pending">
        <span className="pill__mark" aria-hidden="true">
          {mark ?? <span className="spinner" />}
        </span>
        {label}
      </span>
    );
  }

  return (
    <a className="pill" href={url} target="_blank" rel="noopener noreferrer">
      <span className="pill__mark" aria-hidden="true">
        {mark}
      </span>
      {label}
    </a>
  );
}