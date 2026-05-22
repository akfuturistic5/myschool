import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../core/utils/apiErrorMessage";
import { toYmdString } from "../../../core/utils/dateDisplay";
import type { SubjectAssignmentOption } from "../../../core/types/homework";
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

type HomeworkModalProps = {
  academicYearId: number | null;
  assignmentOptions: SubjectAssignmentOption[];
  assignmentsLoading?: boolean;
  formResetKey?: number;
  onSuccess?: () => void;
};

const todayYmd = () => toYmdString(new Date());
const plusDaysYmd = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toYmdString(d);
};

const HomeworkModal = ({
  academicYearId,
  assignmentOptions,
  assignmentsLoading = false,
  formResetKey = 0,
  onSuccess,
}: HomeworkModalProps) => {
  const [assignmentId, setAssignmentId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [homeworkType, setHomeworkType] = useState<string | null>("Homework");
  const [assignDate, setAssignDate] = useState(todayYmd());
  const [dueDate, setDueDate] = useState(plusDaysYmd(7));
  const [status, setStatus] = useState<string | null>("Draft");
  const [isGraded, setIsGraded] = useState(true);
  const [maxMarks, setMaxMarks] = useState("10");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [resubmissionAllowed, setResubmissionAllowed] = useState(true);
  const [allowLateSubmission, setAllowLateSubmission] = useState(true);
  const [saving, setSaving] = useState(false);

  const selectedAssignment = useMemo(
    () => assignmentOptions.find((a) => String(a.id) === assignmentId) ?? null,
    [assignmentOptions, assignmentId]
  );

  const assignmentSelectOptions = useMemo(
    () =>
      assignmentOptions.map((a) => ({
        value: String(a.id),
        label: a.label,
      })),
    [assignmentOptions]
  );

  const resetForm = useCallback(() => {
    setAssignmentId(null);
    setTitle("");
    setDescription("");
    setInstructions("");
    setHomeworkType("Homework");
    setAssignDate(todayYmd());
    setDueDate(plusDaysYmd(7));
    setStatus("Draft");
    setIsGraded(true);
    setMaxMarks("10");
    setMaxAttempts("1");
    setResubmissionAllowed(true);
    setAllowLateSubmission(true);
  }, []);

  useEffect(() => {
    resetForm();
  }, [formResetKey, resetForm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (academicYearId == null) {
      Swal.fire({ icon: "warning", title: "Academic year required", text: "Select an academic year in the header." });
      return;
    }
    if (!selectedAssignment) {
      Swal.fire({ icon: "warning", title: "Class & subject required", text: "Choose a teacher assignment." });
      return;
    }
    if (!title.trim()) {
      Swal.fire({ icon: "warning", title: "Title required" });
      return;
    }
    if (!assignDate || !dueDate) {
      Swal.fire({ icon: "warning", title: "Dates required" });
      return;
    }
    if (assignDate > dueDate) {
      Swal.fire({ icon: "warning", title: "Due date must be on or after assign date" });
      return;
    }
    if (isGraded && (maxMarks === "" || Number.isNaN(Number(maxMarks)))) {
      Swal.fire({ icon: "warning", title: "Max marks required for graded homework" });
      return;
    }

    const payload = {
      academic_year_id: academicYearId,
      class_id: selectedAssignment.classId,
      class_section_id: selectedAssignment.classSectionId,
      class_subject_id: selectedAssignment.classSubjectId,
      teacher_assignment_id: selectedAssignment.id,
      title: title.trim(),
      description: description.trim() || null,
      instructions: instructions.trim() || null,
      homework_type: homeworkType || "Homework",
      assign_date: assignDate,
      due_date: dueDate,
      status: status || "Draft",
      is_graded: isGraded,
      max_marks: isGraded ? Number(maxMarks) : null,
      max_attempts: Math.max(1, parseInt(maxAttempts, 10) || 1),
      resubmission_allowed: resubmissionAllowed,
      allow_late_submission: allowLateSubmission,
      assignment_mode: "section" as const,
      student_ids: [] as number[],
      attachments: [] as unknown[],
    };

    try {
      setSaving(true);
      const res = await apiService.createHomework(payload);
      const count = res?.recipient_count ?? res?.data?.recipient_count;
      hideBsModal("add_home_work");
      resetForm();
      await Swal.fire({
        icon: "success",
        title: "Homework created",
        text: count != null ? `Assigned to ${count} student(s).` : undefined,
        timer: 2200,
        showConfirmButton: false,
      });
      onSuccess?.();
    } catch (err) {
      Swal.fire({ icon: "error", title: "Could not save", text: extractMessageFromApiError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal fade" id="add_home_work">
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title">Add Home Work</h4>
            <button
              type="button"
              className="btn-close custom-btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
            >
              <i className="ti ti-x" />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {academicYearId == null && (
                <div className="alert alert-warning py-2 mb-3">
                  Select an academic year from the header before creating homework.
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">
                  Class, section & subject <span className="text-danger">*</span>
                </label>
                <CommonSelect
                  className="select"
                  options={assignmentSelectOptions}
                  value={assignmentId}
                  onChange={setAssignmentId}
                  placeholder={
                    assignmentsLoading
                      ? "Loading assignments..."
                      : assignmentSelectOptions.length
                        ? "Select assignment"
                        : "No subject assignments for this year"
                  }
                  isDisabled={assignmentsLoading || assignmentSelectOptions.length === 0}
                />
                <p className="text-muted small mb-0 mt-1">
                  Whole section will receive this homework when saved.
                </p>
              </div>
              <div className="mb-3">
                <label className="form-label">
                  Title <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. Chapter 5 exercises"
                />
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Type</label>
                  <CommonSelect
                    className="select"
                    options={HOMEWORK_TYPE_OPTIONS}
                    value={homeworkType}
                    onChange={setHomeworkType}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Status</label>
                  <CommonSelect
                    className="select"
                    options={STATUS_OPTIONS}
                    value={status}
                    onChange={setStatus}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-md-6 mb-3">
                  <label className="form-label">Assign date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label">Due date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={dueDate}
                    min={assignDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Instructions</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </div>
              <div className="row align-items-end">
                <div className="col-md-4 mb-3">
                  <div className="form-check form-switch">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="hw-graded"
                      checked={isGraded}
                      onChange={(e) => setIsGraded(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="hw-graded">
                      Graded
                    </label>
                  </div>
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Max marks</label>
                  <input
                    type="number"
                    className="form-control"
                    min={0}
                    step={0.5}
                    disabled={!isGraded}
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(e.target.value)}
                  />
                </div>
                <div className="col-md-4 mb-3">
                  <label className="form-label">Max attempts</label>
                  <input
                    type="number"
                    className="form-control"
                    min={1}
                    max={20}
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                  />
                </div>
              </div>
              <div className="d-flex flex-wrap gap-4 mb-2">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="hw-resubmit"
                    checked={resubmissionAllowed}
                    onChange={(e) => setResubmissionAllowed(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="hw-resubmit">
                    Allow resubmission
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="hw-late"
                    checked={allowLateSubmission}
                    onChange={(e) => setAllowLateSubmission(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="hw-late">
                    Allow late submission
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
              </Link>
              <button type="submit" className="btn btn-primary" disabled={saving || academicYearId == null}>
                {saving ? "Saving..." : "Add Homework"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default HomeworkModal;
