
import { Link } from "react-router-dom";
import { useCalls } from "../../../core/hooks/useCalls";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import Table from "../../../core/common/dataTable/index";

const formatCallType = (type: string) => {
  if (!type) return 'Unknown';
  const t = String(type).toLowerCase();
  if (t === 'incoming') return 'Incoming Call';
  if (t === 'outgoing') return 'Outgoing Call';
  if (t === 'missed') return 'Missed Call';
  return type;
};

const CallHistory = () => {
  const { calls, loading, error } = useCalls();
  
  // Transform API data to match table format - only real calls from DB
  const data = (calls || []).map((call: any) => ({
    id: call.id,
    checkbox: true,
    username: call.recipient_username || [call.recipient_first_name, call.recipient_last_name].filter(Boolean).join(' ') || 'Unknown',
    phone_number: call.phone_number || call.recipient_phone || 'N/A',
    call_type: formatCallType(call.call_type),
    duration: call.duration ? `${Math.floor(call.duration / 60)}:${String(call.duration % 60).padStart(2, '0')}` : '00:00',
    date_time: call.call_date ? new Date(call.call_date).toLocaleString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A',
    image_url: call.recipient_photo_url || "assets/img/users/user-01.jpg",
    key: call.id.toString()
  }));
  const columns = [
    {
      title: "UserName",
      dataIndex: "username",
      render: (text: any, record: any) => (
        <span className="userimgname">
          <Link to="#" className="product-img">
            <ImageWithBasePath alt="" src={record.image_url} />
          </Link>
          <Link to="#">{text}</Link>
        </span>
      ),
      sorter: (a: any, b: any) => a.username.length - b.username.length,
    },
    {
      title: "Phone Number",
      dataIndex: "phone_number",
      sorter: (a: any, b: any) => a.phone_number.length - b.phone_number.length,
    },

    {
      title: "Call Type",
      dataIndex: "call_type",
      sorter: (a: any, b: any) => a.call_type.length - b.call_type.length,
    },
    {
      title: "Duration",
      dataIndex: "duration",
      sorter: (a: any, b: any) => a.duration.length - b.duration.length,
    },
    {
      title: "Date & Time",
      dataIndex: "date_time",
      sorter: (a: any, b: any) => a.duration.length - b.duration.length,
    },
    {
      title: "Actions",
      dataIndex: "actions",
      render: () => (
        <div className="dropdown table-action">
          <Link
            to="#"
            className="action-icon"
            data-bs-toggle="dropdown"
            aria-expanded="true"
          >
            <i className="fa fa-ellipsis-v"></i>
          </Link>
          <div
            className="dropdown-menu dropdown-menu-right"
            data-bs-toggle="modal"
            data-bs-target="#user-profile-new"
            style={{
              position: "absolute",
              inset: "0px auto auto 0px",
              margin: "0px",
              transform: "translate3d(-99.3333px, 35.3333px, 0px)",
            }}
            data-popper-placement="bottom-start"
          >
            <Link className="dropdown-item edit-popup" to="#">
              <i className="ti ti-edit text-blue"></i> Edit
            </Link>
            <Link
              className="dropdown-item"
              to="#"
              data-bs-toggle="modal"
              data-bs-target="#delete_campaign"
            >
              <i className="ti ti-trash text-danger"></i> Delete
            </Link>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="page-header">
          <div className="page-header menu">
            <div className="page-title">
              <h4>Call History</h4>
              <h6>View your call history. Calls appear here when you make or receive them.</h6>
            </div>
          </div>
        </div>
        <div className="card table-list-card">
          <div className="card-body">
            {loading ? (
              <div className="text-center p-4">Loading...</div>
            ) : error ? (
              <div className="text-center p-4 text-danger">Error: {error}</div>
            ) : data.length === 0 ? (
              <div className="text-center p-5 empty-state">
                <div className="empty-state-icon mb-3">
                  <i className="bx bx-phone-call" style={{ fontSize: '48px', color: '#ccc' }} />
                </div>
                <h5 className="text-muted">No calls yet</h5>
                <p className="text-muted mb-0">Your call history will appear here when you make or receive calls.</p>
              </div>
            ) : (
              <div className="table-responsive product-list">
                <Table columns={columns} dataSource={data} />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* details popup - shows when user clicks action on a call row */}
      <div className="modal fade" id="user-profile-new">
        <div className="modal-dialog history-modal-profile">
          <div className="modal-content">
            <div className="modal-body text-center py-4">
              <p className="text-muted mb-0">Call details and quick actions will appear here when you select a call.</p>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal custom-modal fade"
        id="delete_campaign"
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-0 m-0 justify-content-end">
              <button
                className="btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body">
              <div className="success-message text-center">
                <div className="success-popup-icon">
                  <i className="ti ti-trash-x" />
                </div>
                <h3>Are you sure?</h3>
                <p className="del-info">You won't be able to revert this!</p>
                <div className="col-lg-12 text-center modal-btn">
                  <Link
                    to="#"
                    className="btn btn-light"
                    data-bs-dismiss="modal"
                  >
                    Cancel
                  </Link>
                  <Link
                    to="#"
                    className="btn btn-danger"
                    data-bs-dismiss="modal"
                  >
                    Yes, Delete it
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallHistory;
