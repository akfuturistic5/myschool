import { useEffect, useMemo, useState } from "react";
import { DatePicker, message } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { Link } from "react-router-dom";
import PredefinedDateRanges from "../../core/common/datePicker";
import CommonSelect from "../../core/common/commonSelect";
import { messageTo as messageToOptions, transactionDate } from "../../core/common/selectoption/selectoption";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { useNoticeBoard } from "../../core/hooks/useNoticeBoard";
import { useUserRoles } from "../../core/hooks/useUserRoles";
import { useCurrentUser } from "../../core/hooks/useCurrentUser";

const splitTargets = (value: string | null | undefined) =>
  String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const toDayjs = (value: string | null | undefined) => {
  if (!value) return null;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
};

const getInitialForm = () => ({
  title: "",
  content: "",
  messageTargets: [] as string[],
  noticeDate: null as Dayjs | null,
  publishOn: null as Dayjs | null,
});

const NoticeBoard = () => {
  const routes = all_routes;
  const { userRoles, loading: rolesLoading } = useUserRoles();
  const { user } = useCurrentUser();
  const canManageNotices = useMemo(() => {
    const roleId = Number(user?.role_id);
    return roleId === 1 || roleId === 6;
  }, [user?.role_id]);
  /** Latest notice only for viewers; headmaster/administrative need full list to edit/delete. */
  const noticeFetchLimit = canManageNotices ? 100 : 1;
  const { notices, loading, error, saving, createNotice, updateNotice, deleteNotice } = useNoticeBoard({
    limit: noticeFetchLimit,
  });
  const [selectedNotice, setSelectedNotice] = useState<any>(null);
  const [createForm, setCreateForm] = useState(getInitialForm());
  const [editForm, setEditForm] = useState(getInitialForm());
  const targetOptions = useMemo(
    () =>
      userRoles
        .map((role) => String(role?.roleName || "").trim())
        .filter(Boolean),
    [userRoles]
  );

  useEffect(() => {
    if (!selectedNotice) return;
    const targets = splitTargets(selectedNotice.messageTo);
    setEditForm({
      title: selectedNotice.title || "",
      content: selectedNotice.content || "",
      messageTargets: targets,
      noticeDate: toDayjs(selectedNotice.notice_date),
      publishOn: toDayjs(selectedNotice.publish_on),
    });
  }, [selectedNotice]);

  const selectedTargetsLabel = useMemo(
    () => (selectedNotice?.messageTo ? splitTargets(selectedNotice.messageTo) : []),
    [selectedNotice]
  );

  const onToggleTarget = (
    target: string,
    formState: { messageTargets: string[] },
    setFormState: (updater: any) => void
  ) => {
    const hasTarget = formState.messageTargets.includes(target);
    const nextTargets = hasTarget
      ? formState.messageTargets.filter((item) => item !== target)
      : [...formState.messageTargets, target];

    setFormState((prev: any) => ({
      ...prev,
      messageTargets: nextTargets,
    }));
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageNotices) {
      message.error("Only Headmaster/Administrative can add notices");
      return;
    }
    const title = createForm.title.trim();
    const content = createForm.content.trim();
    const message_to = createForm.messageTargets.join(", ");

    if (!title) {
      message.error("Title is required");
      return;
    }
    if (!content) {
      message.error("Message is required");
      return;
    }
    if (!createForm.messageTargets.length) {
      message.error("Please select at least one role in Message To");
      return;
    }
    if (
      createForm.noticeDate &&
      createForm.publishOn &&
      createForm.noticeDate.isBefore(createForm.publishOn, "day")
    ) {
      message.error("Notice Date cannot be earlier than Publish On");
      return;
    }

    try {
      await createNotice({
        title,
        content,
        message_to,
        notice_date: createForm.noticeDate ? createForm.noticeDate.format("YYYY-MM-DD") : null,
        publish_on: createForm.publishOn ? createForm.publishOn.format("YYYY-MM-DD") : null,
      });
      message.success("Notice created successfully");
      setCreateForm(getInitialForm());
    } catch (submitError: any) {
      message.error(submitError?.message || "Failed to create notice");
    }
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageNotices) {
      message.error("Only Headmaster/Administrative can edit notices");
      return;
    }
    if (!selectedNotice?.id) return;

    const title = editForm.title.trim();
    const content = editForm.content.trim();
    const message_to = editForm.messageTargets.join(", ");

    if (!title) {
      message.error("Title is required");
      return;
    }
    if (!content) {
      message.error("Message is required");
      return;
    }
    if (!editForm.messageTargets.length) {
      message.error("Please select at least one role in Message To");
      return;
    }
    if (
      editForm.noticeDate &&
      editForm.publishOn &&
      editForm.noticeDate.isBefore(editForm.publishOn, "day")
    ) {
      message.error("Notice Date cannot be earlier than Publish On");
      return;
    }

    try {
      await updateNotice(selectedNotice.id, {
        title,
        content,
        message_to,
        notice_date: editForm.noticeDate ? editForm.noticeDate.format("YYYY-MM-DD") : null,
        publish_on: editForm.publishOn ? editForm.publishOn.format("YYYY-MM-DD") : null,
      });
      message.success("Notice updated successfully");
    } catch (submitError: any) {
      message.error(submitError?.message || "Failed to update notice");
    }
  };

  const handleDelete = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageNotices) {
      message.error("Only Headmaster/Administrative can delete notices");
      return;
    }
    if (!selectedNotice?.id) return;
    try {
      await deleteNotice(selectedNotice.id);
      message.success("Notice deleted successfully");
      setSelectedNotice(null);
    } catch (deleteError: any) {
      message.error(deleteError?.message || "Failed to delete notice");
    }
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Notice Board</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Announcement</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Notice Board
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption />
              {canManageNotices && (
                <div className="mb-2">
                  <Link
                    to="#"
                    data-bs-toggle="modal"
                    data-bs-target="#add_message"
                    className="btn btn-primary d-flex align-items-center"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Add Message
                  </Link>
                </div>
              )}
            </div>
          </div>

          <div className="d-flex align-items-center justify-content-end flex-wrap mb-2">
            <div className="form-check me-2 mb-3">
              <input className="form-check-input" type="checkbox" disabled />
              <span className="checkmarks">Mark &amp; Delete All</span>
            </div>
            <div className="d-flex align-items-center flex-wrap">
              <div className="input-icon-start mb-3 me-2 position-relative">
                <PredefinedDateRanges />
              </div>
              <div className="dropdown mb-3">
                <Link
                  to="#"
                  className="btn btn-outline-light bg-white dropdown-toggle"
                  data-bs-toggle="dropdown"
                  data-bs-auto-close="outside"
                >
                  <i className="ti ti-filter me-2" />
                  Filter
                </Link>
                <div className="dropdown-menu drop-width">
                  <form>
                    <div className="d-flex align-items-center border-bottom p-3">
                      <h4>Filter</h4>
                    </div>
                    <div className="p-3 border-bottom pb-0">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Message to</label>
                            <CommonSelect className="select" options={messageToOptions} defaultValue={messageToOptions[0]} />
                          </div>
                        </div>
                        <div className="col-md-12">
                          <div className="mb-3">
                            <label className="form-label">Added Date</label>
                            <CommonSelect className="select" options={transactionDate} defaultValue={transactionDate[0]} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>

          {loading && <p className="mb-3 text-muted">Loading notices...</p>}
          {!loading && error && <p className="mb-3 text-danger">{error}</p>}
          {!loading && !error && notices.length === 0 && <p className="mb-3 text-muted">No notices available.</p>}
          {!loading &&
            !error &&
            notices.map((notice) => (
              <div key={notice.id} className="card board-hover mb-3">
                <div className="card-body d-md-flex align-items-center justify-content-between pb-1">
                  <div className="d-flex align-items-center mb-3">
                    <span className="bg-soft-primary text-primary avatar avatar-md me-2 br-5 flex-shrink-0">
                      <i className="ti ti-notification fs-16" />
                    </span>
                    <div>
                      <h6 className="mb-1 fw-semibold">
                        <Link
                          to="#"
                          onClick={() => setSelectedNotice(notice)}
                          data-bs-toggle="modal"
                          data-bs-target="#view_details"
                        >
                          {notice.title}
                        </Link>
                      </h6>
                      <p>
                        <i className="ti ti-calendar me-1" />
                        {notice.modified_at ? `Modified on: ${notice.modifiedOn}` : `Added on: ${notice.addedOn}`}
                      </p>
                    </div>
                  </div>
                  {canManageNotices && (
                    <div className="d-flex align-items-center board-action mb-3">
                      <Link
                        to="#"
                        onClick={() => setSelectedNotice(notice)}
                        data-bs-toggle="modal"
                        data-bs-target="#edit_message"
                        className="text-primary border rounded p-1 badge me-1 primary-btn-hover"
                      >
                        <i className="ti ti-edit-circle fs-16" />
                      </Link>
                      <Link
                        to="#"
                        onClick={() => setSelectedNotice(notice)}
                        data-bs-toggle="modal"
                        data-bs-target="#delete-modal"
                        className="text-danger border rounded p-1 badge danger-btn-hover"
                      >
                        <i className="ti ti-trash-x fs-16" />
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {canManageNotices && <div className="modal fade" id="add_message">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">New Message</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitCreate}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={255}
                    value={createForm.title}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Publish On</label>
                  <DatePicker
                    className="form-control datetimepicker"
                    placeholder="Select Date"
                    value={createForm.publishOn}
                    onChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        publishOn: value ? dayjs(value) : null,
                      }))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Notice Date</label>
                  <DatePicker
                    className="form-control datetimepicker"
                    placeholder="Select Date"
                    value={createForm.noticeDate}
                    onChange={(value) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        noticeDate: value ? dayjs(value) : null,
                      }))
                    }
                    disabledDate={(current) =>
                      !!createForm.publishOn &&
                      !!current &&
                      current.startOf("day").isBefore(createForm.publishOn.startOf("day"))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    maxLength={5000}
                    value={createForm.content}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, content: e.target.value }))}
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Message To</label>
                  <div className="row">
                    {targetOptions.map((target) => (
                      <div key={target} className="col-md-6">
                        <label className="checkboxs mb-1">
                          <input
                            type="checkbox"
                            checked={createForm.messageTargets.includes(target)}
                            onChange={() => onToggleTarget(target, createForm, setCreateForm)}
                          />
                          <span className="checkmarks" />
                          {target}
                        </label>
                      </div>
                    ))}
                    {!rolesLoading && targetOptions.length === 0 && (
                      <p className="text-muted mb-0">No active roles found.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving || rolesLoading || targetOptions.length === 0}>
                  {saving ? "Saving..." : "Add New Message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>}

      {canManageNotices && <div className="modal fade" id="edit_message">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Message</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Title</label>
                  <input
                    type="text"
                    className="form-control"
                    maxLength={255}
                    value={editForm.title}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Publish On</label>
                  <DatePicker
                    className="form-control datetimepicker"
                    placeholder="Select Date"
                    value={editForm.publishOn}
                    onChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        publishOn: value ? dayjs(value) : null,
                      }))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Notice Date</label>
                  <DatePicker
                    className="form-control datetimepicker"
                    placeholder="Select Date"
                    value={editForm.noticeDate}
                    onChange={(value) =>
                      setEditForm((prev) => ({
                        ...prev,
                        noticeDate: value ? dayjs(value) : null,
                      }))
                    }
                    disabledDate={(current) =>
                      !!editForm.publishOn &&
                      !!current &&
                      current.startOf("day").isBefore(editForm.publishOn.startOf("day"))
                    }
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label">Message</label>
                  <textarea
                    className="form-control"
                    rows={4}
                    maxLength={5000}
                    value={editForm.content}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, content: e.target.value }))}
                  />
                </div>
                <div className="mb-0">
                  <label className="form-label">Message To</label>
                  <div className="row">
                    {targetOptions.map((target) => (
                      <div key={target} className="col-md-6">
                        <div className="form-check form-check-md mb-1">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={editForm.messageTargets.includes(target)}
                            onChange={() => onToggleTarget(target, editForm, setEditForm)}
                          />
                          <span>{target}</span>
                        </div>
                      </div>
                    ))}
                    {!rolesLoading && targetOptions.length === 0 && (
                      <p className="text-muted mb-0">No active roles found.</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <Link to="#" className="btn btn-light me-2" data-bs-dismiss="modal">
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving || !selectedNotice || rolesLoading || targetOptions.length === 0}>
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>}

      <div className="modal fade" id="view_details">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{selectedNotice?.title || "Notice Details"}</h4>
              <button type="button" className="btn-close custom-btn-close" data-bs-dismiss="modal" aria-label="Close">
                <i className="ti ti-x" />
              </button>
            </div>
            <div className="modal-body pb-0">
              <div className="mb-3">
                <p>{selectedNotice?.content || "No message content available."}</p>
              </div>
              <div className="mb-3">
                <label className="form-label d-block">Message To</label>
                {(selectedTargetsLabel.length ? selectedTargetsLabel : ["All"]).map((target) => (
                  <span key={target} className="badge badge-soft-primary me-2">
                    {target}
                  </span>
                ))}
              </div>
              <div className="row">
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Notice Date</label>
                    <p>{selectedNotice?.noticeDate || "N/A"}</p>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Publish On</label>
                    <p>{selectedNotice?.publishOn || "N/A"}</p>
                  </div>
                </div>
              </div>
              <div className="border-top pt-3">
                <div className="d-flex align-items-center flex-wrap">
                  <div className="d-flex align-items-center me-4 mb-3">
                    <span className="avatar avatar-sm bg-light me-1">
                      <i className="ti ti-calendar text-default fs-14" />
                    </span>
                    Added on: {selectedNotice?.addedOn || "N/A"}
                  </div>
                  <div className="d-flex align-items-center mb-3">
                    <span className="avatar avatar-sm bg-light me-1">
                      <i className="ti ti-user-edit text-default fs-14" />
                    </span>
                    Last modified: {selectedNotice?.modifiedOn || "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {canManageNotices && <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={handleDelete}>
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>Confirm Deletion</h4>
                <p>Are you sure you want to delete this notice?</p>
                <div className="d-flex justify-content-center">
                  <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-danger" disabled={saving || !selectedNotice}>
                    {saving ? "Deleting..." : "Yes, Delete"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>}
    </>
  );
};

export default NoticeBoard;

