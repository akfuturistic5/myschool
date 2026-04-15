import { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import dayjs from "dayjs";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
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

const FeesGroup = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [filterStatus, setFilterStatus] = useState<string>("All");
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  // Modal States
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchFeesGroups = async (isManualRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      if (!academicYearId) return;
      
      const res = await apiService.getFeesGroups({ academic_year_id: academicYearId });
      if (res.status === "SUCCESS") {
        const mappedData = res.data.map((item: any) => ({
          ...item,
          key: item.id,
          feesGroup: item.name, // Mapping for existing UI columns
          status: item.status?.charAt(0).toUpperCase() + item.status?.slice(1).toLowerCase() // Normalize status
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
      setError(err.message || "Failed to fetch fees groups");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeesGroups();
  }, [academicYearId]);

  const handleApplyClick = (e: any) => {
    e.preventDefault();
    let filtered = [...data];

    if (filterStatus !== "All") {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    if (dateRange) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      filtered = filtered.filter(item => {
        if (!item.created_at) return true; // Keep items without dates or use a different field
        const d = dayjs(item.created_at);
        return (d.isSame(start) || d.isAfter(start)) && (d.isSame(end) || d.isBefore(end));
      });
    }

    setFilteredData(filtered);
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleReset = () => {
    setFilterStatus("All");
    setDateRange(null);
    setFilteredData(data);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      ID: item.id,
      "Fees Group": item.name,
      Description: item.description || "",
      Status: item.status
    }));
    exportToExcel(exportData, `FeesGroups_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const columns = [
      { title: "ID", dataKey: "id" },
      { title: "Fees Group", dataKey: "name" },
      { title: "Description", dataKey: "description" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(filteredData, "Fees Group List", `FeesGroups_${new Date().toISOString().split('T')[0]}`, columns);
  };

  const handlePrint = () => {
    const columns = [
      { title: "ID", dataKey: "id" },
      { title: "Fees Group", dataKey: "name" },
      { title: "Description", dataKey: "description" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Fees Group List", columns, filteredData);
  };

  const handleEdit = (group: any) => {
    setSelectedGroup(group);
    // Modal will be triggered by data-bs-target in the Link
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
    // Modal will be triggered by data-bs-target in the Link
  };

  const handleDeleteSuccess = () => {
    fetchFeesGroups();
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
      sorter: (a: any, b: any) => Number(a.id) - Number(b.id),
    },
    {
      title: "Fees Group",
      dataIndex: "feesGroup",
      sorter: (a: any, b: any) => (a.feesGroup || "").localeCompare(b.feesGroup || ""),
    },
    {
      title: "Description",
      dataIndex: "description",
      sorter: (a: any, b: any) => (a.description || "").localeCompare(b.description || ""),
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
            <ul className="dropdown-menu dropdown-menu-right p-3">
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  data-bs-toggle="modal"
                  data-bs-target="#edit_fees_group"
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
                    Fees Group
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                onRefresh={() => fetchFeesGroups(true)}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_fees_group"
                  onClick={() => setSelectedGroup(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Fees Group
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees Group List</h4>
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
                    <form onSubmit={handleApplyClick}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
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
              {/* Student List */}
              <Table dataSource={filteredData} columns={columns} Selection={true} />
              {/* /Student List */}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <FeesModal 
        onSuccess={fetchFeesGroups} 
        editGroupData={selectedGroup} 
        deleteId={deleteId}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  );
};

export default FeesGroup;
