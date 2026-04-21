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
  hasSections: boolean;
  activeSectionCount: number;
  assignmentRequiresSection: boolean;
};

type AssignmentRow = {
  id: number;
  teacherId: number;
  classId: number;
  sectionId: number | null;
  subjectId: number;
  className?: string;
  sectionName?: string | null;
  subjectName?: string;
  teacherFirstName?: string;
  teacherLastName?: string;
};

const TeacherAssignments = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes, loading: classesLoading } = useClasses(academicYearId);
  const { subjects, loading: subjectsLoading } = useSubjects(null, { academicYearId });

  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [classId, setClassId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [meta, setMeta] = useState<AssignmentMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const { sections, loading: sectionsLoading } = useSections(classId ? Number(classId) : null);
  const { teachers, loading: teachersLoading } = useTeachers();

  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await apiService.getTeacherAssignments(
        academicYearId ? { academicYearId } : {}
      );
      const raw = res?.data ?? [];
      setRows(Array.isArray(raw) ? raw : []);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load assignments");
      setRows([]);
    } finally {
      setListLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    if (!classId) {
      setMeta(null);
      setSectionId(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setMetaLoading(true);
      try {
        const res = await apiService.getTeacherAssignmentClassMeta(Number(classId));
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
  }, [classId]);

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
      .filter(
        (s: { class_id?: number | null }) =>
          s.class_id == null || String(s.class_id) === String(classId)
      )
      .map((s: { id: number; subject_name?: string }) => ({
        value: String(s.id),
        label: s.subject_name ?? String(s.id),
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

  const resetForm = () => {
    setTeacherId(null);
    setClassId(null);
    setSectionId(null);
    setSubjectId(null);
    setMeta(null);
    setEditingId(null);
    setFormError(null);
  };

  const onEdit = (row: AssignmentRow) => {
    setEditingId(row.id);
    setTeacherId(String(row.teacherId));
    setClassId(String(row.classId));
    setSectionId(row.sectionId != null ? String(row.sectionId) : null);
    setSubjectId(String(row.subjectId));
    setFormError(null);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!teacherId || !classId || !subjectId) {
      setFormError("Teacher, class, and subject are required.");
      return;
    }
    if (showSectionField && !sectionId) {
      setFormError("Section is required for this class.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        teacherId: Number(teacherId),
        classId: Number(classId),
        subjectId: Number(subjectId),
        sectionId: showSectionField && sectionId ? Number(sectionId) : null,
      };
      if (editingId != null) {
        await apiService.updateTeacherAssignment(editingId, body);
      } else {
        await apiService.createTeacherAssignment(body);
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
      await apiService.deleteTeacherAssignment(id);
      await loadList();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Delete failed");
    }
  };

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
              Assign teachers to class and subject. Sections appear only when the class uses sections.
            </p>
          </div>
        </div>

        <div className="card mb-4">
          <div className="card-header bg-light">
            <h4 className="text-dark mb-0">{editingId ? "Edit assignment" : "Add assignment"}</h4>
          </div>
          <div className="card-body">
            <form onSubmit={onSubmit}>
              {formError && <div className="alert alert-danger py-2">{formError}</div>}
              <div className="row g-3">
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Teacher</label>
                  <CommonSelect
                    className="select"
                    options={teacherOptions}
                    value={teacherId}
                    onChange={(v) => setTeacherId(v)}
                  />
                </div>
                <div className="col-md-6 col-lg-4">
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
                  <div className="col-md-6 col-lg-4">
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
                    {!sectionsLoading && sectionOptions.length === 0 && (
                      <div className="small text-warning mt-1">
                        No active sections for this class. Add sections under Academic → Class sections, or turn
                        off class sections in the class record.
                      </div>
                    )}
                  </div>
                )}
                <div className="col-md-6 col-lg-4">
                  <label className="form-label">Subject</label>
                  <CommonSelect
                    className="select"
                    options={subjectOptions}
                    value={subjectId}
                    onChange={(v) => setSubjectId(v)}
                  />
                  {subjectsLoading && <span className="small text-muted">Loading subjects…</span>}
                </div>
              </div>
              {classId && metaLoading && (
                <p className="small text-muted mt-2 mb-0">Checking class rules…</p>
              )}
              {classId && meta && !metaLoading && (
                <p className="small text-muted mt-2 mb-0">
                  {meta.assignmentRequiresSection
                    ? "This class has sections — pick a section."
                    : "This class is class-only — no section is stored."}
                </p>
              )}
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
            <h4 className="text-dark mb-0">Current assignments</h4>
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
                      <th>Subject</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-muted py-4">
                          No assignments yet.
                        </td>
                      </tr>
                    ) : (
                      rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <button
                              type="button"
                              className="btn btn-link p-0 text-start"
                              onClick={() => onEdit(r)}
                            >
                              {`${r.teacherFirstName ?? ""} ${r.teacherLastName ?? ""}`.trim() ||
                                `#${r.teacherId}`}
                            </button>
                          </td>
                          <td>{r.className ?? r.classId}</td>
                          <td>{r.sectionName ?? (r.sectionId == null ? "—" : r.sectionId)}</td>
                          <td>{r.subjectName ?? r.subjectId}</td>
                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => onDelete(r.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
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
