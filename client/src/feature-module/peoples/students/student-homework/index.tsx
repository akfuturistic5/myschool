import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import Table from "../../../../core/common/dataTable/index";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../../core/utils/apiErrorMessage";
import { formatDateDMY } from "../../../../core/utils/dateDisplay";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";
import { selectUser } from "../../../../core/data/redux/authSlice";

const statusBadge = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "evaluated" || s === "submitted") return "badge-soft-success";
  if (s === "viewed" || s === "under review") return "badge-soft-info";
  if (s === "late" || s === "returned" || s === "resubmission requested") return "badge-soft-warning";
  if (s === "draft") return "badge-soft-secondary";
  return "badge-soft-dark";
};

const StudentHomeworkList = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const dashboardRoute = getDashboardForRole(user?.role);

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getMyHomeworkList();
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(
        list.map((r: Record<string, unknown>, i: number) => ({
          key: String(r.id ?? i),
          id: r.id,
          title: r.title,
          subject: r.subject_name,
          class: r.class_name,
          section: r.section_name,
          dueDate: formatDateDMY(r.due_date as string),
          homeworkType: r.homework_type,
          recipientStatus: r.recipient_status,
          submissionStatus: r.latest_submission_status ?? "—",
          attempt: r.latest_attempt_number ?? "—",
        }))
      );
    } catch (err) {
      setError(extractMessageFromApiError(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const detailPath = (id: number) => routes.studentHomeworkDetail.replace(":id", String(id));

  const columns = useMemo(
    () => [
      {
        title: "Title",
        dataIndex: "title",
        render: (text: string, record: Record<string, unknown>) => (
          <Link to={detailPath(Number(record.id))} className="link-primary">
            {text}
          </Link>
        ),
      },
      { title: "Subject", dataIndex: "subject" },
      { title: "Class", dataIndex: "class" },
      { title: "Due date", dataIndex: "dueDate" },
      {
        title: "Your status",
        dataIndex: "recipientStatus",
        render: (t: string) => <span className={`badge ${statusBadge(t)}`}>{t}</span>,
      },
      {
        title: "Submission",
        dataIndex: "submissionStatus",
        render: (t: string) =>
          t === "—" ? (
            <span className="text-muted">Not submitted</span>
          ) : (
            <span className={`badge ${statusBadge(String(t))}`}>{t}</span>
          ),
      },
      {
        title: "Action",
        dataIndex: "action",
        render: (_: unknown, record: Record<string, unknown>) => (
          <Link to={detailPath(Number(record.id))} className="btn btn-sm btn-primary">
            Open
          </Link>
        ),
      },
    ],
    []
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">My Homework</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={dashboardRoute}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item active">Homework</li>
              </ol>
            </nav>
          </div>
          <button type="button" className="btn btn-outline-light bg-white mb-2" onClick={load}>
            <i className="ti ti-refresh me-1" />
            Refresh
          </button>
        </div>

        {error && <div className="alert alert-warning">{error}</div>}

        <div className="card">
          <div className="card-body p-0 py-3">
            {loading ? (
              <p className="p-4 text-muted mb-0">Loading...</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-muted mb-0">No homework assigned right now.</p>
            ) : (
              <Table columns={columns} dataSource={rows} Selection={false} showSearch={true} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentHomeworkList;
