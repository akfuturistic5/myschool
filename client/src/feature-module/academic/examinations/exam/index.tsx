import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import Table from "../../../../core/common/dataTable/index";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { useClasses } from "../../../../core/hooks/useClasses";
import { all_routes } from "../../../router/all_routes";

const Exam = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { user } = useCurrentUser();
  const { classes } = useClasses();
  const role = String((user as any)?.role_name || (user as any)?.role || "").toLowerCase();
  const isAdminLike =
    role === "admin" || role === "headmaster" || role === "administrator" || role === "administrative";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingExamId, setDeletingExamId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [examTypes, setExamTypes] = useState<string[]>([]);
  const [form, setForm] = useState({
    exam_name: "",
    exam_type: "",
    class_ids: [] as number[],
    description: "",
  });

  const loadExamTypes = async () => {
    try {
      const res = await apiService.getExamTypes();
      const types = Array.isArray(res?.data) ? res.data.map((t: any) => t.type_name) : [];
      setExamTypes(types);
      if (types.length > 0) {
        setForm((p) => ({ ...p, exam_type: p.exam_type || types[0] }));
      }
    } catch (e) {
      console.error("loadExamTypes", e);
    }
  };

  const loadExams = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiService.listExams({
        academic_year_id: academicYearId || undefined,
      });
      setRows(Array.isArray((res as any)?.data) ? (res as any).data : []);
    } catch (e: any) {
      setMessage(e?.message || "Failed to load exams");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExamTypes();
    loadExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId]);

  const tableData = useMemo(
    () =>
      rows.map((r) => ({
        id: r.id,
        examName: r.exam_name,
        examType: r.exam_type,
        classes: Array.isArray(r.class_names) ? r.class_names.join(", ") : "—",
        createdAt: r.created_at ? new Date(r.created_at).toLocaleDateString() : "—",
      })),
    [rows]
  );

  const classOptions = useMemo(() => {
    const rows = Array.isArray(classes) ? classes : [];
    return rows
      .map((c: any) => {
        const className = String(c?.class_name ?? "").trim();
        const classCode = String(c?.class_code ?? "").trim();
        return {
          id: Number(c?.id),
          className,
          label: classCode ? `${className} (${classCode})` : className,
        };
      })
      .filter((c) => Number.isFinite(c.id) && c.id > 0 && c.className)
      .sort((a, b) => a.className.localeCompare(b.className) || a.id - b.id);
  }, [classes]);

  const columns = [
    { title: "ID", dataIndex: "id" },
    { title: "Exam Name", dataIndex: "examName" },
    { title: "Exam Type", dataIndex: "examType" },
    { title: "Classes", dataIndex: "classes" },
    { title: "Created", dataIndex: "createdAt" },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex gap-2">
          <Link
            to={`${routes.examSchedule}?examId=${record.id}`}
            className="btn btn-sm btn-outline-primary"
          >
            {isAdminLike ? "Manage" : "Timetable"}
          </Link>
          {isAdminLike && (
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              disabled={deletingExamId === Number(record.id)}
              onClick={() => handleDeleteExam(Number(record.id), String(record.examName || "this exam"))}
            >
              {deletingExamId === Number(record.id) ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      ),
    },
  ];

  const handleDeleteExam = async (examId: number, examName: string) => {
    if (!Number.isFinite(examId) || examId <= 0) return;
    const confirmed = window.confirm(
      `Delete exam "${examName}"?\n\nThis will permanently remove timetable and marks linked to this exam.`
    );
    if (!confirmed) return;
    setDeletingExamId(examId);
    setMessage(null);
    try {
      await apiService.deleteExam(examId);
      setMessage("Exam deleted successfully.");
      await loadExams();
    } catch (err: any) {
      setMessage(err?.message || "Failed to delete exam");
    } finally {
      setDeletingExamId(null);
    }
  };

  const toggleClass = (classId: number) => {
    setForm((prev) => {
      const has = prev.class_ids.includes(classId);
      return {
        ...prev,
        class_ids: has ? prev.class_ids.filter((id) => id !== classId) : [...prev.class_ids, classId],
      };
    });
  };

  const selectAllClasses = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setForm((prev) => ({ ...prev, class_ids: classOptions.map((c) => c.id) }));
    } else {
      setForm((prev) => ({ ...prev, class_ids: [] }));
    }
  };

  const createExam = async (manageAfterCreate = false) => {
    if (!form.exam_name.trim()) {
      setMessage("Exam name is required.");
      return;
    }
    if (!form.class_ids.length) {
      setMessage("Select at least one class.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await apiService.createExam({
        exam_name: form.exam_name.trim(),
        exam_type: form.exam_type,
        class_ids: form.class_ids,
        academic_year_id: academicYearId || null,
        description: form.description || null,
      });
      const createdExamId = Number((res as any)?.data?.id);
      setForm({ exam_name: "", exam_type: examTypes[0] || "", class_ids: [], description: "" });
      setMessage("Exam created successfully.");
      await loadExams();
      if (manageAfterCreate && Number.isFinite(createdExamId) && createdExamId > 0) {
        navigate(`${routes.examSchedule}?examId=${createdExamId}`);
      }
    } catch (err: any) {
      setMessage(err?.message || "Failed to create exam");
    } finally {
      setSaving(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createExam(false);
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Exams</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Examinations
                </li>
              </ol>
            </nav>
          </div>
        </div>

        {message && (
          <div className={`alert ${message.includes("success") ? "alert-success" : "alert-warning"} alert-dismissible fade show`} role="alert">
            {message}
            <button type="button" className="btn-close" onClick={() => setMessage(null)} />
          </div>
        )}

        {isAdminLike && (
          <div className="card border-0 shadow-sm mb-4">
            <div className="card-header bg-transparent border-bottom">
              <h5 className="card-title mb-0">
                <i className="ti ti-plus me-2 text-primary" />
                Create New Exam
              </h5>
            </div>
            <div className="card-body">
              <form onSubmit={submit}>
                <div className="row g-4">
                  <div className="col-lg-4 col-md-6">
                    <label className="form-label fw-semibold">Exam Name</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Mid-Term Examination"
                      value={form.exam_name}
                      onChange={(ev) => setForm((p) => ({ ...p, exam_name: ev.target.value }))}
                    />
                  </div>
                  <div className="col-lg-3 col-md-6">
                    <label className="form-label fw-semibold">Exam Type</label>
                    <select
                      className="form-select text-capitalize"
                      value={form.exam_type}
                      onChange={(ev) => setForm((p) => ({ ...p, exam_type: ev.target.value }))}
                    >
                      {examTypes.length === 0 && <option value="">Loading types...</option>}
                      {examTypes.map((t) => (
                        <option key={t} value={t}>
                          {t.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-lg-5 col-12">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <label className="form-label fw-semibold mb-0">
                        Target Classes 
                        <span className="badge bg-soft-primary text-primary ms-2">
                          {form.class_ids.length} Selected
                        </span>
                      </label>
                      <div className="form-check form-check-inline me-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="selectAll"
                          checked={classOptions.length > 0 && form.class_ids.length === classOptions.length}
                          onChange={selectAllClasses}
                        />
                        <label className="form-check-label small text-muted" htmlFor="selectAll">
                          Select All
                        </label>
                      </div>
                    </div>
                    <div className="border rounded p-3 bg-light-gray" style={{ maxHeight: "160px", overflowY: "auto" }}>
                      <div className="row row-cols-2 row-cols-sm-3 g-2">
                        {classOptions.map((c) => (
                          <div key={c.id} className="col">
                            <div className="form-check custom-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`cls_${c.id}`}
                                checked={form.class_ids.includes(Number(c.id))}
                                onChange={() => toggleClass(Number(c.id))}
                              />
                              <label className="form-check-label small text-dark text-truncate d-block" htmlFor={`cls_${c.id}`} title={c.label}>
                                {c.label}
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                      {classOptions.length === 0 && (
                        <div className="text-center py-2 text-muted small">No classes available</div>
                      )}
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label fw-semibold">Description</label>
                    <textarea
                      className="form-control"
                      placeholder="Add any additional notes or instructions for this exam..."
                      rows={3}
                      value={form.description}
                      onChange={(ev) => setForm((p) => ({ ...p, description: ev.target.value }))}
                    />
                  </div>
                  <div className="col-12 d-flex gap-2">
                    <button className="btn btn-primary d-flex align-items-center" type="submit" disabled={saving}>
                      {saving ? (
                        <span className="spinner-border spinner-border-sm me-2" />
                      ) : (
                        <i className="ti ti-device-floppy me-2" />
                      )}
                      Create Exam
                    </button>
                    <button
                      className="btn btn-outline-primary d-flex align-items-center"
                      type="button"
                      disabled={saving}
                      onClick={() => createExam(true)}
                    >
                      <i className="ti ti-table-plus me-2" />
                      Create & Add Subjects
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">
              <i className="ti ti-list me-2 text-primary" />
              Existing Exams
            </h5>
            {loading && (
              <div className="spinner-border spinner-border-sm text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            )}
          </div>
          <div className="card-body p-0">
            <Table columns={columns} dataSource={tableData} Selection={false} showSearch />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Exam;





