import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
// import { feeGroup, feesTypes, paymentType } from '../../../core/common/selectoption/selectoption'
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import {
  Contract,
  Hostel,
  Marital,
  PickupPoint,
  Shift,
  VehicleNumber,
  allClass,
  allSubject,
  bloodGroup,
  gender,
  roomNO,
  route,
  status,
} from "../../../../core/common/selectoption/selectoption";

import CommonSelect from "../../../../core/common/commonSelect";
import TagInput from "../../../../core/common/Taginput";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSubjects } from "../../../../core/hooks/useSubjects";
import { useBloodGroups } from "../../../../core/hooks/useBloodGroups";
import { useHostels } from "../../../../core/hooks/useHostels";
import { useHostelRooms } from "../../../../core/hooks/useHostelRooms";
import { useTransportRoutes } from "../../../../core/hooks/useTransportRoutes";
import { useTransportPickupPoints } from "../../../../core/hooks/useTransportPickupPoints";
import { useTransportVehicles } from "../../../../core/hooks/useTransportVehicles";

interface TeacherLocationState {
  teacherId?: number;
  teacher?: any;
  returnTo?: string;
}

const TeacherForm = () => {
  const routes = all_routes;
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as TeacherLocationState | null;
  const teacherId = state?.teacherId ?? state?.teacher?.id;
  const formRef = useRef<HTMLFormElement>(null);

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [owner, setOwner] = useState<string[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState<string | null>(null);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState<string | null>(null);
  const [selectedContractType, setSelectedContractType] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const handleTagsChange = (newTags: string[]) => {
    setOwner(newTags);
  };

  const [defaultDate, setDefaultDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('Active');

  // Lookup data from API (real data for dropdowns)
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes, loading: classesLoading, error: classesError } = useClasses(academicYearId);
  const { subjects, loading: subjectsLoading, error: subjectsError } = useSubjects();
  const { bloodGroups, loading: bloodGroupsLoading, error: bloodGroupsError } = useBloodGroups();
  const { hostels } = useHostels();
  const { hostelRooms } = useHostelRooms();
  const { data: transportRoutes, loading: routesLoading, error: routesError } = useTransportRoutes();
  const { data: pickupPoints, loading: pickupLoading, error: pickupError } = useTransportPickupPoints();
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError } = useTransportVehicles();

  useEffect(() => {
    if (location.pathname === routes.editTeacher) {
      setIsEdit(true);
      if (teacherId) {
        setLoadingTeacher(true);
        apiService
          .getTeacherById(teacherId)
          .then((res: any) => {
            if (res?.data) setTeacherData(res.data);
          })
          .catch(() => {})
          .finally(() => setLoadingTeacher(false));
      } else {
        setTeacherData(state?.teacher ?? null);
      }
    } else {
      setIsEdit(false);
      setTeacherData(null);
    }
  }, [location.pathname, teacherId]);

  useEffect(() => {
    if (teacherData && isEdit) {
      const jd = teacherData.joining_date ? dayjs(teacherData.joining_date) : null;
      const dob = teacherData.date_of_birth ? dayjs(teacherData.date_of_birth) : null;
      setDefaultDate(dob || jd);
      if (teacherData.languages_known) {
        const tags = typeof teacherData.languages_known === "string"
          ? teacherData.languages_known.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
        setOwner(tags.length ? tags : ["English"]);
      } else {
        setOwner(["English"]);
      }
      // Set status based on teacher data
      const currentStatus = teacherData.status === 'Active' || teacherData.is_active === true || teacherData.is_active === 1 
        ? 'Active' 
        : 'Inactive';
      setSelectedStatus(currentStatus);
      setSelectedClassId(teacherData.class_id ? String(teacherData.class_id) : null);
      setSelectedSubjectId(teacherData.subject_id ? String(teacherData.subject_id) : null);
      setSelectedGender(teacherData.gender ?? null);
      setSelectedMaritalStatus(teacherData.marital_status ?? null);
      setSelectedBloodGroup(teacherData.blood_group ?? null);
      setSelectedContractType(teacherData.contract_type ?? null);
      setSelectedShift(teacherData.shift ?? null);
    }
  }, [teacherData, isEdit]);

  if (isEdit && teacherId && loadingTeacher) {
    return (
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading teacher...</span>
          </div>
        </div>
      </div>
    );
  }

  const t = teacherData || state?.teacher;

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content content-two">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <Link
                to={state?.returnTo ?? routes.teacherList}
                className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
              >
                <i className="ti ti-arrow-left me-1" />
                Back
              </Link>
              <h3 className="mb-1">{isEdit ? "Edit" : "Add"} Teacher</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={routes.teacherList}>Teacher</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    {isEdit ? "Edit" : "Add"} Teacher
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          {/* /Page Header */}
          <div className="row">
            <div className="col-md-12">
              <form ref={formRef} key={isEdit && t ? `edit-${t.id}` : "add"}>
                <>
                  {/* Personal Information */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-info-square-rounded fs-16" />
                        </span>
                        <h4 className="text-dark">Personal Information</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                            <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                              <i className="ti ti-photo-plus fs-16" />
                            </div>
                            <div className="profile-upload">
                              <div className="profile-uploader d-flex align-items-center">
                                <div className="drag-upload-btn mb-3">
                                  Upload
                                  <input
                                    type="file"
                                    className="form-control image-sign"
                                    multiple
                                  />
                                </div>
                                <Link
                                  to="#"
                                  className="btn btn-primary mb-3"
                                >
                                  Remove
                                </Link>
                              </div>
                              <p className="fs-12">
                                Upload image size 4MB, Format JPG, PNG, SVG
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="row row-cols-xxl-5 row-cols-md-6">
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Teacher ID</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.employee_code ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">First Name</label>
                            <input
                              name="first_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.first_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Last Name</label>
                            <input
                              name="last_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.last_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Class</label>
                            {classesLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2" />
                                Loading classes...
                              </div>
                            ) : classesError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2" />
                                Error: {classesError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={(classes || []).map((cls: any) => ({
                                  value: String(cls.id),
                                  label: cls.class_name ?? ''
                                }))}
                                value={selectedClassId}
                                onChange={(value) => {
                                  if (isEdit) {
                                    setSelectedClassId(value);
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Subject</label>
                            {subjectsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2" />
                                Loading subjects...
                              </div>
                            ) : subjectsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2" />
                                Error: {subjectsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={(subjects || [])
                                  .filter((sub: any) =>
                                    selectedClassId ? String(sub.class_id) === selectedClassId : true
                                  )
                                  .map((sub: any) => ({
                                    value: String(sub.id),
                                    label: sub.subject_name ?? ''
                                  }))}
                                value={selectedSubjectId}
                                onChange={(value) => {
                                  if (isEdit) {
                                    setSelectedSubjectId(value);
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Gender</label>
                            <CommonSelect
                              className="select"
                              options={gender}
                              defaultValue={
                                isEdit && t
                                  ? (gender as any).find(
                                      (g: any) => g.value === String(t.gender || '').toLowerCase()
                                    ) || gender[0]
                                  : undefined
                              }
                              onChange={(value: string | null) => {
                                if (isEdit) {
                                  setSelectedGender(value);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Primary Contact Number
                            </label>
                            <input
                              name="phone"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.phone ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Email Address</label>
                            <input
                              name="email"
                              type="email"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.email ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Blood Group</label>
                            {bloodGroupsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2" />
                                Loading blood groups...
                              </div>
                            ) : bloodGroupsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2" />
                                Error: {bloodGroupsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={(bloodGroups || []).map((bg: any) => ({
                                  value: bg.blood_group ?? '',
                                  label: bg.blood_group ?? ''
                                }))}
                                value={selectedBloodGroup}
                                onChange={(value: string | null) => {
                                  if (isEdit) {
                                    setSelectedBloodGroup(value);
                                  }
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Date of Joining
                            </label>
                            <div className="input-icon position-relative">
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                              <input
                                type="text"
                                className="form-control datetimepicker"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Father’s Name</label>
                            <input
                              name="father_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.father_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Mother’s Name</label>
                            <input
                              name="mother_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.mother_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Date of Birth</label>
                            <div className="input-icon position-relative">
                              {isEdit? <DatePicker
                                className="form-control datetimepicker"
                                format={{
                                  format: "DD-MM-YYYY",
                                  type: "mask",
                                }}
                                value={defaultDate}
                                placeholder="Select Date"
                              /> : <DatePicker
                              className="form-control datetimepicker"
                              format={{
                                format: "DD-MM-YYYY",
                                type: "mask",
                              }}
                              defaultValue=""
                              placeholder="Select Date"
                            />}
                              
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Marital Status</label>
                            <CommonSelect
                              className="select"
                              options={Marital}
                              defaultValue={
                                isEdit && t
                                  ? (Marital as any).find(
                                      (m: any) => m.value === (teacherData?.marital_status || t.marital_status || '')
                                    ) || Marital[0]
                                  : undefined
                              }
                              onChange={(value: string | null) => {
                                if (isEdit) {
                                  setSelectedMaritalStatus(value);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Language Known</label>
                            <TagInput
                              // className="input-tags form-control"
                           initialTags ={owner}
                            onTagsChange={handleTagsChange}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Qualification</label>
                            <input
                              name="qualification"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.qualification ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Work Experience
                            </label>
                            <input
                              name="experience_years"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.experience_years != null ? String(t.experience_years) : "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Previous School if Any
                            </label>
                            <input
                              name="previous_school_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.previous_school_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Previous School Address
                            </label>
                            <input
                              name="previous_school_address"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.previous_school_address ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Previous School Phone No
                            </label>
                            <input
                              name="previous_school_phone"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.previous_school_phone ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Address</label>
                            <input
                              name="address"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.current_address ?? t.address ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Permanent Address
                            </label>
                            <input
                              name="permanent_address"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.permanent_address ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              PAN Number
                            </label>
                            <input
                              name="pan_number"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.pan_number ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              ID Number
                            </label>
                            <input
                              name="id_number"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.id_number ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Status</label>
                            <CommonSelect
                              className="select"
                              options={status}
                              defaultValue={isEdit && t 
                                ? status.find((s: any) => {
                                    const currentStatus = t.status === 'Active' || t.is_active === true || t.is_active === 1 ? 'Active' : 'Inactive';
                                    return s.value === currentStatus;
                                  }) || status[0]
                                : undefined}
                              value={isEdit ? selectedStatus : null}
                              key={isEdit && t ? `status-${t.id}-${selectedStatus}` : 'status-new'}
                              onChange={(value: string | null) => {
                                if (isEdit) {
                                  setSelectedStatus(value || 'Active');
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-12 col-xl-12">
                          <div className="mb-3">
                            <label className="form-label">Notes</label>
                            <textarea
                              className="form-control"
                              placeholder="Other Information"
                              rows={4}
                              defaultValue={
                                isEdit
                                  ? "Depending on the specific needs of your organization or system, additional information may be collected or tracked. Its important to ensure that any data collected complies with privacy regulations and policies to protect students sensitive information"
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Personal Information */}
                </>

                <>
                  {/* Payroll */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-user-shield fs-16" />
                        </span>
                        <h4 className="text-dark">Payroll</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">EPF No</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.epf_no ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Basic Salary</label>
                            <input
                              name="salary"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.salary != null ? String(t.salary) : "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Contract Type</label>
                            <CommonSelect
                              className="select"
                              options={Contract}
                              defaultValue={
                                isEdit && t
                                  ? (Contract as any).find(
                                      (c: any) => c.value === (teacherData?.contract_type || t.contract_type || '')
                                    ) || Contract[0]
                                  : undefined
                              }
                              onChange={(value: string | null) => {
                                if (isEdit) {
                                  setSelectedContractType(value);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Work Shift</label>
                            <CommonSelect
                              className="select"
                              options={Shift}
                              defaultValue={
                                isEdit && t
                                  ? (Shift as any).find(
                                      (s: any) => s.value === (teacherData?.shift || t.shift || '')
                                    ) || Shift[0]
                                  : undefined
                              }
                              onChange={(value: string | null) => {
                                if (isEdit) {
                                  setSelectedShift(value);
                                }
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Work Location</label>
                            <input
                              name="work_location"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.work_location ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Date of Leaving
                            </label>
                            <div className="input-icon position-relative">
                            {isEdit? <DatePicker
                                className="form-control datetimepicker"
                                format={{
                                  format: "DD-MM-YYYY",
                                  type: "mask",
                                }}
                                value={defaultDate}
                                placeholder="Select Date"
                              /> : <DatePicker
                              className="form-control datetimepicker"
                              format={{
                                format: "DD-MM-YYYY",
                                type: "mask",
                              }}
                              defaultValue=""
                              placeholder="Select Date"
                            />}
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Payroll */}
                  {/* Leaves */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-users fs-16" />
                        </span>
                        <h4 className="text-dark">Leaves</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Medical Leaves</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "01" : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Casual Leaves</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "02" : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Maternity Leaves
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "20" : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Sick Leaves</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "02" : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Leaves */}
                  {/* Bank Details */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-map fs-16" />
                        </span>
                        <h4 className="text-dark">Bank Account Detail</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Account Name</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.emergency_contact_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Account Number</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.emergency_contact_phone ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Bank Name</label>
                            <input
                              name="bank_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.bank_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">IFSC Code</label>
                            <input
                              name="ifsc"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.ifsc ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Branch Name</label>
                            <input
                              name="branch"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.branch ?? "") : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Bank Details */}
                </>

                {/* Transport Information */}
                <div className="card">
                  <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                        <i className="ti ti-bus-stop fs-16" />
                      </span>
                      <h4 className="text-dark">Transport Information</h4>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                      />
                    </div>
                  </div>
                  <div className="card-body pb-1">
                    <div className="row">
                      <div className="col-lg-4 col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Route</label>
                          {routesLoading ? (
                            <div className="form-control">
                              <i className="ti ti-loader ti-spin me-2" />
                              Loading routes...
                            </div>
                          ) : routesError ? (
                            <div className="form-control text-danger">
                              <i className="ti ti-alert-circle me-2" />
                              Error: {routesError}
                            </div>
                          ) : (
                            <CommonSelect
                              className="select"
                              options={(transportRoutes || []).map((r: any) => ({
                                value: String((r.originalData?.id ?? r.id) ?? ''),
                                label: r.routes ?? r.originalData?.route_name ?? 'N/A',
                              }))}
                              defaultValue={undefined}
                            />
                          )}
                        </div>
                      </div>
                      <div className="col-lg-4 col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Vehicle Number</label>
                          {vehiclesLoading ? (
                            <div className="form-control">
                              <i className="ti ti-loader ti-spin me-2" />
                              Loading vehicles...
                            </div>
                          ) : vehiclesError ? (
                            <div className="form-control text-danger">
                              <i className="ti ti-alert-circle me-2" />
                              Error: {vehiclesError}
                            </div>
                          ) : (
                            <CommonSelect
                              className="select"
                              options={(vehicles || []).map((v: any) => ({
                                value: String((v.originalData?.id ?? v.id) ?? ''),
                                label: v.vehicleNumber ?? v.originalData?.vehicle_number ?? 'N/A',
                              }))}
                              defaultValue={undefined}
                            />
                          )}
                        </div>
                      </div>
                      <div className="col-lg-4 col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Pickup Point</label>
                          {pickupLoading ? (
                            <div className="form-control">
                              <i className="ti ti-loader ti-spin me-2" />
                              Loading pickup points...
                            </div>
                          ) : pickupError ? (
                            <div className="form-control text-danger">
                              <i className="ti ti-alert-circle me-2" />
                              Error: {pickupError}
                            </div>
                          ) : (
                            <CommonSelect
                              className="select"
                              options={(pickupPoints || []).map((p: any) => ({
                                value: String((p.originalData?.id ?? p.id) ?? ''),
                                label: p.pickupPoint ?? p.originalData?.pickup_point_name ?? 'N/A',
                              }))}
                              defaultValue={undefined}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Transport Information */}
                {/* Hostel Information */}
                <div className="card">
                  <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                        <i className="ti ti-building-fortress fs-16" />
                      </span>
                      <h4 className="text-dark">Hostel Information</h4>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                      />
                    </div>
                  </div>
                  <div className="card-body pb-1">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Hostel</label>
                          <CommonSelect
                            className="select"
                            options={(hostels || []).map((h: any) => ({
                              value: String((h.originalData as { id?: number })?.id ?? ""),
                              label: (h.hostelName as string) || "N/A",
                            }))}
                            defaultValue={undefined}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Room No</label>
                          <CommonSelect
                            className="select"
                            options={(hostelRooms || []).map((r: any) => ({
                              value: String((r.originalData as { id?: number })?.id ?? ""),
                              label: (r.roomNo as string) || "N/A",
                            }))}
                            defaultValue={undefined}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Hostel Information */}
                <>
                  {/* Social Media Links */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-building fs-16" />
                        </span>
                        <h4 className="text-dark">Social Media Links</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row rows-cols-xxl-5">
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Facebook</label>
                            <input
                              name="facebook"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.facebook ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Instagram</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={
                                isEdit ? "www.instagram.com" : undefined
                              }
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Linked In</label>
                            <input
                              name="linkedin"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.linkedin ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Youtube</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={
                                isEdit ? "www.youtube.com" : undefined
                              }
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Twitter URL</label>
                            <input
                              name="twitter"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.twitter ?? "") : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Social Media Links */}
                  {/* Documents */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-file fs-16" />
                        </span>
                        <h4 className="text-dark">Documents</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-6">
                          <div className="mb-2">
                            <div className="mb-3">
                              <label className="form-label">
                                Upload Resume
                              </label>
                              <p>
                                Upload image size of 4MB, Accepted Format PDF
                              </p>
                            </div>
                            <div className="d-flex align-items-center flex-wrap">
                              <div className="btn btn-primary drag-upload-btn mb-2 me-2">
                                <i className="ti ti-file-upload me-1" />
                                Change
                                <input
                                  type="file"
                                  className="form-control image_sign"
                                  multiple
                                />
                              </div>
                              <p className="mb-2">Resume.pdf</p>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-6">
                          <div className="mb-2">
                            <div className="mb-3">
                              <label className="form-label">
                                Upload Joining Letter
                              </label>
                              <p>
                                Upload image size of 4MB, Accepted Format PDF
                              </p>
                            </div>
                            <div className="d-flex align-items-center flex-wrap">
                              <div className="btn btn-primary drag-upload-btn mb-2 me-2">
                                <i className="ti ti-file-upload me-1" />
                                Upload Document
                                <input
                                  type="file"
                                  className="form-control image_sign"
                                  multiple
                                />
                              </div>
                              <p className="mb-2">Resume.pdf</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Documents */}
                  {/* Password */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-file fs-16" />
                        </span>
                        <h4 className="text-dark">Password</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">New Password</label>
                            <input type="password" className="form-control" />
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Confirm Password
                            </label>
                            <input type="password" className="form-control" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Password */}
                </>

                <div className="text-end">
                  <button 
                    type="button" 
                    className="btn btn-light me-3"
                    onClick={() => navigate(routes.teacherList)}
                  >
                    Cancel
                  </button>
                  {isEdit ? (
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!teacherId || !formRef.current) return;
                        const form = formRef.current;
                        const get = (name: string) => (form.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value?.trim() || null;
                        const getNum = (name: string) => { const v = get(name); return v ? parseInt(v, 10) : undefined; };
                        setIsUpdating(true);
                        try {
                          const updateData: Record<string, any> = {
                            status: selectedStatus,
                            is_active: selectedStatus === 'Active',
                            first_name: get('first_name') || teacherData?.first_name,
                            last_name: get('last_name') || teacherData?.last_name,
                            phone: get('phone') || teacherData?.phone,
                            email: get('email') || teacherData?.email,
                            address: get('address') || teacherData?.address,
                            father_name: get('father_name') || teacherData?.father_name,
                            mother_name: get('mother_name') || teacherData?.mother_name,
                            qualification: get('qualification') || teacherData?.qualification,
                            experience_years: getNum('experience_years') ?? teacherData?.experience_years,
                            previous_school_name: get('previous_school_name') || teacherData?.previous_school_name,
                            previous_school_address: get('previous_school_address') || teacherData?.previous_school_address,
                            previous_school_phone: get('previous_school_phone') || teacherData?.previous_school_phone,
                            bank_name: get('bank_name') || teacherData?.bank_name,
                            branch: get('branch') || teacherData?.branch,
                            ifsc: get('ifsc') || teacherData?.ifsc,
                            current_address: get('address') || teacherData?.current_address || teacherData?.address,
                            permanent_address: get('permanent_address') || teacherData?.permanent_address,
                            pan_number: get('pan_number') || teacherData?.pan_number,
                            id_number: get('id_number') || teacherData?.id_number,
                            facebook: get('facebook') || teacherData?.facebook,
                            twitter: get('twitter') || teacherData?.twitter,
                            linkedin: get('linkedin') || teacherData?.linkedin,
                            languages_known: owner?.length ? owner : (teacherData?.languages_known ? (Array.isArray(teacherData.languages_known) ? teacherData.languages_known : [teacherData.languages_known]) : undefined),
                            class_id: teacherData?.class_id,
                            subject_id: teacherData?.subject_id,
                            gender: selectedGender || teacherData?.gender,
                            marital_status: selectedMaritalStatus || teacherData?.marital_status,
                            blood_group: selectedBloodGroup || teacherData?.blood_group,
                            salary: getNum('salary') ?? teacherData?.salary,
                            contract_type: selectedContractType || teacherData?.contract_type,
                            shift: selectedShift || teacherData?.shift,
                            work_location: get('work_location') || teacherData?.work_location,
                            date_of_birth: teacherData?.date_of_birth ? dayjs(teacherData.date_of_birth).format('YYYY-MM-DD') : undefined,
                            joining_date: teacherData?.joining_date ? dayjs(teacherData.joining_date).format('YYYY-MM-DD') : undefined,
                          };
                          Object.keys(updateData).forEach(k => { if (updateData[k] === undefined || updateData[k] === null) delete updateData[k]; });
                          const response = await apiService.updateTeacher(teacherId, updateData);
                          if (response && response.status === 'SUCCESS') {
                            navigate(routes.teacherList, { state: { refresh: true } });
                          } else {
                            alert(response?.message || 'Failed to update teacher');
                          }
                        } catch (error: any) {
                          console.error('Error updating teacher:', error);
                          alert(error?.message || 'Failed to update teacher. Please try again.');
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Updating...' : 'Save Changes'}
                    </button>
                  ) : (
                    <Link to={routes.teacherList} className="btn btn-primary">
                      Add Teacher
                    </Link>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default TeacherForm;
