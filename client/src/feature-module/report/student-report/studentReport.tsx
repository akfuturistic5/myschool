/* eslint-disable */
import { useMemo, useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import Table from "../../../core/common/dataTable/index";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";
import TooltipOption from "../../../core/common/tooltipOption";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  classSection,
  gender,
  status,
} from "../../../core/common/selectoption/selectoption";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useStudents } from "../../../core/hooks/useStudents";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import type { Dayjs } from "dayjs";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const StudentReport = () => {
  const { students, loading, error, refetch } = useStudents();
  const routes = all_routes;
  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [selectedGender, setSelectedGender] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [appliedClass, setAppliedClass] = useState<string>("All");
  const [appliedSection, setAppliedSection] = useState<string>("All");
  const [appliedGender, setAppliedGender] = useState<string>("All");
  const [appliedStatus, setAppliedStatus] = useState<string>("All");
  const data = useMemo(
    () =>
      (Array.isArray(students) ? students : []).map((student: any, index: number) => ({
        key: student.admission_number || student.id || `student-report-${index}`,
        studentId: student.id,
        admissionNo: student.admission_number || "—",
        rollNo: student.roll_number || "—",
        name: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "—",
        class: student.class_name || "—",
        section: student.section_name || "—",
        gender: student.gender || "—",
        parent:
          student.father_name ||
          student.mother_name ||
          [student.guardian_first_name, student.guardian_last_name].filter(Boolean).join(" ") ||
          "—",
        dateOfJoin: student.admission_date ? new Date(student.admission_date).toLocaleDateString() : "—",
        dateOfJoinRaw: student.admission_date ? new Date(student.admission_date).toISOString().slice(0, 10) : "",
        dob: student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—",
        dobRaw: student.date_of_birth ? new Date(student.date_of_birth).toISOString().slice(0, 10) : "",
        status: student.is_active ? "Active" : "Inactive",
        imgSrc: student.photo_url || "",
        parentImgSrc: "",
      })),
    [students]
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

  const sectionOptions = useMemo(() => {
    const uniqueSections = Array.from(
      new Set(
        data
          .map((item) => String(item.section || "").trim())
          .filter((value) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));

    return [{ value: "All", label: "All Sections" }, ...uniqueSections.map((value) => ({ value, label: value }))];
  }, [data]);

  const filteredData = useMemo(
    () =>
      data.filter((row) => {
        const classMatched = appliedClass === "All" || row.class === appliedClass;
        const sectionMatched = appliedSection === "All" || row.section === appliedSection;
        const genderMatched = appliedGender === "All" || row.gender === appliedGender;
        const statusMatched = appliedStatus === "All" || row.status === appliedStatus;
        const dateMatched =
          !selectedDateRange ||
          ((row.dateOfJoinRaw &&
            row.dateOfJoinRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
            row.dateOfJoinRaw <= selectedDateRange[1].format("YYYY-MM-DD")) ||
            (row.dobRaw &&
              row.dobRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
              row.dobRaw <= selectedDateRange[1].format("YYYY-MM-DD")));
        return classMatched && sectionMatched && genderMatched && statusMatched && dateMatched;
      }),
    [appliedClass, appliedGender, appliedSection, appliedStatus, data, selectedDateRange]
  );

  const exportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Name", dataKey: "name" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Gender", dataKey: "gender" },
      { title: "Parent", dataKey: "parent" },
      { title: "Date Of Join", dataKey: "dateOfJoin" },
      { title: "DOB", dataKey: "dob" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const handleExportExcel = () => {
    const exportData = filteredData.map((row) => ({
      "Admission No": row.admissionNo,
      "Roll No": row.rollNo,
      Name: row.name,
      Class: row.class,
      Section: row.section,
      Gender: row.gender,
      Parent: row.parent,
      "Date Of Join": row.dateOfJoin,
      DOB: row.dob,
      Status: row.status,
    }));

    exportToExcel(exportData, `StudentReport_${new Date().toISOString().split("T")[0]}`);
  };

  const handleExportPDF = () => {
    exportToPDF(
      filteredData,
      "Student Report List",
      `StudentReport_${new Date().toISOString().split("T")[0]}`,
      exportColumns
    );
  };

  const handlePrint = () => {
    printData("Student Report List", exportColumns, filteredData);
  };

  const handleApplyClick = () => {
    setAppliedClass(selectedClass);
    setAppliedSection(selectedSection);
    setAppliedGender(selectedGender);
    setAppliedStatus(selectedStatus);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = () => {
    setSelectedClass("All");
    setSelectedSection("All");
    setSelectedGender("All");
    setSelectedStatus("All");
    setAppliedClass("All");
    setAppliedSection("All");
    setAppliedGender("All");
    setAppliedStatus("All");
    setSelectedDateRange(null);
  };
  const columns = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      render: (admissionNo: string) => (
        <>
          <Link to="#" className="link-primary">
            {admissionNo}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
    },

    {
      title: "Roll No",
      dataIndex: "rollNo",
      sorter: (a: TableData, b: TableData) => compareText(a?.rollNo, b?.rollNo),
    },
    {
      title: "Name",
      dataIndex: "name",
      render: (_text:any, record: any) => (
        <>
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md">
              <ImageWithBasePath
                src={record.imgSrc}
                className="img-fluid rounded-circle"
                alt="img"
                gender={record.gender}
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to="#">{record.name}</Link>
              </p>
            </div>
          </div>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.name, b?.name),
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText(a?.class, b?.class),
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) => compareText(a?.section, b?.section),
    },
    {
      title: "Gender",
      dataIndex: "gender",
      sorter: (a: TableData, b: TableData) => compareText(a?.gender, b?.gender),
    },
    {
      title: "Parent",
      dataIndex: "parent",
      render: (_text:any, record: any) => (
        <>
          <div className="d-flex align-items-center">
            <Link to="#" className="avatar avatar-md">
              <ImageWithBasePath
                src={record.parentImgSrc}
                className="img-fluid rounded-circle"
                alt="img"
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link to="#">{record.parent}</Link>
              </p>
            </div>
          </div>
        </>
      ),
      sorter: (a: TableData, b: TableData) => compareText(a?.parent, b?.parent),
    },
    {
      title: "Date Of Join",
      dataIndex: "dateOfJoin",
      sorter: (a: TableData, b: TableData) => compareText(a?.dateOfJoin, b?.dateOfJoin),
    },
    {
      title: "DOB",
      dataIndex: "dob",
      sorter: (a: TableData, b: TableData) => compareText(a?.dob, b?.dob),
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
      sorter: (a: TableData, b: TableData) => compareText(a?.status, b?.status),
    },
  ];
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">Student Report</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">Report</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      Student Report
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
            {/* /Page Header */}
            {/* Student List */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Student Report List</h4>
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
                    <div
                      className="dropdown-menu drop-width"
                      ref={dropdownMenuRef}
                    >
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
                                <label className="form-label">Section</label>
                                <CommonSelect
                                  className="select"
                                  options={sectionOptions}
                                  value={selectedSection}
                                  onChange={(value: any) => setSelectedSection(String(value))}
                                />
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Gender</label>
                                <CommonSelect
                                  className="select"
                                  options={gender}
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
                                  options={status}
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
                    <p className="mt-2 mb-0">Loading student report...</p>
                  </div>
                ) : (
                  <>
                    {/* Student List */}
                    <Table columns={columns} dataSource={filteredData} Selection={true} />
                    {/* /Student List */}
                  </>
                )}
              </div>
            </div>
            {/* /Student List */}
          </div>
        </div>
        {/* /Page Wrapper */}
      </>
    </div>
  );
};

export default StudentReport;
