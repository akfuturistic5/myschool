import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Table from "../../../core/common/dataTable/index";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";
import { useClassSubjects } from "../../../core/hooks/useClassSubjects";
import { useSubjects } from "../../../core/hooks/useSubjects";
import { useClasses } from "../../../core/hooks/useClasses";
import { apiService } from "../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const ClassSubject = () => {
  const routes = all_routes;
  const [classFilterId, setClassFilterId] = useState<string>("");
  const { classes = [] } = useClasses();
  const { subjects: masterSubjects = [] } = useSubjects(null);
  const [electiveGroups, setElectiveGroups] = useState<any[]>([]);
  
  // Use current academic year from session or context (defaulting to a fallback for now)
  const academicYearId = 1; 

  const { classSubjects, loading, error, refetch } = useClassSubjects({
    class_id: classFilterId,
    academic_year_id: academicYearId
  });

  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [form, setForm] = useState({
    class_id: "",
    subject_id: "",
    is_elective: false,
    elective_group_id: "",
  });

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const fetchGroups = useCallback(async (classId: string) => {
    if (!classId) {
      setElectiveGroups([]);
      return;
    }
    try {
      const res = await apiService.getElectiveGroups(classId);
      if (res.status === 'SUCCESS') setElectiveGroups(res.data);
    } catch (err) {
      console.error("Failed to fetch elective groups", err);
    }
  }, []);

  // Sync groups when class_id changes in the form
  useEffect(() => {
    fetchGroups(form.class_id);
  }, [form.class_id, fetchGroups]);

  const resetForm = () => {
    setForm({
      class_id: "",
      subject_id: "",
      is_elective: false,
      elective_group_id: "",
    });
    setSelectedAssignment(null);
  };

  const classOptions = useMemo(
    () => [{ value: "", label: "All Classes" }, ...classes.map((c: any) => ({ value: String(c.id), label: `${c.class_name} (${c.class_code})` }))],
    [classes]
  );

  const masterSubjectOptions = useMemo(
    () => [{ value: "", label: "Select Master Subject" }, ...masterSubjects.map((s: any) => ({ value: String(s.id), label: `${s.subject_name} [${s.subject_code}]` }))],
    [masterSubjects]
  );

  const groupOptions = useMemo(
    () => [{ value: "", label: "Select Elective Group (Optional)" }, ...electiveGroups.map((g: any) => ({ value: String(g.id), label: g.group_name }))],
    [electiveGroups]
  );

  const data = useMemo(() => {
    return (classSubjects ?? []).map((cs: any, index: number) => ({
      key: String(cs.id ?? index),
      id: cs.id,
      name: cs.subject_name || "N/A",
      class: cs.class_name || "N/A",
      teacher: "Not Assigned", 
      code: cs.subject_code || "N/A",
      type: cs.subject_type || "Theory",
      category: cs.is_elective ? `Elective${cs.elective_group_name ? ` (${cs.elective_group_name})` : ''}` : "Core",
      originalData: cs,
    }));
  }, [classSubjects]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      width: 80,
      sorter: (a: TableData, b: TableData) => Number(a.id) - Number(b.id),
    },
    {
      title: "Subject Name",
      dataIndex: "name",
      sorter: (a: TableData, b: TableData) => String(a.name).localeCompare(String(b.name)),
      render: (text: string) => <span className="fw-bold text-dark">{text}</span>
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => String(a.class).localeCompare(String(b.class)),
    },
    {
      title: "Teacher",
      dataIndex: "teacher",
      render: (text: string) => <span className="text-muted">{text}</span>
    },
    {
      title: "Code",
      dataIndex: "code",
      render: (text: string) => <span className="badge badge-soft-info">{text}</span>
    },
    {
      title: "Type",
      dataIndex: "type",
      render: (text: string) => (
        <span className={`badge ${text === "Theory" ? "bg-info" : "bg-secondary"}`}>
          {text}
        </span>
      )
    },
    {
      title: "Category",
      dataIndex: "category",
      render: (text: string) => (
        <span className={`badge ${text.startsWith("Core") ? "badge-soft-primary" : "badge-soft-warning"}`}>
          {text}
        </span>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      width: 100,
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center justify-content-center">
          <div className="dropdown">
            <Link
              to="#"
              className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
              data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
              aria-expanded="false"
            >
              <i className="ti ti-dots-vertical fs-14" />
            </Link>
            <ul className="dropdown-menu dropdown-menu-end p-2 shadow-sm">
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedAssignment(record);
                    setForm({
                      class_id: String(record.originalData?.class_id),
                      subject_id: String(record.originalData?.subject_id),
                      is_elective: !!record.originalData?.is_elective,
                      elective_group_id: String(record.originalData?.elective_group_id || ""),
                    });
                    (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("edit_assignment"))?.show();
                  }}
                >
                  <i className="ti ti-edit-circle me-2" />
                  Edit
                </Link>
              </li>
              <li>
                <Link
                  className="dropdown-item rounded-1 text-danger"
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(record.id);
                  }}
                >
                  <i className="ti ti-trash-x me-2" />
                  Remove
                </Link>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.class_id || !form.subject_id) {
      Swal.fire("Error", "Please select both Class and Subject", "error");
      return;
    }
    setIsSaving(true);
    try {
      await apiService.assignSubjectToClass({
        class_id: Number(form.class_id),
        subject_id: Number(form.subject_id),
        academic_year_id: academicYearId,
        is_elective: form.is_elective,
        elective_group_id: form.is_elective && form.elective_group_id ? Number(form.elective_group_id) : null,
      });
      await refetch();
      (window as any).bootstrap?.Modal?.getInstance(document.getElementById("add_assignment"))?.hide();
      resetForm();
      Swal.fire("Success", "Subject assigned to class successfully", "success");
    } catch (err: any) {
      Swal.fire("Error", err.message || "Failed to assign subject", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment?.id) return;
    setIsSaving(true);
    try {
      await apiService.updateClassSubject(selectedAssignment.id, {
        is_elective: form.is_elective,
        elective_group_id: form.is_elective && form.elective_group_id ? Number(form.elective_group_id) : null,
      });
      await refetch();
      (window as any).bootstrap?.Modal?.getInstance(document.getElementById("edit_assignment"))?.hide();
      resetForm();
      Swal.fire("Success", "Assignment updated successfully", "success");
    } catch (err: any) {
      Swal.fire("Error", err.message || "Failed to update assignment", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !form.class_id) return;
    try {
      const res = await apiService.createElectiveGroup({ 
        group_name: newGroupName.trim(),
        class_id: Number(form.class_id)
      });
      if (res.status === 'SUCCESS') {
        await fetchGroups(form.class_id);
        setForm({ ...form, elective_group_id: String(res.data.id) });
        setNewGroupName("");
        (window as any).bootstrap?.Collapse?.getOrCreateInstance(document.getElementById("newGroupCollapse"))?.hide();
      }
    } catch (err) {
      Swal.fire("Error", "Failed to create group", "error");
    }
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: "Are you sure?",
      text: "This will remove the subject from this class's curriculum.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await apiService.removeClassSubject(id);
          await refetch();
          Swal.fire("Removed!", "Subject removed from class.", "success");
        } catch (err: any) {
          Swal.fire("Error", err.message || "Failed to remove subject", "error");
        }
      }
    });
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Class Subjects</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                <li className="breadcrumb-item active">Curriculum</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption
              onRefresh={() => refetch()}
              onPrint={() => printData("Class Subjects", [{ title: "Name", dataKey: "name" }, { title: "Class", dataKey: "class" }, { title: "Type", dataKey: "type" }], data)}
            />
            <div className="mb-2">
              <button className="btn btn-primary d-flex align-items-center" data-bs-toggle="modal" data-bs-target="#add_assignment" onClick={resetForm}>
                <i className="ti ti-square-rounded-plus-filled me-2"></i>
                Assign Subject
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
            <h4 className="mb-3">Curriculum Roster</h4>
            <div className="d-flex align-items-center flex-wrap">
              <div className="mb-3 me-2" style={{ minWidth: '200px' }}>
                <CommonSelect
                  className="select"
                  options={classOptions}
                  defaultValue={classOptions[0]}
                  onChange={(v) => setClassFilterId(v || "")}
                />
              </div>
            </div>
          </div>
          <div className="card-body p-0 py-3" style={{ minHeight: '400px' }}>
            {loading ? (
              <div className="text-center p-5"><div className="spinner-border text-primary" role="status"></div></div>
            ) : error ? (
              <div className="alert alert-danger m-3">{error}</div>
            ) : (
              <Table columns={columns} dataSource={data} Selection={false} />
            )}
          </div>
        </div>
      </div>

      {/* Assign Modal */}
      <div className="modal fade" id="add_assignment">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Assign Subject to Class</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Class <span className="text-danger">*</span></label>
                  <CommonSelect
                    key={`add-class-${form.class_id || 'empty'}`}
                    className="select"
                    options={classOptions.filter(o => o.value !== "")}
                    value={form.class_id}
                    onChange={(v) => setForm({...form, class_id: v || ""})}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Subject <span className="text-danger">*</span></label>
                  <CommonSelect
                    key={`add-subject-${form.subject_id || 'empty'}`}
                    className="select"
                    options={masterSubjectOptions.filter(o => o.value !== "")}
                    value={form.subject_id}
                    onChange={(v) => setForm({...form, subject_id: v || ""})}
                  />
                </div>
                
                <div className="d-flex align-items-center justify-content-between border p-3 rounded bg-light mb-3">
                  <div>
                    <h5 className="mb-0">Elective Subject?</h5>
                    <p className="text-muted small mb-0">Check if this is an optional/elective subject</p>
                  </div>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={form.is_elective} onChange={e => setForm({...form, is_elective: e.target.checked})} />
                  </div>
                </div>

                {form.is_elective && (
                  <div className="border p-3 rounded mb-3 bg-soft-warning">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <label className="form-label mb-0">Elective Group</label>
                      <button type="button" className="btn btn-xs btn-outline-primary" data-bs-toggle="collapse" data-bs-target="#newGroupCollapse" disabled={!form.class_id}>
                        + New Group
                      </button>
                    </div>
                    <CommonSelect
                      key={`add-group-${form.class_id}-${form.elective_group_id || 'empty'}`}
                      className="select"
                      options={groupOptions}
                      value={form.elective_group_id}
                      onChange={(v) => setForm({...form, elective_group_id: v || ""})}
                      placeholder={form.class_id ? "Select Group" : "Select Class first"}
                      isDisabled={!form.class_id}
                    />
                    
                    <div className="collapse mt-2" id="newGroupCollapse">
                      <div className="input-group">
                        <input type="text" className="form-control form-control-sm" placeholder="Group Name" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} />
                        <button className="btn btn-sm btn-primary" type="button" onClick={handleCreateGroup}>Create</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Assigning..." : "Assign Subject"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <div className="modal fade" id="edit_assignment">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Assignment</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Class</label>
                  <input type="text" className="form-control" value={selectedAssignment?.class || ""} disabled />
                </div>
                <div className="mb-3">
                  <label className="form-label">Subject</label>
                  <input type="text" className="form-control" value={selectedAssignment?.name || ""} disabled />
                </div>
                <div className="d-flex align-items-center justify-content-between border p-3 rounded bg-light mb-3">
                  <div>
                    <h5 className="mb-0">Elective Subject?</h5>
                  </div>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={form.is_elective} onChange={e => setForm({...form, is_elective: e.target.checked})} />
                  </div>
                </div>

                {form.is_elective && (
                  <div className="border p-3 rounded mb-3 bg-soft-warning">
                    <label className="form-label">Elective Group</label>
                    <CommonSelect
                      key={`edit-group-${form.class_id}-${form.elective_group_id || 'empty'}`}
                      className="select"
                      options={groupOptions}
                      value={form.elective_group_id}
                      onChange={(v) => setForm({...form, elective_group_id: v || ""})}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Updating..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassSubject;
