
import { useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import Table from "../../../core/common/dataTable/index";
import { useClassSchedules } from "../../../core/hooks/useClassSchedules";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { useClassRooms } from "../../../core/hooks/useClassRooms";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useClasses } from "../../../core/hooks/useClasses";
import { useSections } from "../../../core/hooks/useSections";
import { useSubjects } from "../../../core/hooks/useSubjects";
import { useSchedules } from "../../../core/hooks/useSchedules";
import { apiService } from "../../../core/services/apiService";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";

const DAY_OPTIONS = [
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
  { value: "7", label: "Sunday" },
];

const ClassRoutine = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { data, loading, error, refetch } = useClassSchedules({ academicYearId });
  const { teachers = [] } = useTeachers();
  const { classRooms = [] } = useClassRooms();
  const { classes = [] } = useClasses(academicYearId);
  const { sections = [] } = useSections();
  const { subjects = [] } = useSubjects();
  const { data: slots = [] } = useSchedules();

  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedRoutine, setSelectedRoutine] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filterClass, setFilterClass] = useState("Select");
  const [filterSection, setFilterSection] = useState("Select");
  const [filterTeacher, setFilterTeacher] = useState("Select");
  const [filterSubject, setFilterSubject] = useState("Select");
  const [filterDay, setFilterDay] = useState("Select");
  const [form, setForm] = useState({
    class_id: "",
    section_id: "",
    subject_id: "",
    teacher_id: "",
    day_of_week: "1",
    time_slot_id: "",
    class_room_id: "",
  });

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => dropdownMenuRef.current?.classList.remove("show");
  const optionize = (arr: any[], v: string, l: string) => [{ value: "Select", label: "Select" }, ...arr.map((x: any) => ({ value: String(x[v]), label: String(x[l] ?? x[v]) }))];
  const classOptions = optionize(classes, "id", "class_name");
  const sectionOptions = optionize(sections, "id", "section_name");
  const subjectOptions = optionize(subjects, "id", "subject_name");
  const teacherOptions = [{ value: "Select", label: "Select" }, ...teachers.map((t: any) => ({ value: String(t.id), label: `${t.first_name || ""} ${t.last_name || ""}`.trim() || String(t.id) }))];
  const slotOptions = [{ value: "Select", label: "Select" }, ...slots.map((s: any) => ({ value: String(s.originalData?.id ?? s.id), label: s.type || s.slot_name || String(s.id) }))];
  const roomOptions = [{ value: "Select", label: "Select" }, ...classRooms.map((r: any) => ({ value: String(r.id), label: String(r.room_no ?? r.id) }))];
  const classById = useMemo(() => Object.fromEntries(classes.map((c: any) => [String(c.id), c.class_name])), [classes]);
  const sectionById = useMemo(() => Object.fromEntries(sections.map((s: any) => [String(s.id), s.section_name])), [sections]);
  const subjectById = useMemo(() => Object.fromEntries(subjects.map((s: any) => [String(s.id), s.subject_name])), [subjects]);
  const teacherById = useMemo(() => Object.fromEntries(teachers.map((t: any) => [String(t.id), `${t.first_name || ""} ${t.last_name || ""}`.trim()])), [teachers]);
  const slotById = useMemo(() => Object.fromEntries(slots.map((s: any) => [String(s.originalData?.id ?? s.id), s.type || s.slot_name || "N/A"])), [slots]);
  const dayLabel = (v: any) => DAY_OPTIONS.find((d) => Number(d.value) === Number(v))?.label || "N/A";

  const mappedData = (data || []).map((r: any, i: number) => {
    const o = r.originalData || {};
    return {
      key: String(r.id ?? i),
      id: Number(r.id ?? o.id ?? 0),
      class: r.class || classById[String(o.class_id)] || "N/A",
      section: r.section || sectionById[String(o.section_id)] || "N/A",
      teacher: r.teacher || teacherById[String(o.teacher_id)] || "N/A",
      subject: r.subject || subjectById[String(o.subject_id)] || "N/A",
      day: r.day || dayLabel(o.day_of_week),
      startTime: r.startTime || "N/A",
      endTime: r.endTime || "N/A",
      classRoom: r.classRoom || "N/A",
      originalData: o,
    };
  }).filter((r: any) =>
    (filterClass === "Select" || r.class === classById[filterClass]) &&
    (filterSection === "Select" || r.section === sectionById[filterSection]) &&
    (filterTeacher === "Select" || r.teacher === teacherById[filterTeacher]) &&
    (filterSubject === "Select" || r.subject === subjectById[filterSubject]) &&
    (filterDay === "Select" || r.day === dayLabel(filterDay))
  );

  const openEdit = (record: any) => {
    setSelectedRoutine(record);
    const o = record.originalData || {};
    setForm({
      class_id: String(o.class_id || "Select"),
      section_id: String(o.section_id || "Select"),
      subject_id: String(o.subject_id || "Select"),
      teacher_id: String(o.teacher_id || "Select"),
      day_of_week: String(o.day_of_week || "1"),
      time_slot_id: String(o.time_slot_id || "Select"),
      class_room_id: String(o.class_room_id || "Select"),
    });
    (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("edit_class_routine"))?.show();
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!academicYearId || !form.class_id || !form.section_id || !form.teacher_id || !form.time_slot_id) {
      setMessage("Please fill all required fields");
      return;
    }
    setSaving(true);
    try {
      await apiService.createClassSchedule({
        class_id: Number(form.class_id),
        section_id: Number(form.section_id),
        subject_id: form.subject_id && form.subject_id !== "Select" ? Number(form.subject_id) : null,
        teacher_id: Number(form.teacher_id),
        day_of_week: Number(form.day_of_week),
        time_slot_id: Number(form.time_slot_id),
        class_room_id: form.class_room_id && form.class_room_id !== "Select" ? Number(form.class_room_id) : null,
        academic_year_id: academicYearId,
      });
      await refetch();
      setMessage("Routine created successfully");
      (window as any).bootstrap?.Modal?.getInstance(document.getElementById("add_class_routine"))?.hide();
    } catch (err: any) {
      setMessage(err?.message || "Failed to create routine");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoutine?.id || !academicYearId) return;
    setSaving(true);
    try {
      await apiService.updateClassSchedule(selectedRoutine.id, {
        class_id: Number(form.class_id),
        section_id: Number(form.section_id),
        subject_id: form.subject_id && form.subject_id !== "Select" ? Number(form.subject_id) : null,
        teacher_id: Number(form.teacher_id),
        day_of_week: Number(form.day_of_week),
        time_slot_id: Number(form.time_slot_id),
        class_room_id: form.class_room_id && form.class_room_id !== "Select" ? Number(form.class_room_id) : null,
        academic_year_id: academicYearId,
      });
      await refetch();
      setMessage("Routine updated successfully");
      (window as any).bootstrap?.Modal?.getInstance(document.getElementById("edit_class_routine"))?.hide();
    } catch (err: any) {
      setMessage(err?.message || "Failed to update routine");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleteId) return;
    setSaving(true);
    try {
      await apiService.deleteClassSchedule(deleteId);
      await refetch();
      setMessage("Routine deleted successfully");
      (window as any).bootstrap?.Modal?.getInstance(document.getElementById("delete-modal"))?.hide();
      setDeleteId(null);
    } catch (err: any) {
      setMessage(err?.message || "Failed to delete routine");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", sorter: (a: any, b: any) => a.id - b.id },
    { title: "Class", dataIndex: "class" },
    { title: "Section", dataIndex: "section" },
    { title: "Teacher", dataIndex: "teacher" },
    { title: "Subject", dataIndex: "subject" },
    { title: "Day", dataIndex: "day" },
    { title: "Start Time", dataIndex: "startTime" },
    { title: "End Time", dataIndex: "endTime" },
    { title: "Class Room", dataIndex: "classRoom" },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="dropdown">
          <Link to="#" className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0" data-bs-toggle="dropdown">
            <i className="ti ti-dots-vertical fs-14" />
          </Link>
          <ul className="dropdown-menu dropdown-menu-right p-3">
            <li><Link className="dropdown-item rounded-1" to="#" onClick={(e) => { e.preventDefault(); openEdit(record); }}><i className="ti ti-edit-circle me-2" />Edit</Link></li>
            <li><Link className="dropdown-item rounded-1" to="#" onClick={(e) => { e.preventDefault(); setDeleteId(record.id); (window as any).bootstrap?.Modal?.getOrCreateInstance(document.getElementById("delete-modal"))?.show(); }}><i className="ti ti-trash-x me-2" />Delete</Link></li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Class Routine</h3>
              <nav><ol className="breadcrumb mb-0"><li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li><li className="breadcrumb-item"><Link to="#">Academic</Link></li><li className="breadcrumb-item active">Class Routine</li></ol></nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              <div className="mb-2"><Link to="#" className="btn btn-primary" data-bs-toggle="modal" data-bs-target="#add_class_routine"><i className="ti ti-square-rounded-plus-filled me-2" />Add Class Routine</Link></div>
            </div>
          </div>
          {message ? <div className="alert alert-info">{message}</div> : null}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Class Routine</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative"><PredefinedDateRanges /></div>
                <div className="dropdown mb-3 me-2">
                  <Link to="#" className="btn btn-outline-light bg-white dropdown-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside"><i className="ti ti-filter me-2" />Filter</Link>
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3"><h4>Filter</h4></div>
                      <div className="p-3 border-bottom pb-0">
                        <div className="row">
                          <div className="col-md-12"><div className="mb-3"><label className="form-label">Class</label><CommonSelect className="select" options={classOptions} onChange={(v) => setFilterClass(v || "Select")} /></div></div>
                          <div className="col-md-12"><div className="mb-3"><label className="form-label">Section</label><CommonSelect className="select" options={sectionOptions} onChange={(v) => setFilterSection(v || "Select")} /></div></div>
                          <div className="col-md-12"><div className="mb-3"><label className="form-label">Teacher</label><CommonSelect className="select" options={teacherOptions} onChange={(v) => setFilterTeacher(v || "Select")} /></div></div>
                          <div className="col-md-12"><div className="mb-3"><label className="form-label">Subject</label><CommonSelect className="select" options={subjectOptions} onChange={(v) => setFilterSubject(v || "Select")} /></div></div>
                          <div className="col-md-12"><div className="mb-3"><label className="form-label">Day</label><CommonSelect className="select" options={[{ value: "Select", label: "Select" }, ...DAY_OPTIONS]} onChange={(v) => setFilterDay(v || "Select")} /></div></div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={() => { setFilterClass("Select"); setFilterSection("Select"); setFilterTeacher("Select"); setFilterSubject("Select"); setFilterDay("Select"); }}>Reset</Link>
                        <Link to="#" className="btn btn-primary" onClick={handleApplyClick}>Apply</Link>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {error ? <div className="alert alert-danger mx-3 mt-3">Failed to load class routine</div> : null}
              {loading ? <div className="text-center py-4"><span className="spinner-border spinner-border-sm me-2" />Loading class routine...</div> : <Table columns={columns} dataSource={mappedData} Selection={true} />}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_class_routine"><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h4 className="modal-title">Add Class Routine</h4><button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button></div><form onSubmit={submitCreate}><div className="modal-body"><div className="mb-3"><label className="form-label">Teacher</label><CommonSelect className="select" options={teacherOptions} onChange={(v) => setForm((f) => ({ ...f, teacher_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Class</label><CommonSelect className="select" options={classOptions} onChange={(v) => setForm((f) => ({ ...f, class_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Section</label><CommonSelect className="select" options={sectionOptions} onChange={(v) => setForm((f) => ({ ...f, section_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Subject</label><CommonSelect className="select" options={subjectOptions} onChange={(v) => setForm((f) => ({ ...f, subject_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Day</label><CommonSelect className="select" options={DAY_OPTIONS} defaultValue={DAY_OPTIONS[0]} onChange={(v) => setForm((f) => ({ ...f, day_of_week: v || "1" }))} /></div><div className="mb-3"><label className="form-label">Slot</label><CommonSelect className="select" options={slotOptions} onChange={(v) => setForm((f) => ({ ...f, time_slot_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Class Room</label><CommonSelect className="select" options={roomOptions} onChange={(v) => setForm((f) => ({ ...f, class_room_id: v || "Select" }))} /></div></div><div className="modal-footer"><Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</Link><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Add Class Routine"}</button></div></form></div></div></div>
      <div className="modal fade" id="edit_class_routine"><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-header"><h4 className="modal-title">Edit Class Routine</h4><button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal"><i className="ti ti-x" /></button></div><form onSubmit={submitEdit}><div className="modal-body"><div className="mb-3"><label className="form-label">Teacher</label><CommonSelect className="select" options={teacherOptions} value={form.teacher_id} onChange={(v) => setForm((f) => ({ ...f, teacher_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Class</label><CommonSelect className="select" options={classOptions} value={form.class_id} onChange={(v) => setForm((f) => ({ ...f, class_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Section</label><CommonSelect className="select" options={sectionOptions} value={form.section_id} onChange={(v) => setForm((f) => ({ ...f, section_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Subject</label><CommonSelect className="select" options={subjectOptions} value={form.subject_id} onChange={(v) => setForm((f) => ({ ...f, subject_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Day</label><CommonSelect className="select" options={DAY_OPTIONS} value={form.day_of_week} onChange={(v) => setForm((f) => ({ ...f, day_of_week: v || "1" }))} /></div><div className="mb-3"><label className="form-label">Slot</label><CommonSelect className="select" options={slotOptions} value={form.time_slot_id} onChange={(v) => setForm((f) => ({ ...f, time_slot_id: v || "Select" }))} /></div><div className="mb-3"><label className="form-label">Class Room</label><CommonSelect className="select" options={roomOptions} value={form.class_room_id} onChange={(v) => setForm((f) => ({ ...f, class_room_id: v || "Select" }))} /></div></div><div className="modal-footer"><Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">Cancel</Link><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button></div></form></div></div></div>
      <div className="modal fade" id="delete-modal"><div className="modal-dialog modal-dialog-centered"><div className="modal-content"><div className="modal-body text-center"><span className="delete-icon"><i className="ti ti-trash-x" /></span><h4>Confirm Deletion</h4><p>This routine entry will be deleted permanently.</p><div className="d-flex justify-content-center"><Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">Cancel</Link><button type="button" className="btn btn-danger" onClick={doDelete} disabled={saving}>{saving ? "Deleting..." : "Yes, Delete"}</button></div></div></div></div></div>
    </div>
  );
};

export default ClassRoutine;
