import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-charcoal-50">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-charcoal-800 mb-2">Access Denied</h1>
        <p className="text-charcoal-500 mb-6">
          You don't have permission to access this page. Your role may not have the required privileges.
        </p>
        <Link to="/app" className="btn-primary inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-charcoal-50">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-bold text-charcoal-300 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-charcoal-700 mb-2">Page Not Found</h2>
        <p className="text-charcoal-500 mb-6">The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn-primary inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}

export function ErrorPage() {
  const location = useLocation();
  const message = (location.state as { message?: string } | null)?.message;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-charcoal-50">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">!</span>
        </div>
        <h1 className="text-2xl font-bold text-charcoal-800 mb-2">Something Went Wrong</h1>
        <p className="text-charcoal-500 mb-6">
          {message || 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
        </p>
        <Link to="/" className="btn-primary inline-flex">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
