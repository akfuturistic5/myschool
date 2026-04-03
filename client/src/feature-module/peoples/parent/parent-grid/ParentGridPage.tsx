import ErrorBoundary from "../../../../core/components/ErrorBoundary";
import ParentGrid from "./index";

const ParentGridErrorFallback = () => (
  <div className="page-wrapper">
    <div className="content">
      <div className="card">
        <div className="card-body text-center p-5">
          <h5 className="text-danger mb-3">Failed to load Parents</h5>
          <p className="text-muted mb-4">Please try again or refresh the page.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ParentGridPage = () => (
  <ErrorBoundary fallback={<ParentGridErrorFallback />}>
    <ParentGrid />
  </ErrorBoundary>
);

export default ParentGridPage;
