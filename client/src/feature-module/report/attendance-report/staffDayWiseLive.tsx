import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { apiService } from "../../../core/services/apiService";
import { exportAttendanceExcel, exportAttendancePdf } from "./exportUtils";

const StaffDayWiseLive = () => {
  const routes = all_routes;
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getEntityAttendanceDayWise("staff", { date });
        const payload = response?.data || {};
        setRows(Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload) ? payload : []);
        setSummary(payload?.summary || null);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch staff day-wise report");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [date]);

  const exportRows = useMemo(() => rows.map((r) => ({ Staff: r.entity_name, Date: date, Status: r.status, Remark: r.remark || "" })), [rows, date]);
  const handleExportPdf = () => {
    try {
      exportAttendancePdf("Staff Day Wise Report", `staff-day-wise-${date}`, exportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };
  const handleExportExcel = () => {
    try {
      exportAttendanceExcel(`staff-day-wise-${date}`, exportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  return (
    <div className="page-wrapper"><div className="content">
      <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
        <div className="my-auto mb-2"><h3 className="page-title mb-1">Staff Day Wise Report</h3><ol className="breadcrumb mb-0"><li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li><li className="breadcrumb-item active">Staff Day Wise</li></ol></div>
        <TooltipOption />
      </div>
      <div className="card"><div className="card-header"><div className="row g-2">
        <div className="col-md-3"><label className="form-label">Date</label><input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="col-md-3 d-flex align-items-end"><button className="btn btn-outline-primary w-100" onClick={handleExportPdf}>Export PDF</button></div>
        <div className="col-md-3 d-flex align-items-end"><button className="btn btn-outline-success w-100" onClick={handleExportExcel}>Export Excel</button></div>
      </div></div>
      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}
        {summary && <div className="alert alert-info">Marked: {summary.total_marked} | Present: {summary.present} | Late: {summary.late} | Half Day: {summary.half_day} | Absent: {summary.absent} | Attendance %: {summary.attendance_percentage}</div>}
        {loading ? <div className="text-muted">Loading...</div> : (
          <div className="table-responsive">
            <table className="table table-striped"><thead><tr><th>Staff</th><th>Status</th><th>Remark</th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.entity_id}><td>{r.entity_name}</td><td>{r.status}</td><td>{r.remark || "-"}</td></tr>)}</tbody></table>
          </div>
        )}
      </div></div>
    </div></div>
  );
};

export default StaffDayWiseLive;
