import { useRef, useState, useEffect } from "react";
import dayjs from "dayjs";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  AdmissionNo,
  allClass,
  allSection,
  amount,
  DueDate,
  names,
  rollno,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import { useFeeCollections } from "../../../core/hooks/useFeeCollections";
import StudentModals from "../../peoples/students/studentModals";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { apiService } from "../../../core/services/apiService";

const CollectFees = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { data, loading, error, refetch } = useFeeCollections({ academicYearId });
  const [filteredData, setFilteredData] = useState<any[]>([]);
  
  // Dynamic Options for Filters
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Filter States
  const [searchAdmNo, setSearchAdmNo] = useState("");
  const [searchRollNo, setSearchRollNo] = useState("");
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  const [selectedStudentForFee, setSelectedStudentForFee] = useState<{
    id: number;
    admission_number?: string;
    first_name?: string;
    last_name?: string;
    class_name?: string;
    section_name?: string;
    photo_url?: string | null;
  } | null>(null);
  const fetchFilterOptions = async () => {
    try {
      const cRes = await apiService.getClasses();
      if (cRes.status === "SUCCESS") setClasses(cRes.data);
      const sRes = await apiService.getSections();
      if (sRes.status === "SUCCESS") setSections(sRes.data);
    } catch (err) {
      console.error("Filter options fetch error", err);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    setFilteredData(data);
  }, [data]);

  const handleApplyFilter = (e: any) => {
    e.preventDefault();
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  useEffect(() => {
    let filtered = [...data];

    if (searchAdmNo) {
      filtered = filtered.filter((item: any) => 
        item.admNo.toLowerCase().includes(searchAdmNo.toLowerCase())
      );
    }
    if (searchRollNo) {
      filtered = filtered.filter((item: any) => 
        item.rollNo.toLowerCase().includes(searchRollNo.toLowerCase())
      );
    }
    if (selectedClass !== "All") {
      filtered = filtered.filter((item: any) => 
        item.class === selectedClass
      );
    }
    if (selectedSection !== "All") {
      filtered = filtered.filter((item: any) => 
        item.section === selectedSection
      );
    }
    if (filterStatus !== "All") {
      filtered = filtered.filter((item: any) => item.status === filterStatus);
    }

    if (dateRange) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      filtered = filtered.filter((item: any) => {
        if (!item.lastDate || item.lastDate === '-') return false;
        const d = dayjs(item.lastDate, "DD MMM YYYY");
        return (d.isSame(start) || d.isAfter(start)) && (d.isSame(end) || d.isBefore(end));
      });
    }

    setFilteredData(filtered);
  }, [data, searchAdmNo, searchRollNo, selectedClass, selectedSection, filterStatus, dateRange]);

  const handleReset = () => {
    setSearchAdmNo("");
    setSearchRollNo("");
    setSelectedClass("All");
    setSelectedSection("All");
    setFilterStatus("All");
    setDateRange(null);
    setFilteredData(data);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      "Adm No": item.admNo,
      "Roll No": item.rollNo,
      Student: item.student,
      Class: item.class,
      Section: item.section,
      Amount: item.amount,
      "Last Date": item.lastDate,
      Status: item.status
    }));
    exportToExcel(exportData, `FeeCollections_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "Adm No", dataKey: "admNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Student", dataKey: "student" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Amount", dataKey: "amount" },
      { title: "Last Date", dataKey: "lastDate" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(filteredData, "Fee Collection List", `FeeCollections_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "Adm No", dataKey: "admNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Student", dataKey: "student" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Amount", dataKey: "amount" },
      { title: "Last Date", dataKey: "lastDate" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Fee Collection List", cols, filteredData);
  };

  const handleManualRefresh = () => {
    refetch();
    Swal.fire({
      icon: 'success',
      title: 'Refreshed',
      text: 'Data updated successfully',
      timer: 1500,
      showConfirmButton: false
    });
  };
  const columns = [
    {
      title: "Adm No",
      dataIndex: "admNo",
      render: (text: string) => (
        <Link to="#" className="link-primary">
          {text}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => (a.admNo || "").localeCompare(b.admNo || ""),
    },
    {
      title: "Roll No",
      dataIndex: "rollNo",
      sorter: (a: TableData, b: TableData) => (a.rollNo || "").localeCompare(b.rollNo || ""),
    },
    {
      title: "Student",
      dataIndex: "student",
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link to={record.id ? `${routes.studentDetail}/${record.id}` : routes.studentDetail} state={record.id ? { studentId: record.id } : undefined} className="avatar avatar-md">
            <ImageWithBasePath
              src={record.studentImage}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to={record.id ? `${routes.studentDetail}/${record.id}` : routes.studentDetail} state={record.id ? { studentId: record.id } : undefined}>{text}</Link>
            </p>
            <span className="fs-12">{record.studentClass}</span>
          </div>
        </div>
      ),
      sorter: (a: TableData, b: TableData) =>
        (a.student || "").localeCompare(b.student || ""),
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => (a.class || "").localeCompare(b.class || ""),
    },
    {
      title: "Section",
      dataIndex: "section",
      sorter: (a: TableData, b: TableData) =>
        (a.section || "").localeCompare(b.section || ""),
    },
    {
      title: "Amount",
      dataIndex: "amount",
      sorter: (a: TableData, b: TableData) => parseFloat(a.amount) - parseFloat(b.amount),
      render: (text: string) => <span>{parseFloat(text).toLocaleString()}</span>
    },

    {
      title: "Last Date",
      dataIndex: "lastDate",
      sorter: (a: TableData, b: TableData) =>
        dayjs(a.lastDate, "DD MMM YYYY").unix() - dayjs(b.lastDate, "DD MMM YYYY").unix(),
    },

    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Paid" ? (
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
      sorter: (a: TableData, b: TableData) => (a.status || "").localeCompare(b.status || ""),
    },
    {
      title: "Action",
      dataIndex: "status",
      render: (text: string, record: any) => (
        <>
          {text === "Paid" ? (
            <Link to={routes.studentFees} state={record.id ? { studentId: record.id } : undefined} className="btn btn-light">
              View Details
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                const parts = (record.student || "").trim().split(/\s+/);
                const firstName = parts[0] || "";
                const lastName = parts.slice(1).join(" ") || "";
                setSelectedStudentForFee({
                  id: record.id,
                  admission_number: record.admNo,
                  first_name: firstName,
                  last_name: lastName,
                  class_name: record.class,
                  section_name: record.section,
                  photo_url: record.studentImage || null,
                });
                setTimeout(() => {
                  const el = document.getElementById("add_fees_collect");
                  if (el) (window as any).bootstrap?.Modal?.getOrCreateInstance(el).show();
                }, 0);
              }}
            >
              Collect Fees
            </button>
          )}
        </>
      ),
    },
  ];
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Fees Collection</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Fees Collection</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Collect Fees
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                onRefresh={handleManualRefresh}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees List</h4>
              <div className="d-flex align-items-center flex-wrap">
                  <div className="mb-3 me-2">
                    <PredefinedDateRanges onChange={(range: [any, any]) => setDateRange(range)} />
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
                    <form onSubmit={handleApplyFilter}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Admisson No</label>
                              <input 
                                type="text"
                                className="form-control"
                                value={searchAdmNo}
                                onChange={(e) => setSearchAdmNo(e.target.value)}
                                placeholder="Admission No"
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Roll No</label>
                              <input 
                                type="text"
                                className="form-control"
                                value={searchRollNo}
                                onChange={(e) => setSearchRollNo(e.target.value)}
                                placeholder="Roll No"
                              />
                            </div>
                          </div>

                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Classes" },
                                  ...classes.map(c => ({ value: c.class_name || c.name, label: c.class_name || c.name }))
                                ]}
                                defaultValue={{ value: "All", label: "All Classes" }}
                                value={selectedClass}
                                onChange={(val: any) => setSelectedClass(val)}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Sections" },
                                  ...sections.map(s => ({ value: s.section_name || s.name, label: s.section_name || s.name }))
                                ]}
                                defaultValue={{ value: "All", label: "All Sections" }}
                                value={selectedSection}
                                onChange={(val: any) => setSelectedSection(val)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Status" },
                                  { value: "Paid", label: "Paid" },
                                  { value: "Partial", label: "Partial" },
                                  { value: "Unpaid", label: "Unpaid" },
                                  { value: "No Fees", label: "No Fees" }
                                ]}
                                defaultValue={{ value: "All", label: "All Status" }}
                                value={filterStatus}
                                onChange={(val: any) => setFilterStatus(val)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={handleReset}>
                          Reset
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                        >
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading && (
                <div className="d-flex justify-content-center align-items-center p-4">
                  <div className="spinner-border text-primary" role="status" />
                  <span className="ms-2">Loading...</span>
                </div>
              )}
              {error && (
                <div className="alert alert-warning m-3" role="alert">
                  {error}
                </div>
              )}
              {!loading && !error && (
                <Table dataSource={filteredData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <StudentModals
        student={selectedStudentForFee}
        onFeeCollected={() => {
          setSelectedStudentForFee(null);
          refetch();
        }}
      />
    </>
  );
};

export default CollectFees;
