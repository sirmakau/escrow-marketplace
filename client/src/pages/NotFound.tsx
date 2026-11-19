import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { EmptyState } from '../components/ui';

export function NotFound() {
  return (
    <EmptyState
      icon={<Compass size={26} />}
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved."
      action={
        <Link to="/" className="btn btn-primary">
          Back to dashboard
        </Link>
      }
    />
  );
}
