import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import { apiService, getApiBaseUrl } from "../../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../../core/utils/apiErrorMessage";
import { formatDateDMY } from "../../../../core/utils/dateDisplay";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";

const statusBadge = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "evaluated" || s === "submitted") return "badge-soft-success";
  if (s === "late" || s === "returned" || s === "resubmission requested") return "badge-soft-warning";
  if (s === "draft") return "badge-soft-secondary";
  return "badge-soft-info";
};

const ParentHomeworkDetail = () => {
  const { id } = useParams();
  const routes = all_routes;
  const user = useSelector(selectUser);
  const dashboardRoute = getDashboardForRole(user?.role, user?.user_role_id ?? user?.role_id);
  const homeworkId = Number(id);

  const { studentId, loading: contextLoading } = useLinkedStudentContext();
  const effectiveStudentId =
    typeof studentId === "number" && Number.isFinite(studentId) && studentId > 0 ? studentId : null;

  const [homework, setHomework] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiBase, setApiBase] = useState("");

  const listHref =
    effectiveStudentId != null
      ? `${routes.parentHomework}?studentId=${effectiveStudentId}`
      : routes.parentHomework;

  const load = useCallback(async () => {
    if (!homeworkId || !effectiveStudentId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getChildHomeworkById(effectiveStudentId, homeworkId);
      const hw = res?.data ?? res;
      setHomework(hw);
    } catch (err) {
      setError(extractMessageFromApiError(err));
      setHomework(null);
    } finally {
      setLoading(false);
    }
  }, [homeworkId, effectiveStudentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getApiBaseUrl().then(setApiBase).catch(() => setApiBase(""));
  }, []);

  const fileHref = (path: string) => {
    if (!path) return "#";
    if (path.startsWith("http")) return path;
    const base = apiBase.replace(/\/api\/?$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  };

  const teacherAttachments = Array.isArray(homework?.attachments)
    ? (homework.attachments as Record<string, unknown>[])
    : [];
  const submissions = Array.isArray(homework?.submissions)
    ? (homework.submissions as Record<string, unknown>[])
    : [];

  if (contextLoading || loading) {
    return (
      <div className="page-wrapper">
        <div className="content p-4 text-muted">Loading...</div>
      </div>
    );
  }

  if (!effectiveStudentId) {
    return (
      <div className="page-wrapper">
        <div className="content p-4">
          <div className="alert alert-warning">Select a linked child to view homework.</div>
          <Link to={routes.parentHomework} className="btn btn-primary">
            Back
          </Link>
        </div>
      </div>
    );
  }

  if (error || !homework) {
    return (
      <div className="page-wrapper">
        <div className="content p-4">
          <div className="alert alert-danger">{error || "Not found"}</div>
          <Link to={listHref} className="btn btn-primary">
            Back
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">{String(homework.title)}</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={dashboardRoute}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={listHref}>Homework</Link>
                </li>
                <li className="breadcrumb-item active">HW{homework.id}</li>
              </ol>
            </nav>
          </div>
          <Link to={listHref} className="btn btn-outline-light bg-white">
            Back to list
          </Link>
        </div>

        <div className="alert alert-info py-2 small mb-3">
          Read-only view — homework is submitted by the student from their portal.
        </div>

        <div className="row">
          <div className="col-lg-8">
            <div className="card mb-3">
              <div className="card-body">
                <p className="mb-2">
                  <strong>{String(homework.subject_name)}</strong> · {String(homework.class_name)}{" "}
                  {String(homework.section_name)}
                </p>
                <p className="mb-2 text-muted small">
                  Teacher: {String(homework.teacher_name ?? "—")} · Due:{" "}
                  {formatDateDMY(homework.due_date as string)}
                </p>
                {homework.description && (
                  <p className="mb-2">
                    <strong>Description:</strong> {String(homework.description)}
                  </p>
                )}
                {homework.instructions && (
                  <p className="mb-0">
                    <strong>Instructions:</strong> {String(homework.instructions)}
                  </p>
                )}
              </div>
            </div>

            {teacherAttachments.length > 0 && (
              <div className="card mb-3">
                <div className="card-header">
                  <h5 className="mb-0">Teacher files</h5>
                </div>
                <ul className="list-group list-group-flush">
                  {teacherAttachments.map((a) => (
                    <li key={String(a.id)} className="list-group-item">
                      <a href={fileHref(String(a.file_path))} target="_blank" rel="noreferrer">
                        {String(a.file_name)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {submissions.length > 0 && (
              <div className="card mb-3">
                <div className="card-header">
                  <h5 className="mb-0">Submission attempts</h5>
                </div>
                <div className="card-body">
                  {submissions.map((s) => (
                    <div key={String(s.id)} className="border rounded p-3 mb-2">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <strong>Attempt {String(s.attempt_number)}</strong>
                        <span className={`badge ${statusBadge(String(s.status))}`}>{String(s.status)}</span>
                      </div>
                      <p className="small text-muted mb-1">
                        {formatDateDMY(s.submission_date as string)}
                        {s.is_late ? " · Late" : ""}
                      </p>
                      {s.submission_text && <p className="mb-1">{String(s.submission_text)}</p>}
                      {s.marks_obtained != null && s.marks_obtained !== "" && (
                        <p className="mb-1">
                          <strong>Marks:</strong> {String(s.marks_obtained)}
                          {homework.max_marks != null ? ` / ${homework.max_marks}` : ""}
                        </p>
                      )}
                      {s.teacher_feedback && (
                        <p className="mb-1 text-primary">
                          <strong>Feedback:</strong> {String(s.teacher_feedback)}
                        </p>
                      )}
                      {Array.isArray(s.attachments) && (s.attachments as Record<string, unknown>[]).length > 0 && (
                        <ul className="mb-0 small">
                          {(s.attachments as Record<string, unknown>[]).map((a) => (
                            <li key={String(a.id)}>
                              <a href={fileHref(String(a.file_path))} target="_blank" rel="noreferrer">
                                {String(a.file_name)}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {submissions.length === 0 && (
              <p className="text-muted">No submission from the student yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentHomeworkDetail;
