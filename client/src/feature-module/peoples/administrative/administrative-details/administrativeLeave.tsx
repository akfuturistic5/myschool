import { Link } from "react-router-dom";
import { useMemo } from "react";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import AdministrativeSidebar from "./administrativeSidebar";
import AdministrativeBreadcrumb from "./administrativeBreadcrumb";
import { useAdministrativeStaffProfile } from "../../../../core/hooks/useAdministrativeStaffProfile";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";

const AdministrativeLeave = () => {
  const routes = all_routes;
  const { staff, loading: profileLoading, error: profileError } =
    useAdministrativeStaffProfile();
  const { leaveApplications, loading: leaveLoading } = useLeaveApplications({
    studentOnly: true,
    limit: 50,
  });

  const profileState = staff ? { staffId: staff.id, staff } : undefined;

  const data = useMemo(() => {
    return leaveApplications.map((l) => ({
      ...l,
      leaveDate: l.leaveRange,
    }));
  }, [leaveApplications]);

  const columns = [
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      sorter: (a: TableData, b: TableData) =>
        String(a.leaveType).localeCompare(String(b.leaveType)),
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
      sorter: (a: TableData, b: TableData) =>
        String(a.leaveDate).localeCompare(String(b.leaveDate)),
    },
    {
      title: "No of Days",
      dataIndex: "noOfDays",
      sorter: (a: TableData, b: TableData) =>
        parseFloat(String(a.noOfDays)) - parseFloat(String(b.noOfDays)),
    },
    {
      title: "Applied On",
      dataIndex: "applyOn",
      sorter: (a: TableData, b: TableData) =>
        String(a.applyOn).localeCompare(String(b.applyOn)),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => {
        const t = String(text || "").toLowerCase();
        const ok = t.includes("approv");
        return (
          <span
            className={`badge ${ok ? "badge-soft-success" : "badge-soft-warning"} d-inline-flex align-items-center`}
          >
            <i className="ti ti-circle-filled fs-5 me-1" />
            {text || "Pending"}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) =>
        String(a.status).localeCompare(String(b.status)),
    },
  ];

  if (profileLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (profileError || !staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-warning m-3" role="alert">
            <i className="ti ti-alert-circle me-2" />
            {profileError ||
              "Your profile could not be loaded. Open this page from the administrative dashboard."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row">
          <AdministrativeBreadcrumb
            title="Administrative details"
            activeCrumb="Leave"
          />
        </div>
        <div className="row">
          <AdministrativeSidebar staff={staff} />
          <div className="col-xxl-9 col-xl-8">
            <div className="row">
              <div className="col-md-12">
                <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                  <li>
                    <Link
                      to={routes.administrativeDetails}
                      state={profileState}
                      className="nav-link"
                    >
                      <i className="ti ti-user me-2" />
                      Administrative details
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={routes.administrativeLeaves}
                      state={profileState}
                      className="nav-link active"
                    >
                      <i className="ti ti-calendar-due me-2" />
                      Leave
                    </Link>
                  </li>
                </ul>
                <div className="card">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                    <h4 className="mb-3">My leave applications</h4>
                    <Link
                      to={routes.listLeaves}
                      className="btn btn-primary d-inline-flex align-items-center mb-3"
                    >
                      <i className="ti ti-calendar-event me-2" />
                      Open leave list
                    </Link>
                  </div>
                  <div className="card-body p-0 py-3">
                    {leaveLoading && (
                      <div className="p-4 text-center text-muted">
                        Loading leave data...
                      </div>
                    )}
                    {!leaveLoading && (
                      <Table
                        dataSource={data}
                        columns={columns}
                        Selection={false}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeLeave;
