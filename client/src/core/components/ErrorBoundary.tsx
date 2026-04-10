import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { all_routes } from '../../feature-module/router/all_routes';
import { base_path } from '../../environment';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

function dashboardHref(): string {
  const route = all_routes.adminDashboard.startsWith('/')
    ? all_routes.adminDashboard
    : `/${all_routes.adminDashboard}`;
  const base = base_path.replace(/\/$/, '');
  if (!base || base === '') return route;
  return `${base}${route}`;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      const isDev = import.meta.env.DEV;
      const msg = this.state.error?.message;

      return (
        <div
          className="d-flex min-vh-100 align-items-center justify-content-center bg-light px-3"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >
          <div
            className="card shadow-sm border-0 text-center"
            style={{ maxWidth: '28rem' }}
          >
            <div className="card-body p-4 p-md-5">
              <div
                className="rounded-circle bg-danger bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3 text-danger fw-bold"
                style={{ width: '3rem', height: '3rem' }}
                aria-hidden
              >
                !
              </div>
              <h2 className="h4 mb-2">Something went wrong</h2>
              <p className="text-muted mb-4">
                Please refresh the page or go back to the dashboard and try again.
              </p>
              {isDev && msg ? (
                <pre
                  className="text-start small text-danger bg-light rounded p-2 mb-4 text-wrap"
                  style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                >
                  {msg}
                </pre>
              ) : null}
              <div className="d-flex flex-wrap gap-2 justify-content-center">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => window.location.reload()}
                >
                  Refresh page
                </button>
                <a className="btn btn-outline-secondary" href={dashboardHref()}>
                  Dashboard
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
