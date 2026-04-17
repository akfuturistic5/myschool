import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { apiService } from "../../../core/services/apiService";
import { exportAttendanceExcel, exportAttendancePdf } from "./exportUtils";

const StaffReportLive = () => {
  const routes = all_routes;
  const location = useLocation();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getEntityAttendanceReport("staff", { month });
        const payload = response?.data || {};
        setRows(Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload) ? payload : []);
        setSummary(payload?.summary || null);
      } catch (err: any) {
        setError(err?.message || "Failed to fetch staff report");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [month]);

  const exportRows = useMemo(() => rows.map((r) => ({ Staff: r.entity_name, Date: r.attendance_date || "", Status: r.status || "", Remark: r.remark || "" })), [rows]);
  const handleExportPdf = () => {
    try {
      exportAttendancePdf("Staff Attendance Report", `staff-report-${month}`, exportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };
  const handleExportExcel = () => {
    try {
      exportAttendanceExcel(`staff-report-${month}`, exportRows);
    } catch (err: any) {
      setError(err?.message || "Export failed");
    }
  };

  return (
    <div className="page-wrapper"><div className="content">
      <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
        <div className="my-auto mb-2"><h3 className="page-title mb-1">Staff Report</h3><ol className="breadcrumb mb-0"><li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li><li className="breadcrumb-item active">Staff Report</li></ol></div>
        <TooltipOption />
      </div>
      <div className="filter-wrapper">
        <div className="list-tab">
          <ul>
            <li><Link to={routes.attendanceReport} className={location.pathname === routes.attendanceReport ? "active" : ""}>Attendance Report</Link></li>
            <li><Link to={routes.studentAttendanceType} className={location.pathname === routes.studentAttendanceType ? "active" : ""}>Students Attendance Type</Link></li>
            <li><Link to={routes.dailyAttendance} className={location.pathname === routes.dailyAttendance ? "active" : ""}>Daily Attendance</Link></li>
            <li><Link to={routes.studentDayWise} className={location.pathname === routes.studentDayWise ? "active" : ""}>Student Day Wise</Link></li>
            <li><Link to={routes.staffDayWise} className={location.pathname === routes.staffDayWise ? "active" : ""}>Staff Day Wise</Link></li>
            <li><Link to={routes.staffReport} className={location.pathname === routes.staffReport ? "active" : ""}>Staff Report</Link></li>
          </ul>
        </div>
      </div>
      <div className="card"><div className="card-header"><div className="row g-2">
        <div className="col-md-3"><label className="form-label">Month</label><input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        <div className="col-md-3 d-flex align-items-end"><button className="btn btn-outline-primary w-100" onClick={handleExportPdf}>Export PDF</button></div>
        <div className="col-md-3 d-flex align-items-end"><button className="btn btn-outline-success w-100" onClick={handleExportExcel}>Export Excel</button></div>
      </div></div>
      <div className="card-body">
        {error && <div className="alert alert-danger">{error}</div>}
        {summary && <div className="alert alert-info">Marked: {summary.total_marked} | Present: {summary.present} | Late: {summary.late} | Half Day: {summary.half_day} | Absent: {summary.absent} | Attendance %: {summary.attendance_percentage}</div>}
        {loading ? <div className="text-muted">Loading...</div> : (
          <div className="table-responsive">
            <table className="table table-striped"><thead><tr><th>Staff</th><th>Date</th><th>Status</th><th>Remark</th></tr></thead>
              <tbody>{rows.map((r, i) => <tr key={`${r.entity_id}-${i}`}><td>{r.entity_name}</td><td>{r.attendance_date || "-"}</td><td>{r.status || "-"}</td><td>{r.remark || "-"}</td></tr>)}</tbody></table>
          </div>
        )}
      </div></div>
    </div></div>
  );
};

export default StaffReportLive;
