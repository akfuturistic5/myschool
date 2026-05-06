import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import Table from "../../../../core/common/dataTable/index";
import { apiService } from "../../../../core/services/apiService";
import { all_routes } from "../../../router/all_routes";
import TooltipOption from "../../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../../core/utils/exportUtils";

type GradeRow = {
  id: number;
  grade: string;
  min_percentage: number;
  max_percentage: number;
  percentage_label?: string;
  status: string;
  is_active?: boolean;
};

type GradeForm = {
  grade: string;
  min_percentage: string;
  max_percentage: string;
  is_active: boolean;
};

const Grade = () => {
  const routes = all_routes;
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [addForm, setAddForm] = useState<GradeForm>({
    grade: "",
    min_percentage: "",
    max_percentage: "",
    is_active: true,
  });
  const [editForm, setEditForm] = useState<GradeForm>({
    grade: "",
    min_percentage: "",
    max_percentage: "",
    is_active: true,
  });

  const extractErrorMessage = (err: any, fallback: string) => {
    const raw = String(err?.message || "").trim();
    const jsonStart = raw.indexOf("{");
    if (jsonStart >= 0) {
      try {
        const parsed = JSON.parse(raw.slice(jsonStart));
        const msg = String(parsed?.message || parsed?.error || "").trim();
        if (msg) return msg;
      } catch {
        // fall through to plain message parsing
      }
    }
    if (raw) return raw;
    return fallback;
  };

  const resetAddForm = () => {
    setAddForm({
      grade: "",
      min_percentage: "",
      max_percentage: "",
      is_active: true,
    });
  };

  const resetEditState = () => {
    setEditingId(null);
    setIsEditModalOpen(false);
    setEditForm({
      grade: "",
      min_percentage: "",
      max_percentage: "",
      is_active: true,
    });
  };

  const loadGrades = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiService.getExamGradeScale();
      const data = Array.isArray((res as any)?.data) ? (res as any).data : [];
      setRows(data);
      if (!data.length) {
        setMessage("No grade scale configured.");
      }
    } catch (e: any) {
      setRows([]);
      setMessage(e?.message || "Failed to load grade scale.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGrades();
  }, []);

  const onEdit = (row: GradeRow) => {
    const resolvedId = Number((row as any)?.id);
    if (!Number.isFinite(resolvedId) || resolvedId <= 0) {
      void Swal.fire("Error", "Selected grade could not be opened for edit. Please refresh and try again.", "error");
      return;
    }
    setEditingId(resolvedId);
    setEditForm({
      grade: String((row as any)?.grade || ""),
      min_percentage: String((row as any)?.min_percentage ?? ""),
      max_percentage: String((row as any)?.max_percentage ?? ""),
      is_active: (row as any)?.is_active !== false && String((row as any)?.status || "").toLowerCase() !== "inactive",
    });
    setIsEditModalOpen(true);
    setMessage(null);
  };

  const onDelete = async (id: number, grade: string) => {
    const confirm = await Swal.fire({
      title: "Delete Grade?",
      text: `Are you sure you want to delete "${grade}"?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Delete",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;
    setSaving(true);
    setMessage(null);
    try {
      await apiService.deleteExamGradeScale(id);
      await loadGrades();
      if (editingId === id) resetEditState();
      await Swal.fire("Success", "Grade deleted successfully.", "success");
    } catch (e: any) {
      await Swal.fire("Error", extractErrorMessage(e, "Failed to delete grade."), "error");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      grade: addForm.grade.trim(),
      min_percentage: Number(addForm.min_percentage),
      max_percentage: Number(addForm.max_percentage),
      is_active: addForm.is_active,
    };
    setSaving(true);
    setMessage(null);
    try {
      await apiService.createExamGradeScale(payload);
      await Swal.fire("Success", "Grade added successfully.", "success");
      resetAddForm();
      await loadGrades();
    } catch (err: any) {
      await Swal.fire("Error", extractErrorMessage(err, "Failed to save grade."), "error");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    const payload = {
      grade: editForm.grade.trim(),
      min_percentage: Number(editForm.min_percentage),
      max_percentage: Number(editForm.max_percentage),
      is_active: editForm.is_active,
    };
    setSaving(true);
    setMessage(null);
    try {
      await apiService.updateExamGradeScale(editingId, payload);
      await Swal.fire("Success", "Grade updated successfully.", "success");
      resetEditState();
      await loadGrades();
    } catch (err: any) {
      await Swal.fire("Error", extractErrorMessage(err, "Failed to update grade."), "error");
    } finally {
      setSaving(false);
    }
  };

  const tableData = useMemo(
    () =>
      rows.map((r) => ({
        id: Number(r.id),
        grade: String(r.grade || "-"),
        percentage: String(r.percentage_label || `${r.min_percentage ?? 0}% - ${Math.floor(Number(r.max_percentage ?? 0))}%`),
        status: r.is_active === false ? "Inactive" : String(r.status || "Active"),
        raw: r,
      })),
    [rows]
  );

  const exportColumns = useMemo(
    () => [
      { title: "ID", dataKey: "id" },
      { title: "Grade", dataKey: "grade" },
      { title: "Percentage", dataKey: "percentage" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const exportRows = useMemo(
    () =>
      tableData.map((row) => ({
        id: row.id,
        grade: row.grade,
        percentage: row.percentage,
        status: row.status,
      })),
    [tableData]
  );

  const showNothingToExport = useCallback(() => {
    void Swal.fire({
      icon: "info",
      title: "Nothing to export",
      text: "Grade list is empty.",
      timer: 2200,
      showConfirmButton: false,
    });
  }, []);

  const handleRefresh = useCallback(() => {
    void loadGrades();
  }, []);

  const handlePrint = useCallback(() => {
    if (!exportRows.length) {
      showNothingToExport();
      return;
    }
    printData("Grade List", exportColumns, exportRows);
  }, [exportColumns, exportRows, showNothingToExport]);

  const handleExportPdf = useCallback(() => {
    if (!exportRows.length) {
      showNothingToExport();
      return;
    }
    const stamp = new Date().toISOString().split("T")[0];
    exportToPDF(exportRows, "Grade List", `grade-list_${stamp}`, exportColumns);
  }, [exportColumns, exportRows, showNothingToExport]);

  const handleExportExcel = useCallback(() => {
    if (!exportRows.length) {
      showNothingToExport();
      return;
    }
    const stamp = new Date().toISOString().split("T")[0];
    exportToExcel(exportRows, `grade-list_${stamp}`, "Grade List");
  }, [exportRows, showNothingToExport]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (value: any) => (
        <>
          <Link to="#" className="link-primary">
            {value}
          </Link>
        </>
      ),
      sorter: (a: any, b: any) => Number(a.id) - Number(b.id),
    },
    {
      title: "Grade",
      dataIndex: "grade",
      sorter: (a: any, b: any) => a.grade.localeCompare(b.grade),
    },
    {
      title: "Percentage",
      dataIndex: "percentage",
      sorter: (a: any, b: any) => a.percentage.localeCompare(b.percentage),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value: any) => (
        <>
          <span className={`badge ${String(value).toLowerCase() === "inactive" ? "badge-soft-danger" : "badge-soft-success"} d-inline-flex align-items-center`}>
            <i className="ti ti-circle-filled fs-5 me-1"></i>{value || "Active"}
          </span>
        </>
      ),
      sorter: (a: any, b: any) => a.status.localeCompare(b.status),
    },
    {
      title: "Action",
      dataIndex: "action",
      key: "action",
      render: (_: any, record: any) => (
        <div className="d-flex gap-2">
          <button
            className="btn btn-sm btn-outline-primary"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit((record?.raw || record) as GradeRow);
            }}
            disabled={saving}
          >
            Edit
          </button>
          <button
            className="btn btn-sm btn-outline-danger"
            type="button"
            onClick={() => onDelete(Number(record.id), String(record.grade))}
            disabled={saving}
          >
            Delete
          </button>
        </div>
      ),
    },
  ];
  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Grade</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Academic </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Grade
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption
              onRefresh={handleRefresh}
              onPrint={handlePrint}
              onExportPdf={handleExportPdf}
              onExportExcel={handleExportExcel}
            />
            </div>
          </div>
          {/* /Page Header */}
          {message && <div className="alert alert-warning">{message}</div>}

          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">Add Grade</h5>
            </div>
            <div className="card-body">
              <form onSubmit={onSubmitAdd}>
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label">Grade</label>
                    <input
                      className="form-control"
                      value={addForm.grade}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, grade: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Min %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="form-control"
                      value={addForm.min_percentage}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, min_percentage: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Max %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      className="form-control"
                      value={addForm.max_percentage}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, max_percentage: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-3 d-flex align-items-end">
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="add-grade-active"
                        checked={addForm.is_active}
                        onChange={(e) => setAddForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                      />
                      <label className="form-check-label" htmlFor="add-grade-active">
                        Is Active
                      </label>
                    </div>
                  </div>
                </div>
                <div className="mt-3 d-flex gap-2">
                  <button className="btn btn-primary" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Add Grade"}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Grade List</h4>
              {loading && <p className="text-muted mb-3">Loading...</p>}
            </div>
            <div className="card-body p-0 py-3">
              <Table columns={columns} dataSource={tableData} Selection={false} />
            </div>
          </div>
          {isEditModalOpen && (
            <>
              <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true">
                <div className="modal-dialog modal-md modal-dialog-centered" role="document">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Edit Grade</h5>
                      <button type="button" className="btn-close" onClick={resetEditState} disabled={saving}></button>
                    </div>
                    <div className="modal-body">
                      <form onSubmit={onSubmitEdit}>
                        <div className="row g-3">
                          <div className="col-12">
                            <label className="form-label">Grade</label>
                            <input
                              className="form-control"
                              value={editForm.grade}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, grade: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Min %</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="form-control"
                              value={editForm.min_percentage}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, min_percentage: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="col-md-6">
                            <label className="form-label">Max %</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="100"
                              className="form-control"
                              value={editForm.max_percentage}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, max_percentage: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="col-12">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id="edit-grade-active"
                                checked={editForm.is_active}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                              />
                              <label className="form-check-label" htmlFor="edit-grade-active">
                                Is Active
                              </label>
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 d-flex gap-2">
                          <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? "Saving..." : "Update Grade"}
                          </button>
                          <button type="button" className="btn btn-outline-secondary" onClick={resetEditState} disabled={saving}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-backdrop fade show"></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Grade;





