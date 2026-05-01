import { useEffect, useRef, useState, useCallback } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import { status } from "../../../core/common/selectoption/selectoption";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import TransportModal from "./transportModal";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useTransportDrivers } from "../../../core/hooks/useTransportDrivers";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";

const TransportVehicleDrivers = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  
  // State for filters and pagination
  const [params, setParams] = useState({
    page: 1,
    limit: 10,
    search: "",
    role: "all",
    status: "",
    sortField: "id",
    sortOrder: "ASC"
  });

  const { data, loading, metadata, refetch } = useTransportDrivers(params);

  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [draftRole, setDraftRole] = useState("all");
  const [draftStatus, setDraftStatus] = useState("all");

  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const onPageChange = (page: number, pageSize: number) => {
    setParams(prev => ({ ...prev, page, limit: pageSize }));
  };

  const onSort = (field: string, order: string) => {
    const sortFieldMap: Record<string, string> = {
      id: "id",
      name: "driver_name",
      phone: "phone",
      role: "role",
      driverLicenseNo: "license_number",
      status: "is_active",
      createdAt: "created_at",
    };
    setParams(prev => ({
      ...prev,
      sortField: sortFieldMap[field] || "id",
      sortOrder: order === "ascend" ? "ASC" : "DESC"
    }));
  };

  const handleSearch = (value: string) => {
    setParams(prev => ({ ...prev, search: value, page: 1 }));
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
      Name: item.name,
      Role: item.role,
      Phone: item.phone,
      "License No": item.driverLicenseNo,
      Address: item.address,
      Status: item.status
    }));
    exportToExcel(exportData, `Transport_Drivers_${new Date().toISOString().split('T')[0]}`);
  };

  const handleExportPDF = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Name", dataKey: "name" },
      { title: "Role", dataKey: "role" },
      { title: "Phone", dataKey: "phone" },
      { title: "License No", dataKey: "driverLicenseNo" },
      { title: "Address", dataKey: "address" },
      { title: "Status", dataKey: "status" },
    ];
    exportToPDF(data, "Transport Staff List", `Transport_Staff_${new Date().toISOString().split('T')[0]}`, cols);
  };

  const handlePrint = () => {
    const cols = [
      { title: "ID", dataKey: "id" },
      { title: "Name", dataKey: "name" },
      { title: "Role", dataKey: "role" },
      { title: "Phone", dataKey: "phone" },
      { title: "License No", dataKey: "driverLicenseNo" },
      { title: "Address", dataKey: "address" },
      { title: "Status", dataKey: "status" },
    ];
    printData("Transport Staff List", cols, data);
  };

  const columns = [
    {
      title: "ID",
      dataIndex: "displayId",
      sorter: true,
      render: (text: any) => (
        <Link to="#" className="link-primary">
          {text || '—'}
        </Link>
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      sorter: true,
      render: (text: string, record: any) => (
        <div className="d-flex align-items-center">
          <Link to="#" className="avatar avatar-md">
            <ImageWithBasePath
              src={record.img}
              className="img-fluid rounded-circle"
              alt="img"
            />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to="#">{text}</Link>
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Phone Number",
      dataIndex: "phone",
      sorter: true,
    },
    {
      title: "Role",
      dataIndex: "role",
      sorter: true,
    },
    {
      title: "Driver License No",
      dataIndex: "driverLicenseNo",
      render: (text: string, record: any) => (record.role === "Conductor" ? "N/A" : text),
      sorter: true,
    },
    {
      title: "Address",
      dataIndex: "address",
      sorter: true,
    },
    {
      title: "Status",
      dataIndex: "status",
      sorter: true,
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
                  data-bs-target="#edit_driver"
                  onClick={() => setSelectedDriver(record)}
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
                    setSelectedDriver(record);
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
              <h3 className="page-title mb-1">Transport Staff</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Transport Staff
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
                  data-bs-target="#add_driver"
                  onClick={() => setSelectedDriver(null)}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Staff
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Transport Staff List</h4>
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
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Role</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "all", label: "All Roles" },
                                  { value: "driver", label: "Driver" },
                                  { value: "conductor", label: "Conductor" }
                                ]}
                                value={draftRole}
                                onChange={(val: string | null) => setDraftRole(val || "all")}
                              />
                            </div>
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[{ value: "all", label: "All Status" }, ...status.map(s => ({ value: s.value.toLowerCase(), label: s.label }))]}
                                value={draftStatus}
                                onChange={(val: string | null) => setDraftStatus(val === "all" || val === "All" ? "all" : (val?.toLowerCase() || "all"))}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={() => {
                          setDraftRole("all");
                          setDraftStatus("all");
                          setParams({ ...params, role: "all", status: "all", page: 1 });
                        }}>
                          Reset
                        </Link>
                        <Link to="#" className="btn btn-primary" onClick={() => {
                          setParams(prev => ({ ...prev, role: draftRole, status: draftStatus, page: 1 }));
                          handleApplyClick();
                        }}>
                          Apply
                        </Link>
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
                 loading={loading}
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
        selectedDriver={selectedDriver}
        deleteId={deleteId}
        onSuccess={() => {
          refetch();
          setSelectedDriver(null);
          setDeleteId(null);
        }}
      />
    </>
  );
};

export default TransportVehicleDrivers;

