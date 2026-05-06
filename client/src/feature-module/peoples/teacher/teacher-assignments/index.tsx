import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import CommonSelect from "../../../../core/common/commonSelect";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSections } from "../../../../core/hooks/useSections";
import { useSubjects } from "../../../../core/hooks/useSubjects";
import { useTeachers } from "../../../../core/hooks/useTeachers";

type AssignmentMeta = {
  classId: number;
  className?: string;
  activeSectionCount: number;
  assignmentRequiresSection: boolean;
};

type SubjectAssignmentRow = {
  id: number;
  teacherId: number;
  classId: number;
  classSectionId: number | null;
  subjectId: number;
  className?: string;
  sectionName?: string | null;
  subjectName?: string;
  subjectType?: string;
  teacherFirstName?: string;
  teacherLastName?: string;
};

type ClassAssignmentRow = {
  id: number;
  teacherId: number;
  classId: number;
  classSectionId: number | null;
  role: string;
  className?: string;
  sectionName?: string | null;
  teacherFirstName?: string;
  teacherLastName?: string;
};

const TeacherAssignments = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes, loading: classesLoading } = useClasses(academicYearId);
  const { teachers, loading: teachersLoading } = useTeachers();

  const [activeTab, setActiveTab] = useState<"class" | "subject">("class");

  // Form State
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [role, setRole] = useState<string>("primary");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Meta & Hooks
  const [meta, setMeta] = useState<AssignmentMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const { sections, loading: sectionsLoading } = useSections(classId ? Number(classId) : null, { academicYearId });
  const { subjects, loading: subjectsLoading } = useSubjects(classId ? Number(classId) : null, { academicYearId });

  // List State
  const [classRows, setClassRows] = useState<ClassAssignmentRow[]>([]);
  const [subjectRows, setSubjectRows] = useState<SubjectAssignmentRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      if (activeTab === "class") {
        const res = await apiService.getClassTeacherAssignments(
          academicYearId ? { academicYearId } : {}
        );
        setClassRows(Array.isArray(res?.data) ? res.data : []);
      } else {
        const res = await apiService.getSubjectTeacherAssignments(
          academicYearId ? { academicYearId } : {}
        );
        setSubjectRows(Array.isArray(res?.data) ? res.data : []);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load assignments");
    } finally {
      setListLoading(false);
    }
  }, [academicYearId, activeTab]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!classId || !academicYearId) {
      setMeta(null);
      setSectionId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setMetaLoading(true);
      try {
        const res = await apiService.getTeacherAssignmentClassMeta(Number(classId), academicYearId);
        const d = res?.data;
        if (!cancelled && d) setMeta(d as AssignmentMeta);
      } catch {
        if (!cancelled) setMeta(null);
      } finally {
        if (!cancelled) setMetaLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [classId, academicYearId]);

  const showSectionField = Boolean(meta?.assignmentRequiresSection);
  
  const sectionOptions = useMemo(
    () =>
      (sections || []).map((s: { id: number; section_name?: string }) => ({
        value: String(s.id),
        label: s.section_name ?? String(s.id),
      })),
    [sections]
  );

  const subjectOptions = useMemo(() => {
    if (!classId) return [];
    return (subjects || [])
      .map((s: { id: number; subject_name?: string; subject_type?: string; master_subject_id?: number }) => ({
        value: String(s.master_subject_id || s.id),
        label: `${s.subject_name ?? String(s.id)} ${s.subject_type ? `(${s.subject_type})` : ""}`.trim(),
      }));
  }, [subjects, classId]);

  const teacherOptions = useMemo(
    () =>
      (teachers || []).map((t: { id: number; first_name?: string; last_name?: string }) => ({
        value: String(t.id),
        label: `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || String(t.id),
      })),
    [teachers]
  );

  const classOptions = useMemo(
    () =>
      (classes || []).map((c: { id: number; class_name?: string }) => ({
        value: String(c.id),
        label: c.class_name ?? String(c.id),
      })),
    [classes]
  );

  const roleOptions = [
    { value: "primary", label: "Primary" },
    { value: "assistant", label: "Assistant" },
  ];

  const resetForm = () => {
    setTeacherId(null);
    setClassId(null);
    setSectionId(null);
    setSubjectId(null);
    setRole("primary");
    setMeta(null);
    setEditingId(null);
    setFormError(null);
  };

  const onEdit = (row: any) => {
    setEditingId(row.id);
    setTeacherId(String(row.teacherId));
    setClassId(String(row.classId));
    setSectionId(row.classSectionId != null ? String(row.classSectionId) : null);
    if (activeTab === "subject") {
      setSubjectId(String(row.subjectId));
    } else {
      setRole(row.role || "primary");
    }
    setFormError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!teacherId || !classId || (activeTab === "subject" && !subjectId)) {
      setFormError(`Teacher, class${activeTab === "subject" ? ", and subject" : ""} are required.`);
      return;
    }
    if (showSectionField && !sectionId) {
      setFormError("Section is required for this class.");
      return;
    }
    setSaving(true);
    try {
      const commonBody = {
        teacherId: Number(teacherId),
        classId: Number(classId),
        classSectionId: showSectionField && sectionId ? Number(sectionId) : null,
        academicYearId,
      };

      if (activeTab === "class") {
        const body = { ...commonBody, role };
        if (editingId != null) {
          await apiService.updateClassTeacherAssignment(editingId, body);
        } else {
          await apiService.createClassTeacherAssignment(body);
        }
      } else {
        const body = { ...commonBody, subjectId: Number(subjectId) };
        if (editingId != null) {
          await apiService.updateSubjectTeacherAssignment(editingId, body);
        } else {
          await apiService.createSubjectTeacherAssignment(body);
        }
      }
      resetForm();
      await loadList();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!window.confirm("Remove this assignment?")) return;
    try {
      if (activeTab === "class") {
        await apiService.deleteClassTeacherAssignment(id);
      } else {
        await apiService.deleteSubjectTeacherAssignment(id);
      }
      await loadList();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  useEffect(() => {
    resetForm();
  }, [activeTab]);

  return (
    <div className="page-wrapper">
      <div className="content content-two">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <Link
              to={routes.teacherList}
              className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
            >
              <i className="ti ti-arrow-left me-1" />
              Back
            </Link>
            <h3 className="mb-1">Teacher assignments</h3>
            <p className="text-muted mb-0 small">
              Assign teachers to classes or specific subjects.
            </p>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-body p-0">
            <ul className="nav nav-tabs nav-tabs-bottom">
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "class" ? "active" : ""}`}
                  onClick={() => setActiveTab("class")}
                >
                  Class Teacher Assignments
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link ${activeTab === "subject" ? "active" : ""}`}
                  onClick={() => setActiveTab("subject")}
                >
                  Subject Teacher Assignments
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="card mb-4" key={`${activeTab}-${editingId}`}>
          <div className="card-header bg-light">
            <h4 className="text-dark mb-0">
              {editingId ? "Edit " : "Add "}
              {activeTab === "class" ? "Class Teacher" : "Subject Teacher"} Assignment
            </h4>
          </div>
          <div className="card-body">
            <form onSubmit={onSubmit}>
              {formError && <div className="alert alert-danger py-2">{formError}</div>}
              <div className="row g-3">
                <div className="col-md-6 col-lg-3">
                  <label className="form-label">Teacher</label>
                  <CommonSelect
                    className="select"
                    options={teacherOptions}
                    value={teacherId}
                    onChange={(v) => setTeacherId(v)}
                  />
                </div>
                <div className="col-md-6 col-lg-3">
                  <label className="form-label">Class</label>
                  <CommonSelect
                    className="select"
                    options={classOptions}
                    value={classId}
                    onChange={(v) => {
                      setClassId(v);
                      if (!editingId) setSectionId(null);
                      setSubjectId(null);
                    }}
                  />
                  {classesLoading && <span className="small text-muted">Loading classes…</span>}
                </div>
                {showSectionField && (
                  <div className="col-md-6 col-lg-3">
                    <label className="form-label">
                      Section <span className="text-danger">*</span>
                    </label>
                    <CommonSelect
                      className="select"
                      options={sectionOptions}
                      value={sectionId}
                      onChange={(v) => setSectionId(v)}
                    />
                    {sectionsLoading && <span className="small text-muted">Loading sections…</span>}
                  </div>
                )}
                {activeTab === "subject" ? (
                  <div className="col-md-6 col-lg-3">
                    <label className="form-label">Subject</label>
                    <CommonSelect
                      className="select"
                      options={subjectOptions}
                      value={subjectId}
                      onChange={(v) => setSubjectId(v)}
                    />
                    {subjectsLoading && <span className="small text-muted">Loading subjects…</span>}
                  </div>
                ) : (
                  <div className="col-md-6 col-lg-3">
                    <label className="form-label">Role</label>
                    <CommonSelect
                      className="select"
                      options={roleOptions}
                      value={role}
                      onChange={(v) => setRole(v || "primary")}
                    />
                  </div>
                )}
              </div>
              <div className="mt-3">
                <button type="submit" className="btn btn-primary me-2" disabled={saving}>
                  {saving ? "Saving…" : editingId ? "Update" : "Add"}
                </button>
                {editingId != null && (
                  <button type="button" className="btn btn-light" onClick={resetForm} disabled={saving}>
                    Cancel edit
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header bg-light">
            <h4 className="text-dark mb-0">Current {activeTab === "class" ? "Class" : "Subject"} Assignments</h4>
          </div>
          <div className="card-body p-0">
            {listError && <div className="alert alert-danger m-3 mb-0">{listError}</div>}
            {listLoading ? (
              <div className="p-4 text-center text-muted">Loading…</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Teacher</th>
                      <th>Class</th>
                      <th>Section</th>
                      {activeTab === "subject" ? (
                        <>
                          <th>Subject</th>
                          <th>Type</th>
                        </>
                      ) : (
                        <th>Role</th>
                      )}
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTab === "class" ? (
                      classRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">No class teacher assignments yet.</td>
                        </tr>
                      ) : (
                        classRows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button type="button" className="btn btn-link p-0 text-start" onClick={() => onEdit(r)}>
                                {`${r.teacherFirstName ?? ""} ${r.teacherLastName ?? ""}`.trim() || `#${r.teacherId}`}
                              </button>
                            </td>
                            <td>{r.className}</td>
                            <td>{r.sectionName || "—"}</td>
                            <td><span className={`badge ${r.role === "primary" ? "bg-primary" : "bg-secondary"}`}>{r.role}</span></td>
                            <td className="text-end">
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(r.id)}>Remove</button>
                            </td>
                          </tr>
                        ))
                      )
                    ) : (
                      subjectRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center text-muted py-4">No subject teacher assignments yet.</td>
                        </tr>
                      ) : (
                        subjectRows.map((r) => (
                          <tr key={r.id}>
                            <td>
                              <button type="button" className="btn btn-link p-0 text-start" onClick={() => onEdit(r)}>
                                {`${r.teacherFirstName ?? ""} ${r.teacherLastName ?? ""}`.trim() || `#${r.teacherId}`}
                              </button>
                            </td>
                            <td>{r.className}</td>
                            <td>{r.sectionName || "—"}</td>
                            <td>{r.subjectName}</td>
                            <td>
                              {r.subjectType && (
                                <span className={`badge ${r.subjectType === "Practical" ? "bg-info" : "bg-warning-light text-warning"}`}>
                                  {r.subjectType}
                                </span>
                              )}
                            </td>
                            <td className="text-end">
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => onDelete(r.id)}>Remove</button>
                            </td>
                          </tr>
                        ))
                      )
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

export default TeacherAssignments;





