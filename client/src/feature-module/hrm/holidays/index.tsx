import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { apiService } from "../../../core/services/apiService";
import { selectUser } from "../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const defaultForm = { title: "", description: "", start_date: "", end_date: "", holiday_type: "school" };
const getReadableError = (err: any, fallback: string) => {
  const raw = String(err?.message || "");
  const m = raw.match(/"message"\s*:\s*"([^"]+)"/);
  if (m?.[1]) return m[1];
  return raw || fallback;
};

const Holiday = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const role = String(user?.role || "").trim().toLowerCase();
  const roleId = Number(user?.user_role_id ?? user?.role_id);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const canManage = roleId === 1 || roleId === 6 || role === "admin" || role === "administrative" || role === "headmaster";
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [year, month] = filterMonth.split("-").map(Number);
      const res = await apiService.getHolidays({ month, year, academicYearId });
      setRows(Array.isArray(res?.data) ? res.data : []);
    } catch (err: any) {
      setError(getReadableError(err, "Failed to load holidays"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filterMonth, academicYearId]);

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))),
    [rows]
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      setMessage(null);
      if (!academicYearId) {
        setError("Select an academic year before creating/updating holidays.");
        return;
      }
      if (editingId) {
        await apiService.updateHoliday(editingId, { ...form, academic_year_id: academicYearId ?? null });
      } else {
        await apiService.createHoliday({ ...form, academic_year_id: academicYearId ?? null });
      }
      setForm(defaultForm);
      setEditingId(null);
      setMessage(editingId ? "Holiday updated." : "Holiday created.");
      await load();
    } catch (err: any) {
      setError(getReadableError(err, "Failed to save holiday"));
    }
  };

  const startEdit = (row: any) => {
    setEditingId(Number(row.id));
    setForm({
      title: row.title || "",
      description: row.description || "",
      start_date: String(row.start_date || "").slice(0, 10),
      end_date: String(row.end_date || "").slice(0, 10),
      holiday_type: row.holiday_type || "school",
    });
  };

  const removeHoliday = async (id: number) => {
    if (!window.confirm("Delete this holiday?")) return;
    try {
      setError(null);
      setMessage(null);
      await apiService.deleteHoliday(id);
      setMessage("Holiday deleted.");
      await load();
    } catch (err: any) {
      setError(getReadableError(err, "Failed to delete holiday"));
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Holidays</h3>
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
              <li className="breadcrumb-item active">Holidays</li>
            </ol>
          </div>
          <TooltipOption />
        </div>

        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label">Month</label>
                <input type="month" className="form-control" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        {canManage && (
          <div className="card mb-3">
            <div className="card-header"><h5 className="mb-0">{editingId ? "Edit Holiday" : "Add Holiday"}</h5></div>
            <div className="card-body">
              <form onSubmit={onSubmit}>
                <div className="row g-2">
                  <div className="col-md-4"><input className="form-control" placeholder="Title" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></div>
                  <div className="col-md-2"><input type="date" className="form-control" value={form.start_date} onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} required /></div>
                  <div className="col-md-2"><input type="date" className="form-control" value={form.end_date} onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} required /></div>
                  <div className="col-md-2">
                    <select className="form-select" value={form.holiday_type} onChange={(e) => setForm((p) => ({ ...p, holiday_type: e.target.value }))}>
                      <option value="public">Public</option>
                      <option value="school">School</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="col-md-12"><textarea className="form-control" rows={2} placeholder="Description (optional)" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></div>
                  <div className="col-md-12 d-flex gap-2">
                    <button type="submit" className="btn btn-primary">{editingId ? "Update" : "Create"}</button>
                    {editingId ? <button type="button" className="btn btn-light" onClick={() => { setEditingId(null); setForm(defaultForm); }}>Cancel Edit</button> : null}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {message && <div className="alert alert-success">{message}</div>}
            {loading ? (
              <div className="text-muted">Loading holidays...</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped">
                  <thead><tr><th>Title</th><th>Start</th><th>End</th><th>Type</th><th>Description</th>{canManage ? <th>Actions</th> : null}</tr></thead>
                  <tbody>
                    {sortedRows.map((row) => (
                      <tr key={row.id}>
                        <td>{row.title}</td>
                        <td>{String(row.start_date).slice(0, 10)}</td>
                        <td>{String(row.end_date).slice(0, 10)}</td>
                        <td>{row.holiday_type || "custom"}</td>
                        <td>{row.description || "—"}</td>
                        {canManage ? (
                          <td>
                            <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(row)}>Edit</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => removeHoliday(Number(row.id))}>Delete</button>
                          </td>
                        ) : null}
                      </tr>
                    ))}
                    {!sortedRows.length && (
                      <tr><td colSpan={canManage ? 6 : 5} className="text-muted">No holidays found for selected month.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Holiday;




