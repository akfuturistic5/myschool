import { useState, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import { useClasses } from "../../../core/hooks/useClasses";
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

  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editStudent, setEditStudent] = useState<any>(null);

  const { classes = [], loading: classesLoading } = useClasses(academicYearId);
  const [sections, setSections] = useState<any[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("");

  const classOptions = useMemo(
    () =>
      classes.map((c: any) => ({
        value: String(c.id),
        label: c.class_name || c.name || `Class ${c.id}`,
      })),
    [classes]
  );

  const sectionOptions = useMemo(
    () =>
      sections.map((s: any) => ({
        value: String(s.section_id ?? s.id),
        label: s.section_name || s.name || `Section ${s.section_id ?? s.id}`,
      })),
    [sections]
  );

  const fetchSectionsForClass = useCallback(async (classId: string) => {
    if (!classId || !academicYearId) {
      setSections([]);
      return;
    }
    try {
      setSectionsLoading(true);
      const res = await apiService.getClassSections(classId, academicYearId);
      if (res.status === "SUCCESS") {
        setSections(Array.isArray(res.data) ? res.data : []);
      } else {
        setSections([]);
      }
    } catch (err) {
      console.error("Failed to fetch sections for class", err);
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  }, [academicYearId]);

  const fetchCurriculumMap = useCallback(async (
    isManualRefresh = false,
    overrides?: { classId?: string; sectionId?: string }
  ) => {
    const classId = overrides?.classId ?? selectedClass;
    const sectionId = overrides?.sectionId ?? selectedSection;

    if (!academicYearId) {
      setFilteredData([]);
      setLoading(false);
      setError(null);
      return;
    }

    if (!classId) {
      setFilteredData([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await apiService.getCurriculumMap({
        academic_year_id: academicYearId,
        class_id: classId,
        section_id: sectionId || null,
      });

      if (res.status === "SUCCESS") {
        const rows = Array.isArray(res.data) ? res.data : [];
        const mappedData = rows.map((item: any, idx: number) => ({
          ...item,
          key: item.id || idx,
          sNo: String(idx + 1),
          studentName: `${item.first_name || ""} ${item.last_name || ""}`.trim(),
          admissionNo: item.admission_number,
          rollNo: item.roll_number || "-",
          selections: item.selected_electives?.trim() ? item.selected_electives : "None selected",
        }));
        setFilteredData(mappedData);
        if (isManualRefresh) {
          Swal.fire({
            icon: "success",
            title: "Refreshed",
            text: "Data updated successfully",
            timer: 1500,
            showConfirmButton: false,
          });
        }
      } else {
        setError(res.message || "Failed to fetch curriculum map");
        setFilteredData([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch curriculum map");
      setFilteredData([]);
    } finally {
      setLoading(false);
    }
  }, [academicYearId, selectedClass, selectedSection]);

  useEffect(() => {
    if (selectedClass) {
      fetchSectionsForClass(selectedClass);
    } else {
      setSections([]);
      setSelectedSection("");
    }
  }, [selectedClass, fetchSectionsForClass]);

  useEffect(() => {
    fetchCurriculumMap();
  }, [fetchCurriculumMap]);

  const handleClassChange = (classId: string | null) => {
    setSelectedClass(classId || "");
    setSelectedSection("");
  };

  const handleAssignSuccess = useCallback(
    (classId?: string, sectionId?: string) => {
      const nextClass = classId || selectedClass;
      const nextSection = sectionId !== undefined ? sectionId : selectedSection;
      if (classId) {
        setSelectedClass(classId);
      }
      if (sectionId !== undefined) {
        setSelectedSection(sectionId || "");
      }
      if (nextClass) {
        fetchCurriculumMap(false, { classId: nextClass, sectionId: nextSection });
      }
    },
    [selectedClass, selectedSection, fetchCurriculumMap]
  );

  const handleExportExcel = () => {
    const exportData = filteredData.map((item) => ({
      SNo: item.sNo,
      Student: item.studentName,
      AdmissionNo: item.admissionNo,
      RollNo: item.rollNo,
      ElectiveChoices: item.selections,
    }));
    exportToExcel(exportData, `CurriculumMapping_${new Date().toISOString().split("T")[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "SNo", dataKey: "sNo" },
      { title: "Student", dataKey: "studentName" },
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Elective Choices", dataKey: "selections" },
    ];
    exportToPDF(
      filteredData,
      "Curriculum Mapping List",
      `CurriculumMapping_${new Date().toISOString().split("T")[0]}`,
      cols
    );
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
        <span
          className={`badge ${
            text === "None selected" ? "badge-soft-danger" : "badge-soft-success"
          }`}
        >
          {text}
        </span>
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center">
          <Link
            to="#"
            className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
            onClick={(e) => {
              e.preventDefault();
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

  const renderTableBody = () => {
    if (!academicYearId) {
      return (
        <div className="text-center p-5">
          <i className="ti ti-calendar-event fs-32 text-warning mb-3" />
          <p className="mb-0">Please select an academic year from the header to view curriculum mapping.</p>
        </div>
      );
    }

    if (!selectedClass) {
      return (
        <div className="text-center p-5">
          <i className="ti ti-info-circle fs-32 text-muted mb-3" />
          <p className="mb-0">Please select a class to view student elective choices.</p>
          {classesLoading && (
            <p className="text-muted small mt-2 mb-0">Loading classes...</p>
          )}
          {!classesLoading && classes.length === 0 && (
            <p className="text-muted small mt-2 mb-0">No classes found for the selected academic year.</p>
          )}
        </div>
      );
    }

    if (loading) {
      return (
        <div className="text-center p-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      );
    }

    if (error) {
      return <div className="alert alert-danger m-3">{error}</div>;
    }

    if (filteredData.length === 0) {
      return (
        <div className="text-center p-5">
          <i className="ti ti-users fs-32 text-muted mb-3" />
          <p className="mb-0">No students found for this class and section in the selected academic year.</p>
          <p className="text-muted small mt-2 mb-0">
            Ensure students are enrolled in this class for the current academic year.
          </p>
        </div>
      );
    }

    return <Table dataSource={filteredData} columns={columns} Selection={true} />;
  };

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
                  onClick={(e) => {
                    e.preventDefault();
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
                <div className="mb-3 me-2" style={{ minWidth: "200px" }}>
                  <CommonSelect
                    key={`curriculum-class-${classOptions.length}-${academicYearId ?? "none"}`}
                    className="select"
                    options={classOptions}
                    value={selectedClass}
                    onChange={handleClassChange}
                    placeholder="Select Class"
                    isDisabled={!academicYearId || classesLoading || classOptions.length === 0}
                  />
                </div>
                <div className="mb-3 me-2" style={{ minWidth: "200px" }}>
                  <CommonSelect
                    className="select"
                    options={sectionOptions}
                    value={selectedSection}
                    onChange={(val) => setSelectedSection(val || "")}
                    placeholder="All Sections"
                    isDisabled={!selectedClass || sectionsLoading}
                  />
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">{renderTableBody()}</div>
          </div>
        </div>
      </div>
      <MappingModal
        show={addModal}
        handleClose={() => {
          setAddModal(false);
          setEditStudent(null);
        }}
        onSuccess={handleAssignSuccess}
        initialClass={editStudent ? String(editStudent.class_id) : selectedClass}
        initialSection={
          editStudent ? String(editStudent.section_id || "") : selectedSection
        }
        initialStudentId={editStudent?.id}
        initialSubjects={editStudent?.selected_subject_ids || []}
      />
    </>
  );
};

export default CurriculumMapping;
