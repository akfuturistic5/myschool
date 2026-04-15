import { useRef, useState, useEffect, useMemo } from "react";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import { useClassRooms } from "../../../core/hooks/useClassRooms";
import { apiService } from "../../../core/services/apiService";
import Table from "../../../core/common/dataTable/index";
import {
  activeList,
  
} from "../../../core/common/selectoption/selectoption";

import type { TableData } from "../../../core/data/interface";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import { Link } from "react-router-dom";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";

/**
 * After async submit + React state updates, Bootstrap 5 sometimes leaves `.modal-backdrop`
 * and `modal-open` on `body`, so the page looks dimmed and does not accept clicks.
 * Same mitigation as Classes edit modal (see classes/index.tsx).
 */
function cleanupBootstrapModalArtifacts() {
  setTimeout(() => {
    document.querySelectorAll(".modal-backdrop").forEach((el) => el.remove());
    document.body.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  }, 150);
}

function hideBootstrapModalByElement(modalEl: HTMLElement | null) {
  const bs = (window as any).bootstrap;
  if (modalEl && bs?.Modal?.getOrCreateInstance) {
    bs.Modal.getOrCreateInstance(modalEl).hide();
  }
  cleanupBootstrapModalArtifacts();
}

/**
 * Wait until the modal is fully hidden (backdrop removed by Bootstrap) before React refetches.
 * Refetching while the modal is closing can leave a stuck `.modal-backdrop` / `modal-open` on `body`.
 */
function hideBootstrapModalAndWaitForClosed(modalEl: HTMLElement | null): Promise<void> {
  return new Promise((resolve) => {
    if (!modalEl) {
      cleanupBootstrapModalArtifacts();
      resolve();
      return;
    }
    const bs = (window as any).bootstrap;
    const inst = bs?.Modal?.getOrCreateInstance?.(modalEl);
    if (!inst?.hide) {
      cleanupBootstrapModalArtifacts();
      resolve();
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      cleanupBootstrapModalArtifacts();
      resolve();
    };
    const t = window.setTimeout(finish, 600);
    const onHidden = () => {
      window.clearTimeout(t);
      modalEl.removeEventListener("hidden.bs.modal", onHidden);
      finish();
    };
    modalEl.addEventListener("hidden.bs.modal", onHidden, { once: true });
    inst.hide();
  });
}

