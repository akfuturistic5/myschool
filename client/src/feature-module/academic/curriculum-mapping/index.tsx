import { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import CommonSelect from "../../../core/common/commonSelect";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import MappingModal from "./MappingModal";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const CurriculumMapping = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [addModal, setAddModal] = useState(false);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<any>(null);

  // Dynamic Options for Filters
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Filter States
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");

  const fetchCurriculumMap = async (isManualRefresh = false) => {
    try {
      if (!academicYearId) return;
      if (selectedClass === "All") {
          setData([]);
          setFilteredData([]);
          setLoading(false);
          return;
      }
      
      setLoading(true);
      setError(null);

      const res = await apiService.getCurriculumMap({ 
        academic_year_id: academicYearId,
        class_id: selectedClass === "All" ? null : selectedClass,
        section_id: selectedSection === "All" ? null : selectedSection
      });

      if (res.status === "SUCCESS") {
        const mappedData = res.data.map((item: any, idx: number) => ({
          ...item,
          key: item.id || idx,
          sNo: String(idx + 1),
          studentName: `${item.first_name} ${item.last_name}`,
          admissionNo: item.admission_number,
          rollNo: item.roll_number || "-",
          selections: item.selected_electives || "None selected"
        }));
        setData(mappedData);
        setFilteredData(mappedData);
        if (isManualRefresh) {
          Swal.fire({
            icon: 'success',
            title: 'Refreshed',
            text: 'Data updated successfully',
            timer: 1500,
            showConfirmButton: false
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch curriculum map");
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const cRes = await apiService.getClasses();
      if (cRes.status === "SUCCESS") setClasses(cRes.data);
      
      const sRes = await apiService.getSections();
      if (sRes.status === "SUCCESS") setSections(sRes.data);
    } catch (err) {
      console.error("Failed to fetch filter options", err);
    }
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchCurriculumMap();
  }, [academicYearId, selectedClass, selectedSection]);

  const handleApplyFilter = (e: any) => {
    e.preventDefault();
    fetchCurriculumMap();
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleReset = () => {
    setSelectedClass("All");
    setSelectedSection("All");
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      SNo: item.sNo,
      Student: item.studentName,
      AdmissionNo: item.admissionNo,
      RollNo: item.rollNo,
      ElectiveChoices: item.selections
    }));
    exportToExcel(exportData, `CurriculumMapping_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "SNo", dataKey: "sNo" },
      { title: "Student", dataKey: "studentName" },
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Elective Choices", dataKey: "selections" },
    ];
    exportToPDF(filteredData, "Curriculum Mapping List", `CurriculumMapping_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "SNo", dataKey: "sNo" },
      { title: "Student", dataKey: "studentName" },
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Elective Choices", dataKey: "selections" },
    ];
    printData("Curriculum Mapping List", cols, filteredData);
  };

  const columns = [
    {
      title: "SNo",
      dataIndex: "sNo",
      sorter: (a: TableData, b: TableData) => Number(a.sNo) - Number(b.sNo),
      width: 80,
    },
    {
      title: "Student",
      dataIndex: "studentName",
      sorter: (a: TableData, b: TableData) =>
        (a.studentName || "").localeCompare(b.studentName || ""),
    },
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      sorter: (a: TableData, b: TableData) =>
        (a.admissionNo || "").localeCompare(b.admissionNo || ""),
    },
    {
      title: "Roll No",
      dataIndex: "rollNo",
      sorter: (a: TableData, b: TableData) =>
        (a.rollNo || "").localeCompare(b.rollNo || ""),
    },
    {
      title: "Elective Choices",
      dataIndex: "selections",
      render: (text: string) => (
          <span className={`badge ${text === "None selected" ? "badge-soft-danger" : "badge-soft-success"}`}>
              {text}
          </span>
      )
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center">
            <Link
              to="#"
              className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
              onClick={() => {
                setEditStudent(record);
                setAddModal(true);
              }}
            >
              <i className="ti ti-edit fs-14" />
            </Link>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Curriculum Mapping</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Academic</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                  Curriculum Mapping
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                 onRefresh={() => fetchCurriculumMap(true)}
                 onPrint={handlePrint}
                 onExportExcel={handleExportExcel}
                 onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  onClick={()=>{
                    setEditStudent(null);
                    setAddModal(true);
                  }}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Assign Electives
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Student Elective Choices</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="mb-3 me-2" style={{ minWidth: '200px' }}>
                  <CommonSelect
                    className="select"
                    options={[
                      { value: "All", label: "Select Class" },
                      ...classes.map(c => ({ value: c.id.toString(), label: c.class_name || c.name }))
                    ]}
                    value={selectedClass}
                    onChange={(val: any) => setSelectedClass(val || "All")}
                  />
                </div>
                <div className="mb-3 me-2" style={{ minWidth: '200px' }}>
                  <CommonSelect
                    className="select"
                    options={[
                      { value: "All", label: "All Sections" },
                      ...sections.map(s => ({ value: s.id.toString(), label: s.section_name || s.name }))
                    ]}
                    value={selectedSection}
                    onChange={(val: any) => setSelectedSection(val || "All")}
                  />
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {selectedClass === "All" ? (
                  <div className="text-center p-5">
                      <i className="ti ti-info-circle fs-32 text-muted mb-3" />
                      <p>Please select a class to view curriculum mapping</p>
                  </div>
              ) : (
                <Table dataSource={filteredData} columns={columns} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>
      <MappingModal 
        show={addModal}
        handleClose={() => {
          setAddModal(false);
          setEditStudent(null);
        }}
        onSuccess={fetchCurriculumMap}
        initialClass={editStudent ? String(editStudent.class_id) : (selectedClass !== "All" ? selectedClass : "")}
        initialSection={editStudent ? String(editStudent.section_id) : (selectedSection !== "All" ? selectedSection : "")}
        initialStudentId={editStudent?.id}
        initialSubjects={editStudent?.selected_subject_ids || []}
      />
    </>
  );
};

export default CurriculumMapping;
