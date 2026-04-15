import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import CommonSelect from "../../../core/common/commonSelect";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClassSchedules } from "../../../core/hooks/useClassSchedules";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import { useSubjects } from "../../../core/hooks/useSubjects";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { useSchedules } from "../../../core/hooks/useSchedules";
import { useClassRooms } from "../../../core/hooks/useClassRooms";
import { apiService } from "../../../core/services/apiService";

const ClassTimetable = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [filterClassId, setFilterClassId] = useState<string>("");
  const [filterSectionId, setFilterSectionId] = useState<string>("");
  const { data: routineData, loading, error, refetch } = useClassSchedules({
    academicYearId,
    classId: filterClassId ? Number(filterClassId) : null,
    sectionId: filterSectionId ? Number(filterSectionId) : null,
  });
  const { classes = [] } = useClasses(academicYearId);
  const { sections = [] } = useSections();
  const { subjects = [] } = useSubjects();
  const { teachers = [] } = useTeachers();
  const { data: slots = [] } = useSchedules();
  const { classRooms = [] } = useClassRooms();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ class_id: "", section_id: "", subject_id: "", teacher_id: "", day_of_week: "1", time_slot_id: "", class_room_id: "" });

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  const grouped = useMemo(() => {
    const g: Record<string, any[]> = { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [], Saturday: [] };
    (routineData || []).forEach((r: any) => {
      const d = r.day || "Monday";
      if (!g[d]) g[d] = [];
      g[d].push(r);
    });
    return g;
  }, [routineData]);
  const options = (arr: any[], valueKey = "id", labelKey = "name") => [{ value: "", label: "Select" }, ...arr.map((x: any) => ({ value: String(x[valueKey]), label: x[labelKey] ?? String(x[valueKey]) }))];
  const classOptions = options(classes, "id", "class_name");
  const sectionOptions = options(sections, "id", "section_name");
  const subjectOptions = options(subjects, "id", "subject_name");
  const teacherOptions = [{ value: "", label: "Select" }, ...teachers.map((t: any) => ({ value: String(t.id), label: `${t.first_name || ""} ${t.last_name || ""}`.trim() || String(t.id) }))];
  const slotOptions = [{ value: "", label: "Select" }, ...slots.map((s: any) => ({ value: String(s.originalData?.id ?? s.id), label: s.type || s.slot_name || String(s.id) }))];
  const roomOptions = [{ value: "", label: "Select" }, ...classRooms.map((r: any) => ({ value: String(r.id), label: String(r.room_no ?? r.id) }))];
  const dayOptions = [{ value: "1", label: "Monday" }, { value: "2", label: "Tuesday" }, { value: "3", label: "Wednesday" }, { value: "4", label: "Thursday" }, { value: "5", label: "Friday" }, { value: "6", label: "Saturday" }, { value: "7", label: "Sunday" }];
  return (
    <div>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Time Table</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Academic</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Time Table
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary d-flex align-items-center"
                  data-bs-toggle="modal"
                  data-bs-target="#add_time_table"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Time Table
                </Link>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Time Table</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                    aria-expanded="false"
                  >
                    <i className="ti ti-filter me-2" />
                    Filter
                  </Link>
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                  >
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 pb-0 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classOptions}
                                defaultValue={classOptions[0]}
                                onChange={(v) => setFilterClassId(v || "")}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionOptions}
                                defaultValue={sectionOptions[0]}
                                onChange={(v) => setFilterSectionId(v || "")}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link
                          to="#"
                          className="btn btn-light me-3"
                          onClick={(e) => {
                            e.preventDefault();
                            setFilterClassId("");
                            setFilterSectionId("");
                          }}
                        >
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
              </div>
            </div>
            <div className="card-body pb-0">
              {message ? <div className="alert alert-info">{message}</div> : null}
              {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}
              {loading ? <div className="text-center py-4">Loading timetable...</div> : null}
              <div className="d-flex flex-nowrap overflow-auto">
                {Object.keys(grouped).map((day) => (
                  <div key={day} className="d-flex flex-column me-4 flex-fill">
                    <div className="mb-3"><h6>{day}</h6></div>
                    {(grouped[day] || []).length === 0 ? <div className="rounded p-3 mb-4 border">No classes</div> : null}
                    {(grouped[day] || []).map((item: any) => (
                      <div key={item.id} className="rounded p-3 mb-4 border">
                        <p className="d-flex align-items-center text-nowrap mb-1"><i className="ti ti-clock me-1" />{item.startTime} - {item.endTime}</p>
                        <p className="text-dark">Subject : {item.subject}</p>
                        <p className="text-dark">Class: {item.class} | Section: {item.section}</p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="modal fade" id="add_time_table">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header"><h4 className="modal-title">Add Time Table</h4><button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close"><i className="ti ti-x" /></button></div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!form.class_id || !form.section_id || !form.teacher_id || !form.day_of_week || !form.time_slot_id || !academicYearId) return;
              setSaving(true);
              try {
                await apiService.createClassSchedule({
                  class_id: Number(form.class_id),
                  section_id: Number(form.section_id),
                  subject_id: form.subject_id ? Number(form.subject_id) : null,
                  teacher_id: Number(form.teacher_id),
                  day_of_week: Number(form.day_of_week),
                  time_slot_id: Number(form.time_slot_id),
                  class_room_id: form.class_room_id ? Number(form.class_room_id) : null,
                  academic_year_id: academicYearId,
                });
                await refetch();
                setMessage("Timetable entry created successfully");
                (window as any).bootstrap?.Modal?.getInstance(document.getElementById("add_time_table"))?.hide();
              } catch {
                setMessage("Failed to create timetable entry");
              } finally {
                setSaving(false);
              }
            }}>
              <div className="modal-body">
                <div className="mb-2"><label className="form-label">Class</label><CommonSelect className="select" options={classOptions} onChange={(v) => setForm((f) => ({ ...f, class_id: v || "" }))} /></div>
                <div className="mb-2"><label className="form-label">Section</label><CommonSelect className="select" options={sectionOptions} onChange={(v) => setForm((f) => ({ ...f, section_id: v || "" }))} /></div>
                <div className="mb-2"><label className="form-label">Subject</label><CommonSelect className="select" options={subjectOptions} onChange={(v) => setForm((f) => ({ ...f, subject_id: v || "" }))} /></div>
                <div className="mb-2"><label className="form-label">Teacher</label><CommonSelect className="select" options={teacherOptions} onChange={(v) => setForm((f) => ({ ...f, teacher_id: v || "" }))} /></div>
                <div className="mb-2"><label className="form-label">Day</label><CommonSelect className="select" options={dayOptions} onChange={(v) => setForm((f) => ({ ...f, day_of_week: v || "1" }))} /></div>
                <div className="mb-2"><label className="form-label">Slot</label><CommonSelect className="select" options={slotOptions} onChange={(v) => setForm((f) => ({ ...f, time_slot_id: v || "" }))} /></div>
                <div className="mb-2"><label className="form-label">Class Room</label><CommonSelect className="select" options={roomOptions} onChange={(v) => setForm((f) => ({ ...f, class_room_id: v || "" }))} /></div>
              </div>
              <div className="modal-footer">
                <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Add Time Table"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassTimetable;
