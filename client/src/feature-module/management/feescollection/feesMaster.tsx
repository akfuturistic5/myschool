import { useRef, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { apiService } from "../../../core/services/apiService";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import dayjs from "dayjs";
import {
    DueDate,
  feeGroup,
  feesTypes,
  fineType,
  ids,
  status,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import FeesModal from "./feesModal";
import TooltipOption from "../../../core/common/tooltipOption";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const FeesMaster = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Options for Filters
  const [groups, setGroups] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);

  // Filter States
  const [selectedGroup, setSelectedGroup] = useState("All");
  const [selectedType, setSelectedType] = useState("All");
  const [selectedFineType, setSelectedFineType] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);

  // Modal States
  const [selectedMaster, setSelectedMaster] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchFeesMaster = async (isManualRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      if (!academicYearId) return;

      const res = await apiService.getFeesMaster({ academic_year_id: academicYearId });
      if (res.status === "SUCCESS") {
        const mappedData = res.data.map((item: any) => ({
          ...item,
          key: item.id,
          feesGroup: item.fees_group_name,
          feesType: item.fees_type_name,
          dueDate: item.due_date ? dayjs(item.due_date).format("DD MMM YYYY") : "-",
          fineType: item.fine_type || "None",
          displayFine: item.fine_type === "percentage" ? `${item.fine_percentage || 0}%` : (item.fine_type === "fixed" ? `${item.fine_amount || 0}` : "0")
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
      setError(err.message || "Failed to fetch fees master");
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      if (!academicYearId) return;
      const gRes = await apiService.getFeesGroups({ academic_year_id: academicYearId });
      if (gRes.status === "SUCCESS") setGroups(gRes.data);
      
      const tRes = await apiService.getFeesTypes();
      if (tRes.status === "SUCCESS") setTypes(tRes.data);
    } catch (err) {
      console.error("Failed to fetch filter options", err);
    }
  };

  useEffect(() => {
    fetchFeesMaster();
    fetchFilterOptions();
  }, [academicYearId]);

  useEffect(() => {
    let filtered = [...data];

    if (selectedGroup !== "All") {
      filtered = filtered.filter(item => item.fees_group_id === Number(selectedGroup));
    }

    if (selectedType !== "All") {
      filtered = filtered.filter(item => item.fees_type_id === Number(selectedType));
    }

    if (filterStatus !== "All") {
      filtered = filtered.filter(item => item.status?.toLowerCase() === filterStatus.toLowerCase());
    }

    if (selectedFineType !== "All") {
      filtered = filtered.filter(item => item.fineType?.toLowerCase() === selectedFineType.toLowerCase());
    }

    if (dateRange) {
      const start = dateRange[0].startOf('day');
      const end = dateRange[1].endOf('day');
      filtered = filtered.filter((item: any) => {
        if (!item.due_date) return false;
        const d = dayjs(item.due_date);
        return (d.isSame(start) || d.isAfter(start)) && (d.isSame(end) || d.isBefore(end));
      });
    }

    setFilteredData(filtered);
  }, [data, selectedGroup, selectedType, filterStatus, selectedFineType, dateRange]);

  const handleApplyFilter = (e: any) => {
    e.preventDefault();
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleReset = () => {
    setSelectedGroup("All");
    setSelectedType("All");
    setSelectedFineType("All");
    setFilterStatus("All");
    setDateRange(null);
    setFilteredData(data);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map(item => ({
      ID: item.id,
      "Fees Group": item.feesGroup,
      "Fees Type": item.feesType,
      "Due Date": item.dueDate,
      Amount: item.amount,
      "Fine Type": item.fineType,
      "Fine Value": item.displayFine,
      Status: item.status
    }));
    exportToExcel(exportData, `FeesMaster_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Fees Group", dataKey: "feesGroup" },
      { title: "Fees Type", dataKey: "feesType" },
      { title: "Due Date", dataKey: "dueDate" },
      { title: "Amount", dataKey: "amount" },
      { title: "Fine Type", dataKey: "fineType" },
      { title: "Fine Amount", dataKey: "displayFine" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(filteredData, "Fees Master List", `FeesMaster_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Fees Group", dataKey: "feesGroup" },
      { title: "Fees Type", dataKey: "feesType" },
      { title: "Due Date", dataKey: "dueDate" },
      { title: "Amount", dataKey: "amount" },
      { title: "Fine Type", dataKey: "fineType" },
      { title: "Fine Amount", dataKey: "displayFine" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Fees Master List", cols, filteredData);
  };

  const handleEdit = (master: any) => {
    setSelectedMaster(master);
  };

  const handleDeleteClick = (id: number) => {
    setDeleteId(id);
  };

  const handleDeleteSuccess = () => {
    fetchFeesMaster();
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
        title: "Due Date",
        dataIndex: "dueDate",
        sorter: (a: TableData, b: TableData) =>
          dayjs(a.dueDate, "DD MMM YYYY").unix() - dayjs(b.dueDate, "DD MMM YYYY").unix(),
      },
    {
      title: "Amount",
      dataIndex: "amount",
      sorter: (a: TableData, b: TableData) =>
        Number(a.amount) - Number(b.amount),
    },

    {
      title: "Fine Type",
      dataIndex: "fineType",
      render: (text: string) => (
        <span className="badge badge-soft-info">{text}</span>
      ),
      sorter: (a: TableData, b: TableData) =>
        (a.fineType || "").localeCompare(b.fineType || ""),
    },
    {
        title: "Fine Value",
        dataIndex: "displayFine",
        sorter: (a: any, b: any) => parseFloat(a.displayFine || "0") - parseFloat(b.displayFine || "0"),
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
                  data-bs-target="#edit_fees_master"
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
                    Fees Master
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                onRefresh={() => fetchFeesMaster(true)}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_fees_master"
                  onClick={() => setSelectedMaster(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Fees Master
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Fees Master List</h4>
              <div className="d-flex align-items-center flex-wrap">
                  <div className="mb-3 me-2">
                    <PredefinedDateRanges onChange={(range: [dayjs.Dayjs, dayjs.Dayjs]) => setDateRange(range)} />
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
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Fees Group</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Groups" },
                                  ...groups.map(g => ({ value: g.id.toString(), label: g.name }))
                                ]}
                                defaultValue={{ value: "All", label: "All Groups" }}
                                value={selectedGroup}
                                onChange={(val: any) => setSelectedGroup(val)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Fees Type</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Types" },
                                  ...types.map(t => ({ value: t.id.toString(), label: t.name }))
                                ]}
                                defaultValue={{ value: "All", label: "All Types" }}
                                value={selectedType}
                                onChange={(val: any) => setSelectedType(val)}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Fine Type</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "All", label: "All Fine Types" },
                                  { value: "None", label: "None" },
                                  { value: "Percentage", label: "Percentage" },
                                  { value: "Fixed", label: "Fixed" }
                                ]}
                                defaultValue={{ value: "All", label: "All Fine Types" }}
                                value={selectedFineType}
                                onChange={(val: any) => setSelectedFineType(val)}
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
        onSuccess={fetchFeesMaster} 
        editMasterData={selectedMaster}
        deleteId={deleteId}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </>
  );
};

export default FeesMaster;
