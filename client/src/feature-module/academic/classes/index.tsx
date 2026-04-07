import { useRef, useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../core/common/datePicker";
import {
  activeList,
  classSection,
  classSylabus,
} from "../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";

type EditRow = {
  classId: number;
  sectionId: number | null;
  className: string;
  sectionName: string;
  noOfStudents: number;
  noOfSubjects: number;
  status: string;
};

const Classes = () => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections, loading, error, refetch } = useClassesWithSections(academicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const editModalRef = useRef<HTMLDivElement | null>(null);
  const [editingRow, setEditingRow] = useState<EditRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedDeleteRow, setSelectedDeleteRow] = useState<EditRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({ className: "", noOfStudents: "", isActive: true });
  const [filterClass, setFilterClass] = useState("Select");
  const [filterSection, setFilterSection] = useState("Select");
  const [filterStatus, setFilterStatus] = useState("Select");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editForm, setEditForm] = useState({ className: "", sectionName: "", noOfStudents: "", noOfSubjects: "", isActive: true });

  useEffect(() => {
    if (editingRow) {
      setEditForm({
        className: editingRow.className,
        sectionName: editingRow.sectionName,
        noOfStudents: String(editingRow.noOfStudents),
        noOfSubjects: String(editingRow.noOfSubjects),
        isActive: editingRow.status === "Active",
      });
    }
  }, [editingRow]);

  const handleEditClick = (record: EditRow) => {
    setEditingRow(record);
    const el = document.getElementById("edit_class");
    if (el) {
      const modal = (window as any).bootstrap?.Modal?.getOrCreateInstance(el);
      if (modal) modal.show();
    }
  };

  const closeEditModalAndCleanup = () => {
    const el = document.getElementById("edit_class");
    if (el) {
      const modal = (window as any).bootstrap?.Modal?.getInstance(el);
      if (modal) modal.hide();
    }
    setEditingRow(null);
    // Fix: Remove leftover modal backdrop/overlay that blocks screen
    setTimeout(() => {
      document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
    }, 150);
  };

  const handleEditSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    setSaving(true);
    try {
      if (editingRow.sectionId) {
        await apiService.updateSection(editingRow.sectionId, {
          section_name: editForm.sectionName,
          no_of_students: parseInt(editForm.noOfStudents, 10) || 0,
          is_active: editForm.isActive,
        });
      } else {
        await apiService.updateClass(editingRow.classId, {
          class_name: editForm.className,
          no_of_students: parseInt(editForm.noOfStudents, 10) || null,
          is_active: editForm.isActive,
        });
      }
      await refetch();
      setMessage("Updated successfully");
      closeEditModalAndCleanup();
    } catch (err) {
      console.error("Failed to save:", err);
      setMessage("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.className.trim() || !academicYearId) return;
    setAdding(true);
    try {
      await apiService.createClass({
        class_name: addForm.className.trim(),
        academic_year_id: academicYearId,
        no_of_students: addForm.noOfStudents ? parseInt(addForm.noOfStudents, 10) : 0,
        is_active: addForm.isActive,
      });
      setAddForm({ className: "", noOfStudents: "", isActive: true });
      await refetch();
      setMessage("Class created successfully");
      const el = document.getElementById("add_class");
      const modal = (window as any).bootstrap?.Modal?.getInstance(el);
      modal?.hide();
    } catch {
      setMessage("Failed to create class");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDeleteRow) return;
    setDeleting(true);
    try {
      if (selectedDeleteRow.sectionId) await apiService.deleteSection(selectedDeleteRow.sectionId);
      else await apiService.deleteClass(selectedDeleteRow.classId);
      await refetch();
      setMessage("Deleted successfully");
      const modal = (window as any).bootstrap?.Modal?.getInstance(document.getElementById("delete-modal"));
      modal?.hide();
      setSelectedDeleteRow(null);
    } catch {
      setMessage("Failed to delete record");
    } finally {
      setDeleting(false);
    }
  };

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  
  const route = all_routes;

  // Transform API data to match table structure (id = classes table ID)
  const transformedData = classesWithSections.map((item: any, index: number) => ({
    key: (index + 1).toString(),
    id: item.classId,
    class: item.className || 'N/A',
    section: item.sectionName || 'N/A',
    noOfStudents: item.noOfStudents || 0,
    noOfSubjects: item.noOfSubjects || 0,
    status: item.status || 'Active',
    action: '',
    classId: item.classId,
    sectionId: item.sectionId ?? null,
    className: item.className || 'N/A',
    sectionName: item.sectionName || 'N/A',
  }));
  const dynamicClassOptions = useMemo(
    () => [{ value: "Select", label: "Select" }, ...Array.from(new Set(transformedData.map((r: any) => r.class))).map((v) => ({ value: v, label: v }))],
    [transformedData]
  );
  const dynamicSectionOptions = useMemo(
    () => [{ value: "Select", label: "Select" }, ...Array.from(new Set(transformedData.map((r: any) => r.section))).map((v) => ({ value: v, label: v }))],
    [transformedData]
  );
  const filteredData = transformedData
    .filter((r: any) =>
      (filterClass === "Select" || r.class === filterClass) &&
      (filterSection === "Select" || r.section === filterSection) &&
      (filterStatus === "Select" || r.status === filterStatus)
    )
    .sort((a: any, b: any) =>
      sortOrder === "asc" ? String(a.class).localeCompare(String(b.class)) : String(b.class).localeCompare(String(a.class))
    );

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (value: string) => (
        <>
          <Link to="#" className="link-primary">
            {value || "-"}
          </Link>
        </>
      ),
    },

    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => a.class.length - b.class.length,
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) =>
        a.section.length - b.section.length,
    },
    {
      title: "No of Student",
      dataIndex: "noOfStudents",
      sorter: (a: TableData, b: TableData) =>
        a.noOfStudents - b.noOfStudents,
    },
    {
      title: "No of Subjects",
      dataIndex: "noOfSubjects",
      sorter: (a: TableData, b: TableData) =>
        a.noOfSubjects - b.noOfSubjects,
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
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
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
                    onClick={(e) => {
                      e.preventDefault();
                      handleEditClick(record as EditRow);
                    }}
                  >
                    <i className="ti ti-edit-circle me-2" />
                    Edit
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedDeleteRow(record as EditRow);
                      const modal = (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("delete-modal"));
                      modal?.show();
                    }}
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

  // Show loading state
  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
            <div className="text-center">
              <i className="ti ti-alert-circle fs-1 text-danger mb-3"></i>
              <h4>Error Loading Classes</h4>
              <p className="text-muted">{error}</p>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Classes List</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={route.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Classes </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    All Classes
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
                  data-bs-target="#add_class"
                >
                  <i className="ti ti-square-rounded-plus-filled me-2" />
                  Add Class
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Classes List */}
          {message ? <div className="alert alert-info">{message}</div> : null}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Classes List</h4>
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
                    <form >
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom pb-0">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={dynamicClassOptions}
                                defaultValue={dynamicClassOptions[0]}
                                onChange={(v) => setFilterClass(v || "Select")}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={dynamicSectionOptions}
                                defaultValue={dynamicSectionOptions[0]}
                                onChange={(v) => setFilterSection(v || "Select")}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={activeList}
                                defaultValue={activeList[0]}
                                onChange={(v) => setFilterStatus(v || "Select")}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={() => { setFilterClass("Select"); setFilterSection("Select"); setFilterStatus("Select"); }}>
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
                      <Link to="#" className="dropdown-item rounded-1 active" onClick={() => setSortOrder("asc")}>
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1" onClick={() => setSortOrder("desc")}>
                        Descending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Viewed
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {/* Classes List */}
              <Table columns={columns} dataSource={filteredData} Selection={true} />
              {/* /Classes List */}
            </div>
          </div>
          {/* /Classes List */}
        </div>
      </div>
      ;{/* /Page Wrapper */}
      <>
        {/* Add Classes */}
        <div className="modal fade" id="add_class">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Class</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleAddClass}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Class Name</label>
                        <input type="text" className="form-control" value={addForm.className} onChange={(e) => setAddForm((f) => ({ ...f, className: e.target.value }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <input type="text" className="form-control" value="Manage section in Sections page" readOnly />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">No of Students</label>
                        <input type="text" className="form-control" value={addForm.noOfStudents} onChange={(e) => setAddForm((f) => ({ ...f, noOfStudents: e.target.value }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">No of Subjects</label>
                        <input type="text" className="form-control" />
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="form-check form-switch">
                          <input className="form-check-input" type="checkbox" role="switch" id="switch-sm" checked={addForm.isActive} onChange={(e) => setAddForm((f) => ({ ...f, isActive: e.target.checked }))} />
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
                  <button type="submit" className="btn btn-primary" disabled={adding}>{adding ? "Adding..." : "Add Class"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Add Classes */}
        {/* Edit Classes */}
        <div className="modal fade" id="edit_class" ref={editModalRef}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Class</h4>
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
                        <label className="form-label">Class Name</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Class Name"
                          value={editForm.className}
                          onChange={(e) => setEditForm((f) => ({ ...f, className: e.target.value }))}
                          readOnly={!!editingRow?.sectionId}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Section"
                          value={editForm.sectionName}
                          onChange={(e) => setEditForm((f) => ({ ...f, sectionName: e.target.value }))}
                          readOnly={!editingRow?.sectionId}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">No of Students</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter no of Students"
                          value={editForm.noOfStudents}
                          onChange={(e) => setEditForm((f) => ({ ...f, noOfStudents: e.target.value }))}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">No of Subjects</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter no of Subjects"
                          value={editForm.noOfSubjects}
                          onChange={(e) => setEditForm((f) => ({ ...f, noOfSubjects: e.target.value }))}
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
                            checked={editForm.isActive}
                            onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
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
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleEditSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Edit Classes */}
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
                    <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                      {deleting ? "Deleting..." : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Delete Modal */}
        {/* View Classes */}
        <div className="modal fade" id="view_class">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <div className="d-flex align-items-center">
                  <h4 className="modal-title">Class Details</h4>
                  <span className="badge badge-soft-success ms-2">
                    <i className="ti ti-circle-filled me-1 fs-5" />
                    Active
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form >
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-6">
                      <div className="class-detail-info">
                        <p>Class Name</p>
                        <span>III</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="class-detail-info">
                        <p>Section</p>
                        <span>A</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="class-detail-info">
                        <p>No of Subjects</p>
                        <span>05</span>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="class-detail-info">
                        <p>No of Students</p>
                        <span>25</span>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /View Classes */}
      </>
    </div>
  );
};

export default Classes;
