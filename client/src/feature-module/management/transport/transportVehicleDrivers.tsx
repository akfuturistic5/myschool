import { useRef, useState } from "react";
import { all_routes } from "../../router/all_routes";
import { Link } from "react-router-dom";
import PredefinedDateRanges from "../../../core/common/datePicker";
import CommonSelect from "../../../core/common/commonSelect";
import {
  driverFilter,
  driverName,
  status,
} from "../../../core/common/selectoption/selectoption";
import type { TableData } from "../../../core/data/interface";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import TransportModal from "./transportModal";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useTransportDrivers } from "../../../core/hooks/useTransportDrivers";
import { apiService } from "../../../core/services/apiService";

const TransportVehicleDrivers = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const { data: apiData, loading, fallbackData, refetch } = useTransportDrivers();
  const data = apiData?.length ? apiData : fallbackData;
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [editDriverName, setEditDriverName] = useState('');
  const [editDriverPhone, setEditDriverPhone] = useState('');
  const [editDriverLicense, setEditDriverLicense] = useState('');
  const [editDriverAddress, setEditDriverAddress] = useState('');
  const [editDriverStatus, setEditDriverStatus] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: any, record: any) => (
        <Link to="#" className="link-primary">
          {text || record.id || 'N/A'}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => String(a.id || '').length - String(b.id || '').length,
    },
    {
      title: "Driver",
      dataIndex: "name",
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
      sorter: (a: TableData, b: TableData) => (String(a.name || '').length - String(b.name || '').length),
    },
    {
      title: "Phone Number",
      dataIndex: "phone",
      sorter: (a: TableData, b: TableData) => a.phone.length - b.phone.length,
    },
    {
      title: "Driver License No",
      dataIndex: "driverLicenseNo",
      sorter: (a: TableData, b: TableData) =>
        a.driverLicenseNo.length - b.driverLicenseNo.length,
    },
    {
      title: "Address",
      dataIndex: "address",
      sorter: (a: TableData, b: TableData) =>
        a.address.length - b.address.length,
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
      sorter: (a: TableData, b: TableData) => a.status.length - b.status.length,
    },

    {
      title: "Action",
      dataIndex: "action",
      render: (text: any, record: any) => (
        <>
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
                    onClick={(e) => {
                      e.preventDefault();
                      // Set form data from record
                      const driver = record.originalData || record;
                      // Get driver name (could be from name, driver_name, or first_name + last_name)
                      const driverName = driver.name || driver.driver_name || record.name || '';
                      const driverPhone = driver.phone || record.phone || '';
                      const driverLicense = driver.license_number || record.driverLicenseNo || '';
                      const driverAddress = driver.address || record.address || '';
                      // Check is_active from originalData (true/1 = active, false/0 = inactive)
                      // Fallback to status string if is_active is not available
                      let driverStatus = true; // default to active
                      if (Object.prototype.hasOwnProperty.call(driver, 'is_active')) {
                        driverStatus = driver.is_active === true || driver.is_active === 1 || driver.is_active === 'true';
                      } else if (record.status) {
                        driverStatus = record.status === 'Active';
                      }

                      setEditDriverName(driverName);
                      setEditDriverPhone(driverPhone);
                      setEditDriverLicense(driverLicense);
                      setEditDriverAddress(driverAddress);
                      setEditDriverStatus(driverStatus);
                      setSelectedDriver(record);

                      setTimeout(() => {
                        const modalElement = document.getElementById('edit_driver');
                        if (modalElement) {
                          const bootstrap = (window as any).bootstrap;
                          if (bootstrap && bootstrap.Modal) {
                            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                            modal.show();
                          }
                        }
                      }, 100);
                    }}
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
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </div>
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
              <h3 className="page-title mb-1">Drivers</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Drivers
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_driver"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Drivers
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {/* Students List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Drivers List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
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
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Driver</label>
                              <CommonSelect
                                className="select"
                                options={driverName}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={status}
                                defaultValue={status[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">More Filter</label>
                              <CommonSelect
                                className="select"
                                options={driverFilter}
                                defaultValue={undefined}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3">
                          Reset
                        </Link>
                        <Link
                          to="#"
                          className="btn btn-primary"
                          onClick={handleApplyClick}
                        >
                          Apply
                        </Link>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="dropdown mb-3">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-sort-ascending-2 me-2" />
                    Sort by A-Z{" "}
                  </Link>
                  <ul className="dropdown-menu p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Ascending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Descending
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Viewed
                      </Link>
                    </li>
                    <li>
                      <Link to="#" className="dropdown-item rounded-1">
                        Recently Added
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading && (
                <div className="text-center py-4">
                  <span className="spinner-border spinner-border-sm me-2" />
                  Loading drivers...
                </div>
              )}
              {!loading && (
                <Table dataSource={data} columns={columns} Selection={true} />
              )}
            </div>
          </div>
          {/* /Students List */}
        </div>
      </div>
      {/* /Page Wrapper */}
      <TransportModal
        selectedDriver={selectedDriver}
        editDriverName={editDriverName}
        setEditDriverName={setEditDriverName}
        editDriverPhone={editDriverPhone}
        setEditDriverPhone={setEditDriverPhone}
        editDriverLicense={editDriverLicense}
        setEditDriverLicense={setEditDriverLicense}
        editDriverAddress={editDriverAddress}
        setEditDriverAddress={setEditDriverAddress}
        editDriverStatus={editDriverStatus}
        setEditDriverStatus={setEditDriverStatus}
        isUpdating={isUpdating}
        setIsUpdating={setIsUpdating}
        onDriverUpdate={async () => {
          const driverId = selectedDriver?.originalData?.id || selectedDriver?.id;
          if (!driverId || isUpdating) return;

          setIsUpdating(true);
          try {
            const updateData = {
              name: editDriverName.trim(),
              phone: editDriverPhone.trim() || null,
              license_number: editDriverLicense.trim() || null,
              address: editDriverAddress.trim() || null,
              is_active: editDriverStatus
            };

            const response = await apiService.updateTransportDriver(driverId, updateData);

            if (response && response.status === 'SUCCESS') {
              // Close modal
              const modalElement = document.getElementById('edit_driver');
              if (modalElement) {
                const bootstrap = (window as any).bootstrap;
                if (bootstrap && bootstrap.Modal) {
                  const modal = bootstrap.Modal.getInstance(modalElement);
                  if (modal) modal.hide();
                }
              }
              // Refetch list
              await refetch();
              // Reset form
              setSelectedDriver(null);
              setEditDriverName('');
              setEditDriverPhone('');
              setEditDriverLicense('');
              setEditDriverAddress('');
              setEditDriverStatus(true);
            } else {
              alert(response?.message || 'Failed to update driver');
            }
          } catch (error: any) {
            console.error('Error updating driver:', error);
            alert(error?.message || 'Failed to update driver. Please try again.');
          } finally {
            setIsUpdating(false);
          }
        }}
      />
    </>
  );
};

export default TransportVehicleDrivers;
