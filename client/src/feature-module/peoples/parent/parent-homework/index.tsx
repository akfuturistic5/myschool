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
import {
  useLinkedStudentContext,
  PARENT_PORTAL_SELECTED_STUDENT_STORAGE_KEY,
} from "../../../../core/hooks/useLinkedStudentContext";
import { useParents } from "../../../../core/hooks/useParents";

const statusBadge = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "completed" || s === "evaluated" || s === "submitted") return "badge-soft-success";
  if (s === "viewed" || s === "under review") return "badge-soft-info";
  if (s === "late" || s === "returned" || s === "resubmission requested") return "badge-soft-warning";
  if (s === "draft") return "badge-soft-secondary";
  return "badge-soft-dark";
};

const parseStudentId = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const ParentHomeworkList = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const dashboardRoute = getDashboardForRole(user?.role, user?.user_role_id ?? user?.role_id);

  const { studentId, loading: contextLoading, isParentRole, parentChildrenLoading } =
    useLinkedStudentContext();
  const { parents } = useParents({ forCurrentUser: isParentRole, enabled: isParentRole });

  const children = useMemo(() => {
    const rows = (parents as { student_id?: number; student_first_name?: string; student_last_name?: string }[]) || [];
    const seen = new Set<number>();
    return rows.filter((r) => {
      const id = parseStudentId(r.student_id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [parents]);

  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);

  useEffect(() => {
    const resolved = parseStudentId(studentId) ?? parseStudentId(children[0]?.student_id);
    setSelectedStudentId(resolved);
  }, [studentId, children]);

  const onSelectChild = (id: number) => {
    setSelectedStudentId(id);
    try {
      sessionStorage.setItem(PARENT_PORTAL_SELECTED_STUDENT_STORAGE_KEY, String(id));
    } catch {
      /* ignore */
    }
  };

  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedStudentId) {
      setRows([]);
      setLoading(contextLoading || parentChildrenLoading);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getChildHomeworkList(selectedStudentId);
      const list = Array.isArray(res?.data) ? res.data : [];
      setRows(
        list.map((r: Record<string, unknown>, i: number) => ({
          key: String(r.id ?? i),
          id: r.id,
          title: r.title,
          subject: r.subject_name,
          class: r.class_name,
          dueDate: formatDateDMY(r.due_date as string),
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
  }, [selectedStudentId, contextLoading, parentChildrenLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const detailPath = (homeworkId: number) => {
    const base = routes.parentHomeworkDetail.replace(":id", String(homeworkId));
    return selectedStudentId ? `${base}?studentId=${selectedStudentId}` : base;
  };

  const selectedChildLabel = useMemo(() => {
    const row = children.find((c) => parseStudentId(c.student_id) === selectedStudentId);
    if (!row) return null;
    return [row.student_first_name, row.student_last_name].filter(Boolean).join(" ").trim() || null;
  }, [children, selectedStudentId]);

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
        title: "Status",
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
            View
          </Link>
        ),
      },
    ],
    [selectedStudentId]
  );

  const pageLoading = contextLoading || parentChildrenLoading || loading;

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Child Homework</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={dashboardRoute}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item active">Homework</li>
              </ol>
            </nav>
          </div>
          <button type="button" className="btn btn-outline-light bg-white mb-2" onClick={load} disabled={!selectedStudentId}>
            <i className="ti ti-refresh me-1" />
            Refresh
          </button>
        </div>

        {children.length > 1 && (
          <div className="card mb-3">
            <div className="card-body py-3">
              <label className="form-label mb-2">Select child</label>
              <div className="d-flex flex-wrap gap-2">
                {children.map((c) => {
                  const id = parseStudentId(c.student_id);
                  if (!id) return null;
                  const name = [c.student_first_name, c.student_last_name].filter(Boolean).join(" ").trim() || `Student #${id}`;
                  const active = id === selectedStudentId;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`btn btn-sm ${active ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => onSelectChild(id)}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {selectedChildLabel && children.length <= 1 && (
          <p className="text-muted mb-3">
            Viewing homework for <strong>{selectedChildLabel}</strong>
          </p>
        )}

        {!selectedStudentId && !pageLoading && (
          <div className="alert alert-warning">No linked student found for your account.</div>
        )}

        {error && <div className="alert alert-warning">{error}</div>}

        <div className="card">
          <div className="card-body p-0 py-3">
            {pageLoading ? (
              <p className="p-4 text-muted mb-0">Loading...</p>
            ) : !selectedStudentId ? null : rows.length === 0 ? (
              <p className="p-4 text-muted mb-0">No homework assigned for this child right now.</p>
            ) : (
              <Table columns={columns} dataSource={rows} Selection={false} showSearch={true} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentHomeworkList;
