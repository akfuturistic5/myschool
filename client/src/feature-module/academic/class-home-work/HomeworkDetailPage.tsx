import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Table from "../../../core/common/dataTable/index";
import { apiService, getApiBaseUrl } from "../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../core/utils/apiErrorMessage";
import { formatDateDMY } from "../../../core/utils/dateDisplay";
import { getDashboardForRole } from "../../../core/utils/roleUtils";
import { useSelector } from "react-redux";
import { selectUser } from "../../../core/data/redux/authSlice";
import { all_routes } from "../../router/all_routes";
import HomeworkEditModal from "./HomeworkEditModal";
import Swal from "sweetalert2";

type TabKey = "overview" | "recipients" | "submissions";

const statusBadgeClass = (status: string) => {
  const s = String(status).toLowerCase();
  if (s === "published" || s === "evaluated" || s === "completed") return "badge-soft-success";
  if (s === "draft" || s === "assigned") return "badge-soft-secondary";
  if (s === "closed" || s === "late") return "badge-soft-warning";
  if (s === "returned" || s === "resubmission requested") return "badge-soft-danger";
  if (s === "submitted" || s === "under review") return "badge-soft-info";
  return "badge-soft-dark";
};

const HomeworkDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const routes = all_routes;
  const user = useSelector(selectUser);
  const dashboardRoute = getDashboardForRole(user?.role);

  const [tab, setTab] = useState<TabKey>("overview");
  const [homework, setHomework] = useState<Record<string, unknown> | null>(null);
  const [recipients, setRecipients] = useState<Record<string, unknown>[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [apiBase, setApiBase] = useState("");

  const homeworkId = Number(id);

  const loadAll = useCallback(async () => {
    if (!homeworkId) return;
    try {
      setLoading(true);
      setError(null);
      const [hwRes, recRes, subRes] = await Promise.all([
        apiService.getHomeworkById(homeworkId),
        apiService.getHomeworkRecipients(homeworkId),
        apiService.getHomeworkSubmissions(homeworkId),
      ]);
      setHomework(hwRes?.data ?? hwRes);
      setRecipients(Array.isArray(recRes?.data) ? recRes.data : []);
      setSubmissions(Array.isArray(subRes?.data) ? subRes.data : []);
    } catch (err) {
      setError(extractMessageFromApiError(err));
      setHomework(null);
    } finally {
      setLoading(false);
    }
  }, [homeworkId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    getApiBaseUrl().then(setApiBase).catch(() => setApiBase(""));
  }, []);

  const fileHref = (path: string) => {
    if (!path) return "#";
    if (path.startsWith("http")) return path;
    const base = apiBase.replace(/\/api\/?$/, "");
    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!homeworkId) return;
    const confirm = await Swal.fire({
      title: `Set status to ${newStatus}?`,
      icon: "question",
      showCancelButton: true,
    });
    if (!confirm.isConfirmed) return;
    try {
      await apiService.patchHomeworkStatus(homeworkId, newStatus);
      await loadAll();
      Swal.fire({ icon: "success", title: "Status updated", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    }
  };

  const handleDelete = async () => {
    const confirm = await Swal.fire({
      title: "Delete this homework?",
      text: "This soft-deletes the assignment for all students.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
    });
    if (!confirm.isConfirmed) return;
    try {
      await apiService.deleteHomework(homeworkId);
      navigate(routes.classHomeWork);
      Swal.fire({ icon: "success", title: "Deleted", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !homeworkId) return;
    try {
      setUploading(true);
      const up = await apiService.uploadHomeworkFile(file);
      const url = up?.data?.url ?? up?.url;
      if (!url) throw new Error("Upload did not return a file URL");
      await apiService.addHomeworkAttachment(homeworkId, {
        file_name: file.name,
        file_path: url,
        file_type: file.type || null,
        file_size: file.size,
      });
      await loadAll();
      Swal.fire({ icon: "success", title: "File attached", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    const confirm = await Swal.fire({ title: "Remove attachment?", icon: "warning", showCancelButton: true });
    if (!confirm.isConfirmed) return;
    try {
      await apiService.deleteHomeworkAttachment(attachmentId);
      await loadAll();
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    }
  };

  const openGradeModal = async (sub: Record<string, unknown>) => {
    const maxMarks = homework?.max_marks != null ? Number(homework.max_marks) : null;
    const isGraded = homework?.is_graded !== false;

    const { value: formValues } = await Swal.fire({
      title: `Grade — ${sub.student_name}`,
      html: `
        <div class="text-start">
          ${isGraded ? `<label class="form-label">Marks (max ${maxMarks ?? "—"})</label>
          <input id="swal-marks" type="number" class="swal2-input" style="width:100%;margin:0 0 8px" value="${sub.marks_obtained ?? ""}" />` : ""}
          <label class="form-label">Feedback</label>
          <textarea id="swal-feedback" class="swal2-textarea" style="width:100%">${sub.teacher_feedback ?? ""}</textarea>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Save grade",
      preConfirm: () => {
        const marksEl = document.getElementById("swal-marks") as HTMLInputElement | null;
        const feedbackEl = document.getElementById("swal-feedback") as HTMLTextAreaElement | null;
        return {
          marks: marksEl?.value !== "" && marksEl ? Number(marksEl.value) : null,
          feedback: feedbackEl?.value ?? "",
        };
      },
    });

    if (!formValues) return;

    try {
      await apiService.evaluateHomeworkSubmission(Number(sub.id), {
        marks_obtained: isGraded ? formValues.marks : null,
        teacher_feedback: formValues.feedback || null,
        status: "Evaluated",
      });
      await loadAll();
      Swal.fire({ icon: "success", title: "Graded", timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    }
  };

  const handleReturn = async (sub: Record<string, unknown>) => {
    const { value: feedback } = await Swal.fire({
      title: `Return to ${sub.student_name}`,
      input: "textarea",
      inputLabel: "Feedback for student",
      inputValue: String(sub.teacher_feedback ?? ""),
      showCancelButton: true,
    });
    if (feedback === undefined) return;
    try {
      await apiService.returnHomeworkSubmission(Number(sub.id), {
        teacher_feedback: feedback || null,
        status: "Resubmission Requested",
      });
      await loadAll();
      Swal.fire({ icon: "success", title: "Returned for correction", timer: 1500, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: "error", text: extractMessageFromApiError(err) });
    }
  };

  const recipientColumns = useMemo(
    () => [
      { title: "Student", dataIndex: "student_name" },
      { title: "Roll", dataIndex: "roll_number" },
      { title: "Admission", dataIndex: "admission_number" },
      {
        title: "Status",
        dataIndex: "status",
        render: (t: string) => <span className={`badge ${statusBadgeClass(t)}`}>{t}</span>,
      },
      {
        title: "Viewed",
        dataIndex: "viewed_at",
        render: (v: string) => (v ? formatDateDMY(v) : "—"),
      },
    ],
    []
  );

  const submissionColumns = useMemo(
    () => [
      { title: "Student", dataIndex: "student_name" },
      { title: "Attempt", dataIndex: "attempt_number" },
      {
        title: "Submitted",
        dataIndex: "submission_date",
        render: (v: string) => formatDateDMY(v),
      },
      {
        title: "Status",
        dataIndex: "status",
        render: (t: string) => <span className={`badge ${statusBadgeClass(t)}`}>{t}</span>,
      },
      {
        title: "Late",
        dataIndex: "is_late",
        render: (v: boolean) => (v ? "Yes" : "No"),
      },
      {
        title: "Marks",
        dataIndex: "marks_obtained",
        render: (v: unknown) => (v != null && v !== "" ? String(v) : "—"),
      },
      {
        title: "Action",
        dataIndex: "action",
        render: (_: unknown, record: Record<string, unknown>) => (
          <div className="d-flex gap-1 flex-wrap">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => openGradeModal(record)}>
              Grade
            </button>
            {homework?.resubmission_allowed !== false && (
              <button type="button" className="btn btn-sm btn-outline-warning" onClick={() => handleReturn(record)}>
                Return
              </button>
            )}
          </div>
        ),
      },
    ],
    [homework?.resubmission_allowed]
  );

  const attachments = Array.isArray(homework?.attachments) ? (homework.attachments as Record<string, unknown>[]) : [];

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content p-4 text-center text-muted">Loading homework...</div>
      </div>
    );
  }

  if (error || !homework) {
    return (
      <div className="page-wrapper">
        <div className="content p-4">
          <div className="alert alert-danger">{error || "Homework not found"}</div>
          <Link to={routes.classHomeWork} className="btn btn-primary">
            Back to list
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
                  <Link to={routes.classHomeWork}>Class Work</Link>
                </li>
                <li className="breadcrumb-item active">HW{homework.id}</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex flex-wrap gap-2 mb-2">
            <span className={`badge ${statusBadgeClass(String(homework.status))} fs-12 px-3 py-2`}>
              {String(homework.status)}
            </span>
            <button type="button" className="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#edit_home_work">
              <i className="ti ti-edit me-1" /> Edit
            </button>
            {homework.status === "Draft" && (
              <button type="button" className="btn btn-success btn-sm" onClick={() => handleStatusChange("Published")}>
                Publish
              </button>
            )}
            {homework.status === "Published" && (
              <button type="button" className="btn btn-warning btn-sm" onClick={() => handleStatusChange("Closed")}>
                Close
              </button>
            )}
            <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleDelete}>
              <i className="ti ti-trash me-1" /> Delete
            </button>
          </div>
        </div>

        <ul className="nav nav-tabs mb-3">
          {(["overview", "recipients", "submissions"] as TabKey[]).map((k) => (
            <li className="nav-item" key={k}>
              <button
                type="button"
                className={`nav-link ${tab === k ? "active" : ""}`}
                onClick={() => setTab(k)}
              >
                {k === "overview" ? "Overview" : k === "recipients" ? `Recipients (${recipients.length})` : `Submissions (${submissions.length})`}
              </button>
            </li>
          ))}
        </ul>

        {tab === "overview" && (
          <div className="row">
            <div className="col-lg-8">
              <div className="card mb-3">
                <div className="card-body">
                  <p className="mb-2">
                    <strong>Class:</strong> {String(homework.class_name)} · {String(homework.section_name)} ·{" "}
                    <strong>Subject:</strong> {String(homework.subject_name)}
                  </p>
                  <p className="mb-2">
                    <strong>Teacher:</strong> {String(homework.teacher_name ?? "—")} · <strong>Type:</strong>{" "}
                    {String(homework.homework_type)}
                  </p>
                  <p className="mb-2">
                    <strong>Assign:</strong> {formatDateDMY(homework.assign_date as string)} · <strong>Due:</strong>{" "}
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
              <div className="card">
                <div className="card-header d-flex justify-content-between align-items-center">
                  <h5 className="mb-0">Attachments</h5>
                  <label className="btn btn-sm btn-primary mb-0">
                    {uploading ? "Uploading..." : "Upload file"}
                    <input type="file" className="d-none" onChange={handleUploadAttachment} disabled={uploading} />
                  </label>
                </div>
                <div className="card-body">
                  {attachments.length === 0 ? (
                    <p className="text-muted mb-0">No attachments.</p>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {attachments.map((a) => (
                        <li key={String(a.id)} className="list-group-item d-flex justify-content-between align-items-center px-0">
                          <a href={fileHref(String(a.file_path))} target="_blank" rel="noreferrer">
                            {String(a.file_name)}
                          </a>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDeleteAttachment(Number(a.id))}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            <div className="col-lg-4">
              <div className="card">
                <div className="card-body">
                  <h6 className="mb-3">Summary</h6>
                  <p className="mb-1">Recipients: <strong>{homework.recipient_count as number}</strong></p>
                  <p className="mb-1">Submitted: <strong>{homework.submitted_count as number}</strong></p>
                  <p className="mb-1">Pending review: <strong>{homework.pending_evaluation_count as number}</strong></p>
                  {homework.is_graded !== false && (
                    <p className="mb-1">Max marks: <strong>{String(homework.max_marks ?? "—")}</strong></p>
                  )}
                  <p className="mb-0 text-muted small">Max attempts: {String(homework.max_attempts)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "recipients" && (
          <div className="card">
            <div className="card-body p-0 py-3">
              <Table columns={recipientColumns} dataSource={recipients.map((r, i) => ({ ...r, key: String(r.id ?? i) }))} Selection={false} showSearch={true} />
            </div>
          </div>
        )}

        {tab === "submissions" && (
          <div className="card">
            <div className="card-body p-0 py-3">
              {submissions.length === 0 ? (
                <p className="p-4 text-muted mb-0">No submissions yet.</p>
              ) : (
                <Table
                  columns={submissionColumns}
                  dataSource={submissions.map((r, i) => ({ ...r, key: String(r.id ?? i) }))}
                  Selection={false}
                  showSearch={true}
                />
              )}
            </div>
          </div>
        )}
      </div>

      <HomeworkEditModal homework={homework} onSuccess={loadAll} />
    </div>
  );
};

export default HomeworkDetailPage;
