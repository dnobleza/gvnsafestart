import { Link } from 'react-router-dom';

// The real GVN-Safestart logo, downscaled from the original 1973x797 asset.
// Explicit dimensions keep it from shifting layout while it loads.
export default function BrandMark({ className = '', height = 52 }) {
  return (
    <Link to="/" className={`inline-flex items-center ${className}`}>
      <img
        src="/logo-gvn.png"
        alt="GVN-Safestart Driving Lesson"
        width="440"
        height="178"
        style={{ height: `${height}px`, width: 'auto' }}
        className="block"
      />
    </Link>
  );
}
