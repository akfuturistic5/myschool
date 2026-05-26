import { Link } from "react-router-dom";
import { useCallback, useMemo, useState } from "react";
import { message } from "antd";
import TodoModal from "../../core/modals/todoModal";
import type { TodoRecord } from "../../core/modals/todoModal";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { useTodos } from "../../core/hooks/useTodos";
import { useCurrentUser } from "../../core/hooks/useCurrentUser";
import { getDashboardForRole } from "../../core/utils/roleUtils";
import { apiService } from "../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../core/utils/exportUtils";

type TodoView = "inbox" | "done" | "important" | "trash";

const PRIORITY_FILTERS = [
  { key: "medium", label: "Medium", className: "text-warning" },
  { key: "high", label: "High", className: "text-success" },
  { key: "low", label: "Low", className: "text-danger" },
];

function priorityBadgeClass(priority: string) {
  const p = (priority || "medium").toLowerCase();
  if (p === "high") return "danger";
  if (p === "low") return "success";
  return "warning";
}

function statusBadgeClass(status: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "done") return "success";
  if (s === "in_progress") return "warning";
  if (s === "on_hold") return "danger";
  if (s === "cancelled") return "secondary";
  return "info";
}

function statusLabel(status: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "in_progress") return "In Progress";
  if (s === "on_hold") return "On Hold";
  if (s === "cancelled") return "Cancelled";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDueDate(due: string | null | undefined) {
  if (!due) return "";
  const d = new Date(due);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const TODO_EXPORT_COLUMNS = [
  { title: "Title", dataKey: "title" },
  { title: "Description", dataKey: "description" },
  { title: "Due Date", dataKey: "dueDate" },
  { title: "Priority", dataKey: "priority" },
  { title: "Status", dataKey: "status" },
  { title: "Important", dataKey: "important" },
] as const;

const Todo = () => {
  const routes = all_routes;
  const { user } = useCurrentUser();
  const dashboardLink = getDashboardForRole(user?.role, user?.role_id);

  const [activeView, setActiveView] = useState<TodoView>("inbox");
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<TodoRecord | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view" | "delete" | null>(null);

  const queryParams = useMemo(
    () => ({
      view: activeView,
      ...(priorityFilter ? { priority: priorityFilter } : {}),
    }),
    [activeView, priorityFilter]
  );

  const { todos, stats, loading, error, refetch } = useTodos(queryParams);

  const exportRows = useMemo(
    () =>
      todos.map((todo: TodoRecord) => ({
        title: String(todo.title ?? ""),
        description: String(todo.description ?? "")
          .replace(/<[^>]*>/g, "")
          .trim(),
        dueDate: formatDueDate(todo.due_date),
        priority: String(todo.priority || "medium"),
        status: statusLabel(todo.status || "pending"),
        important: todo.is_important ? "Yes" : "No",
      })),
    [todos]
  );

  const exportFileBase = useMemo(
    () => `Todo_${activeView}_${new Date().toISOString().split("T")[0]}`,
    [activeView]
  );

  const handleToolbarRefresh = useCallback(() => {
    void refetch();
    message.success("Task list refreshed");
  }, [refetch]);

  const handleExportExcel = useCallback(() => {
    if (!exportRows.length) {
      message.warning("No tasks to export");
      return;
    }
    exportToExcel(exportRows, exportFileBase, "Todo Tasks");
    message.success("Exported to Excel");
  }, [exportRows, exportFileBase]);

  const handleExportPdf = useCallback(() => {
    if (!exportRows.length) {
      message.warning("No tasks to export");
      return;
    }
    exportToPDF(exportRows, "Todo Tasks", exportFileBase, [...TODO_EXPORT_COLUMNS]);
    message.success("Exported to PDF");
  }, [exportRows, exportFileBase]);

  const handlePrint = useCallback(() => {
    if (!exportRows.length) {
      message.warning("No tasks to print");
      return;
    }
    printData("Todo Tasks", [...TODO_EXPORT_COLUMNS], exportRows);
  }, [exportRows]);

  const groupedTodos = useMemo(() => {
    const grouped: Record<string, TodoRecord[]> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    todos.forEach((todo: TodoRecord) => {
      if (!todo.due_date) {
        if (!grouped["no-date"]) grouped["no-date"] = [];
        grouped["no-date"].push(todo);
        return;
      }
      const dueDate = new Date(todo.due_date);
      dueDate.setHours(0, 0, 0, 0);
      let dateKey = "";
      if (dueDate.getTime() === today.getTime()) dateKey = "today";
      else if (dueDate.getTime() === yesterday.getTime()) dateKey = "yesterday";
      else {
        dateKey = dueDate.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(todo);
    });
    return grouped;
  }, [todos]);

  const getDateLabel = (key: string) => {
    if (key === "today") return "Today";
    if (key === "yesterday") return "Yesterday";
    if (key === "no-date") return "No Due Date";
    return key;
  };

  const openModal = (mode: typeof modalMode, todo: TodoRecord | null = null) => {
    setModalMode(mode);
    setSelectedTodo(todo);
  };

  const closeModal = () => {
    setModalMode(null);
    setSelectedTodo(null);
  };

  const handleToggleDone = async (todo: TodoRecord) => {
    if (activeView === "trash") return;
    try {
      const nextStatus = todo.status === "done" ? "pending" : "done";
      await apiService.updateTodo(todo.id, { status: nextStatus });
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const handleToggleImportant = async (todo: TodoRecord) => {
    try {
      await apiService.updateTodo(todo.id, { is_important: !todo.is_important });
      message.success(todo.is_important ? "Removed from important" : "Marked as important");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const handleRestore = async (todo: TodoRecord) => {
    try {
      await apiService.restoreTodo(todo.id);
      message.success("Task restored");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to restore task");
    }
  };

  const sidebarViews: { key: TodoView; label: string; icon: string; count: number }[] = [
    { key: "inbox", label: "Inbox", icon: "ti ti-inbox", count: stats.inbox },
    { key: "done", label: "Done", icon: "ti ti-circle-check", count: stats.done },
    { key: "important", label: "Important", icon: "ti ti-star", count: stats.important },
    { key: "trash", label: "Trash", icon: "ti ti-trash", count: stats.trash },
  ];

  return (
    <>
      <div className="page-wrapper notes-page-wrapper">
        <div className="content pb-4">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3 pb-3 border-bottom position-relative">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Todo</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={dashboardLink}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Application</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Todo
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={handleToolbarRefresh}
                onPrint={handlePrint}
                onExportPdf={handleExportPdf}
                onExportExcel={handleExportExcel}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary d-flex align-items-center"
                  data-bs-toggle="modal"
                  data-bs-target="#todo-add-modal"
                  onClick={() => openModal("create")}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Task
                </Link>
              </div>
            </div>
          </div>

          <div className="row">
            <div className="col-xl-3 col-md-12 sidebars-right theiaStickySidebar section-bulk-widget">
              <div className="stickybar">
                <div className="border rounded-3 mt-4 bg-white p-3 todo-sidebar-panel">
                  <div className="mb-3 pb-3 border-bottom">
                    <h4 className="d-flex align-items-center mb-0">
                      <i className="ti ti-file-text me-2" />
                      Todo List
                    </h4>
                  </div>
                  <div className="border-bottom pb-3 todo-folder-nav">
                    {sidebarViews.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`todo-folder-item ${
                          activeView === item.key ? "active" : ""
                        }`}
                        onClick={() => {
                          setActiveView(item.key);
                          setPriorityFilter(null);
                        }}
                      >
                        <i className={`${item.icon} me-2`} />
                        {item.label}
                        <span className="ms-auto">{item.count}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 px-2">
                    <div>
                      <h5 className="mb-2">Priority</h5>
                      <div className="d-flex flex-column mt-2">
                        {PRIORITY_FILTERS.map((p) => (
                          <button
                            key={p.key}
                            type="button"
                            className={`todo-filter-link ${p.className} ${
                              priorityFilter === p.key ? "is-active" : ""
                            }`}
                            onClick={() =>
                              setPriorityFilter((prev) => (prev === p.key ? null : p.key))
                            }
                          >
                            <span className={`${p.className} me-2`}>
                              <i className="fas fa-square square-rotate fs-10" />
                            </span>
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-xl-9 budget-role-notes">
              {loading ? (
                <div className="text-center p-5 bg-white rounded-3">Loading tasks...</div>
              ) : error ? (
                <div className="text-center p-5 bg-white rounded-3 text-danger">
                  {error}
                </div>
              ) : todos.length === 0 ? (
                <div className="text-center p-5 bg-white rounded-3 text-muted">
                  No tasks found
                </div>
              ) : (
                Object.keys(groupedTodos).map((dateKey, index) => {
                  const dateTodos = groupedTodos[dateKey];
                  const collapseId = `todo-collapse-${index}`;
                  const headingId = `todo-heading-${index}`;
                  return (
                    <div key={dateKey} className="accordion todo-accordion mb-3">
                      <div className="accordion-item">
                        <div className="accordion-header" id={headingId}>
                          <div
                            className="accordion-button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#${collapseId}`}
                          >
                            <div className="d-flex align-items-center justify-content-between w-100 mb-3">
                              <div className="d-flex align-items-center">
                                <i className="ti ti-calendar-due me-2" />
                                <h5 className="fw-semibold mb-0">{getDateLabel(dateKey)}</h5>
                                <span className="avatar avatar-xs bg-primary rounded-circle p-1 ms-2">
                                  {dateTodos.length}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          id={collapseId}
                          className={`accordion-collapse collapse ${index === 0 ? "show" : ""}`}
                        >
                          <div className="accordion-body">
                            {dateTodos.map((todo, todoIndex) => (
                              <div
                                key={todo.id}
                                className={`card ${todoIndex > 0 ? "mt-3" : ""}`}
                              >
                                <div className="card-body p-3 pb-0">
                                  <div className="d-flex align-items-center justify-content-between flex-wrap">
                                    <div
                                      className={`input-block todo-inbox-check d-flex align-items-center w-50 mb-3 ${
                                        todo.status === "done" ? "todo-strike-content" : ""
                                      }`}
                                    >
                                      <div className="form-check form-check-md me-2">
                                        <input
                                          className="form-check-input"
                                          type="checkbox"
                                          checked={todo.status === "done"}
                                          disabled={activeView === "trash"}
                                          onChange={() => handleToggleDone(todo)}
                                        />
                                      </div>
                                      <div className="strike-info">
                                        <h4 className="mb-1">{todo.title}</h4>
                                        {todo.description ? (
                                          <p className="mb-0 text-muted small">
                                            {String(todo.description).slice(0, 200)}
                                            {String(todo.description).length > 200 ? "…" : ""}
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="d-flex align-items-center flex-fill justify-content-between ms-4 mb-3">
                                      <div className="notes-card-body d-flex align-items-center flex-wrap gap-2">
                                        {todo.is_important && (
                                          <p className="badge bg-outline-warning d-inline-flex align-items-center mb-0">
                                            <i className="ti ti-star me-1" />
                                            Important
                                          </p>
                                        )}
                                        <p
                                          className={`badge bg-outline-${priorityBadgeClass(
                                            todo.priority || "medium"
                                          )} d-inline-flex align-items-center mb-0`}
                                        >
                                          <i className="fas fa-circle fs-6 me-1" />
                                          <span className="text-capitalize">
                                            {todo.priority || "medium"}
                                          </span>
                                        </p>
                                        <p
                                          className={`badge bg-outline-${statusBadgeClass(
                                            todo.status || "pending"
                                          )} mb-0`}
                                        >
                                          {statusLabel(todo.status || "pending")}
                                        </p>
                                      </div>
                                      <div className="d-flex align-items-center">
                                        <Link
                                          to="#"
                                          data-bs-toggle="dropdown"
                                          aria-expanded="false"
                                        >
                                          <i className="fas fa-ellipsis-v" />
                                        </Link>
                                        <div className="dropdown-menu notes-menu dropdown-menu-end">
                                          {activeView !== "trash" && (
                                            <>
                                              <Link
                                                to="#"
                                                className="dropdown-item"
                                                data-bs-toggle="modal"
                                                data-bs-target="#todo-edit-modal"
                                                onClick={() => openModal("edit", todo)}
                                              >
                                                <i className="ti ti-edit me-2" />
                                                Edit
                                              </Link>
                                              <Link
                                                to="#"
                                                className="dropdown-item"
                                                onClick={() => handleToggleImportant(todo)}
                                              >
                                                <i className="ti ti-star me-2" />
                                                {todo.is_important
                                                  ? "Remove Important"
                                                  : "Mark Important"}
                                              </Link>
                                            </>
                                          )}
                                          {activeView === "trash" && (
                                            <Link
                                              to="#"
                                              className="dropdown-item"
                                              onClick={() => handleRestore(todo)}
                                            >
                                              <i className="ti ti-arrow-back-up me-2" />
                                              Restore
                                            </Link>
                                          )}
                                          <Link
                                            to="#"
                                            className="dropdown-item"
                                            data-bs-toggle="modal"
                                            data-bs-target="#todo-view-modal"
                                            onClick={() => openModal("view", todo)}
                                          >
                                            <i className="ti ti-eye me-2" />
                                            View
                                          </Link>
                                          <Link
                                            to="#"
                                            className="dropdown-item"
                                            data-bs-toggle="modal"
                                            data-bs-target="#todo-delete-modal"
                                            onClick={() => openModal("delete", todo)}
                                          >
                                            <i className="ti ti-trash me-2" />
                                            Delete
                                          </Link>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      <TodoModal
        mode={modalMode}
        todo={selectedTodo}
        onClose={closeModal}
        onSuccess={refetch}
      />
    </>
  );
};

export default Todo;
