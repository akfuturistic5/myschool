import { useRef, useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import PredefinedDateRanges from "../../../core/common/datePicker";
import {
  activeList,
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
  class_teacher_id: number | null;
  section_teacher_id: number | null;
  class_code?: string | null;
  /** From `classes` row (same for all section rows of that class). */
  max_students?: number | null;
  class_fee?: number | string | null;
  class_description?: string | null;
};

const Classes = () => {
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections, loading, error, refetch } = useClassesWithSections(academicYearId);
  const { teachers = [] } = useTeachers();
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const editModalRef = useRef<HTMLDivElement | null>(null);
  const [editingRow, setEditingRow] = useState<EditRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "danger" | "info">("info");
  const [selectedDeleteRow, setSelectedDeleteRow] = useState<EditRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState({
    className: "",
    classCode: "",
    maxStudents: "",
    classFee: "",
    description: "",
    isActive: true,
    classTeacherStaffId: "Select",
  });
  const [filterClass, setFilterClass] = useState("Select");
  const [filterStatus, setFilterStatus] = useState("Select");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [editForm, setEditForm] = useState({
    className: "",
    sectionName: "",
    isActive: true,
    teacherStaffId: "Select",
    classCode: "",
    maxStudents: "",
    classFee: "",
    description: "",
  });

  const teacherSelectOptions = useMemo(
    () => [
      { value: "Select", label: "No teacher assigned" },
      ...teachers.map((t: any) => ({
        value: String(t.staff_id),
        label: `${t.first_name || ""} ${t.last_name || ""}`.trim() || `Staff #${t.staff_id}`,
      })),
    ],
    [teachers]
  );

  useEffect(() => {
    if (editingRow) {
      setEditForm({
        className: editingRow.className,
        sectionName: editingRow.sectionName,
        isActive: editingRow.status === "Active",
        teacherStaffId:
          editingRow.sectionId != null
            ? editingRow.section_teacher_id != null
              ? String(editingRow.section_teacher_id)
              : "Select"
            : editingRow.class_teacher_id != null
              ? String(editingRow.class_teacher_id)
              : "Select",
        classCode: editingRow.class_code || "",
        maxStudents: editingRow.max_students != null ? String(editingRow.max_students) : "",
        classFee: editingRow.class_fee != null ? String(editingRow.class_fee) : "",
        description: editingRow.class_description || "",
      });
    }
  }, [editingRow]);

  /** Bootstrap sometimes leaves .modal-backdrop and body.modal-open after hide(); removes stuck overlay. */
  const cleanupModalBackdrops = () => {
    setTimeout(() => {
      document.querySelectorAll(".modal-backdrop").forEach((node) => node.remove());
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
    }, 150);
  };

  const showNotification = (msg: string, type: "success" | "danger" | "info" = "info") => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => {
      setMessage("");
    }, 5000);
  };

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
    cleanupModalBackdrops();
  };

  const handleEditSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editingRow) return;
    if (!editForm.className.trim()) {
      showNotification("Class name is required", "danger");
      return;
    }
    setSaving(true);
    try {
      let staffId: number | null = null;
      if (editForm.teacherStaffId && editForm.teacherStaffId !== "Select") {
        const n = parseInt(String(editForm.teacherStaffId), 10);
        staffId = Number.isNaN(n) ? null : n;
      }
      if (editingRow.sectionId) {
        // Update Section
        await apiService.updateSection(editingRow.sectionId, {
          section_name: editForm.sectionName,
          is_active: editForm.isActive,
          section_teacher_id: staffId,
        });
        
        // Also Update Class-level fields
        const parseNum = (s: string) => {
          const t = s.trim();
          if (t === "") return null;
          const n = Number(t);
          return Number.isNaN(n) ? null : n;
        };
        await apiService.updateClass(editingRow.classId, {
          class_name: editForm.className.trim(),
          class_code: editForm.classCode.trim() || null,
          max_students: parseNum(editForm.maxStudents),
          class_fee: parseNum(editForm.classFee),
          description: editForm.description.trim() || null,
          is_active: editForm.isActive, // Note: this updates class status too
          class_teacher_id: editingRow.class_teacher_id, // Keep class teacher same
        });
      } else {
        const parseNum = (s: string) => {
          const t = s.trim();
          if (t === "") return null;
          const n = Number(t);
          return Number.isNaN(n) ? null : n;
        };
        await apiService.updateClass(editingRow.classId, {
          class_name: editForm.className.trim(),
          class_code: editForm.classCode.trim() || null,
          max_students: parseNum(editForm.maxStudents),
          class_fee: parseNum(editForm.classFee),
          description: editForm.description.trim() || null,
          is_active: editForm.isActive,
          class_teacher_id: staffId,
        });
      }
      await refetch();
      showNotification("Updated successfully", "success");
      closeEditModalAndCleanup();
    } catch (err) {
      console.error("Failed to save:", err);
      showNotification("Failed to save changes", "danger");
    } finally {
      setSaving(false);
    }
  };

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.className.trim() || academicYearId == null) return;
    const academicYearIdNum = Number(academicYearId);
    if (!Number.isInteger(academicYearIdNum) || academicYearIdNum < 1) {
      showNotification("Please select a valid academic year in the header.", "danger");
      return;
    }
    setAdding(true);
    try {
      let classTeacherStaffId: number | null = null;
      if (addForm.classTeacherStaffId && addForm.classTeacherStaffId !== "Select") {
        const n = parseInt(String(addForm.classTeacherStaffId), 10);
        classTeacherStaffId = Number.isNaN(n) ? null : n;
      }
      const parseOptInt = (s: string) => {
        const t = s.trim();
        if (t === "") return undefined;
        const n = parseInt(t, 10);
        return Number.isNaN(n) ? undefined : n;
      };
      const parseOptFee = (s: string) => {
        const t = s.trim();
        if (t === "") return undefined;
        const n = Number(t);
        return Number.isNaN(n) ? undefined : n;
      };
      const payload: Record<string, unknown> = {
        class_name: addForm.className.trim(),
        academic_year_id: academicYearIdNum,
        is_active: addForm.isActive,
        class_teacher_id: classTeacherStaffId,
      };
      const code = addForm.classCode.trim();
      if (code) payload.class_code = code;
      const maxS = parseOptInt(addForm.maxStudents);
      if (maxS !== undefined) payload.max_students = maxS;
      const fee = parseOptFee(addForm.classFee);
      if (fee !== undefined) payload.class_fee = fee;
      const desc = addForm.description.trim();
      if (desc) payload.description = desc;

      const createRes = (await apiService.createClass(payload)) as {
        status?: string;
        message?: string;
        data?: unknown;
      };
      if (createRes?.status !== "SUCCESS") {
        throw new Error(createRes?.message || "Class was not created");
      }
      await refetch();
      
      // Close modal first
      const addEl = document.getElementById("add_class");
      if (addEl) {
        const bs = (window as any).bootstrap?.Modal;
        const modal = bs?.getInstance(addEl) ?? bs?.getOrCreateInstance(addEl);
        modal?.hide();
      }
      cleanupModalBackdrops();

      // Clear form and show success
      setAddForm({
        className: "",
        classCode: "",
        maxStudents: "",
        classFee: "",
        description: "",
        isActive: true,
        classTeacherStaffId: "Select",
      });
      showNotification("Class created successfully", "success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create class";
      showNotification(msg, "danger");
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
      showNotification("Deleted successfully", "success");
      setSelectedDeleteRow(null);
      const delEl = document.getElementById("delete-modal");
      if (delEl) {
        const bs = (window as any).bootstrap?.Modal;
        const modal = bs?.getInstance(delEl) ?? bs?.getOrCreateInstance(delEl);
        modal?.hide();
      }
      cleanupModalBackdrops();
    } catch {
      showNotification("Failed to delete record", "danger");
      const delEl = document.getElementById("delete-modal");
      if (delEl) {
        const bs = (window as any).bootstrap?.Modal;
        const modal = bs?.getInstance(delEl) ?? bs?.getOrCreateInstance(delEl);
        modal?.hide();
      }
      cleanupModalBackdrops();
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

  // Transform section-joined data to one row per class.
  const transformedData = useMemo(() => {
    const byClass = new Map<number, any>();
    classesWithSections.forEach((item: any) => {
      const classId = item.classId;
      if (!classId) return;
      if (!byClass.has(classId)) {
        byClass.set(classId, {
          id: classId,
          class: item.className || "N/A",
          classCode: item.classCode || "—",
          teacherStaffId: item.class_teacher_id ?? null,
          noOfStudents: 0,
          noOfSubjects: item.noOfSubjects || 0,
          status: item.classStatus ? "Active" : "Inactive",
          action: "",
          classId,
          sectionId: null,
          className: item.className || "N/A",
          sectionName: "",
          class_teacher_id: item.class_teacher_id ?? null,
          section_teacher_id: null,
          class_code: item.classCode ?? null,
          max_students: item.maxStudents ?? null,
          class_fee: item.classFee ?? null,
          class_description: item.classDescription ?? null,
        });
      }
      const row = byClass.get(classId);
      row.noOfStudents += Number(item.noOfStudents || 0);
      row.noOfSubjects = Math.max(Number(row.noOfSubjects || 0), Number(item.noOfSubjects || 0));
    });
    return Array.from(byClass.values()).map((row, index) => {
      const teacher = teachers.find((t: any) => String(t.staff_id) === String(row.teacherStaffId));
      const teacherDisplay = teacher
        ? `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || `Staff #${teacher.staff_id}`
        : "—";
      return {
        ...row,
        key: String(index + 1),
        teacher: teacherDisplay,
      };
    });
  }, [classesWithSections, teachers]);
  const dynamicClassOptions = useMemo(
    () => [{ value: "Select", label: "Select" }, ...Array.from(new Set(transformedData.map((r: any) => r.class))).map((v) => ({ value: v, label: v }))],
    [transformedData]
  );
  const filteredData = transformedData
    .filter((r: any) =>
      (filterClass === "Select" || r.class === filterClass) &&
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
      title: "Class code",
      dataIndex: "classCode",
      sorter: (a: any, b: any) =>
        String(a.classCode || "").localeCompare(String(b.classCode || "")),
    },
    {
      title: "Class teacher",
      dataIndex: "teacher",
      sorter: (a: TableData, b: TableData) =>
        String(a.teacher || "").localeCompare(String(b.teacher || "")),
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
                data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                aria-expanded="false"
              >
                <i className="ti ti-dots-vertical fs-14" />
              </Link>
              <ul className="dropdown-menu dropdown-menu-end p-2">
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
              <h3 className="page-title mb-1">Classes</h3>
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
          {message ? (
            <div className={`alert alert-${messageType} alert-dismissible fade show`} role="alert">
              {message}
              <button type="button" className="btn-close" onClick={() => setMessage("")} aria-label="Close"></button>
            </div>
          ) : null}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Classes</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
                </div>
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
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
                        <Link to="#" className="btn btn-light me-3" onClick={() => { setFilterClass("Select"); setFilterStatus("Select"); }}>
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
                    data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
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
      {/* /Page Wrapper */}
      <>
        {/* Add Classes */}
        <div className="modal fade" id="add_class">
          <div className="modal-dialog modal-dialog-centered modal-lg">
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
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Class name <span className="text-danger">*</span></label>
                        <input type="text" className="form-control" maxLength={50} value={addForm.className} onChange={(e) => setAddForm((f) => ({ ...f, className: e.target.value }))} required />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Class code</label>
                        <input type="text" className="form-control" maxLength={10} placeholder="e.g. C10" value={addForm.classCode} onChange={(e) => setAddForm((f) => ({ ...f, classCode: e.target.value }))} />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Max students</label>
                        <input type="number" className="form-control" min={1} max={10000} placeholder="Default 30 if empty" value={addForm.maxStudents} onChange={(e) => setAddForm((f) => ({ ...f, maxStudents: e.target.value }))} />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Class fee</label>
                        <input type="number" className="form-control" min={0} step="0.01" placeholder="Optional" value={addForm.classFee} onChange={(e) => setAddForm((f) => ({ ...f, classFee: e.target.value }))} />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Description</label>
                        <textarea className="form-control" rows={2} maxLength={5000} placeholder="Optional" value={addForm.description} onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))} />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Sections</label>
                        <input type="text" className="form-control bg-light" value="Add sections from Academic → Sections after creating the class" readOnly />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Class teacher (optional)</label>
                        <CommonSelect
                          className="select"
                          options={teacherSelectOptions}
                          defaultValue={teacherSelectOptions[0]}
                          onChange={(v) => setAddForm((f) => ({ ...f, classTeacherStaffId: v || "Select" }))}
                        />
                      </div>
                    </div>
                    <div className="col-12">
                      <p className="text-muted small mb-2">Subject count is derived from the Class Subject module when subjects are linked to this class.</p>
                    </div>
                    <div className="col-md-12">
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
          <div className="modal-dialog modal-dialog-centered modal-lg">
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
                          required
                          maxLength={50}
                        />
                      </div>
                    </div>
                    {/* Class-level fields - Always visible */}
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Class code</label>
                        <input
                          type="text"
                          className="form-control"
                          maxLength={10}
                          value={editForm.classCode}
                          onChange={(e) => setEditForm((f) => ({ ...f, classCode: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Max students</label>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          max={10000}
                          placeholder="Empty clears (optional)"
                          value={editForm.maxStudents}
                          onChange={(e) => setEditForm((f) => ({ ...f, maxStudents: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-3">
                        <label className="form-label">Class fee</label>
                        <input
                          type="number"
                          className="form-control"
                          min={0}
                          step="0.01"
                          value={editForm.classFee}
                          onChange={(e) => setEditForm((f) => ({ ...f, classFee: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          maxLength={5000}
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">
                          {editingRow?.sectionId != null ? "Section teacher" : "Class teacher"}
                        </label>
                        <CommonSelect
                          className="select"
                          options={teacherSelectOptions}
                          value={editForm.teacherStaffId}
                          onChange={(v) => setEditForm((f) => ({ ...f, teacherStaffId: v || "Select" }))}
                        />
                      </div>
                    </div>
                    <div className="col-md-12">
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





