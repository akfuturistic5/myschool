import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import Table from "../../../../core/common/dataTable/index";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { useClasses } from "../../../../core/hooks/useClasses";
import { all_routes } from "../../../router/all_routes";

const EXAM_TYPES = [
  "unit_test",
  "monthly",
  "quarterly",
  "half_yearly",
  "annual",
  "preboard",
  "internal",
  "other",
];

const Exam = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { user } = useCurrentUser();
  const { classes } = useClasses(academicYearId || null);
  const role = String(user?.role_name || user?.role || "").toLowerCase();
  const isAdminLike =
    role === "admin" || role === "headmaster" || role === "administrator" || role === "administrative";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    exam_name: "",
    exam_type: "unit_test",
    class_ids: [] as number[],
    description: "",
  });

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
        <Link
          to={`${routes.examSchedule}?examId=${record.id}`}
          className="btn btn-sm btn-outline-primary"
        >
          {isAdminLike ? "Manage" : "Timetable"}
        </Link>
      ),
    },
  ];

  const toggleClass = (classId: number) => {
    setForm((prev) => {
      const has = prev.class_ids.includes(classId);
      return {
        ...prev,
        class_ids: has ? prev.class_ids.filter((id) => id !== classId) : [...prev.class_ids, classId],
      };
    });
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
      setForm({ exam_name: "", exam_type: "unit_test", class_ids: [], description: "" });
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
        <div className="page-header">
          <h3 className="page-title">Exams</h3>
        </div>

        {message && <div className="alert alert-warning">{message}</div>}

        {isAdminLike && (
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">Create Exam</h5>
            </div>
            <div className="card-body">
              <form onSubmit={submit}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label">Exam name</label>
                    <input
                      className="form-control"
                      value={form.exam_name}
                      onChange={(ev) => setForm((p) => ({ ...p, exam_name: ev.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Exam type</label>
                    <select
                      className="form-select"
                      value={form.exam_type}
                      onChange={(ev) => setForm((p) => ({ ...p, exam_type: ev.target.value }))}
                    >
                      {EXAM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-5">
                    <label className="form-label">Classes</label>
                    <div className="border rounded p-2" style={{ maxHeight: 140, overflowY: "auto" }}>
                      {(classes || []).map((c: any) => (
                        <div key={c.id} className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`cls_${c.id}`}
                            checked={form.class_ids.includes(Number(c.id))}
                            onChange={() => toggleClass(Number(c.id))}
                          />
                          <label className="form-check-label" htmlFor={`cls_${c.id}`}>
                            {c.class_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-12">
                    <label className="form-label">Description</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={form.description}
                      onChange={(ev) => setForm((p) => ({ ...p, description: ev.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <button className="btn btn-primary me-2" type="submit" disabled={saving}>
                      {saving ? "Creating..." : "Create exam"}
                    </button>
                    <button
                      className="btn btn-outline-primary"
                      type="button"
                      disabled={saving}
                      onClick={() => createExam(true)}
                    >
                      {saving ? "Creating..." : "Create & Add Subjects"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">Exam List</h5>
            {loading && <span className="text-muted">Loading...</span>}
          </div>
          <div className="card-body p-0 py-2">
            <Table columns={columns} dataSource={tableData} Selection={false} showSearch />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Exam;
