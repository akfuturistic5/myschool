import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import { apiService, getApiBaseUrl } from "../../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../../core/utils/apiErrorMessage";
import { formatDateDMY } from "../../../../core/utils/dateDisplay";
import { getDashboardForRole } from "../../../../core/utils/roleUtils";
import { selectUser } from "../../../../core/data/redux/authSlice";
import Swal from "sweetalert2";

const statusBadge = (status: string) => {
  const s = String(status || "").toLowerCase();
  if (s === "evaluated" || s === "submitted") return "badge-soft-success";
  if (s === "late" || s === "returned" || s === "resubmission requested") return "badge-soft-warning";
  if (s === "draft") return "badge-soft-secondary";
  return "badge-soft-info";
};

type PendingFile = { file: File; name: string };

const StudentHomeworkDetail = () => {
  const { id } = useParams();
  const routes = all_routes;
  const user = useSelector(selectUser);
  const dashboardRoute = getDashboardForRole(user?.role);
  const homeworkId = Number(id);

  const [homework, setHomework] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [apiBase, setApiBase] = useState("");

  const load = useCallback(async () => {
    if (!homeworkId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiService.getMyHomeworkById(homeworkId);
      const hw = res?.data ?? res;
      setHomework(hw);
      const subs = Array.isArray(hw?.submissions) ? hw.submissions : [];
      const draft = subs.find((s: { status?: string }) => s.status === "Draft");
      if (draft?.submission_text) {
        setSubmissionText(String(draft.submission_text));
      }
    } catch (err) {
      setError(extractMessageFromApiError(err));
      setHomework(null);
    } finally {
      setLoading(false);
    }
  }, [homeworkId]);

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

  const latestSubmission = () => {
    const subs = Array.isArray(homework?.submissions) ? (homework.submissions as Record<string, unknown>[]) : [];
    if (!subs.length) return null;
    return subs.reduce((a, b) =>
      Number(a.attempt_number) > Number(b.attempt_number) ? a : b
    );
  };

  const canSubmit = () => {
    const latest = latestSubmission();
    const st = latest?.status;
    if (!latest) return true;
    if (st === "Draft") return true;
    if (st === "Returned" || st === "Resubmission Requested") {
      return homework?.resubmission_allowed !== false;
    }
    if (st === "Evaluated" && homework?.resubmission_allowed !== false) {
      const max = Number(homework?.max_attempts ?? 1);
      return Number(latest.attempt_number) < max;
    }
    if (["Submitted", "Late", "Under Review"].includes(String(st))) return false;
    return false;
  };

  const uploadPendingFiles = async () => {
    const out: { file_name: string; file_path: string; file_type: string | null; file_size: number }[] = [];
    for (const p of pendingFiles) {
      const up = await apiService.uploadHomeworkSubmissionFile(p.file);
      const url = up?.data?.url ?? up?.url;
      if (!url) throw new Error(`Upload failed for ${p.name}`);
      out.push({
        file_name: p.name,
        file_path: url,
        file_type: p.file.type || null,
        file_size: p.file.size,
      });
    }
    return out;
  };

  const saveSubmission = async (status: "Draft" | "Submitted") => {
    if (!homeworkId) return;
    try {
      setSubmitting(true);
      const attachments = status === "Submitted" ? await uploadPendingFiles() : [];
      await apiService.submitMyHomework(homeworkId, {
        submission_text: submissionText.trim() || null,
        status,
        attachments,
      });
      setPendingFiles([]);
      await load();
      await Swal.fire({
        icon: "success",
        title: status === "Draft" ? "Draft saved" : "Submitted",
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const teacherAttachments = Array.isArray(homework?.attachments)
    ? (homework.attachments as Record<string, unknown>[])
    : [];
  const submissions = Array.isArray(homework?.submissions)
    ? (homework.submissions as Record<string, unknown>[])
    : [];
  const submitAllowed = canSubmit();

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content p-4 text-muted">Loading...</div>
      </div>
    );
  }

  if (error || !homework) {
    return (
      <div className="page-wrapper">
        <div className="content p-4">
          <div className="alert alert-danger">{error || "Not found"}</div>
          <Link to={routes.studentHomework} className="btn btn-primary">
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
                  <Link to={routes.studentHomework}>Homework</Link>
                </li>
                <li className="breadcrumb-item active">HW{homework.id}</li>
              </ol>
            </nav>
          </div>
          <Link to={routes.studentHomework} className="btn btn-outline-light bg-white">
            Back to list
          </Link>
        </div>

        <div className="row">
          <div className="col-lg-7">
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
                  <h5 className="mb-0">Your attempts</h5>
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
          </div>

          <div className="col-lg-5">
            <div className="card">
              <div className="card-header">
                <h5 className="mb-0">Submit work</h5>
              </div>
              <div className="card-body">
                {!submitAllowed ? (
                  <p className="text-muted mb-0">
                    Submission is closed for this homework. Check feedback above or wait for teacher
                    to request a resubmission.
                  </p>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="form-label">Your answer</label>
                      <textarea
                        className="form-control"
                        rows={6}
                        value={submissionText}
                        onChange={(e) => setSubmissionText(e.target.value)}
                        placeholder="Type your submission here..."
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Attach files</label>
                      <input
                        type="file"
                        className="form-control"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          setPendingFiles(files.map((f) => ({ file: f, name: f.name })));
                          e.target.value = "";
                        }}
                      />
                      {pendingFiles.length > 0 && (
                        <ul className="small text-muted mt-2 mb-0">
                          {pendingFiles.map((p) => (
                            <li key={p.name}>{p.name}</li>
                          ))}
                        </ul>
                      )}
                      <p className="small text-muted mb-0">Files upload when you submit (not when saving draft).</p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        disabled={submitting}
                        onClick={() => saveSubmission("Draft")}
                      >
                        Save draft
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        disabled={submitting}
                        onClick={() => saveSubmission("Submitted")}
                      >
                        {submitting ? "Submitting..." : "Submit"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentHomeworkDetail;
