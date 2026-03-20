import { Link, useLocation } from 'react-router-dom';
import { TAB_LABELS } from '../../utils/constants';

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const label = TAB_LABELS[pathname];
  if (!label) return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/" className="breadcrumb-link">Home</Link>
      <span className="breadcrumb-sep">/</span>
      <span className="breadcrumb-current">{label}</span>
    </nav>
  );
}
