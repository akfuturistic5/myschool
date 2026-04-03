import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Select from "react-select";
import type { SingleValue } from 'react-select';
import { DatePicker, TimePicker } from 'antd';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { apiService } from '../../../core/services/apiService';
import { selectUser } from '../../../core/data/redux/authSlice';
import { selectSelectedAcademicYearId } from '../../../core/data/redux/academicYearSlice';

type SelectOption = { value: string; label: string };

interface AdminDashboardModalProps {
  refetchRoutine?: () => void;
  refetchEvents?: () => void;
}

const AdminDashboardModal = ({ refetchRoutine, refetchEvents }: AdminDashboardModalProps) => {
    const user = useSelector(selectUser);
    const academicYearId = useSelector(selectSelectedAcademicYearId);
    const isTeacherRole = (user?.role ?? '').trim().toLowerCase() === 'teacher';
    const [activeContent, setActiveContent] = useState('');
    const [allTeacher, setAllTeacher] = useState<SelectOption[]>([{ value: "", label: "Loading..." }]);
    const [allSection, setAllSection] = useState<SelectOption[]>([{ value: "", label: "Loading..." }]);
    const [allClass, setAllClass] = useState<SelectOption[]>([{ value: "", label: "Loading..." }]);
    const [allClassRoom, setAllClassRoom] = useState<SelectOption[]>([{ value: "", label: "Loading..." }]);

    // Add Class Routine form state
    const [routineTeacher, setRoutineTeacher] = useState<SingleValue<SelectOption>>(null);
    const [routineClass, setRoutineClass] = useState<SingleValue<SelectOption>>(null);
    const [routineSection, setRoutineSection] = useState<SingleValue<SelectOption>>(null);
    const [routineDay, setRoutineDay] = useState<SingleValue<SelectOption>>(null);
    const [routineClassRoom, setRoutineClassRoom] = useState<SingleValue<SelectOption>>(null);
    const [routineSubmitting, setRoutineSubmitting] = useState(false);

    // Add Event form state
    const [eventTitle, setEventTitle] = useState('');
    const [eventCategory, setEventCategory] = useState<SingleValue<SelectOption>>(null);
    const [eventStartDate, setEventStartDate] = useState<Dayjs | null>(null);
    const [eventEndDate, setEventEndDate] = useState<Dayjs | null>(null);
    const [eventStartTime, setEventStartTime] = useState<Dayjs | null>(null);
    const [eventEndTime, setEventEndTime] = useState<Dayjs | null>(null);
    const [eventMessage, setEventMessage] = useState('');
    const [eventSubmitting, setEventSubmitting] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const fetchTeachers = async () => {
                    if (isTeacherRole) {
                        try {
                            const me = await apiService.getCurrentTeacher();
                            if (me?.status === 'SUCCESS' && me.data) {
                                const t = me.data as { id: number; first_name?: string; last_name?: string };
                                return { status: 'SUCCESS' as const, data: [t] };
                            }
                        } catch {
                            // Teacher but no record - fall back to full list
                        }
                    }
                    return apiService.getTeachers();
                };
                const fetchClasses = () =>
                    academicYearId != null
                        ? apiService.getClassesByAcademicYear(academicYearId)
                        : apiService.getClasses();
                const [tRes, cRes, sRes, rRes] = await Promise.all([
                    fetchTeachers(),
                    fetchClasses(),
                    apiService.getSections(),
                    apiService.getClassRooms(),
                ]);
                if (tRes?.status === 'SUCCESS' && Array.isArray(tRes.data)) {
                    setAllTeacher([
                        { value: "", label: "Select Teacher" },
                        ...tRes.data.map((t: { id: number; first_name?: string; last_name?: string }) => ({
                            value: String(t.id),
                            label: [t.first_name, t.last_name].filter(Boolean).join(' ') || `Teacher ${t.id}`,
                        })),
                    ]);
                }
                if (cRes?.status === 'SUCCESS' && Array.isArray(cRes.data)) {
                    setAllClass([
                        { value: "", label: "Select Class" },
                        ...cRes.data.map((c: { id: number; class_name?: string; name?: string }) => ({
                            value: String(c.id),
                            label: c.class_name || c.name || `Class ${c.id}`,
                        })),
                    ]);
                }
                if (sRes?.status === 'SUCCESS' && Array.isArray(sRes.data)) {
                    setAllSection([
                        { value: "", label: "Select Section" },
                        ...sRes.data.map((s: { id: number; section_name?: string; name?: string }) => ({
                            value: String(s.id),
                            label: s.section_name || s.name || `Section ${s.id}`,
                        })),
                    ]);
                }
                if (rRes?.status === 'SUCCESS' && Array.isArray(rRes.data)) {
                    setAllClassRoom(
                        rRes.data.map((r: { id: number; room_no?: string }) => ({
                            value: String(r.id),
                            label: r.room_no || `Room ${r.id}`,
                        }))
                    );
                    if (rRes.data.length === 0) setAllClassRoom([{ value: "", label: "No rooms" }]);
                }
            } catch {
                setAllTeacher([{ value: "", label: "Select Teacher" }]);
                setAllClass([{ value: "", label: "Select Class" }]);
                setAllSection([{ value: "", label: "Select Section" }]);
                setAllClassRoom([{ value: "", label: "No rooms" }]);
            }
        })();
    }, [isTeacherRole, academicYearId]);

    const handleContentChange = (event: any) => {
        setActiveContent(event.target.value);
    };

    const hideModal = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            const bsModal = (window as any).bootstrap?.Modal?.getInstance(el);
            if (bsModal) bsModal.hide();
        }
    };

    const handleRoutineSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const teacherId = routineTeacher?.value;
        const classId = routineClass?.value;
        const sectionId = routineSection?.value;
        const dayOfWeek = routineDay?.value || 'Monday';
        const classRoomId = routineClassRoom?.value;
        if (!teacherId || !classId || !sectionId) {
            alert('Please select Teacher, Class, and Section');
            return;
        }
        setRoutineSubmitting(true);
        try {
            const res = await apiService.createClassSchedule({
                teacher_id: Number(teacherId),
                class_id: Number(classId),
                section_id: Number(sectionId),
                day_of_week: dayOfWeek,
                class_room_id: classRoomId ? Number(classRoomId) : null,
            });
            if (res?.status === 'SUCCESS') {
                refetchRoutine?.();
                hideModal('add_class_routine');
                setRoutineTeacher(null);
                setRoutineClass(null);
                setRoutineSection(null);
                setRoutineDay(null);
                setRoutineClassRoom(null);
            } else {
                alert(res?.message || 'Failed to add class routine');
            }
        } catch (err: any) {
            alert(err?.message || 'Failed to add class routine');
        } finally {
            setRoutineSubmitting(false);
        }
    };

    const handleEventSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventTitle.trim()) {
            alert('Please enter Event Title');
            return;
        }
        if (!eventStartDate) {
            alert('Please select Start Date');
            return;
        }
        setEventSubmitting(true);
        try {
            let startDate: string;
            let endDate: string | null = null;
            const isAllDay = !eventStartTime && !eventEndTime;
            if (isAllDay) {
                startDate = eventStartDate.startOf('day').toISOString();
                endDate = (eventEndDate || eventStartDate).endOf('day').toISOString();
            } else {
                const st = eventStartTime || dayjs().hour(9).minute(0);
                const et = eventEndTime || dayjs().hour(10).minute(0);
                const startDt = eventStartDate.clone().hour(st.hour()).minute(st.minute()).second(0).millisecond(0);
                const endDt = (eventEndDate || eventStartDate).clone().hour(et.hour()).minute(et.minute()).second(0).millisecond(0);
                startDate = startDt.toISOString();
                endDate = endDt.toISOString();
            }
            const categoryToColor: Record<string, string> = {
                Celebration: 'bg-warning',
                Training: 'bg-info',
                Meeting: 'bg-primary',
                Holidays: 'bg-danger',
            };
            const eventColor = eventCategory?.value ? (categoryToColor[eventCategory.value] || 'bg-primary') : 'bg-primary';
            const res = await apiService.createEvent({
                title: eventTitle.trim(),
                description: eventMessage.trim() || null,
                start_date: startDate,
                end_date: endDate,
                event_color: eventColor,
                is_all_day: isAllDay,
                event_category: eventCategory?.value || null,
                event_for: 'all',
            });
            if (res?.status === 'SUCCESS') {
                refetchEvents?.();
                hideModal('add_event');
                setEventTitle('');
                setEventCategory(null);
                setEventStartDate(null);
                setEventEndDate(null);
                setEventStartTime(null);
                setEventEndTime(null);
                setEventMessage('');
            } else {
                alert(res?.message || 'Failed to add event');
            }
        } catch (err: any) {
            alert(err?.message || 'Failed to add event');
        } finally {
            setEventSubmitting(false);
        }
    };

    const eventoption = [
        { value: "", label: "Select" },
        { value: "Celebration", label: "Celebration" },
        { value: "Training", label: "Training" },
        { value: "Meeting", label: "Meeting" },
        { value: "Holidays", label: "Holidays" },
      ];

    const allDay = [
        { value: "Monday", label: "Monday" },
        { value: "Tuesday", label: "Tuesday" },
        { value: "Wednesday", label: "Wednesday" },
        { value: "Thursday", label: "Thursday" },
        { value: "Friday", label: "Friday" },
        { value: "Saturday", label: "Saturday" },
        { value: "Sunday", label: "Sunday" },
      ];
      const getModalContainer = () => {
        const modalElement = document.getElementById('modal-datepicker');
        return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
      };
      const getModalContainer2 = () => {
        const modalElement = document.getElementById('modal_datepicker');
        return modalElement ? modalElement : document.body; // Fallback to document.body if modalElement is null
      };
  return (
    <>
    {/* Add Class Routine */}
    <div className="modal fade" id="add_class_routine">
        <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
            <div className="modal-wrapper">
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
            <form onSubmit={handleRoutineSubmit}>
                <div  id='modal_datepicker' className="modal-body">
                <div className="row">
                    <div className="col-md-12">
                    <div className="mb-3">
                        <label className="form-label">Teacher</label>
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allTeacher}
                        value={routineTeacher}
                        onChange={setRoutineTeacher}
                        placeholder="Select Teacher"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Class</label>
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allClass}
                        value={routineClass}
                        onChange={setRoutineClass}
                        placeholder="Select Class"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Section</label>
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allSection}
                        value={routineSection}
                        onChange={setRoutineSection}
                        placeholder="Select Section"
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Day</label>
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allDay}
                        value={routineDay}
                        onChange={setRoutineDay}
                        placeholder="Select Day"
                        />
                    </div>
                    <div className="row">
                        <div className="col-md-6">
                        <div className="mb-3">
                            <label className="form-label">Start Time</label>
                            <div className="date-pic">
                            <TimePicker getPopupContainer={getModalContainer2}  use12Hours placeholder="Choose" format="h:mm A" className="form-control timepicker" />
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
                            <TimePicker getPopupContainer={getModalContainer2}  use12Hours placeholder="Choose" format="h:mm A" className="form-control timepicker" />
                            <span className="cal-icon">
                                <i className="ti ti-clock" />
                            </span>
                            </div>
                        </div>
                        </div>
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Class Room</label>
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allClassRoom}
                        value={routineClassRoom}
                        onChange={setRoutineClassRoom}
                        placeholder="Select Room"
                        />
                    </div>
                    <div className="modal-satus-toggle d-flex align-items-center justify-content-between">
                        <div className="status-title">
                        <h5>Status</h5>
                        <p>Change the Status by toggle </p>
                        </div>
                        <div className="status-toggle modal-status">
                        <input type="checkbox" id="user1" className="check" />
                        <label htmlFor="user1" className="checktoggle">
                            {" "}
                        </label>
                        </div>
                    </div>
                    </div>
                </div>
                </div>
                <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={routineSubmitting}>
                    {routineSubmitting ? 'Adding...' : 'Add Class Routine'}
                </button>
                </div>
            </form>
            </div>
        </div>
        </div>
    </div>
    {/* /Add Class Routine */}
    {/* Add Event */}
    <div className="modal fade" id="add_event">
        <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
            <div className="modal-header">
            <h4 className="modal-title">New Event</h4>
            <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
            >
                <i className="ti ti-x" />
            </button>
            </div>
            <form onSubmit={handleEventSubmit}>
            <div  id='modal-datepicker' className="modal-body">
                <div className="row">
                <div className="col-md-12">
                    <div>
                    <label className="form-label">Event For</label>
                    <div className="d-flex align-items-center flex-wrap">
                        <div className="form-check me-3 mb-3">
                        <input
                            className="form-check-input"
                            type="radio"
                            name="event"
                            id="all"
                            value=""
                            checked={activeContent === ''}
                            onChange={handleContentChange}
                        />
                        <label className="form-check-label" htmlFor="all">
                            All
                        </label>
                        </div>
                        <div className="form-check me-3 mb-3">
                        <input
                            className="form-check-input"
                            type="radio"
                            name="event"
                            id="all-student"
                            value="all-student"
                            onChange={handleContentChange}
                        />
                        <label className="form-check-label" htmlFor="all-student">
                            Students
                        </label>
                        </div>
                        <div className="form-check me-3 mb-3">
                        <input
                            className="form-check-input"
                            type="radio"
                            name="event"
                            id="all-staffs"
                            value="all-staffs" 
                            onChange={handleContentChange}
                        />
                        <label className="form-check-label" htmlFor="all-staffs">
                            Staffs
                        </label>
                        </div>
                    </div>
                    </div>
                    <div className={`all-content ${activeContent === 'all-student' ? 'active' : ''}`} id="all-student">
                    <div className="mb-3">
                        <label className="form-label">Classes</label>
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allClass}
                        defaultValue={allClass[0]}
                        />
                    </div>
                    <div className="mb-3">
                        <label className="form-label">Sections</label>
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allSection}
                        defaultValue={allSection[0]}
                        />
                    </div>
                    </div>
                    <div className={`all-content ${activeContent === 'all-staffs' ? 'active' : ''}`} id="all-staffs">
                    <div className="mb-3">
                        <div className="bg-light-500 p-3 pb-2 rounded">
                        <label className="form-label">Role</label>
                        <div className="row">
                            <div className="col-md-6">
                            <div className="form-check form-check-sm mb-2">
                                <input
                                className="form-check-input"
                                type="checkbox"
                                />
                                Admin
                            </div>
                            <div className="form-check form-check-sm mb-2">
                                <input
                                className="form-check-input"
                                type="checkbox"
                                defaultChecked
                                />
                                Teacher
                            </div>
                            <div className="form-check form-check-sm mb-2">
                                <input
                                className="form-check-input"
                                type="checkbox"
                                />
                                Driver
                            </div>
                            </div>
                            <div className="col-md-6">
                            <div className="form-check form-check-sm mb-2">
                                <input
                                className="form-check-input"
                                type="checkbox"
                                />
                                Accountant
                            </div>
                            <div className="form-check form-check-sm mb-2">
                                <input
                                className="form-check-input"
                                type="checkbox"
                                />
                                Librarian
                            </div>
                            <div className="form-check form-check-sm mb-2">
                                <input
                                className="form-check-input"
                                type="checkbox"
                                />
                                Receptionist
                            </div>
                            </div>
                        </div>
                        </div>
                    </div>
                    <div className="mb-3">
                        <label className="form-label">All Teachers</label>
                        {/* <select classNamePrefix="react-select" className="select">
                        <option>Select</option>
                        <option>I</option>
                        <option>II</option>
                        <option>III</option>
                        <option>IV</option>
                        </select> */}
                        <Select classNamePrefix="react-select"
                        className="select"
                        options={allTeacher}
                        defaultValue={allTeacher[0]}
                        />
                    </div>
                    </div>
                </div>
                <div className="mb-3">
                    <label className="form-label">Event Title</label>
                    <input
                    type="text"
                    className="form-control"
                    placeholder="Enter Title"
                    value={eventTitle}
                    onChange={(e) => setEventTitle(e.target.value)}
                    />
                </div>
                <div className="mb-3">
                    <label className="form-label">Event Category</label>
                    <Select classNamePrefix="react-select"
                    className="select"
                    options={eventoption}
                    value={eventCategory}
                    onChange={setEventCategory}
                    placeholder="Select Category"
                    />
                </div>
                <div className="col-md-6">
                    <div className="mb-3">
                    <label className="form-label">Start Date</label>
                    <div className="date-pic">
                        <DatePicker getPopupContainer={getModalContainer} className="form-control datetimepicker" placeholder="15 May 2024" value={eventStartDate} onChange={(d) => setEventStartDate(d)} />
                        <span className="cal-icon">
                        <i className="ti ti-calendar" />
                        </span>
                    </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="mb-3">
                    <label className="form-label">End Date</label>
                    <div className="date-pic">
                        <DatePicker getPopupContainer={getModalContainer} className="form-control datetimepicker" placeholder="15 May 2024" value={eventEndDate} onChange={(d) => setEventEndDate(d)} />
                        <span className="cal-icon">
                        <i className="ti ti-calendar" />
                        </span>
                    </div>
                    </div>
                </div>
                <div className="col-md-6">
                    <div className="mb-3">
                    <label className="form-label">Start Time</label>
                    <div className="date-pic">
                        <TimePicker getPopupContainer={getModalContainer} use12Hours placeholder="09:10 AM" format="h:mm A" className="form-control timepicker" value={eventStartTime} onChange={(t) => setEventStartTime(t)} />
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
                        <TimePicker getPopupContainer={getModalContainer} use12Hours placeholder="09:10 AM" format="h:mm A" className="form-control timepicker" value={eventEndTime} onChange={(t) => setEventEndTime(t)} />
                        <span className="cal-icon">
                        <i className="ti ti-clock" />
                        </span>
                    </div>
                    </div>
                </div>
                <div className="col-md-12">
                    <div className="mb-3">
                    <div className="bg-light p-3 pb-2 rounded">
                        <div className="mb-3">
                        <label className="form-label">Attachment</label>
                        <p>Upload size of 4MB, Accepted Format PDF</p>
                        </div>
                        <div className="d-flex align-items-center flex-wrap">
                        <div className="btn btn-primary drag-upload-btn mb-2 me-2">
                            <i className="ti ti-file-upload me-1" />
                            Upload
                            <input
                            type="file"
                            className="form-control image_sign"
                            multiple
                            />
                        </div>
                        <p className="mb-2">Fees_Structure.pdf</p>
                        </div>
                    </div>
                    </div>
                    <div className="mb-0">
                    <label className="form-label">Message</label>
                    <textarea
                        className="form-control"
                        rows={4}
                        placeholder="Enter event description..."
                        value={eventMessage}
                        onChange={(e) => setEventMessage(e.target.value)}
                    />
                    </div>
                </div>
                </div>
            </div>
            <div className="modal-footer">
                <button type="button" className="btn btn-light me-2" data-bs-dismiss="modal">
                Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={eventSubmitting}>
                {eventSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
            </form>
        </div>
        </div>
    </div>
    {/* /Add Event */}
    </>

  )
}

export default AdminDashboardModal