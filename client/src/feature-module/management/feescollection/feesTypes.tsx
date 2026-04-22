import { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  feeGroup,
  feesTypes,
  ids,
  names,
  status,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import FeesModal from "./feesModal";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const FeesTypes = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [filterGroup, setFilterGroup] = useState<string | number>("All");
  const [filterStatus, setFilterStatus] = useState("All");

  // Options
  const [groups, setGroups] = useState<any[]>([]);

  // Modal States
  const [selectedType, setSelectedType] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchGroups = async () => {
    try {
      if (!academicYearId) return;
      const res = await apiService.getFeesGroups({ academic_year_id: academicYearId });
      if (res.status === "SUCCESS") {
        setGroups(res.data
          .filter((g: any) => g.status === "Active")
          .map((g: any) => ({ value: String(g.id), label: g.name }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch groups", err);
    }
  };

  const fetchFeesTypes = async (isManualRefresh = false) => {
    try {
      if (!academicYearId) return;
      setLoading(true);
      setError(null);
      const res = await apiService.getFeesTypes({ academic_year_id: academicYearId });
      if (res.status === "SUCCESS") {
        const mappedData = res.data.map((item: any) => ({
          ...item,
          key: item.id,
          feesType: item.name,
          feesCode: item.code || "-",
          feesGroup: item.group_names || "-",
          groupIds: item.group_ids || []
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
      setError(err.message || "Failed to fetch fees types");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeesTypes();
    fetchGroups();
  }, [academicYearId]);

  const handleApplyClick = (e: any) => {
    e.preventDefault();
    let filtered = [...data];

    if (filterGroup !== "All") {
      filtered = filtered.filter(item => {
        const ids = item.group_ids || [];
        // Handle both array (PostgreSQL ARRAY_AGG) and potential JSON string
        const normalizedIds = Array.isArray(ids) ? ids : (typeof ids === 'string' ? JSON.parse(ids) : []);
        return normalizedIds.some((gid: any) => Number(gid) === Number(filterGroup));
      });
    }

    if (filterStatus !== "All") {
      filtered = filtered.filter(item => 
        item.status && item.status.toLowerCase() === filterStatus.toLowerCase()
      );
    }

    setFilteredData(filtered);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleReset = () => {
    setFilterGroup("All");
    setFilterStatus("All");
    setFilteredData(data);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      ID: item.id,
      "Fees Type": item.name,
      Code: item.code || "",
      "Fees Group": item.group_names || "-",
      Description: item.description || "",
      Status: item.status
    }));
    exportToExcel(exportData, `FeesTypes_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const columns = [
      { title: "ID", dataKey: "id" },
      { title: "Fees Type", dataKey: "name" },
      { title: "Code", dataKey: "code" },
      { title: "Fees Group", dataKey: "group_names" },
      { title: "Description", dataKey: "description" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(filteredData, "Fees Type List", `FeesTypes_${new Date().toISOString().split('T')[0]}`, columns);
  };

  const handlePrint = () => {
    const columns = [
      { title: "ID", dataKey: "id" },
      { title: "Fees Type", dataKey: "name" },
      { title: "Code", dataKey: "code" },
      { title: "Fees Group", dataKey: "group_names" },
      { title: "Description", dataKey: "description" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Fees Type List", columns, filteredData);
  };

  const handleEdit = (type: any) => {
    setSelectedType(type);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
  };

  const handleDeleteSuccess = () => {
    fetchFeesTypes();
    setDeleteId(null);
  };
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: string) => (
        <Link to="#" className="link-primary">
          {text}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => Number(a.id || 0) - Number(b.id || 0),
    },
    {
      title: "Fees Type",
      dataIndex: "feesType",
      sorter: (a: TableData, b: TableData) =>
        (a.feesType || "").localeCompare(b.feesType || ""),
    },
    {
      title: "Fees Code",
      dataIndex: "feesCode",
      sorter: (a: TableData, b: TableData) =>
        (a.feesCode || "").localeCompare(b.feesCode || ""),
    },
    {
      title: "Fees Group",
      dataIndex: "feesGroup",
      sorter: (a: TableData, b: TableData) =>
        (a.feesGroup || "").localeCompare(b.feesGroup || ""),
    },
    {
      title: "Description",
      dataIndex: "description",
      sorter: (a: TableData, b: TableData) =>
        (a.description || "").localeCompare(b.description || ""),
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
      sorter: (a: any, b: any) => (a.status || "").localeCompare(b.status || ""),
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
                  data-bs-toggle="modal"
                  data-bs-target="#edit_fees_Type"
                  onClick={() => handleEdit(record)}
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
                    Fees Type
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                onRefresh={() => fetchFeesTypes(true)}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_fees_Type"
                  onClick={() => setSelectedType(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Fees Type
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees Type List</h4>
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
                  <div
                    className="dropdown-menu drop-width"
                    ref={dropdownMenuRef}
                  >
                    <form onSubmit={handleApplyClick}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Fees Group</label>
                              <CommonSelect
                                className="select"
                                options={[{ value: "All", label: "All Groups" }, ...groups]}
                                defaultValue={{ value: "All", label: "All Groups" }}
                                value={filterGroup === "All" ? "All" : filterGroup.toString()}
                                onChange={(val: any) => setFilterGroup(val)}
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
                                  { value: "Active", label: "Active" },
                                  { value: "Inactive", label: "Inactive" }
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
              <Table dataSource={filteredData} columns={columns} Selection={true} />
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <FeesModal 
        onSuccess={fetchFeesTypes} 
        editTypeData={selectedType} 
        deleteId={deleteId}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  );
};

export default FeesTypes;