const ClassSection = () => {
  const routes = all_routes;
  const { sections, loading, error, refetch } = useSections();
  const { teachers = [] } = useTeachers();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes = [] } = useClasses(academicYearId);
  const { classRooms = [] } = useClassRooms();
  const [selectedSection, setSelectedSection] = useState<any>(null);
  const [editSectionName, setEditSectionName] = useState<string>('');
  const [editSectionStatus, setEditSectionStatus] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [addForm, setAddForm] = useState({
    section_name: '',
    class_id: '',
    is_active: true,
    section_teacher_staff_id: 'Select',
    max_students: '',
    room_number: 'Select',
    description: '',
  });
  const [editSectionTeacherStaffId, setEditSectionTeacherStaffId] = useState<string>('Select');
  const [editMaxStudents, setEditMaxStudents] = useState<string>('');
  const [editRoomNumber, setEditRoomNumber] = useState<string>('Select');
  const [editDescription, setEditDescription] = useState<string>('');
  const [filterSection, setFilterSection] = useState("Select");
  const [filterStatus, setFilterStatus] = useState("Select");
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const editModalRef = useRef<HTMLDivElement | null>(null);
  
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const classOptions = useMemo(
    () => [{ value: "Select", label: "Select" }, ...classes.map((c: any) => ({ value: String(c.id), label: c.class_name }))],
    [classes]
  );
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
  const sectionOptions = useMemo(
    () => [{ value: "Select", label: "Select" }, ...Array.from(new Set((sections || []).map((s: any) => s.section_name))).map((s) => ({ value: s, label: s }))],
    [sections]
  );

  /** Rooms from `class_rooms` that are available for assignment (Active only). */
  const availableClassRooms = useMemo(
    () =>
      (classRooms || []).filter((r: any) => {
        const s = String(r.status ?? "Active").trim().toLowerCase();
        return s === "active";
      }),
    [classRooms]
  );

  const labelForRoom = (r: any) => {
    const no = String(r.room_no ?? "").trim();
    const bits = [r.building, r.floor].filter(Boolean);
    if (!no) return "";
    return bits.length ? `${no} (${bits.join(" · ")})` : no;
  };

  const roomOptionsForAdd = useMemo(() => {
    const first = { value: "Select", label: "No room assigned" };
    const rest = availableClassRooms
      .map((r: any) => {
        const value = String(r.room_no ?? "").trim();
        return {
          value,
          label: labelForRoom(r) || value,
        };
      })
      .filter((o) => o.value !== "");
    return [first, ...rest];
  }, [availableClassRooms]);

  /** Edit: include legacy `sections.room_number` if it is not in the active list (e.g. old free text or inactive room). */
  const roomOptionsForEdit = useMemo(() => {
    const first = { value: "Select", label: "No room assigned" };
    const rest = availableClassRooms.map((r: any) => ({
      value: String(r.room_no ?? "").trim(),
      label: labelForRoom(r) || String(r.room_no ?? "").trim(),
    })).filter((o) => o.value !== "");
    const all = [first, ...rest];
    const v =
      editRoomNumber && editRoomNumber !== "Select" ? editRoomNumber.trim() : "";
    if (v && !all.some((o) => o.value === v)) {
      return [...all, { value: v, label: `${v} (current)` }];
    }
    return all;
  }, [availableClassRooms, editRoomNumber]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.section_name.trim() || !addForm.class_id) return;
    setIsCreating(true);
    try {
      let sectionTeacherId: number | null = null;
      if (addForm.section_teacher_staff_id && addForm.section_teacher_staff_id !== "Select") {
        const n = parseInt(String(addForm.section_teacher_staff_id), 10);
        sectionTeacherId = Number.isNaN(n) ? null : n;
      }
      const payload: Record<string, unknown> = {
        section_name: addForm.section_name.trim(),
        class_id: Number(addForm.class_id),
        is_active: addForm.is_active,
        section_teacher_id: sectionTeacherId,
      };
      const ms = addForm.max_students.trim();
      if (ms !== '') {
        const n = parseInt(ms, 10);
        if (!Number.isNaN(n)) payload.max_students = n;
      }
      if (addForm.room_number && addForm.room_number !== "Select") {
        payload.room_number = addForm.room_number.trim();
      }
      const desc = addForm.description.trim();
      if (desc !== '') payload.description = desc;
      await apiService.createSection(payload);
      await refetch();
      setMessage('Section created successfully');
      setAddForm({
        section_name: '',
        class_id: '',
        is_active: true,
        section_teacher_staff_id: 'Select',
        max_students: '',
        room_number: 'Select',
        description: '',
      });
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      hideBootstrapModalByElement(document.getElementById("add_class_section"));
    } finally { setIsCreating(false); }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSection?.id) return;
    setIsDeleting(true);
    try {
      await apiService.deleteSection(selectedSection.id);
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await hideBootstrapModalAndWaitForClosed(document.getElementById("delete-modal"));
      await refetch();
      setMessage('Section deleted successfully');
    } finally { setIsDeleting(false); }
  };

  // Handle edit button click
  const handleEditClick = (section: any) => {
    setSelectedSection(section);
    setEditSectionName(section?.section_name || '');
    setEditSectionTeacherStaffId(
      section?.section_teacher_id != null ? String(section.section_teacher_id) : 'Select'
    );
    setEditMaxStudents(section?.max_students != null ? String(section.max_students) : '');
    const rawRoom =
      section?.room_number != null ? String(section.room_number).trim() : "";
    setEditRoomNumber(rawRoom === "" ? "Select" : rawRoom);
    setEditDescription(section?.description != null ? String(section.description) : '');
    // Handle is_active - Backend should normalize to boolean, but be defensive
    let isActive = false;
    if (section?.is_active === true || section?.is_active === 'true' || section?.is_active === 1 || section?.is_active === 't' || section?.is_active === 'T') {
      isActive = true;
    } else {
      // Everything else is false
      isActive = false;
    }
    setEditSectionStatus(isActive);
    
    // Show modal using Bootstrap
    const modalElement = document.getElementById('edit_class_section');
    if (modalElement) {
      // Use Bootstrap 5 modal API
      const bootstrap = (window as any).bootstrap;
      if (bootstrap && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.show();
        } else {
          const newModal = new bootstrap.Modal(modalElement);
          newModal.show();
        }
      }
    }
  };

  // Handle delete button click
  const handleDeleteClick = (section: any) => {
    setSelectedSection(section);
    const modalElement = document.getElementById('delete-modal');
    if (modalElement) {
      const bootstrap = (window as any).bootstrap;
      if (bootstrap && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.show();
        } else {
          const newModal = new bootstrap.Modal(modalElement);
          newModal.show();
        }
      }
    }
  };

  // Handle save edit form submission
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSection || !selectedSection.id) {
      console.error('No section selected for editing');
      alert('No section selected for editing');
      return;
    }

    if (!editSectionName || editSectionName.trim() === '') {
      alert('Section name is required');
      return;
    }

    try {
      setIsUpdating(true);

      let sectionTeacherId: number | null = null;
      if (editSectionTeacherStaffId && editSectionTeacherStaffId !== 'Select') {
        const n = parseInt(String(editSectionTeacherStaffId), 10);
        sectionTeacherId = Number.isNaN(n) ? null : n;
      }
      let maxStudentsVal: number | null = null;
      if (editMaxStudents.trim() === '') {
        maxStudentsVal = null;
      } else {
        const n = parseInt(editMaxStudents.trim(), 10);
        maxStudentsVal = Number.isNaN(n) ? null : n;
      }
      const updateData: Record<string, unknown> = {
        section_name: editSectionName.trim(),
        is_active: editSectionStatus,
        section_teacher_id: sectionTeacherId,
        max_students: maxStudentsVal,
        room_number: editRoomNumber === "Select" ? null : editRoomNumber.trim(),
        description: editDescription.trim() === '' ? null : editDescription.trim(),
      };

      const response = await apiService.updateSection(selectedSection.id, updateData);

      if (response && response.status === 'SUCCESS') {
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        hideBootstrapModalByElement(document.getElementById("edit_class_section"));

        await refetch();
        setMessage('Section updated successfully');

        // Reset form
        setSelectedSection(null);
        setEditSectionName('');
        setEditSectionStatus(true);
        setEditSectionTeacherStaffId('Select');
        setEditMaxStudents('');
        setEditRoomNumber('Select');
        setEditDescription('');
      } else {
        const errorMsg = response?.message || 'Failed to update section';
        console.error('Update failed:', errorMsg);
        alert(errorMsg);
      }
    } catch (err: any) {
      console.error('=== ERROR UPDATING SECTION ===');
      console.error('Error:', err);
      console.error('Error message:', err?.message);
      console.error('Error stack:', err?.stack);
      
      let errorMessage = 'Failed to update section. Please try again.';
      if (err?.message) {
        errorMessage = `Error: ${err.message}`;
      }
      alert(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  // Reset edit form when modal is closed
  useEffect(() => {
    const editModalElement = document.getElementById('edit_class_section');
    if (editModalElement) {
      const handleModalHidden = () => {
        setSelectedSection(null);
        setEditSectionName('');
        setEditSectionStatus(true);
        setEditSectionTeacherStaffId('Select');
        setEditMaxStudents('');
        setEditRoomNumber('Select');
        setEditDescription('');
      };
      
      editModalElement.addEventListener('hidden.bs.modal', handleModalHidden);
      
      return () => {
        editModalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
      };
    }
  }, []);

  // Transform API data to match table structure
  const transformedData = sections.map((section: any, index: number) => {
    const rawValue = section.is_active;
    
    // Convert to boolean - backend should already normalize, but be defensive
    let isActive = false;
    
    // Primary check: boolean true
    if (rawValue === true) {
      isActive = true;
    }
    // Primary check: boolean false
    else if (rawValue === false) {
      isActive = false;
    }
    // String check
    else if (typeof rawValue === 'string') {
      const lowerVal = rawValue.toLowerCase().trim();
      if (lowerVal === 'true' || lowerVal === 't' || lowerVal === '1') {
        isActive = true;
      } else {
        isActive = false;
      }
    }
    // Number check
    else if (typeof rawValue === 'number') {
      isActive = rawValue === 1 || rawValue > 0;
    }
    // Null/undefined check - default to false
    else if (rawValue === null || rawValue === undefined) {
      isActive = false;
    }
    // Fallback - default to false
    else {
      isActive = false;
    }
    
    // Ensure status is always a string
    const status: string = isActive === true ? 'Active' : 'Inactive';
    
    const teacherDisplay = [section.teacher_first_name, section.teacher_last_name].filter(Boolean).join(' ').trim();
    const cap =
      section.max_students != null && section.max_students !== ''
        ? String(section.max_students)
        : '—';
    const roomDisp =
      section.room_number != null && String(section.room_number).trim() !== ''
        ? String(section.room_number).trim()
        : '—';
    return {
      key: section.id?.toString() || (index + 1).toString(),
      id: section.id?.toString() || `SE${String(index + 1).padStart(6, '0')}`,
      sectionName: section.section_name || 'N/A',
      sectionTeacher: teacherDisplay || '—',
      maxStudents: cap,
      roomNumber: roomDisp,
      status: status,
      sectionData: {
        ...section,
        is_active: isActive // Ensure sectionData also has normalized boolean
      }
    };
  }).filter((row: any) => (filterSection === "Select" || row.sectionName === filterSection) && (filterStatus === "Select" || row.status === filterStatus));

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: any, record: any) => (
        <>
          <Link to="#" className="link-primary">{text || record.id || 'N/A'}</Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => {
        const idA = a.id?.toString() || '';
        const idB = b.id?.toString() || '';
        return idA.localeCompare(idB);
      },
    },

    {
      title: "Section Name",
      dataIndex: "sectionName",
      sorter: (a: TableData, b: TableData) => {
        const nameA = a.sectionName?.toString() || '';
        const nameB = b.sectionName?.toString() || '';
        return nameA.localeCompare(nameB);
      },
    },
    {
      title: "Section teacher",
      dataIndex: "sectionTeacher",
      sorter: (a: TableData, b: TableData) =>
        String(a.sectionTeacher || "").localeCompare(String(b.sectionTeacher || "")),
    },
    {
      title: "Max students",
      dataIndex: "maxStudents",
      sorter: (a: TableData, b: TableData) =>
        String(a.maxStudents || "").localeCompare(String(b.maxStudents || ""), undefined, { numeric: true }),
    },
    {
      title: "Room",
      dataIndex: "roomNumber",
      sorter: (a: TableData, b: TableData) =>
        String(a.roomNumber || "").localeCompare(String(b.roomNumber || "")),
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
      sorter: (a: TableData, b: TableData) => {
        const statusA = a.status?.toString() || '';
        const statusB = b.status?.toString() || '';
        return statusA.localeCompare(statusB);
      },
    },

    {
      title: "Action",
      dataIndex: "action",
      render: (text: string, record: any) => (
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
                      handleEditClick(record.sectionData);
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
                      handleDeleteClick(record.sectionData);
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
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Sections</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Academic </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Sections
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
                    data-bs-target="#add_class_section"
                  >
                    <i className="ti ti-square-rounded-plus-filled me-2" />
                    Add Section
                  </Link>
                </div>
              </div>
            </div>
            {/* /Page Header */}
            {message ? <div className="alert alert-info">{message}</div> : null}
            {/* Guardians List */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Class Section</h4>
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
                    <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                      <form >
                        <div className="d-flex align-items-center border-bottom p-3">
                          <h4>Filter</h4>
                        </div>
                        <div className="p-3 border-bottom pb-0">
                          <div className="row">
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Section</label>
                                <CommonSelect
                                  className="select"
                                  options={sectionOptions}
                                  defaultValue={sectionOptions[0]}
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
                          <Link to="#" className="btn btn-light me-3" onClick={() => { setFilterSection("Select"); setFilterStatus("Select"); }}>
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
                {/* Sections List */}
                {loading ? (
                  <div className="d-flex justify-content-center align-items-center p-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <span className="ms-2">Loading sections...</span>
                  </div>
                ) : error ? (
                  <div className="text-center p-5">
                    <p className="text-danger">Error loading sections: {error}</p>
                  </div>
                ) : transformedData.length === 0 ? (
                  <div className="text-center p-5">
                    <p className="text-muted">No sections found.</p>
                  </div>
                ) : (
                  <Table columns={columns} dataSource={transformedData} Selection={true} />
                )}
                {/* /Sections List */}
              </div>
            </div>
            {/* /Guardians List */}
          </div>
        </div>
        {/* /Page Wrapper */}
      </>
      <div>
        {/* Add Class Section */}
        <div className="modal fade" id="add_class_section">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Section</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <input
                          type="text"
                          className="form-control"
                          maxLength={10}
                          value={addForm.section_name}
                          onChange={(e) => setAddForm((f) => ({ ...f, section_name: e.target.value }))}
                        />
                        <small className="text-muted">Up to 10 characters (database limit).</small>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Class</label>
                        <CommonSelect className="select" options={classOptions} defaultValue={classOptions[0]} onChange={(v) => setAddForm((f) => ({ ...f, class_id: v || '' }))} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section teacher (optional)</label>
                        <CommonSelect
                          className="select"
                          options={teacherSelectOptions}
                          defaultValue={teacherSelectOptions[0]}
                          onChange={(v) => setAddForm((f) => ({ ...f, section_teacher_staff_id: v || 'Select' }))}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Max students (optional)</label>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          max={10000}
                          placeholder="Default 30 if empty"
                          value={addForm.max_students}
                          onChange={(e) => setAddForm((f) => ({ ...f, max_students: e.target.value }))}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Room (optional)</label>
                        <CommonSelect
                          className="select"
                          options={roomOptionsForAdd}
                          value={addForm.room_number}
                          onChange={(v) =>
                            setAddForm((f) => ({ ...f, room_number: v || "Select" }))
                          }
                        />
                        <small className="text-muted d-block mt-1">
                          Active rooms from Class rooms; stored as room number on the section.
                        </small>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Description (optional)</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          maxLength={5000}
                          value={addForm.description}
                          onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="status-title">
                          <h5>Status</h5>
                          <p>Change the Status by toggle </p>
                        </div>
                        <div className="form-check form-switch">
                          <input className="form-check-input" type="checkbox" role="switch" id="switch-sm" checked={addForm.is_active} onChange={(e) => setAddForm((f) => ({ ...f, is_active: e.target.checked }))} />
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
                  <button type="submit" className="btn btn-primary" disabled={isCreating}>{isCreating ? "Adding..." : "Add Section"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Add Class Section */}
        {/* Edit Class Section */}
        <div className="modal fade" id="edit_class_section" ref={editModalRef}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Section</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleSaveEdit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Enter Section"
                          maxLength={10}
                          value={editSectionName}
                          onChange={(e) => setEditSectionName(e.target.value)}
                          key={`section-input-${selectedSection?.id || 'new'}`}
                          required
                        />
                        <small className="text-muted">Up to 10 characters (database limit).</small>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section teacher</label>
                        <CommonSelect
                          className="select"
                          options={teacherSelectOptions}
                          value={editSectionTeacherStaffId}
                          onChange={(v) => setEditSectionTeacherStaffId(v || 'Select')}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Max students</label>
                        <input
                          type="number"
                          className="form-control"
                          min={1}
                          max={10000}
                          placeholder="Empty resets to default (30)"
                          value={editMaxStudents}
                          onChange={(e) => setEditMaxStudents(e.target.value)}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Room (optional)</label>
                        <CommonSelect
                          className="select"
                          options={roomOptionsForEdit}
                          value={editRoomNumber}
                          onChange={(v) => setEditRoomNumber(v || "Select")}
                        />
                        <small className="text-muted d-block mt-1">
                          Active rooms from Class rooms. A value saved earlier that is not in the list appears as &quot;current&quot;.
                        </small>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Description</label>
                        <textarea
                          className="form-control"
                          rows={2}
                          maxLength={5000}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
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
                            checked={editSectionStatus}
                            onChange={(e) => setEditSectionStatus(e.target.checked)}
                            key={`status-input-${selectedSection?.id || 'new'}`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-light me-2"
                    data-bs-dismiss="modal"
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Edit Class Section */}
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
                    <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Yes, Delete"}</button>
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

export default ClassSection;
