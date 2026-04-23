/* eslint-disable */
import { useMemo, useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import Table from "../../../core/common/dataTable/index";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import TooltipOption from "../../../core/common/tooltipOption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import { gender, status } from "../../../core/common/selectoption/selectoption";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import type { Dayjs } from "dayjs";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const formatGenderLabel = (g: string | null | undefined) => {
  const v = String(g || "").trim().toLowerCase();
  if (!v) return "—";
  if (v === "m" || v === "male") return "Male";
  if (v === "f" || v === "female") return "Female";
  if (v === "o" || v === "other") return "Other";
  const raw = String(g).trim();
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

const genderKey = (g: string | null | undefined) => {
  const v = String(g || "").trim().toLowerCase();
  if (v === "m") return "male";
  if (v === "f") return "female";
  return v;
};

const TeacherReport = () => {
  const { teachers, loading, error, refetch } = useTeachers();
  const routes = all_routes;
  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [selectedSubject, setSelectedSubject] = useState<string>("All");
  const [selectedGender, setSelectedGender] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [appliedClass, setAppliedClass] = useState<string>("All");
  const [appliedSubject, setAppliedSubject] = useState<string>("All");
  const [appliedGender, setAppliedGender] = useState<string>("All");
  const [appliedStatus, setAppliedStatus] = useState<string>("All");

  const data = useMemo(
    () =>
      (Array.isArray(teachers) ? teachers : []).map((teacher: any, index: number) => {
        const name = `${teacher.first_name || ""} ${teacher.last_name || ""}`.trim() || "—";
        const statusLabel =
          teacher.status === "Active" || teacher.is_active === true || teacher.is_active === 1
            ? "Active"
            : "Inactive";
        const joinRaw = teacher.joining_date ? new Date(teacher.joining_date).toISOString().slice(0, 10) : "";
        const dobRaw = teacher.date_of_birth ? new Date(teacher.date_of_birth).toISOString().slice(0, 10) : "";
        return {
          key: teacher.id || `teacher-report-${index}`,
          teacherId: teacher.id,
          teacher,
          employeeCode: teacher.employee_code || "—",
          name,
          class: teacher.class_name || "—",
          subject: teacher.subject_name || "—",
          genderLabel: formatGenderLabel(teacher.gender),
          genderFilter: genderKey(teacher.gender),
          email: teacher.email || "—",
          phone: teacher.phone || "—",
          qualification: teacher.qualification || "—",
          dateOfJoin: teacher.joining_date ? new Date(teacher.joining_date).toLocaleDateString() : "—",
          dateOfJoinRaw: joinRaw,
          dob: teacher.date_of_birth ? new Date(teacher.date_of_birth).toLocaleDateString() : "—",
          dobRaw,
          status: statusLabel,
          imgSrc: teacher.photo_url || "",
        };
      }),
    [teachers]
  );

  const classOptions = useMemo(() => {
    const uniqueClasses = Array.from(
      new Set(
        data
          .map((item) => String(item.class || "").trim())
          .filter((value) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Classes" }, ...uniqueClasses.map((value) => ({ value, label: value }))];
  }, [data]);

  const subjectOptions = useMemo(() => {
    const uniqueSubjects = Array.from(
      new Set(
        data
          .map((item) => String(item.subject || "").trim())
          .filter((value) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Subjects" }, ...uniqueSubjects.map((value) => ({ value, label: value }))];
  }, [data]);

  const filteredData = useMemo(
    () =>
      data.filter((row) => {
        const classMatched = appliedClass === "All" || row.class === appliedClass;
        const subjectMatched = appliedSubject === "All" || row.subject === appliedSubject;
        const genderMatched = appliedGender === "All" || row.genderFilter === appliedGender;
        const statusMatched = appliedStatus === "All" || row.status === appliedStatus;
        const dateMatched =
          !selectedDateRange ||
          ((row.dateOfJoinRaw &&
            row.dateOfJoinRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
            row.dateOfJoinRaw <= selectedDateRange[1].format("YYYY-MM-DD")) ||
            (row.dobRaw &&
              row.dobRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
              row.dobRaw <= selectedDateRange[1].format("YYYY-MM-DD")));
        return classMatched && subjectMatched && genderMatched && statusMatched && dateMatched;
      }),
    [appliedClass, appliedGender, appliedStatus, appliedSubject, data, selectedDateRange]
  );

  const exportColumns = useMemo(
    () => [
      { title: "Employee Code", dataKey: "employeeCode" },
      { title: "Name", dataKey: "name" },
      { title: "Class", dataKey: "class" },
      { title: "Subject", dataKey: "subject" },
      { title: "Gender", dataKey: "genderLabel" },
      { title: "Email", dataKey: "email" },
      { title: "Phone", dataKey: "phone" },
      { title: "Qualification", dataKey: "qualification" },
      { title: "Date Of Join", dataKey: "dateOfJoin" },
      { title: "DOB", dataKey: "dob" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const handleExportExcel = () => {
    const exportData = filteredData.map((row) => ({
      "Employee Code": row.employeeCode,
      Name: row.name,
      Class: row.class,
      Subject: row.subject,
      Gender: row.genderLabel,
      Email: row.email,
      Phone: row.phone,
      Qualification: row.qualification,
      "Date Of Join": row.dateOfJoin,
      DOB: row.dob,
      Status: row.status,
    }));
    exportToExcel(exportData, `TeacherReport_${new Date().toISOString().split("T")[0]}`);
  };

  const handleExportPDF = () => {
    exportToPDF(filteredData, "Teacher Report List", `TeacherReport_${new Date().toISOString().split("T")[0]}`, exportColumns);
  };

  const handlePrint = () => {
    printData("Teacher Report List", exportColumns, filteredData);
  };

  const handleApplyClick = () => {
    setAppliedClass(selectedClass);
    setAppliedSubject(selectedSubject);
    setAppliedGender(selectedGender);
    setAppliedStatus(selectedStatus);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = () => {
    setSelectedClass("All");
    setSelectedSubject("All");
    setSelectedGender("All");
    setSelectedStatus("All");
    setAppliedClass("All");
    setAppliedSubject("All");
    setAppliedGender("All");
    setAppliedStatus("All");
    setSelectedDateRange(null);
  };

  const columns = [
    {
      title: "Employee Code",
      dataIndex: "employeeCode",
      render: (code: string, record: any) => (
        <Link
          to={routes.teacherDetails}
          state={{ teacherId: record.teacherId, teacher: record.teacher }}
          className="link-primary"
        >
          {code}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.employeeCode, (b as any)?.employeeCode),
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (_text: any, record: any) => (
        <div className="d-flex align-items-center">
          <Link
            to={routes.teacherDetails}
            state={{ teacherId: record.teacherId, teacher: record.teacher }}
            className="avatar avatar-md"
          >
            <ImageWithBasePath
              src={record.imgSrc}
              className="img-fluid rounded-circle"
              alt="img"
              gender={record.teacher?.gender}
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to={routes.teacherDetails} state={{ teacherId: record.teacherId, teacher: record.teacher }}>
                {record.name}
              </Link>
            </p>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.name, (b as any)?.name),
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.class, (b as any)?.class),
    },
    {
      title: "Subject",
      dataIndex: "subject",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.subject, (b as any)?.subject),
    },
    {
      title: "Gender",
      dataIndex: "genderLabel",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.genderLabel, (b as any)?.genderLabel),
    },
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.email, (b as any)?.email),
    },
    {
      title: "Phone",
      dataIndex: "phone",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.phone, (b as any)?.phone),
    },
    {
      title: "Qualification",
      dataIndex: "qualification",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.qualification, (b as any)?.qualification),
    },
    {
      title: "Date Of Join",
      dataIndex: "dateOfJoin",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.dateOfJoin, (b as any)?.dateOfJoin),
    },
    {
      title: "DOB",
      dataIndex: "dob",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.dob, (b as any)?.dob),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) =>
        text === "Active" ? (
          <span className="badge badge-soft-success d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1"></i>
            {text}
          </span>
        ) : (
          <span className="badge badge-soft-danger d-inline-flex align-items-center">
            <i className="ti ti-circle-filled fs-5 me-1"></i>
            {text}
          </span>
        ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.status, (b as any)?.status),
    },
  ];

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Teacher Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Teacher Report
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={refetch}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Teacher Report List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="mb-3 me-2">
                  <PredefinedDateRanges onChange={(range: [Dayjs, Dayjs]) => setSelectedDateRange(range)} />
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
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classOptions}
                                value={selectedClass}
                                onChange={(value: any) => setSelectedClass(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Subject</label>
                              <CommonSelect
                                className="select"
                                options={subjectOptions}
                                value={selectedSubject}
                                onChange={(value: any) => setSelectedSubject(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Gender</label>
                              <CommonSelect
                                className="select"
                                options={[{ value: "All", label: "All Gender" }, ...gender]}
                                value={selectedGender}
                                onChange={(value: any) => setSelectedGender(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[{ value: "All", label: "All Status" }, ...status]}
                                value={selectedStatus}
                                onChange={(value: any) => setSelectedStatus(String(value))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={handleResetFilters}>
                          Reset
                        </Link>
                        <Link to="#" className="btn btn-primary" onClick={handleApplyClick}>
                          Apply
                        </Link>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {error && (
                <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                  {error}
                </div>
              )}
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 mb-0">Loading teacher report...</p>
                </div>
              ) : (
                <Table columns={columns} dataSource={filteredData} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherReport;

