import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { all_routes } from '../router/all_routes';

type TicketRow = {
  id: number;
  ticket_number: string;
  subject: string;
  school_name: string;
  institute_number?: string;
  priority: string;
  status: string;
  updated_at: string;
};

const SuperAdminSupportTickets = () => {
  const navigate = useNavigate();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await superAdminApiService.listSupportTickets({
        status: statusFilter || undefined,
        search: search || undefined,
        page_size: 25,
      });
      if (res.status === 'SUCCESS' && Array.isArray(res.data)) {
        setRows(res.data as TicketRow[]);
      } else {
        setError(res.message || 'Failed to load');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    load();
  }, [authChecked, isAuthenticated, statusFilter]);

  const openTicket = (ticketId: number) => {
    navigate(all_routes.superAdminSupportTicket.replace(':id', String(ticketId)));
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      open: 'bg-primary',
      in_progress: 'bg-info',
      waiting_for_response: 'bg-warning text-dark',
      resolved: 'bg-success',
      closed: 'bg-secondary',
    };
    return map[s] || 'bg-secondary';
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h2 className="h4 mb-1">Support tickets</h2>
          <p className="text-muted small mb-0">Tickets raised by school admins across the platform</p>
        </div>
        <div className="d-flex gap-2">
          <input
            type="search"
            className="form-control form-control-sm"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load()}
          />
          <select
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="waiting_for_response">Waiting</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <button type="button" className="btn btn-sm btn-primary" onClick={load}>
            Apply
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card border-0 shadow-sm">
          <div className="card-body text-center text-muted py-5">No support tickets yet.</div>
        </div>
      ) : (
        <div className="card border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover mb-0 align-middle">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>School</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr
                    key={t.id}
                    className="sa-school-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => openTicket(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openTicket(t.id);
                      }
                    }}
                  >
                    <td>
                      <span className="fw-medium text-primary">{t.ticket_number}</span>
                    </td>
                    <td>
                      <div>{t.school_name}</div>
                      {t.institute_number && (
                        <small className="text-muted">{t.institute_number}</small>
                      )}
                    </td>
                    <td>{t.subject}</td>
                    <td>
                      <span className="badge bg-light text-dark border text-capitalize">{t.priority}</span>
                    </td>
                    <td>
                      <span className={`badge ${statusBadge(t.status)}`}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="small text-muted">{new Date(t.updated_at).toLocaleString()}</td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        title="Open ticket"
                        onClick={() => openTicket(t.id)}
                      >
                        <i className="ti ti-eye me-1" />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminSupportTickets;
