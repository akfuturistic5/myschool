import { useEffect, useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import CommonSelect from "../../../core/common/commonSelect";
import { status as statusOptions } from "../../../core/common/selectoption/selectoption";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import TransportModal from "./transportModal";
import { useTransportVehicles } from "../../../core/hooks/useTransportVehicles";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const TransportVehicle = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  
  // State for dynamic features
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: "",
    status: "",
    sortField: "id",
    sortOrder: "ASC"
  });

  const { data, loading, metadata, refetch } = useTransportVehicles(params);

  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [draftStatus, setDraftStatus] = useState("all");

  useEffect(() => {
    setParams((prev) => ({ ...prev, academic_year_id: academicYearId ?? undefined, page: 1 }));
  }, [academicYearId]);

  const handleApplyClick = (e: any) => {
    e.preventDefault();
    setParams(prev => ({ ...prev, status: draftStatus, page: 1 }));
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const onPageChange = (page: number, pageSize: number) => {
    setParams(prev => ({ ...prev, page, limit: pageSize }));
  };

  const onSort = (field: string, order: string) => {
    setParams(prev => ({
      ...prev,
      sortField: field,
      sortOrder: order === "ascend" ? "ASC" : "DESC"
    }));
  };

  const onRefresh = async () => {
    await refetch();
    Swal.fire({
      icon: 'success',
      title: 'Refreshed',
      text: 'Data updated successfully',
      timer: 1500,
      showConfirmButton: false
    });
  };

  const handleExportExcel = () => {
    const exportData = (data as any[]).map((item: any) => ({
      ID: item.id,
      "Vehicle No": item.vehicleNo,
      Model: item.vehicleModel,
      "Seat Capacity": item.seatCapacity,
      "Made of Year": item.madeofYear,
      "Registration No": item.registrationNo,
      "Chassis No": item.chassisNo,
      "GPS Device ID": item.gps,
      Status: item.status
    }));
    exportToExcel(exportData, `Transport_Vehicles_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Vehicle No", dataKey: "vehicleNo" },
      { title: "Model", dataKey: "vehicleModel" },
      { title: "Seat Capacity", dataKey: "seatCapacity" },
      { title: "Made of Year", dataKey: "madeofYear" },
      { title: "Registration No", dataKey: "registrationNo" },
      { title: "Chassis No", dataKey: "chassisNo" },
      { title: "GPS Device ID", dataKey: "gps" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(data, "Transport Vehicles List", `Transport_Vehicles_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Vehicle No", dataKey: "vehicleNo" },
      { title: "Model", dataKey: "vehicleModel" },
      { title: "Seat Capacity", dataKey: "seatCapacity" },
      { title: "Made of Year", dataKey: "madeofYear" },
      { title: "Registration No", dataKey: "registrationNo" },
      { title: "Chassis No", dataKey: "chassisNo" },
      { title: "GPS Device ID", dataKey: "gps" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Transport Vehicles List", cols, data);
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "displayId",
      sorter: true,
      render: (text: string) => (
        <Link to="#" className="link-primary">
          {text}
        </Link>
      ),
    },
    {
      title: "Vehicle No",
      dataIndex: "vehicleNo",
      sorter: true,
    },
    {
      title: "Vehicle Model",
      dataIndex: "vehicleModel",
      sorter: true,
    },
    {
      title: "Seat Capacity",
      dataIndex: "seatCapacity",
      sorter: true,
    },
    {
      title: "Made of Year",
      dataIndex: "madeofYear",
      sorter: true,
    },
    {
      title: "Registration No",
      dataIndex: "registrationNo",
      sorter: true,
    },
    {
      title: "Chassis No",
      dataIndex: "chassisNo",
      render: (text: string) => (
        <span className="badge bg-soft-info">{text}</span>
      ),
      sorter: true,
    },
    {
      title: "GPS Device ID",
      dataIndex: "gps",
      sorter: true,
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
      sorter: true,
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
                  data-bs-target="#edit_vehicle"
                  onClick={() => setSelectedVehicle(record)}
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
                  onClick={() => {
                    setDeleteId(record.originalData?.id || record.id);
                    setSelectedVehicle(record);
                  }}
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
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Vehicles</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Vehicles
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption 
                onRefresh={onRefresh}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_vehicle"
                  onClick={() => setSelectedVehicle(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Vehicle
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Vehicles List</h4>
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
                    <form onSubmit={handleApplyClick}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[{ value: "all", label: "All Status" }, ...statusOptions.map(s => ({ value: s.value.toLowerCase(), label: s.label }))]}
                                value={draftStatus}
                                onChange={(val: string | null) => setDraftStatus(val === "all" || val === "All" ? "all" : (val?.toLowerCase() || "all"))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={() => {
                          setDraftStatus("all");
                          setParams({ ...params, status: "all", page: 1 });
                        }}>
                          Reset
                        </Link>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-body p-0 py-3">
               <Table 
                 dataSource={data} 
                 columns={columns} 
                 Selection={true} 
                 pagination={{
                   current: metadata.page,
                   pageSize: metadata.limit,
                   total: metadata.totalCount,
                   showSizeChanger: true,
                   onChange: onPageChange
                 }}
                 onTableChange={(pagination: any, filters: any, sorter: any) => {
                   if (sorter.field) {
                     onSort(sorter.field, sorter.order);
                   }
                 }}
               />
            </div>
          </div>
        </div>
      </div>

      <TransportModal
        selectedVehicle={selectedVehicle}
        deleteId={deleteId}
        onSuccess={() => {
          refetch();
          setSelectedVehicle(null);
          setDeleteId(null);
        }}
      />
    </>
  );
};

export default TransportVehicle;
