/* eslint-disable */
import { useEffect, useMemo, useRef, useState } from "react";
import Table from "../../../core/common/dataTable/index";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { TableData } from "../../../core/data/interface";
import TooltipOption from "../../../core/common/tooltipOption";
import CommonSelect from "../../../core/common/commonSelect";
import { status } from "../../../core/common/selectoption/selectoption";
import { all_routes } from "../../router/all_routes";
import { useClassesWithSections } from "../../../core/hooks/useClassesWithSections";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const isValidSectionName = (name: string) => {
  const v = String(name || "").trim();
  return v && v !== "—" && v !== "N/A";
};

const ClassReport = () => {
  const navigate = useNavigate();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classesWithSections, loading, error, refetch } = useClassesWithSections(academicYearId);

  const [selectedClass, setSelectedClass] = useState<string>("All");
  const [selectedSection, setSelectedSection] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [appliedClass, setAppliedClass] = useState<string>("All");
  const [appliedSection, setAppliedSection] = useState<string>("All");
  const [appliedStatus, setAppliedStatus] = useState<string>("All");

  const data = useMemo(() => {
    const byClass = new Map<number, any>();

    (Array.isArray(classesWithSections) ? classesWithSections : []).forEach((row: any) => {
      const classId = Number(row.classId);
      if (!classId || Number.isNaN(classId)) return;

      const sectionName = String(row.sectionName || "").trim();
      const hasSection = isValidSectionName(sectionName);

      if (!byClass.has(classId)) {
        byClass.set(classId, {
          key: String(classId),
          id: row.classCode || String(classId) || "—",
          class: row.className || "—",
          classId,
          sectionNames: [] as string[],
          sectionStatuses: [] as string[],
          noOfStudents: 0,
          classStatus: row.classStatus,
          hasSections: false,
        });
      }

      const agg = byClass.get(classId);

      if (hasSection) {
        agg.hasSections = true;
        if (!agg.sectionNames.includes(sectionName)) {
          agg.sectionNames.push(sectionName);
        }
        agg.sectionStatuses.push(row.status || "Inactive");
        agg.noOfStudents += Number(row.noOfStudents ?? 0);
      } else if (!agg.hasSections) {
        agg.noOfStudents = Math.max(agg.noOfStudents, Number(row.noOfStudents ?? 0));
      }
    });

    return Array.from(byClass.values()).map((agg) => {
      const sectionLabel = agg.sectionNames.length ? agg.sectionNames.join(", ") : "—";
      const rowStatus = agg.classStatus ? "Active" : "Inactive";
      return {
        ...agg,
        section: sectionLabel,
        status: rowStatus,
        action: "View Details",
      };
    });
  }, [classesWithSections]);

  const classFilterOptions = useMemo(() => {
    const unique = Array.from(
      new Set(data.map((r) => String(r.class || "").trim()).filter((v) => v && v !== "—"))
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Classes" }, ...unique.map((value) => ({ value, label: value }))];
  }, [data]);

  const sectionFilterOptions = useMemo(() => {
    const pool =
      selectedClass === "All"
        ? (Array.isArray(classesWithSections) ? classesWithSections : [])
        : (Array.isArray(classesWithSections) ? classesWithSections : []).filter(
            (r: any) => r.className === selectedClass
          );
    const unique = Array.from(
      new Set(
        pool
          .map((r: any) => String(r.sectionName || "").trim())
          .filter(isValidSectionName)
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Sections" }, ...unique.map((value) => ({ value, label: value }))];
  }, [selectedClass, classesWithSections]);

  const filteredMainRows = useMemo(
    () =>
      data.filter((row) => {
        const classOk = appliedClass === "All" || row.class === appliedClass;
        const sectionOk =
          appliedSection === "All" ||
          (Array.isArray(row.sectionNames) && row.sectionNames.includes(appliedSection));
        const statusOk = appliedStatus === "All" || row.status === appliedStatus;
        return classOk && sectionOk && statusOk;
      }),
    [appliedClass, appliedSection, appliedStatus, data]
  );

  const routes = all_routes;

  useEffect(() => {
    if (selectedSection !== "All" && !sectionFilterOptions.some((o) => o.value === selectedSection)) {
      setSelectedSection("All");
    }
  }, [sectionFilterOptions, selectedSection]);

  const mainExportColumns = useMemo(
    () => [
      { title: "ID", dataKey: "id" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "No Of Students", dataKey: "noOfStudents" },
      { title: "Status", dataKey: "status" },
    ],
    []
  );

  const handleMainExportExcel = () => {
    const rows = filteredMainRows.map((row) => ({
      ID: row.id,
      Class: row.class,
      Section: row.section,
      "No Of Students": row.noOfStudents,
      Status: row.status,
    }));
    exportToExcel(rows, `ClassReport_${new Date().toISOString().split("T")[0]}`);
  };

  const handleMainExportPDF = () => {
    const rows = filteredMainRows.map((r) => ({
      ...r,
      noOfStudents: String(r.noOfStudents ?? ""),
    }));
    exportToPDF(rows, "Class Report", `ClassReport_${new Date().toISOString().split("T")[0]}`, mainExportColumns);
  };

  const handleMainPrint = () => {
    const rows = filteredMainRows.map((r) => ({
      ...r,
      noOfStudents: String(r.noOfStudents ?? ""),
    }));
    printData("Class Report", mainExportColumns, rows);
  };

  const openClassDetails = (record: any) => {
    navigate(`${routes.classReportDetail}/${record.classId}/0`, {
      state: { className: record.class, sectionName: record.section },
    });
  };

  const renderSectionBadges = (record: any) => {
    const names: string[] = Array.isArray(record.sectionNames) ? record.sectionNames : [];
    if (!names.length) {
      return <span className="text-muted">—</span>;
    }
    return (
      <div className="d-flex flex-wrap gap-1">
        {names.map((name: string) => (
          <span key={name} className="badge badge-soft-primary">
            {name}
          </span>
        ))}
      </div>
    );
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (id: string) => (
        <Link to="#" className="link-primary">
          {id}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.id, (b as any)?.id),
    },
    {
      title: "Class",
      dataIndex: "class",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.class, (b as any)?.class),
    },
    {
      title: "Section",
      dataIndex: "section",
      render: (_text: string, record: any) => renderSectionBadges(record),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.section, (b as any)?.section),
    },
    {
      title: "No Of Students",
      dataIndex: "noOfStudents",
      sorter: (a: TableData, b: TableData) => compareNumber((a as any)?.noOfStudents, (b as any)?.noOfStudents),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_text: string, record: any) => (
        <button type="button" className="btn btn-light" onClick={() => openClassDetails(record)}>
          View Details
        </button>
      ),
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.action, (b as any)?.action),
    },
  ];

  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const handleApplyClick = () => {
    setAppliedClass(selectedClass);
    setAppliedSection(selectedSection);
    setAppliedStatus(selectedStatus);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = () => {
    setSelectedClass("All");
    setSelectedSection("All");
    setSelectedStatus("All");
    setAppliedClass("All");
    setAppliedSection("All");
    setAppliedStatus("All");
  };

  const statusFilterOptions = [{ value: "All", label: "All Status" }, ...status];

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Class Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Class Report
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={refetch}
                onPrint={handleMainPrint}
                onExportExcel={handleMainExportExcel}
                onExportPdf={handleMainExportPDF}
              />
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Class Report List</h4>
              <div className="d-flex align-items-center flex-wrap">
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
                    <form onSubmit={(e) => e.preventDefault()}>
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
                                options={classFilterOptions}
                                value={selectedClass}
                                onChange={(value: any) => {
                                  setSelectedClass(String(value));
                                  setSelectedSection("All");
                                }}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sectionFilterOptions}
                                value={selectedSection}
                                onChange={(value: any) => setSelectedSection(String(value))}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={statusFilterOptions}
                                value={selectedStatus}
                                onChange={(value: any) => setSelectedStatus(String(value))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={handleResetFilters}>
                          Reset
                        </button>
                        <button type="button" className="btn btn-primary" onClick={handleApplyClick}>
                          Apply
                        </button>
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
              {!loading && !error && data.length === 0 && (
                <div className="alert alert-info mx-3 mt-3 mb-0" role="alert">
                  No classes found. Add classes and sections for the selected academic year, or pick a different year
                  from the header.
                </div>
              )}
              {loading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 mb-0">Loading class report...</p>
                </div>
              ) : (
                <Table columns={columns} dataSource={filteredMainRows} Selection={true} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClassReport;
