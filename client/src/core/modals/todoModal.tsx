import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import Select from "react-select";
import { DatePicker } from "antd";
import dayjs, { Dayjs } from "dayjs";
import { message } from "antd";
import { apiService } from "../services/apiService";

export type TodoRecord = {
  id: number;
  title: string;
  description?: string | null;
  due_date?: string | null;
  priority?: string;
  status?: string;
  is_important?: boolean;
};

type TodoModalProps = {
  mode: "create" | "edit" | "view" | "delete" | null;
  todo: TodoRecord | null;
  onClose: () => void;
  onSuccess: () => void;
};

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "done", label: "Done" },
];

function hideBootstrapModal(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const bs = (window as Window & { bootstrap?: { Modal?: { getInstance: (e: Element) => { hide: () => void } | null; getOrCreateInstance: (e: Element) => { hide: () => void } } } }).bootstrap;
  const Modal = bs?.Modal;
  if (!Modal) return;
  const instance = Modal.getInstance(el) || Modal.getOrCreateInstance(el);
  instance?.hide();
}

const TodoModal = ({ todo, onClose, onSuccess }: TodoModalProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("pending");
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [isImportant, setIsImportant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!todo) {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setStatus("pending");
      setDueDate(null);
      setIsImportant(false);
      return;
    }
    setTitle(todo.title || "");
    setDescription(todo.description || "");
    setPriority((todo.priority || "medium").toLowerCase());
    setStatus((todo.status || "pending").toLowerCase());
    setDueDate(todo.due_date ? dayjs(todo.due_date) : null);
    setIsImportant(Boolean(todo.is_important));
  }, [todo]);

  const buildPayload = () => ({
    title: title.trim(),
    description: description.trim() || null,
    priority,
    status,
    due_date: dueDate ? dueDate.toISOString() : null,
    is_important: isImportant,
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      message.error("Title is required");
      return;
    }
    try {
      setSubmitting(true);
      await apiService.createTodo(buildPayload());
      message.success("Task created");
      hideBootstrapModal("todo-add-modal");
      onSuccess();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!todo?.id) return;
    if (!title.trim()) {
      message.error("Title is required");
      return;
    }
    try {
      setSubmitting(true);
      await apiService.updateTodo(todo.id, buildPayload());
      message.success("Task updated");
      hideBootstrapModal("todo-edit-modal");
      onSuccess();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!todo?.id) return;
    try {
      setSubmitting(true);
      const isTrash = todo.status === "cancelled";
      if (isTrash) {
        await apiService.deleteTodo(todo.id);
        message.success("Task deleted permanently");
      } else {
        await apiService.trashTodo(todo.id);
        message.success("Task moved to trash");
      }
      hideBootstrapModal("todo-delete-modal");
      onSuccess();
      onClose();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal fade" id="todo-add-modal">
        <div className="modal-dialog modal-dialog-centered custom-modal-two">
          <div className="modal-content">
            <div className="page-wrapper-new p-0">
              <div className="content">
                <div className="modal-header border-0 custom-modal-header">
                  <div className="page-title">
                    <h4>Add Task</h4>
                  </div>
                  <button
                    type="button"
                    className="btn-close custom-btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                    onClick={onClose}
                  >
                    <i className="ti ti-x" />
                  </button>
                </div>
                <div className="modal-body custom-modal-body">
                  <form onSubmit={handleCreate}>
                    <div className="row">
                      <div className="col-12">
                        <div className="mb-3">
                          <label className="form-label">Title *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={255}
                            required
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="mb-3">
                          <label className="form-label">Priority</label>
                          <Select
                            className="select"
                            classNamePrefix="react-select"
                            options={priorityOptions}
                            value={priorityOptions.find((o) => o.value === priority)}
                            onChange={(opt) => setPriority(opt?.value || "medium")}
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="mb-3">
                          <label className="form-label">Status</label>
                          <Select
                            className="select"
                            classNamePrefix="react-select"
                            options={statusOptions}
                            value={statusOptions.find((o) => o.value === status)}
                            onChange={(opt) => setStatus(opt?.value || "pending")}
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="input-blocks todo-calendar mb-3">
                          <label className="form-label">Due Date</label>
                          <DatePicker
                            className="form-control w-100"
                            value={dueDate}
                            onChange={(d) => setDueDate(d)}
                            format="DD MMM YYYY"
                          />
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="form-check mb-3">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="todo-add-important"
                            checked={isImportant}
                            onChange={(e) => setIsImportant(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="todo-add-important">
                            Mark as important
                          </label>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="mb-3">
                          <label className="form-label">Description</label>
                          <textarea
                            className="form-control"
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={10000}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer-btn">
                      <button
                        type="button"
                        className="btn btn-cancel me-2"
                        data-bs-dismiss="modal"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-submit" disabled={submitting}>
                        {submitting ? "Saving..." : "Submit"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="todo-edit-modal">
        <div className="modal-dialog modal-dialog-centered custom-modal-two">
          <div className="modal-content">
            <div className="page-wrapper-new p-0">
              <div className="content">
                <div className="modal-header border-0 custom-modal-header">
                  <div className="page-title">
                    <h4>Edit Task</h4>
                  </div>
                  <button
                    type="button"
                    className="btn-close custom-btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                    onClick={onClose}
                  >
                    <i className="ti ti-x" />
                  </button>
                </div>
                <div className="modal-body custom-modal-body">
                  <form onSubmit={handleUpdate}>
                    <div className="row">
                      <div className="col-12">
                        <div className="mb-3">
                          <label className="form-label">Title *</label>
                          <input
                            type="text"
                            className="form-control"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={255}
                            required
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="mb-3">
                          <label className="form-label">Priority</label>
                          <Select
                            className="select"
                            classNamePrefix="react-select"
                            options={priorityOptions}
                            value={priorityOptions.find((o) => o.value === priority)}
                            onChange={(opt) => setPriority(opt?.value || "medium")}
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="mb-3">
                          <label className="form-label">Status</label>
                          <Select
                            className="select"
                            classNamePrefix="react-select"
                            options={statusOptions}
                            value={statusOptions.find((o) => o.value === status)}
                            onChange={(opt) => setStatus(opt?.value || "pending")}
                          />
                        </div>
                      </div>
                      <div className="col-6">
                        <div className="input-blocks todo-calendar mb-3">
                          <label className="form-label">Due Date</label>
                          <DatePicker
                            className="form-control w-100"
                            value={dueDate}
                            onChange={(d) => setDueDate(d)}
                            format="DD MMM YYYY"
                          />
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="form-check mb-3">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="todo-edit-important"
                            checked={isImportant}
                            onChange={(e) => setIsImportant(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="todo-edit-important">
                            Mark as important
                          </label>
                        </div>
                      </div>
                      <div className="col-12">
                        <div className="mb-3">
                          <label className="form-label">Description</label>
                          <textarea
                            className="form-control"
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={10000}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="modal-footer-btn">
                      <button
                        type="button"
                        className="btn btn-cancel me-2"
                        data-bs-dismiss="modal"
                        onClick={onClose}
                      >
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-submit" disabled={submitting}>
                        {submitting ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="todo-view-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="page-wrapper-new p-0">
              <div className="content">
                <div className="modal-header border-0 custom-modal-header">
                  <div className="page-title edit-page-title">
                    <h4>{todo?.title || "Task"}</h4>
                    <p className="text-muted mb-0 text-capitalize">{todo?.status?.replace("_", " ")}</p>
                  </div>
                  <button
                    type="button"
                    className="btn-close custom-btn-close"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                    onClick={onClose}
                  >
                    <i className="ti ti-x" />
                  </button>
                </div>
                <div className="modal-body custom-modal-body">
                  <p>{todo?.description || "No description"}</p>
                  <p className="mb-1">
                    <strong>Priority:</strong>{" "}
                    <span className="text-capitalize">{todo?.priority || "medium"}</span>
                  </p>
                  {todo?.due_date && (
                    <p className="mb-0">
                      <strong>Due:</strong> {dayjs(todo.due_date).format("DD MMM YYYY")}
                    </p>
                  )}
                  <div className="modal-footer-btn edit-footer-menu mt-3">
                    <button
                      type="button"
                      className="btn btn-cancel"
                      data-bs-dismiss="modal"
                      onClick={onClose}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="todo-delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center px-4 py-4">
              <span className="delete-icon d-inline-flex">
                <i className="ti ti-trash-x" />
              </span>
              <h4 className="mb-2">
                {todo?.status === "cancelled"
                  ? "Delete permanently?"
                  : "Move task to trash?"}
              </h4>
              <p className="text-muted mb-1">
                {todo?.title ? (
                  <>
                    <strong>{todo.title}</strong>
                    <br />
                  </>
                ) : null}
                {todo?.status === "cancelled"
                  ? "This action cannot be undone. The task will be removed forever."
                  : "You can restore this task later from the Trash folder."}
              </p>
              <div className="d-flex justify-content-center gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-light px-4"
                  data-bs-dismiss="modal"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger px-4"
                  disabled={submitting}
                  onClick={handleDelete}
                >
                  {submitting
                    ? "Please wait..."
                    : todo?.status === "cancelled"
                      ? "Yes, Delete"
                      : "Move to Trash"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TodoModal;
