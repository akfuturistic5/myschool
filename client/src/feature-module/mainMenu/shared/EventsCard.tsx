import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";

interface EventItem {
  id?: number;
  title?: string;
  start_date?: string;
  end_date?: string;
  is_all_day?: boolean;
  event_color?: string;
}

interface EventsCardProps {
  upcomingEvents: EventItem[];
  completedEvents: EventItem[];
  loading?: boolean;
  limit?: number;
}

const formatDate = (d: string | undefined) =>
  d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
const formatTime = (d: string | undefined) =>
  d ? new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
const getTimeRange = (ev: EventItem) =>
  ev.is_all_day ? "All day" : ev.start_date
    ? `${formatTime(ev.start_date)}${ev.end_date ? ` - ${formatTime(ev.end_date)}` : ""}`
    : "";
const EventListItem = ({ ev, showTime = true }: { ev: EventItem; showTime?: boolean }) => (
  <li className="list-group-item p-3">
    <div className="d-flex align-items-center justify-content-between">
      <div className="d-flex align-items-center">
        <span className="avatar avatar-lg flex-shrink-0 me-2 bg-primary-transparent rounded">
          <i className="ti ti-calendar-event fs-20 text-primary" />
        </span>
        <div className="overflow-hidden">
          <h6 className="mb-1">
            <Link to={all_routes.events}>{ev.title || "Event"}</Link>
          </h6>
          <p className="mb-0">
            <i className="ti ti-calendar me-1" />
            {formatDate(ev.start_date)}
            {ev.end_date && formatDate(ev.end_date) !== formatDate(ev.start_date) ? ` - ${formatDate(ev.end_date)}` : ""}
          </p>
        </div>
      </div>
      <span className={`badge d-inline-flex align-items-center ${ev.is_all_day ? "badge-soft-danger" : "badge-soft-skyblue"}`}>
        <i className="ti ti-circle-filled fs-5 me-1" />
        {ev.is_all_day ? "Full Day" : "Half Day"}
      </span>
    </div>
    {showTime && getTimeRange(ev) && (
      <p className="mb-0 mt-1 ms-5">
        <i className="ti ti-clock me-1" />
        {getTimeRange(ev)}
      </p>
    )}
  </li>
);

export const EventsCard = ({ upcomingEvents, completedEvents, loading, limit = 5 }: EventsCardProps) => {
  const routes = all_routes;
  const upcoming = (upcomingEvents || []).slice(0, limit);
  const completed = (completedEvents || []).slice(0, limit);

  return (
    <div className="card flex-fill">
      <div className="card-header d-flex align-items-center justify-content-between">
        <h4 className="card-title">Events</h4>
        <Link to={routes.events} className="fw-medium">
          View All
        </Link>
      </div>
      <div className="card-body p-0">
        {loading ? (
          <div className="p-4 text-center">
            <div className="spinner-border spinner-border-sm text-primary" role="status" />
            <span className="ms-2">Loading events...</span>
          </div>
        ) : !upcoming.length && !completed.length ? (
          <div className="p-4">
            <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
              <i className="ti ti-info-circle me-2 fs-18" />
              <span>No events. Events will appear here once available.</span>
            </div>
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <h6 className="px-3 pt-3 mb-2 text-muted small">Upcoming Events</h6>
                <ul className="list-group list-group-flush">
                  {upcoming.map((ev) => (
                    <EventListItem key={ev.id} ev={ev} />
                  ))}
                </ul>
              </>
            )}
            {completed.length > 0 && (
              <>
                <h6 className="px-3 pt-3 mb-2 text-muted small">Completed Events</h6>
                <ul className="list-group list-group-flush">
                  {completed.map((ev) => (
                    <EventListItem key={ev.id} ev={ev} />
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
