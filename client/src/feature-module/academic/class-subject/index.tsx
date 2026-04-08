import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Table from "../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";
import { useSubjects } from "../../../core/hooks/useSubjects";
import { useClasses } from "../../../core/hooks/useClasses";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";

const ClassSubject = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [classFilterId, setClassFilterId] = useState<string>("");
  const { classes = [] } = useClasses(academicYearId);
  const { subjects, loading, error, refetch } = useSubjects(classFilterId ? Number(classFilterId) : null);
  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({ subject_name: "", subject_code: "", class_id: "", type: "Theory", is_active: true });
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const classOptions = useMemo(() => [{ value: "", label: "All Classes" }, ...classes.map((c: any) => ({ value: String(c.id), label: c.class_name }))], [classes]);
  const data = (subjects ?? []).map((s: any, index: number) => ({
    key: String(s.id ?? index),
    id: s.id,
    name: s.subject_name || "N/A",
    code: s.subject_code || "N/A",
    type: (s.practical_hours || 0) > 0 ? "Practical" : "Theory",
    status: s.is_active ? "Active" : "Inactive",
    originalData: s,
  }));
  const handleApplyClick = () => dropdownMenuRef.current?.classList.remove("show");
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: any, record: any) => (
        <>
          <Link to="#" className="link-primary">
            {text || record.id || 'N/A'}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => String(a.id || "").localeCompare(String(b.id || "")),
    },

    {
      title: "Name",
      dataIndex: "name",
      sorter: (a: TableData, b: TableData) => String(a.name || "").localeCompare(String(b.name || "")),
    },
    {
      title: "Code",
      dataIndex: "code",
      sorter: (a: TableData, b: TableData) => String(a.code || "").localeCompare(String(b.code || "")),
    },
    {
      title: "Type",
      dataIndex: "type",
      sorter: (a: TableData, b: TableData) => String(a.type || "").localeCompare(String(b.type || "")),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Active" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : (
            <span className="badge badge-soft-danger d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          )}
        </>
      ),
      sorter: (a: TableData, b: TableData) => String(a.status || "").localeCompare(String(b.status || "")),
    },

    {
      title: "Action",
      dataIndex: "action",
      render: (text: any, record: any) => (
        <>
          <div className="d-flex align-items-center">
            <div className="dropdown">
              <Link
                to="#"
                className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="ti ti-dots-vertical fs-14" />
              </Link>
              <ul className="dropdown-menu dropdown-menu-right p-3">
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => { e.preventDefault(); setSelectedSubject(record); setForm({ subject_name: record.originalData?.subject_name || "", subject_code: record.originalData?.subject_code || "", class_id: String(record.originalData?.class_id || ""), type: record.type, is_active: record.status === "Active" }); (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("edit_subject"))?.show(); }}
                  >
                    <i className="ti ti-edit-circle me-2" />
                    Edit
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => { e.preventDefault(); setSelectedSubject(record); (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("delete-modal"))?.show(); }}
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </>
      ),
    },
  ];
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Subjects</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Academic </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Subjects
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
                <div className="mb-2">
                  <Link
                    to="#"
                    className="btn btn-primary"
                    data-bs-toggle="modal"
                    data-bs-target="#add_subject"
                  >
                    <i className="ti ti-square-rounded-plus-filled me-2" />
                    Add Subject
                  </Link>
                </div>
              </div>
            </div>
            {/* /Page Header */}
            {message ? <div className="alert alert-info">{message}</div> : null}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Class Subject</h4>
                <div className="d-flex align-items-center flex-wrap">
                  <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
                  </div>
                  <div className="dropdown mb-3 me-2">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown"
                      data-bs-auto-close="outside"
                    >
                      <i className="ti ti-filter me-2" />
                      Filter
                    </Link>
                    <div className="dropdown-menu drop-width"  ref={dropdownMenuRef}>
                      <form>
                        <div className="d-flex align-items-center border-bottom p-3">
                          <h4>Filter</h4>
                        </div>
                        <div className="p-3 border-bottom pb-0">
                          <div className="row">
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Name</label>
                                <CommonSelect
                                  className="select"
                                  options={classOptions}
                                  defaultValue={classOptions[0]}
                                  onChange={(v) => setClassFilterId(v || "")}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Code</label>
                                <CommonSelect
                                  className="select"
                                  options={count}
                                  defaultValue={count[0]}
                                   
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 d-flex align-items-center justify-content-end">
                          <Link to="#" className="btn btn-light me-3">
                            Reset
                          </Link>
                          <Link
                            to="#"
                            className="btn btn-primary"
                            onClick={handleApplyClick}
                          >
                            Apply
                          </Link>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="dropdown mb-3">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-sort-ascending-2 me-2" />
                      Sort by A-Z
                    </Link>
                    <ul className="dropdown-menu p-3">
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1 active"
                        >
                          Ascending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Descending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Viewed
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Added
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="card-body p-0 py-3">
                {/* Loading State */}
                {loading && (
                  <div className="text-center p-4">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2">Loading subjects data...</p>
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="text-center p-4">
                    <div className="alert alert-danger" role="alert">
                      <i className="ti ti-alert-circle me-2"></i>
                      {error}
                      <button 
                        className="btn btn-sm btn-outline-danger ms-3" 
                        onClick={refetch}
                      >
                        Retry
                      </button>
                    </div>
                  </div>
                )}

                {/* Subjects List */}
                {!loading && !error && (
                  <Table columns={columns} dataSource={data} Selection={true} />
                )}
                
                {/* /Subjects List */}
              </div>
            </div>
            {/* /Guardians List */}
          </div>
        </div>
        {/* /Page Wrapper */}
      </>
      <div>
        {/* Add Subject */}
        <div className="modal fade" id="add_subject">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Subject</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!form.subject_name.trim()) return;
                setIsSaving(true);
                try {
                  await apiService.createSubject({
                    subject_name: form.subject_name.trim(),
                    subject_code: form.subject_code || null,
                    class_id: form.class_id ? Number(form.class_id) : null,
                    practical_hours: form.type === "Practical" ? 1 : 0,
                    theory_hours: form.type === "Theory" ? 1 : 0,
                    is_active: form.is_active,
                  });
                  await refetch();
                  setMessage("Subject created successfully");
                  (window as any).bootstrap?.Modal?.getInstance(document.getElementById("add_subject"))?.hide();
                } catch { setMessage("Failed to create subject"); } finally { setIsSaving(false); }
              }}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Name</label>
                        <input type="text" className="form-control" value={form.subject_name} onChange={(e) => setForm((f) => ({ ...f, subject_name: e.target.value }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Code</label>
                        <input type="text" className="form-control" value={form.subject_code} onChange={(e) => setForm((f) => ({ ...f, subject_code: e.target.value }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Type</label>
                        <CommonSelect className="select" options={[{ value: "Theory", label: "Theory" }, { value: "Practical", label: "Practical" }]} defaultValue={{ value: form.type, label: form.type }} onChange={(v) => setForm((f) => ({ ...f, type: v || "Theory" }))} />
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="switch-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Saving..." : "Add Subject"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Add Subject */}
        {/* Edit Subject */}
        <div className="modal fade" id="edit_subject">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Subject</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={(e) => e.preventDefault()}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Name"
                          value={form.subject_name}
                          onChange={(e) => setForm((f) => ({ ...f, subject_name: e.target.value }))}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Code</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: form.subject_code || "custom", label: form.subject_code || "custom" }]}
                          defaultValue={{ value: form.subject_code || "custom", label: form.subject_code || "custom" }}
                        /><input className="form-control mt-2" value={form.subject_code} onChange={(e) => setForm((f) => ({ ...f, subject_code: e.target.value }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Type</label>
                        <CommonSelect
                          className="select"
                          options={[{ value: "Theory", label: "Theory" }, { value: "Practical", label: "Practical" }]}
                          defaultValue={{ value: form.type, label: form.type }}
                          onChange={(v) => setForm((f) => ({ ...f, type: v || "Theory" }))}
                        />
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="form-check form-switch">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            role="switch"
                            id="switch-sm2"
                            checked={form.is_active}
                            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link
                    to="#"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-primary"
                    onClick={async (e) => {
                      e.preventDefault();
                      const id = selectedSubject?.originalData?.id || selectedSubject?.id;
                      if (!id || isSaving || !form.subject_name.trim()) return;
                      setIsSaving(true);
                      try {
                        await apiService.updateSubject(id, {
                          subject_name: form.subject_name.trim(),
                          subject_code: form.subject_code || null,
                          class_id: form.class_id ? Number(form.class_id) : null,
                          practical_hours: form.type === "Practical" ? 1 : 0,
                          theory_hours: form.type === "Theory" ? 1 : 0,
                          is_active: form.is_active,
                        });
                        await refetch();
                        setMessage("Subject updated successfully");
                        (window as any).bootstrap?.Modal?.getInstance(document.getElementById("edit_subject"))?.hide();
                      } catch {
                        setMessage("Failed to update subject");
                      } finally {
                        setIsSaving(false);
                      }
                    }}
                  >
                    {isSaving ? "Updating..." : "Save Changes"}
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Edit Subject */}
        {/* Delete Modal */}
        <div className="modal fade" id="delete-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form >
                <div className="modal-body text-center">
                  <span className="delete-icon">
                    <i className="ti ti-trash-x" />
                  </span>
                  <h4>Confirm Deletion</h4>
                  <p>
                    You want to delete all the marked items, this cant be undone
                    once you delete.
                  </p>
                  <div className="d-flex justify-content-center">
                    <Link
                      to="#"
                      className="btn btn-light me-3"
                      data-bs-dismiss="modal"
                    >
                      Cancel
                    </Link>
                    <button type="button" className="btn btn-danger" disabled={isSaving} onClick={async () => {
                      const id = selectedSubject?.originalData?.id || selectedSubject?.id;
                      if (!id) return;
                      setIsSaving(true);
                      try {
                        await apiService.deleteSubject(id);
                        await refetch();
                        setMessage("Subject deleted successfully");
                        (window as any).bootstrap?.Modal?.getInstance(document.getElementById("delete-modal"))?.hide();
                      } catch {
                        setMessage("Failed to delete subject");
                      } finally { setIsSaving(false); }
                    }}>{isSaving ? "Deleting..." : "Yes, Delete"}</button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Delete Modal */}
      </div>
    </div>
  );
};

export default ClassSubject;
