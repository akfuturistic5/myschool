import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import { extractMessageFromApiError } from "../../../core/utils/apiErrorMessage";
import { toYmdString } from "../../../core/utils/dateDisplay";
import type { HomeworkSectionStudent, SubjectAssignmentOption } from "../../../core/types/homework";
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

type AssignmentMode = "section" | "students";

const hideBsModal = (id: string) => {
  const el = document.getElementById(id);
  if (!el) return;
  const bootstrap = (window as {
    bootstrap?: { Modal?: { getInstance: (n: Element) => { hide: () => void } | null; new (n: Element): { hide: () => void } } };
  }).bootstrap;
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
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("section");
  const [sectionStudents, setSectionStudents] = useState<HomeworkSectionStudent[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);

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

  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return sectionStudents;
    return sectionStudents.filter((s) => {
      const name = String(s.student_name || "").toLowerCase();
      const roll = String(s.roll_number ?? "").toLowerCase();
      const adm = String(s.admission_number ?? "").toLowerCase();
      return name.includes(q) || roll.includes(q) || adm.includes(q);
    });
  }, [sectionStudents, studentSearch]);

  const resetForm = useCallback(() => {
    setAssignmentId(null);
    setAssignmentMode("section");
    setSectionStudents([]);
    setStudentSearch("");
    setSelectedStudentIds([]);
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

  const loadSectionStudents = useCallback(async () => {
    if (!selectedAssignment || academicYearId == null) {
      setSectionStudents([]);
      return;
    }
    setStudentsLoading(true);
    try {
      const res = await apiService.getHomeworkSectionStudents(
        selectedAssignment.classSectionId,
        academicYearId
      );
      const list = Array.isArray(res?.data) ? res.data : [];
      setSectionStudents(
        list.map((row: Record<string, unknown>) => ({
          student_id: Number(row.student_id),
          student_name: String(row.student_name || "").trim() || `Student #${row.student_id}`,
          roll_number: row.roll_number != null ? String(row.roll_number) : null,
          admission_number: row.admission_number != null ? String(row.admission_number) : null,
        }))
      );
    } catch (err) {
      setSectionStudents([]);
      console.error("loadSectionStudents:", err);
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedAssignment, academicYearId]);

  useEffect(() => {
    setSelectedStudentIds([]);
    setStudentSearch("");
    if (assignmentMode === "students" && selectedAssignment) {
      loadSectionStudents();
    } else if (assignmentMode === "section") {
      setSectionStudents([]);
    }
  }, [assignmentId, assignmentMode, loadSectionStudents, selectedAssignment]);

  const handleAssignmentChange = (value: string | null) => {
    setAssignmentId(value);
    setSelectedStudentIds([]);
    setStudentSearch("");
  };

  const toggleAllFiltered = (checked: boolean) => {
    if (!checked) {
      setSelectedStudentIds([]);
      return;
    }
    setSelectedStudentIds(filteredStudents.map((s) => s.student_id));
  };

  const toggleStudent = (studentId: number, checked: boolean) => {
    if (checked) {
      setSelectedStudentIds((prev) => (prev.includes(studentId) ? prev : [...prev, studentId]));
    } else {
      setSelectedStudentIds((prev) => prev.filter((id) => id !== studentId));
    }
  };

  const allFilteredSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedStudentIds.includes(s.student_id));

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
    if (assignmentMode === "students" && selectedStudentIds.length === 0) {
      Swal.fire({ icon: "warning", title: "Select students", text: "Choose at least one student to assign homework." });
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
      assignment_mode: assignmentMode,
      student_ids: assignmentMode === "students" ? selectedStudentIds : [],
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

  const sectionStudentCount = sectionStudents.length;
  const assignHint =
    assignmentMode === "section"
      ? sectionStudentCount > 0
        ? `All ${sectionStudentCount} active student(s) in this section will receive the homework.`
        : "Select a class assignment to see how many students will be included."
      : `${selectedStudentIds.length} of ${sectionStudentCount || "—"} student(s) selected.`;

  return (
    <div className="modal fade" id="add_home_work">
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div
          className="modal-content d-flex flex-column"
          style={{ maxHeight: "min(90vh, 900px)" }}
        >
          <div className="modal-header flex-shrink-0">
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
          <form
            id="homework-add-form"
            onSubmit={handleSubmit}
            className="d-flex flex-column flex-grow-1 overflow-hidden"
            style={{ minHeight: 0 }}
          >
            <div
              className="modal-body overflow-y-auto flex-grow-1"
              style={{ maxHeight: "calc(90vh - 140px)" }}
            >
              {academicYearId == null && (
                <div className="alert alert-warning py-2 mb-3">
                  Select an academic year from the header before creating homework.
                </div>
              )}

              <div className="border rounded p-3 mb-3 bg-light">
                <h6 className="mb-3 text-dark">Class &amp; assignment</h6>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label mb-1">
                      Class, section, subject &amp; teacher <span className="text-danger">*</span>
                    </label>
                    <CommonSelect
                      className="select"
                      options={assignmentSelectOptions}
                      value={assignmentId}
                      onChange={handleAssignmentChange}
                      placeholder={
                        assignmentsLoading
                          ? "Loading assignments..."
                          : assignmentSelectOptions.length
                            ? "Select assignment"
                            : "No subject assignments for this year"
                      }
                      isDisabled={assignmentsLoading || assignmentSelectOptions.length === 0}
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded p-3 mb-3">
                <h6 className="mb-3 text-dark">Assign to</h6>
                <div className="row g-3 align-items-start">
                  <div className="col-md-6">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="hw-assign-mode"
                        id="hw-mode-section"
                        checked={assignmentMode === "section"}
                        onChange={() => setAssignmentMode("section")}
                      />
                      <label className="form-check-label" htmlFor="hw-mode-section">
                        <strong>Whole class / section</strong>
                        <span className="d-block text-muted small">Default — all students in the section</span>
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="hw-assign-mode"
                        id="hw-mode-students"
                        checked={assignmentMode === "students"}
                        disabled={!selectedAssignment}
                        onChange={() => setAssignmentMode("students")}
                      />
                      <label className="form-check-label" htmlFor="hw-mode-students">
                        <strong>Specific students</strong>
                        <span className="d-block text-muted small">Select one or more students from the list</span>
                      </label>
                    </div>
                  </div>
                  <div className="col-12">
                    <p className="text-muted small mb-0">{assignHint}</p>
                  </div>
                </div>

                {assignmentMode === "students" && (
                  <div className="mt-3 pt-3 border-top">
                    {!selectedAssignment ? (
                      <p className="text-muted small mb-0">Select a class assignment above to load students.</p>
                    ) : studentsLoading ? (
                      <p className="text-muted small mb-0">Loading students...</p>
                    ) : sectionStudentCount === 0 ? (
                      <p className="text-warning small mb-0">No active students found in this section.</p>
                    ) : (
                      <>
                        <div className="row g-3 mb-2">
                          <div className="col-md-8">
                            <label className="form-label mb-1">Search student</label>
                            <input
                              className="form-control"
                              value={studentSearch}
                              onChange={(e) => setStudentSearch(e.target.value)}
                              placeholder="Name, roll no., or admission no."
                            />
                          </div>
                          <div className="col-md-4 d-flex align-items-end">
                            <span className="badge bg-soft-primary w-100 text-center py-2">
                              {selectedStudentIds.length} selected
                            </span>
                          </div>
                        </div>
                        <div
                          className="table-responsive border rounded"
                          style={{ maxHeight: "220px", overflowY: "auto" }}
                        >
                          <table className="table table-sm mb-0">
                            <thead className="thead-light sticky-top bg-white">
                              <tr>
                                <th style={{ width: "48px" }}>
                                  <input
                                    type="checkbox"
                                    checked={allFilteredSelected}
                                    onChange={(e) => toggleAllFiltered(e.target.checked)}
                                    aria-label="Select all visible students"
                                  />
                                </th>
                                <th>Name</th>
                                <th>Roll</th>
                                <th>Admission</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredStudents.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="text-muted text-center py-3">
                                    No students match your search.
                                  </td>
                                </tr>
                              ) : (
                                filteredStudents.map((s) => {
                                  const checked = selectedStudentIds.includes(s.student_id);
                                  return (
                                    <tr key={s.student_id}>
                                      <td>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => toggleStudent(s.student_id, e.target.checked)}
                                          aria-label={`Select ${s.student_name}`}
                                        />
                                      </td>
                                      <td>{s.student_name}</td>
                                      <td>{s.roll_number || "—"}</td>
                                      <td>{s.admission_number || "—"}</td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div className="border rounded p-3 mb-3">
                <h6 className="mb-3 text-dark">Homework details</h6>
                <div className="row g-3">
                  <div className="col-12">
                    <label className="form-label mb-1">
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
                  <div className="col-md-3">
                    <label className="form-label mb-1">Type</label>
                    <CommonSelect
                      className="select"
                      options={HOMEWORK_TYPE_OPTIONS}
                      value={homeworkType}
                      onChange={setHomeworkType}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label mb-1">Status</label>
                    <CommonSelect
                      className="select"
                      options={STATUS_OPTIONS}
                      value={status}
                      onChange={setStatus}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label mb-1">Assign date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={assignDate}
                      onChange={(e) => setAssignDate(e.target.value)}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label mb-1">Due date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={dueDate}
                      min={assignDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label mb-1">Description</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Short summary for students and parents"
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label mb-1">Instructions</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      placeholder="What students should do"
                    />
                  </div>
                </div>
              </div>

              <div className="border rounded p-3">
                <h6 className="mb-3 text-dark">Grading &amp; submission rules</h6>
                <div className="row g-3 align-items-end">
                  <div className="col-md-4">
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
                  <div className="col-md-4">
                    <label className="form-label mb-1">Max marks</label>
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
                  <div className="col-md-4">
                    <label className="form-label mb-1">Max attempts</label>
                    <input
                      type="number"
                      className="form-control"
                      min={1}
                      max={20}
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(e.target.value)}
                    />
                  </div>
                  <div className="col-12">
                    <div className="d-flex flex-wrap gap-4">
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
                </div>
              </div>
            </div>
            <div className="modal-footer flex-shrink-0 border-top bg-white">
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
