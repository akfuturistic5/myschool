import { useRef, useState, useEffect } from "react";
import dayjs from "dayjs";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
    allSection,
    cast,
    gender,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import AssignModal from "./assignModal";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const FeesAssign = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [editModal, setEditModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Options for Filters
  const [classes, setClasses] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  // Filter States
  const [selectedClass, setSelectedClass] = useState("All");
  const [selectedSection, setSelectedSection] = useState("All");
  const [selectedGender, setSelectedGender] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Modal States
  const [selectedAssign, setSelectedAssign] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchFeesAssignments = async (isManualRefresh = false) => {
    try {
      if (!academicYearId) return;
      setLoading(true);
      setError(null);

      const res = await apiService.getFeesAssignments({ academic_year_id: academicYearId });
      if (res.status === "SUCCESS") {
        const mappedData = res.data.map((item: any, idx: number) => ({
          ...item,
          key: item.id || idx,
          sNo: String(idx + 1),
          feesGroup: item.fees_group_name || "Unknown Group",
          feesType: item.fees_type_name || "Unknown Type",
          class: item.class_name || "-",
          section: item.section_name || "-",
          amount: item.total_amount || "0",
          gender: item.gender || "All",
          category: item.category || "All"
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
      setError(err.message || "Failed to fetch fees assignments");
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      if (!academicYearId) return;
      const cRes = await apiService.getClasses();
      if (cRes.status === "SUCCESS") setClasses(cRes.data);
      
      const sRes = await apiService.getSections();
      if (sRes.status === "SUCCESS") setSections(sRes.data);
    } catch (err) {
      console.error("Failed to fetch filter options", err);
    }
  };

  useEffect(() => {
    fetchFeesAssignments();
    fetchFilterOptions();
  }, [academicYearId]);

  const handleApplyFilter = (e: any) => {
    e.preventDefault();
    let filtered = [...data];

    if (selectedClass !== "All") {
      filtered = filtered.filter(item => item.class_id === Number(selectedClass));
    }

    if (selectedSection !== "All") {
      filtered = filtered.filter(item => item.section_id === Number(selectedSection) || !item.section_id); 
    }

    if (selectedGender !== "All") {
      filtered = filtered.filter(item => item.gender?.toLowerCase() === selectedGender.toLowerCase());
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter(item => item.category?.toLowerCase() === selectedCategory.toLowerCase());
    }
/* Note: Section filter might be null in DB if assigned to all sections of a class. Handle gracefully. */


    setFilteredData(filtered);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleReset = () => {
    setSelectedClass("All");
    setSelectedSection("All");
    setSelectedGender("All");
    setSelectedCategory("All");
    setFilteredData(data);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      SNo: item.sNo,
      Group: item.feesGroup,
      Type: item.feesType,
      Class: item.class,
      Section: item.section,
      Amount: item.amount,
      Gender: item.gender,
      Category: item.category
    }));
    exportToExcel(exportData, `FeesAssign_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "SNo", dataKey: "sNo" },
      { title: "Group", dataKey: "feesGroup" },
      { title: "Type", dataKey: "feesType" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Amount", dataKey: "amount" },
      { title: "Gender", dataKey: "gender" },
      { title: "Category", dataKey: "category" },
    ];
    exportToPDF(filteredData, "Fees Assignment List", `FeesAssign_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "SNo", dataKey: "sNo" },
      { title: "Group", dataKey: "feesGroup" },
      { title: "Type", dataKey: "feesType" },
      { title: "Class", dataKey: "class" },
      { title: "Section", dataKey: "section" },
      { title: "Amount", dataKey: "amount" },
      { title: "Gender", dataKey: "gender" },
      { title: "Category", dataKey: "category" },
    ];
    printData("Fees Assignment List", cols, filteredData);
  };

  const handleEdit = (assign: any) => {
    setSelectedAssign(assign);
    setEditModal(true);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
  };
  const columns = [
    {
      title: "SNo",
      dataIndex: "sNo",
      sorter: (a: TableData, b: TableData) => Number(a.sNo) - Number(b.sNo),
    },
    {
        title: "Fees Group",
        dataIndex: "feesGroup",
        sorter: (a: TableData, b: TableData) =>
          (a.feesGroup || "").localeCompare(b.feesGroup || ""),
      },

    {
      title: "Fees Type",
      dataIndex: "feesType",
      sorter: (a: TableData, b: TableData) =>
        (a.feesType || "").localeCompare(b.feesType || ""),
    },
    {
        title: "Class",
        dataIndex: "class",
        sorter: (a: TableData, b: TableData) =>
          (a.class || "").localeCompare(b.class || ""),
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
      sorter: (a: TableData, b: TableData) =>
        Number(a.amount) - Number(b.amount),
    },
    {
      title: "Gender",
      dataIndex: "gender",
      sorter: (a: TableData, b: TableData) =>
        (a.gender || "").localeCompare(b.gender || ""),
    },
    {
      title: "Category",
      dataIndex: "category",
      sorter: (a: TableData, b: TableData) =>
        (a.category || "").localeCompare(b.category || ""),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center">
          <div className="dropdown">
            <Link
              to="#"
              className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="ti ti-dots-vertical fs-14" />
            </Link>
            <ul className="dropdown-menu dropdown-menu-end p-2">
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  onClick={()=>handleEdit(record)}
                >
                  <i className="ti ti-edit-circle me-2" />
                  Edit
                </Link>
              </li>
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  data-bs-toggle="modal"
                  data-bs-target="#delete-modal"
                  onClick={() => handleDeleteClick(record.id)}
                >
                  <i className="ti ti-trash-x me-2" />
                  Delete
                </Link>
              </li>
            </ul>
          </div>
        </div>
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
                  Assign Fees
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                 onRefresh={() => fetchFeesAssignments(true)}
                 onPrint={handlePrint}
                 onExportExcel={handleExportExcel}
                 onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  onClick={()=>{
                    setSelectedAssign(null);
                    setAddModal(true);
                  }}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Assign New
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees Assignment List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle mb-3 me-2"
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
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Classes" },
                                  ...classes.map(c => ({ value: c.id.toString(), label: c.class_name || c.name }))
                                ]}
                                defaultValue={{ value: "All", label: "All Classes" }}
                                value={selectedClass}
                                onChange={(val: any) => setSelectedClass(val)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Sections" },
                                  ...sections.map(s => ({ value: s.id.toString(), label: s.section_name || s.name }))
                                ]}
                                defaultValue={{ value: "All", label: "All Sections" }}
                                value={selectedSection}
                                onChange={(val: any) => setSelectedSection(val)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Gender</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Genders" },
                                  { value: "Male", label: "Male" },
                                  { value: "Female", label: "Female" }
                                ]}
                                defaultValue={{ value: "All", label: "All Genders" }}
                                value={selectedGender}
                                onChange={(val: any) => setSelectedGender(val)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Category</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Categories" },
                                  { value: "General", label: "General" },
                                  { value: "OBC", label: "OBC" },
                                  { value: "SC", label: "SC" },
                                  { value: "ST", label: "ST" }
                                ]}
                                defaultValue={{ value: "All", label: "All Categories" }}
                                value={selectedCategory}
                                onChange={(val: any) => setSelectedCategory(val)}
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
              <Table dataSource={filteredData} columns={columns} Selection={true} />
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <AssignModal 
        setEditModal={setEditModal} 
        editModal={editModal} 
        setAddModal={setAddModal} 
        addModal={addModal}
        editAssignData={selectedAssign}
        deleteId={deleteId}
        onDeleteSuccess={fetchFeesAssignments}
      />
    </>
  );
};

export default FeesAssign;

