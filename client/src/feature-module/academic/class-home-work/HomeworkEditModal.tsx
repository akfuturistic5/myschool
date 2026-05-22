import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../core/utils/apiErrorMessage";
import { toYmdString } from "../../../core/utils/dateDisplay";
import Swal from "sweetalert2";

const HOMEWORK_TYPE_OPTIONS = [
  { value: "Homework", label: "Homework" },
  { value: "Assignment", label: "Assignment" },
  { value: "Project", label: "Project" },
  { value: "Worksheet", label: "Worksheet" },
  { value: "Practical", label: "Practical" },
  { value: "Reading", label: "Reading" },
  { value: "Activity", label: "Activity" },
];

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Published", label: "Published" },
  { value: "Closed", label: "Closed" },
  { value: "Archived", label: "Archived" },
];

const hideBsModal = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const bootstrap = (window as { bootstrap?: { Modal?: { getInstance: (n: Element) => { hide: () => void } | null; new (n: Element): { hide: () => void } } } }).bootstrap;
  if (bootstrap?.Modal) {
    const inst = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
    inst.hide();
  }
};

type HomeworkEditModalProps = {
  homework: Record<string, unknown> | null;
  onSuccess?: () => void;
};

const HomeworkEditModal = ({ homework, onSuccess }: HomeworkEditModalProps) => {
  const isDraft = homework?.status === "Draft";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [homeworkType, setHomeworkType] = useState<string | null>("Homework");
  const [assignDate, setAssignDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<string | null>("Draft");
  const [isGraded, setIsGraded] = useState(true);
  const [maxMarks, setMaxMarks] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [resubmissionAllowed, setResubmissionAllowed] = useState(true);
  const [allowLateSubmission, setAllowLateSubmission] = useState(true);
  const [saving, setSaving] = useState(false);

  const hydrate = useCallback(() => {
    if (!homework) return;
    setTitle(String(homework.title ?? ""));
    setDescription(String(homework.description ?? ""));
    setInstructions(String(homework.instructions ?? ""));
    setHomeworkType(String(homework.homework_type ?? "Homework"));
    setAssignDate(toYmdString(homework.assign_date as string));
    setDueDate(toYmdString(homework.due_date as string));
    setStatus(String(homework.status ?? "Draft"));
    setIsGraded(homework.is_graded !== false);
    setMaxMarks(homework.max_marks != null ? String(homework.max_marks) : "");
    setMaxAttempts(String(homework.max_attempts ?? 1));
    setResubmissionAllowed(homework.resubmission_allowed !== false);
    setAllowLateSubmission(homework.allow_late_submission !== false);
  }, [homework]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homework?.id) return;

    const payload: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      instructions: instructions.trim() || null,
      due_date: dueDate,
      resubmission_allowed: resubmissionAllowed,
      allow_late_submission: allowLateSubmission,
      max_attempts: Math.max(1, parseInt(maxAttempts, 10) || 1),
      is_graded: isGraded,
      max_marks: isGraded ? Number(maxMarks) : null,
    };

    if (isDraft) {
      Object.assign(payload, {
        homework_type: homeworkType,
        assign_date: assignDate,
        status,
      });
    }

    try {
      setSaving(true);
      await apiService.updateHomework(Number(homework.id), payload);
      hideBsModal("edit_home_work");
      await Swal.fire({ icon: "success", title: "Saved", timer: 1500, showConfirmButton: false });
      onSuccess?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Update failed", text: extractMessageFromApiError(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!homework) return null;

  return (
    <div className="modal fade" id="edit_home_work">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div
          className="modal-content d-flex flex-column"
          style={{ maxHeight: "min(90vh, 820px)" }}
        >
          <div className="modal-header flex-shrink-0">
            <h4 className="modal-title">Edit Home Work</h4>
            <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
              <i className="ti ti-x" />
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="d-flex flex-column flex-grow-1 overflow-hidden"
            style={{ minHeight: 0 }}
          >
            <div
              className="modal-body overflow-y-auto flex-grow-1"
              style={{ maxHeight: "calc(90vh - 140px)" }}
            >
              {!isDraft && (
                <div className="alert alert-info py-2 small">
                  Published homework: only title, description, instructions, due date, and policy fields can be changed.
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
              </div>
              {isDraft && (
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Type</label>
                    <CommonSelect className="select" options={HOMEWORK_TYPE_OPTIONS} value={homeworkType} onChange={setHomeworkType} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Status</label>
                    <CommonSelect className="select" options={STATUS_OPTIONS} value={status} onChange={setStatus} />
                  </div>
                </div>
              )}
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Assign date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={assignDate}
                    disabled={!isDraft}
                    onChange={(e) => setAssignDate(e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Due date</label>
                  <input type="date" className="form-control" value={dueDate} min={assignDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="row">
                <div className="mb-3 col-md-6">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="mb-3 col-md-6">
                  <label className="form-label">Instructions</label>
                  <textarea className="form-control" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                </div>
              </div>
              <div className="row align-items-end">
                <div className="col-md-4 mb-3">
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={isGraded} onChange={(e) => setIsGraded(e.target.checked)} id="edit-hw-graded" />
                    <label className="form-check-label" htmlFor="edit-hw-graded">Graded</label>
                  </div>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Max marks</label>
                  <input type="number" className="form-control" disabled={!isGraded} value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Max attempts</label>
                  <input type="number" className="form-control" min={1} value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
                </div>
              </div>
              <div className="d-flex flex-wrap gap-4">
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" checked={resubmissionAllowed} onChange={(e) => setResubmissionAllowed(e.target.checked)} id="edit-resubmit" />
                  <label className="form-check-label" htmlFor="edit-resubmit">Allow resubmission</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="checkbox" checked={allowLateSubmission} onChange={(e) => setAllowLateSubmission(e.target.checked)} id="edit-late" />
                  <label className="form-check-label" htmlFor="edit-late">Allow late submission</label>
                </div>
              </div>
            </div>
            <div className="modal-footer flex-shrink-0 border-top bg-white">
              <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</Link>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HomeworkEditModal;
