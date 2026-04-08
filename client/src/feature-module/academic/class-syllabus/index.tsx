import { useMemo, useRef, useState } from "react";
import Table from "../../../core/common/dataTable/index";
import { useClassSyllabus } from "../../../core/hooks/useClassSyllabus";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import {
  activeList,
  classSection,
  classSylabus,
} from "../../../core/common/selectoption/selectoption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { apiService } from "../../../core/services/apiService";

const ClassSyllabus = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [selectedSyllabus, setSelectedSyllabus] = useState<any>(null);
  const { data: apiData, loading, error, refetch, fallbackData } = useClassSyllabus({ academicYearId });
  const { classes = [] } = useClasses(academicYearId);
  const { sections = [] } = useSections();

  const data = loading ? fallbackData : (apiData ?? []);

  const classOptions = useMemo(() => {
    const fromApi = (classes || []).map((c: any) => {
      const name = String(c.class_name ?? c.name ?? c.class_code ?? c.id ?? "");
      return name ? { value: name, label: name } : null;
    }).filter(Boolean) as { value: string; label: string }[];
    const base = fromApi.length > 0 ? fromApi : classSylabus.filter((x: any) => x.value !== "Select");
    return [{ value: "Select", label: "Select" }, ...base];
  }, [classes]);
  const classIdByName = useMemo(() => {
    const map: Record<string, number> = {};
    classes.forEach((c: any) => { if (c.class_name) map[String(c.class_name)] = Number(c.id); });
    return map;
  }, [classes]);

  const sectionOptions = useMemo(() => {
    const fromApi = (sections || []).map((s: any) => {
      const name = String(s.section_name ?? s.name ?? s.id ?? "");
      return name ? { value: name, label: name } : null;
    }).filter(Boolean) as { value: string; label: string }[];
    const base = fromApi.length > 0 ? fromApi : classSection.filter((x: any) => x.value !== "Select");
    return [{ value: "Select", label: "Select" }, ...base];
  }, [sections]);
  const sectionIdByName = useMemo(() => {
    const map: Record<string, number> = {};
    sections.forEach((s: any) => { if (s.section_name) map[String(s.section_name)] = Number(s.id); });
    return map;
  }, [sections]);

  const editClassOptions = useMemo(() => {
    const current = selectedSyllabus?.class;
    if (!current || current === "N/A") return classOptions;
    const exists = classOptions.some((o: any) => o.value === current || o.label === current);
    if (exists) return classOptions;
    return [...classOptions, { value: current, label: current }];
  }, [classOptions, selectedSyllabus?.class]);

  const editSectionOptions = useMemo(() => {
    const current = selectedSyllabus?.section;
    if (!current || current === "N/A") return sectionOptions;
    const exists = sectionOptions.some((o: any) => o.value === current || o.label === current);
    if (exists) return sectionOptions;
    return [...sectionOptions, { value: current, label: current }];
  }, [sectionOptions, selectedSyllabus?.section]);

  const editStatusOptions = useMemo(() => {
    const statusOpts = activeList.filter((x: any) => x.value === "Active" || x.value === "Inactive");
    const current = selectedSyllabus?.status;
    if (!current) return statusOpts;
    const exists = statusOpts.some((o: any) => o.value === current || o.label === current);
    if (exists) return statusOpts;
    return [...statusOpts, { value: current, label: current }];
  }, [selectedSyllabus?.status]);

  const [addClass, setAddClass] = useState("");
  const [addSection, setAddSection] = useState("");
  const [addSubjectGroup, setAddSubjectGroup] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editSection, setEditSection] = useState("");
  const [editSubjectGroup, setEditSubjectGroup] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const addSubjectRef = useRef<HTMLInputElement>(null);
  const editSubjectRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const subjectGroup = addSubjectRef.current?.value?.trim() || addSubjectGroup.trim();
    if (!subjectGroup) return;
    const cls = addClass && addClass !== "Select" ? addClass : undefined;
    const sec = addSection && addSection !== "Select" ? addSection : undefined;
    setSubmitting(true);
    try {
      await apiService.createClassSyllabus({
        class_id: cls ? classIdByName[cls] : undefined,
        section_id: sec ? sectionIdByName[sec] : undefined,
        subject_group: subjectGroup,
        status: "Active",
        academic_year_id: academicYearId,
      });
      refetch();
      setAddClass("");
      setAddSection("");
      setAddSubjectGroup("");
      if (addSubjectRef.current) addSubjectRef.current.value = "";
      const modalEl = document.getElementById("add_syllabus");
      if (modalEl) {
        const bootstrap = (window as any).bootstrap;
        if (bootstrap?.Modal) {
          const m = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
          m.hide();
        }
      }
    } catch (err) {
      console.error("Failed to add syllabus:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSyllabus?.id) return;
    const subjectGroup = editSubjectRef.current?.value?.trim() ?? editSubjectGroup ?? selectedSyllabus?.subjectGroup ?? "";
    if (!subjectGroup) return;
    setSubmitting(true);
    try {
      const cls = (editClass && editClass !== "Select" ? editClass : selectedSyllabus?.class) || undefined;
      const sec = (editSection && editSection !== "Select" ? editSection : selectedSyllabus?.section) || undefined;
      const statusVal = editStatus && editStatus !== "Select" ? editStatus : selectedSyllabus?.status;
      await apiService.updateClassSyllabus(selectedSyllabus.id, {
        class_id: cls ? classIdByName[cls] : selectedSyllabus?.originalData?.class_id,
        section_id: sec ? sectionIdByName[sec] : selectedSyllabus?.originalData?.section_id,
        subject_group: subjectGroup,
        status: statusVal,
        academic_year_id: academicYearId,
      });
      refetch();
      setSelectedSyllabus(null);
      const modalEl = document.getElementById("edit_syllabus");
      if (modalEl) {
        const bootstrap = (window as any).bootstrap;
        if (bootstrap?.Modal) bootstrap.Modal.getInstance(modalEl)?.hide();
      }
    } catch (err) {
      console.error("Failed to update syllabus:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSyllabus?.id) return;
    setSubmitting(true);
    try {
      await apiService.deleteClassSyllabus(selectedSyllabus.id);
      refetch();
      setSelectedSyllabus(null);
      const modalEl = document.getElementById("delete-modal");
      if (modalEl) {
        const bootstrap = (window as any).bootstrap;
        if (bootstrap?.Modal) bootstrap.Modal.getInstance(modalEl)?.hide();
      }
    } catch (err) {
      console.error("Failed to delete syllabus:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (record: any) => {
    const r = record?.originalData ?? record;
    const cls = r?.class ?? record?.class ?? r?.class_name ?? "";
    const sec = r?.section ?? record?.section ?? r?.section_name ?? "";
    const subj = r?.subjectGroup ?? r?.subject_group ?? record?.subjectGroup ?? "";
    const st = r?.status ?? record?.status ?? "Active";
    setSelectedSyllabus(record);
    setEditClass(cls);
    setEditSection(sec);
    setEditSubjectGroup(subj);
    setEditStatus(st);
    setTimeout(() => {
      const modalElement = document.getElementById("edit_syllabus");
      if (modalElement) {
        const bootstrap = (window as any).bootstrap;
        if (bootstrap && bootstrap.Modal) {
          const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
          modal.show();
        }
      }
    }, 100);
  };

  const columns = [
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => (a.class || "").length - (b.class || "").length,
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) => (a.section || "").length - (b.section || "").length,
    },
    {
      title: "Subject Group",
      dataIndex: "subjectGroup",
      sorter: (a: TableData, b: TableData) => (a.subjectGroup || "").length - (b.subjectGroup || "").length,
    },
    {
      title: "CreatedDate",
      dataIndex: "createdDate",
      sorter: (a: TableData, b: TableData) => (a.createdDate || "").length - (b.createdDate || "").length,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_: any, record: any) => {
        const statusVal = record.status ?? "Active";
        const isActive = statusVal === "Active" || statusVal === "active";
        return (
          <span className={`badge badge-soft-${isActive ? "success" : "danger"} d-inline-flex align-items-center`}>
            <i className="ti ti-circle-filled fs-5 me-1" />
            {isActive ? "Active" : statusVal}
          </span>
        );
      },
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
                      openEditModal(record);
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
                      setSelectedSyllabus(record);
                      const modalEl = document.getElementById("delete-modal");
                      if (modalEl) {
                        const bootstrap = (window as any).bootstrap;
                        if (bootstrap?.Modal) {
                          const m = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                          m.show();
                        }
                      }
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

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  return (
    <div>
      <>
        <div className="page-wrapper">
          <div className="content">
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Books</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Syllabus</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Subject Group
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
                    data-bs-target="#add_syllabus"
                  >
                    <i className="ti ti-square-rounded-plus-filled me-2" />
                    Add Subject Group
                  </Link>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Class Syllabus</h4>
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
                      <form>
                        <div className="d-flex align-items-center border-bottom p-3">
                          <h4>Filter</h4>
                        </div>
                        <div className="p-3 border-bottom pb-0">
                          <div className="row">
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Class</label>
                                <CommonSelect className="select" options={classOptions} defaultValue={classOptions[0]} />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Section</label>
                                <CommonSelect className="select" options={sectionOptions} defaultValue={sectionOptions[0]} />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Status</label>
                                <CommonSelect className="select" options={activeList} defaultValue={activeList[0]} />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 d-flex align-items-center justify-content-end">
                          <Link to="#" className="btn btn-light me-3">
                            Reset
                          </Link>
                          <Link to="#" className="btn btn-primary" onClick={handleApplyClick}>
                            Apply
                          </Link>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="dropdown mb-3">
                    <Link to="#" className="btn btn-outline-light bg-white dropdown-toggle" data-bs-toggle="dropdown">
                      <i className="ti ti-sort-ascending-2 me-2" />
                      Sort by A-Z
                    </Link>
                    <ul className="dropdown-menu p-3">
                      <li>
                        <Link to="#" className="dropdown-item rounded-1 active">
                          Ascending
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
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
                {error && (
                  <div className="alert alert-warning mx-3 mt-3 mb-0" role="alert">
                    Could not load syllabus from server. Showing sample data.
                  </div>
                )}
                {loading && (
                  <div className="text-center py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading syllabus...
                  </div>
                )}
                {!loading && (
                  <Table columns={columns} dataSource={data} Selection={true} />
                )}
              </div>
            </div>
          </div>
        </div>
      </>
      <div>
        <div className="modal fade" id="add_syllabus">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Subject Group</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleAddSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Class</label>
                        <CommonSelect
                          className="select"
                          options={classOptions}
                          defaultValue={classOptions[0]}
                          onChange={(v) => setAddClass(v || "")}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <CommonSelect
                          className="select"
                          options={sectionOptions}
                          defaultValue={sectionOptions[0]}
                          onChange={(v) => setAddSection(v || "")}
                        />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Subject Group</label>
                        <input
                          ref={addSubjectRef}
                          type="text"
                          className="form-control"
                          placeholder="Enter Subject Group"
                          onChange={(e) => setAddSubjectGroup(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Adding..." : "Add Subject Group"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="modal fade" id="edit_syllabus">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Subject Group</h4>
                <button
                  type="button"
                  className="btn-close custom-btn-close"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <form onSubmit={handleEditSubmit}>
                <div className="modal-body">
                  <div className="row">
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Class</label>
                        <CommonSelect
                          className="select"
                          options={editClassOptions}
                          value={editClass || selectedSyllabus?.class}
                          defaultValue={editClassOptions.find((o: any) => o.value === (editClass || selectedSyllabus?.class) || o.label === (editClass || selectedSyllabus?.class)) ?? editClassOptions[0]}
                          onChange={(v) => setEditClass(v || "")}
                          key={`edit-class-${selectedSyllabus?.id ?? "new"}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <CommonSelect
                          className="select"
                          options={editSectionOptions}
                          value={editSection || selectedSyllabus?.section}
                          defaultValue={editSectionOptions.find((o: any) => o.value === (editSection || selectedSyllabus?.section) || o.label === (editSection || selectedSyllabus?.section)) ?? editSectionOptions[0]}
                          onChange={(v) => setEditSection(v || "")}
                          key={`edit-section-${selectedSyllabus?.id ?? "new"}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Subject Group</label>
                        <input
                          ref={editSubjectRef}
                          type="text"
                          className="form-control"
                          placeholder="Enter Subject Group"
                          defaultValue={selectedSyllabus?.subjectGroup ?? selectedSyllabus?.originalData?.subject_group ?? ""}
                          onChange={(e) => setEditSubjectGroup(e.target.value)}
                          key={`edit-subject-${selectedSyllabus?.id ?? "new"}`}
                        />
                      </div>
                      <div className="mb-0">
                        <label className="form-label">Status</label>
                        <CommonSelect
                          className="select"
                          options={editStatusOptions}
                          value={editStatus || selectedSyllabus?.status}
                          defaultValue={editStatusOptions.find((o: any) => o.value === (editStatus || selectedSyllabus?.status) || o.label === (editStatus || selectedSyllabus?.status)) ?? editStatusOptions.find((o: any) => o.value === "Active") ?? editStatusOptions[0]}
                          onChange={(v) => setEditStatus(v || "")}
                          key={`edit-status-${selectedSyllabus?.id ?? "new"}`}
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="modal fade" id="delete-modal">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>Confirm Deletion</h4>
                <p>
                  You want to delete this syllabus entry. This cannot be undone once you delete.
                </p>
                <div className="d-flex justify-content-center">
                  <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">
                    Cancel
                  </Link>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteConfirm}
                    disabled={submitting}
                  >
                    {submitting ? "Deleting..." : "Yes, Delete"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassSyllabus;
