import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiService } from "../../core/services/apiService";
import { all_routes } from "../router/all_routes";
import HolidayDashboardCard from "./shared/HolidayDashboardCard";

type DriverPortalPayload = {
  linked?: boolean;
  driver?: Record<string, unknown> | null;
  staff?: Record<string, unknown> | null;
  vehicles?: Record<string, unknown>[];
  routes?: Record<string, unknown>[];
  pickup_points?: Record<string, unknown>[];
  passengers?: Record<string, unknown>[];
};

export default function DriverDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DriverPortalPayload | null>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = (await apiService.getDriverPortalMe()) as {
          status?: string;
          data?: DriverPortalPayload;
          message?: string;
        };
        if (disposed) return;
        if (res?.status === "SUCCESS") {
          setData(res.data || {});
        } else {
          setError(res?.message || "Failed to load driver portal.");
        }
      } catch (e: any) {
        if (!disposed) setError(e?.message || "Failed to load driver portal.");
      } finally {
        if (!disposed) setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      vehicles: data?.vehicles?.length ?? 0,
      routes: data?.routes?.length ?? 0,
      pickups: data?.pickup_points?.length ?? 0,
      passengers: data?.passengers?.length ?? 0,
    }),
    [data]
  );

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row">
          <div className="col-12">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h3 className="mb-0">Driver Dashboard</h3>
              <Link to={all_routes.profile} className="btn btn-light btn-sm">
                My Profile
              </Link>
            </div>
          </div>
        </div>
        <div className="row">
          <HolidayDashboardCard />
        </div>

        {loading && <div className="alert alert-info">Loading driver data...</div>}
        {error && <div className="alert alert-danger">{error}</div>}

        {!loading && !error && data?.linked === false && (
          <div className="alert alert-warning mb-3">
            Driver profile is not linked with this account yet. Contact admin.
          </div>
        )}

        {!loading && !error && data?.linked && (
          <>
            <div className="row">
              <div className="col-md-3">
                <div className="card"><div className="card-body">Vehicles: <strong>{counts.vehicles}</strong></div></div>
              </div>
              <div className="col-md-3">
                <div className="card"><div className="card-body">Routes: <strong>{counts.routes}</strong></div></div>
              </div>
              <div className="col-md-3">
                <div className="card"><div className="card-body">Pickup Points: <strong>{counts.pickups}</strong></div></div>
              </div>
              <div className="col-md-3">
                <div className="card"><div className="card-body">Passengers: <strong>{counts.passengers}</strong></div></div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h5 className="mb-0">My Vehicles</h5></div>
              <div className="card-body">
                <ul className="mb-0">
                  {(data?.vehicles || []).map((v: any) => (
                    <li key={String(v.id)}>
                      {String(v.vehicle_number || "N/A")} - {String(v.vehicle_model || "N/A")}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h5 className="mb-0">My Routes</h5></div>
              <div className="card-body">
                <ul className="mb-0">
                  {(data?.routes || []).map((r: any) => (
                    <li key={String(r.id)}>{String(r.route_name || `Route ${r.id}`)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
