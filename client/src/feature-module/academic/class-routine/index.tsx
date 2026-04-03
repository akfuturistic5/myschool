
import { useMemo, useRef, useState } from "react";
import Table from "../../../core/common/dataTable/index";
import { useClassSchedules } from "../../../core/hooks/useClassSchedules";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { useClassRooms } from "../../../core/hooks/useClassRooms";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  allClass,
  classSection,
  count,
  routinename,
  teacher,
  weak,
} from "../../../core/common/selectoption/selectoption";
import { TimePicker } from "antd";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import dayjs from "dayjs";

const ClassRoutine = () => {
  const routes = all_routes;
  const [selectedRoutine, setSelectedRoutine] = useState<any>(null);
  const { data: apiData, loading, error, fallbackData } = useClassSchedules();
  const { teachers = [] } = useTeachers();
  const { classRooms = [] } = useClassRooms();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes = [] } = useClasses(academicYearId);
  const { sections = [] } = useSections();
  // Real data only: use API result when loaded; use fallback only while loading so layout doesn't jump
  const data = loading ? fallbackData : (apiData ?? []);

  // Dynamic options from API for Edit modal – ensures real data shows correctly
  const teacherOptions = useMemo(() => {
    const fromApi = (teachers || []).map((t: any) => {
      const name = [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || t.employee_code || String(t.id);
      return { value: name, label: name };
    });
    return [{ value: "Select", label: "Select" }, ...fromApi];
  }, [teachers]);

  const classRoomOptions = useMemo(() => {
    const fromApi = (classRooms || []).map((r: any) => {
      const roomNo = String(r.room_no ?? r.roomNo ?? r.id ?? "");
      return roomNo ? { value: roomNo, label: roomNo } : null;
    }).filter(Boolean) as { value: string; label: string }[];
    return [{ value: "Select", label: "Select" }, ...fromApi];
  }, [classRooms]);

  const classOptions = useMemo(() => {
    const fromApi = (classes || []).map((c: any) => {
      const name = String(c.class_name ?? c.name ?? c.class_code ?? c.id ?? "");
      return name ? { value: name, label: name } : null;
    }).filter(Boolean) as { value: string; label: string }[];
    return [{ value: "Select", label: "Select" }, ...fromApi];
  }, [classes]);

  const sectionOptions = useMemo(() => {
    const fromApi = (sections || []).map((s: any) => {
      const name = String(s.section_name ?? s.name ?? s.id ?? "");
      return name ? { value: name, label: name } : null;
    }).filter(Boolean) as { value: string; label: string }[];
    return [{ value: "Select", label: "Select" }, ...fromApi];
  }, [sections]);

  // Options that include current record's value so Edit modal always shows real data
  const editTeacherOptions = useMemo(() => {
    const current = selectedRoutine?.teacher;
    if (!current || current === "N/A") return teacherOptions;
    const exists = teacherOptions.some((o: any) => o.value === current || o.label === current);
    if (exists) return teacherOptions;
    return [...teacherOptions, { value: current, label: current }];
  }, [teacherOptions, selectedRoutine?.teacher]);

  const editClassRoomOptions = useMemo(() => {
    const current = selectedRoutine?.classRoom;
    if (!current || current === "N/A") return classRoomOptions;
    const exists = classRoomOptions.some((o: any) => o.value === current || o.label === current);
    if (exists) return classRoomOptions;
    return [...classRoomOptions, { value: current, label: current }];
  }, [classRoomOptions, selectedRoutine?.classRoom]);

  const editClassOptions = useMemo(() => {
    const current = selectedRoutine?.class;
    if (!current || current === "N/A") return classOptions;
    const exists = classOptions.some((o: any) => o.value === current || o.label === current);
    if (exists) return classOptions;
    return [...classOptions, { value: current, label: current }];
  }, [classOptions, selectedRoutine?.class]);

  const editSectionOptions = useMemo(() => {
    const current = selectedRoutine?.section;
    if (!current || current === "N/A") return sectionOptions;
    const exists = sectionOptions.some((o: any) => o.value === current || o.label === current);
    if (exists) return sectionOptions;
    return [...sectionOptions, { value: current, label: current }];
  }, [sectionOptions, selectedRoutine?.section]);

  const getModalContainer = () => {
    const modalElement = document.getElementById("modal-datepicker");
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  const getModalContainer2 = () => {
    const modalElement = document.getElementById("modal_datepicker");
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  const getModalContainer3= () => {
    const modalElement = document.getElementById("modal_datepicker");
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  const getModalContainer4= () => {
    const modalElement = document.getElementById("modal_datepicker");
    return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
  };
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

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
      sorter: (a: any, b: any) => {
        const idA = String(a.id || '').length;
        const idB = String(b.id || '').length;
        return idA - idB;
      },
    },

    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: any, b: any) => a.class.length - b.class.length,
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: any, b: any) => a.section.length - b.section.length,
    },
    {
      title: "Teacher",
      dataIndex: "teacher",
      sorter: (a: any, b: any) => a.teacher.length - b.teacher.length,
    },
    {
      title: "Subject",
      dataIndex: "subject",
      sorter: (a: any, b: any) => a.subject.length - b.subject.length,
    },
    {
      title: "Day",
      dataIndex: "day",
      sorter: (a: any, b: any) => a.day.length - b.day.length,
    },
    {
      title: "Start Time",
      dataIndex: "startTime",
      sorter: (a: any, b: any) => a.startTime.length - b.startTime.length,
    },
    {
      title: "End Time",
      dataIndex: "endTime",
      sorter: (a: any, b: any) => a.endTime.length - b.endTime.length,
    },
    {
      title: "Class Room",
      dataIndex: "classRoom",
      sorter: (a: any, b: any) => a.classRoom.length - b.classRoom.length,
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (text: any, record: any) => {
        const handleEditClick = (e: React.MouseEvent) => {
          e.preventDefault();
          setSelectedRoutine(record);
          const modalElement = document.getElementById('edit_class_routine');
          if (modalElement) {
            const bootstrap = (window as any).bootstrap;
            if (bootstrap && bootstrap.Modal) {
              const modal = bootstrap.Modal.getInstance(modalElement);
              if (modal) {
                modal.show();
              } else {
                new bootstrap.Modal(modalElement).show();
              }
            }
          }
        };
        
        return (
          <>
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
                    onClick={handleEditClick}
                  >
                    <i className="ti ti-edit-circle me-2" />
                    Edit
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#delete-modal"
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </>
        );
      },
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
                <h3 className="page-title mb-1">Class Routine</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Academic </Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Class Routine
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
                    data-bs-target="#add_class_routine"
                  >
                    <i className="ti ti-square-rounded-plus-filled me-2" />
                    Add Class Routine
                  </Link>
                </div>
              </div>
            </div>
            {/* /Page Header */}
            {/* Guardians List */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Class Routine</h4>
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
                                  options={allClass}
                                  defaultValue={allClass[0]}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Section</label>

                                <CommonSelect
                                  className="select"
                                  options={classSection}
                                  defaultValue={classSection[0]}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Teacher</label>
                                <CommonSelect
                                  className="select"
                                  options={routinename}
                                  defaultValue={routinename[0]}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Room No</label>
                                <CommonSelect
                                  className="select"
                                  options={count}
                                  defaultValue={count[0]}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Day</label>
                                <CommonSelect
                                  className="select"
                                  options={weak}
                                  defaultValue={weak[0]}
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
                    Could not load class schedules from server. Showing sample data.
                  </div>
                )}
                {loading && (
                  <div className="text-center py-4">
                    <span className="spinner-border spinner-border-sm me-2" />
                    Loading class routine...
                  </div>
                )}
                {!loading && (
                  <Table columns={columns} dataSource={data} Selection={true} />
                )}
              </div>
            </div>
            {/* /Guardians List */}
          </div>
        </div>
        {/* /Page Wrapper */}
      </>
      <>
        {/* Add Class Routine */}
        <div className="modal fade" id="add_class_routine">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Add Class Routine</h4>
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
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Teacher</label>

                        <CommonSelect
                          className="select"
                          options={teacher}
                          defaultValue={teacher[0]}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Class</label>
                        <CommonSelect
                          className="select"
                          options={allClass}
                          defaultValue={allClass[0]}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <CommonSelect
                          className="select"
                          options={classSection}
                          defaultValue={classSection[0]}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Day</label>
                        <CommonSelect
                          className="select"
                          options={weak}
                          defaultValue={weak[0]}
                        />
                      </div>
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Start Time</label>
                            <div className="date-pic">
                              <TimePicker
                                getPopupContainer={getModalContainer2}
                                use12Hours
                                placeholder="Choose"
                                format="h:mm A"
                                className="form-control timepicker"
                              />
                              <span className="cal-icon">
                                <i className="ti ti-clock" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">End Time</label>
                            <div className="date-pic">
                              <TimePicker
                                getPopupContainer={getModalContainer}
                                use12Hours
                                placeholder="Choose"
                                format="h:mm A"
                                className="form-control timepicker"
                              />
                              <span className="cal-icon">
                                <i className="ti ti-clock" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Class Room</label>
                        <CommonSelect className="select" options={count} />
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
                  <Link to="#" className="btn btn-primary" data-bs-dismiss="modal">
                    Add Class Routine
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Add Class Routine */}
        {/* Edit Class Routine */}
        <div className="modal fade" id="edit_class_routine">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Edit Class Routine</h4>
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
                    <div className="col-md-12">
                      <div className="mb-3">
                        <label className="form-label">Teacher</label>
                        <CommonSelect 
                          className="select" 
                          options={editTeacherOptions} 
                          defaultValue={selectedRoutine?.teacher && selectedRoutine.teacher !== "N/A"
                            ? editTeacherOptions.find((t: any) => t.value === selectedRoutine.teacher || t.label === selectedRoutine.teacher) || editTeacherOptions[0]
                            : editTeacherOptions[0]}
                          key={`teacher-${selectedRoutine?.id || 'new'}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Class</label>
                        <CommonSelect 
                          className="select" 
                          options={editClassOptions} 
                          defaultValue={selectedRoutine?.class && selectedRoutine.class !== "N/A"
                            ? editClassOptions.find((c: any) => c.value === selectedRoutine.class || c.label === selectedRoutine.class) || editClassOptions[0]
                            : editClassOptions[0]}
                          key={`class-${selectedRoutine?.id || 'new'}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Section</label>
                        <CommonSelect
                          className="select"
                          options={editSectionOptions}
                          defaultValue={selectedRoutine?.section && selectedRoutine.section !== "N/A"
                            ? editSectionOptions.find((s: any) => s.value === selectedRoutine.section || s.label === selectedRoutine.section) || editSectionOptions[0]
                            : editSectionOptions[0]}
                          key={`section-${selectedRoutine?.id || 'new'}`}
                        />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Day</label>
                        <CommonSelect 
                          className="select" 
                          options={weak} 
                          defaultValue={selectedRoutine?.day ? weak.find((d: any) => d.value === selectedRoutine.day || d.label === selectedRoutine.day) || weak[0] : weak[0]}
                          key={`day-${selectedRoutine?.id || 'new'}`}
                        />
                      </div>
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Start Time</label>
                            <div className="date-pic">
                            <TimePicker
                                getPopupContainer={getModalContainer3}
                                use12Hours
                                placeholder="Choose"
                                format="h:mm A"
                                className="form-control timepicker"
                                defaultValue={(() => {
                                  const timeStr = String(selectedRoutine?.originalData?.startTime ?? selectedRoutine?.startTime ?? '').trim();
                                  if (!timeStr) return null;
                                  // Backend returns "HH:mm" or "HH:mm:ss"; display format is "h:mm A"
                                  if (dayjs(timeStr, 'HH:mm:ss', true).isValid()) return dayjs(timeStr, 'HH:mm:ss');
                                  if (dayjs(timeStr, 'HH:mm', true).isValid()) return dayjs(timeStr, 'HH:mm');
                                  if (dayjs(timeStr, 'h:mm A', true).isValid()) return dayjs(timeStr, 'h:mm A');
                                  const parsed = dayjs(timeStr);
                                  return parsed.isValid() ? parsed : null;
                                })()}
                                key={`startTime-${selectedRoutine?.id || 'new'}`}
                              />
                              <span className="cal-icon">
                                <i className="ti ti-clock" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">End Time</label>
                            <div className="date-pic">
                            <TimePicker
                                getPopupContainer={getModalContainer4}
                                use12Hours
                                placeholder="Choose"
                                format="h:mm A"
                                className="form-control timepicker"
                                defaultValue={(() => {
                                  const timeStr = String(selectedRoutine?.originalData?.endTime ?? selectedRoutine?.endTime ?? '').trim();
                                  if (!timeStr) return null;
                                  // Backend returns "HH:mm" or "HH:mm:ss"; display format is "h:mm A"
                                  if (dayjs(timeStr, 'HH:mm:ss', true).isValid()) return dayjs(timeStr, 'HH:mm:ss');
                                  if (dayjs(timeStr, 'HH:mm', true).isValid()) return dayjs(timeStr, 'HH:mm');
                                  if (dayjs(timeStr, 'h:mm A', true).isValid()) return dayjs(timeStr, 'h:mm A');
                                  const parsed = dayjs(timeStr);
                                  return parsed.isValid() ? parsed : null;
                                })()}
                                key={`endTime-${selectedRoutine?.id || 'new'}`}
                              />
                              <span className="cal-icon">
                                <i className="ti ti-clock" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Class Room</label>
                        <CommonSelect 
                          className="select" 
                          options={editClassRoomOptions} 
                          defaultValue={selectedRoutine?.classRoom && selectedRoutine.classRoom !== "N/A"
                            ? editClassRoomOptions.find((c: any) => c.value === selectedRoutine.classRoom || c.label === selectedRoutine.classRoom) || editClassRoomOptions[0]
                            : editClassRoomOptions[0]}
                          key={`classRoom-${selectedRoutine?.id || 'new'}`}
                        />
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
                  <Link to="#" className="btn btn-primary" data-bs-dismiss="modal">
                    Save Changes
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Edit Class Routine */}
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
                    <Link to="#" className="btn btn-danger" data-bs-dismiss="modal">
                      Yes, Delete
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
        {/* /Delete Modal */}
      </>
    </div>
  );
};

export default ClassRoutine;
