import { OverlayTrigger, Tooltip } from "react-bootstrap";

interface LibraryToolbarProps {
  onRefresh: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  /** e.g. Import books button */
  extra?: React.ReactNode;
}

/**
 * Action bar for library pages: refresh, Excel (.xlsx), PDF (jsPDF + autoTable).
 */
const LibraryToolbar = ({ onRefresh, onExportExcel, onExportPdf, extra }: LibraryToolbarProps) => {
  return (
    <>
      {extra}
      <div className="pe-1 mb-2">
        <OverlayTrigger placement="top" overlay={<Tooltip id="lib-tt-refresh">Refresh</Tooltip>}>
          <button
            type="button"
            className="btn btn-outline-light bg-white btn-icon me-1"
            onClick={onRefresh}
            aria-label="Refresh"
          >
            <i className="ti ti-refresh" />
          </button>
        </OverlayTrigger>
      </div>
      <div className="dropdown me-2 mb-2">
        <button
          type="button"
          className="dropdown-toggle btn btn-light fw-medium d-inline-flex align-items-center"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <i className="ti ti-file-export me-2" />
          Export
        </button>
        <ul className="dropdown-menu dropdown-menu-end p-3">
          <li>
            <button type="button" className="dropdown-item rounded-1" onClick={onExportPdf}>
              <i className="ti ti-file-type-pdf me-1" />
              Export as PDF
            </button>
          </li>
          <li>
            <button type="button" className="dropdown-item rounded-1" onClick={onExportExcel}>
              <i className="ti ti-file-type-xls me-1" />
              Export as Excel (.xlsx)
            </button>
          </li>
        </ul>
      </div>
    </>
  );
};

export default LibraryToolbar;
