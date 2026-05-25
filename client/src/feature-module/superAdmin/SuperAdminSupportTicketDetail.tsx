import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { superAdminToast } from './superAdminToast';
import { all_routes } from '../router/all_routes';

type Ticket = {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  school_name: string;
  institute_number?: string;
  created_at: string;
};

type Message = {
  id: number;
  sender_type: string;
  sender_name: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
};

type Attachment = {
  id: number;
  file_name: string;
  file_path: string;
  file_type?: string;
};

const STATUSES = ['open', 'in_progress', 'waiting_for_response', 'resolved', 'closed'] as const;

const SuperAdminSupportTicketDetail = () => {
  const { id } = useParams<{ id: string }>();
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [reply, setReply] = useState('');
  const [internalNote, setInternalNote] = useState(false);
  const [sending, setSending] = useState(false);
  const [patching, setPatching] = useState(false);
  const [statusDraft, setStatusDraft] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await superAdminApiService.getSupportTicket(Number(id));
      if (res.status === 'SUCCESS' && res.data) {
        const d = res.data as { ticket: Ticket; messages: Message[]; attachments?: Attachment[] };
        setTicket(d.ticket);
        setStatusDraft(d.ticket.status);
        setMessages(d.messages || []);
        setAttachments(d.attachments || []);
      } else {
        superAdminToast.error(res.message || 'Ticket not found');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    load();
  }, [authChecked, isAuthenticated, load]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const saveStatus = async () => {
    if (!id || !ticket || statusDraft === ticket.status) return;
    setPatching(true);
    try {
      const res = await superAdminApiService.patchSupportTicket(Number(id), { status: statusDraft });
      if (res.status === 'SUCCESS') {
        const updated =
          res.data && typeof res.data === 'object' && 'status' in res.data
            ? String((res.data as Ticket).status)
            : statusDraft;
        setTicket((prev) => (prev ? { ...prev, status: updated } : prev));
        setStatusDraft(updated);
        superAdminToast.success('Status saved');
      } else {
        superAdminToast.error(res.message || 'Update failed');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setPatching(false);
    }
  };

  const openAttachment = async (att: Attachment) => {
    if (!id) return;
    try {
      const blob = await superAdminApiService.fetchSupportAttachment(Number(id), att.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'File unavailable');
    }
  };

  const sendReply = async () => {
    if (!id || !reply.trim()) return;
    if (sending) return;
    setSending(true);
    try {
      const res = await superAdminApiService.replySupportTicket(Number(id), {
        message: reply.trim(),
        is_internal_note: internalNote,
      });
      if (res.status === 'SUCCESS') {
        setReply('');
        superAdminToast.success('Reply sent');
        await load();
      } else {
        superAdminToast.error(res.message || 'Failed');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div>
        <Link to={all_routes.superAdminSupportTickets}>← Back to tickets</Link>
        <p className="mt-3 text-muted">Ticket not found.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <Link to={all_routes.superAdminSupportTickets} className="text-decoration-none small">
          <i className="ti ti-arrow-left me-1" />
          All tickets
        </Link>
      </div>

      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h2 className="h4 mb-1">{ticket.ticket_number}</h2>
          <p className="text-muted mb-0">
            {ticket.school_name}
            {ticket.institute_number ? ` · ${ticket.institute_number}` : ''}
          </p>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-2">
          <select
            className="form-select form-select-sm"
            value={statusDraft}
            disabled={patching}
            onChange={(e) => setStatusDraft(e.target.value)}
            aria-label="Ticket status"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={patching || statusDraft === ticket.status}
            onClick={saveStatus}
          >
            {patching ? 'Saving…' : 'Save status'}
          </button>
        </div>
      </div>

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-body">
          <h5 className="mb-2">{ticket.subject}</h5>
          <p className="text-muted small mb-3">
            {ticket.category.replace(/_/g, ' ')} · Priority:{' '}
            <span className="text-capitalize">{ticket.priority}</span> (set by school) · Created{' '}
            {new Date(ticket.created_at).toLocaleString()}
          </p>
          {ticket.description?.trim() && (
            <div className="border rounded p-3 bg-light">
              <h6 className="small text-uppercase text-muted mb-2">Original request</h6>
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>
                {ticket.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-header bg-transparent">
            <h6 className="mb-0">Attachments</h6>
          </div>
          <ul className="list-group list-group-flush">
            {attachments.map((a) => (
              <li key={a.id} className="list-group-item d-flex justify-content-between align-items-center">
                <span className="text-truncate me-2">
                  <i className="ti ti-paperclip me-1" />
                  {a.file_name}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary flex-shrink-0"
                  onClick={() => openAttachment(a)}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card border-0 shadow-sm mb-3">
        <div className="card-header bg-transparent">
          <h6 className="mb-0">Conversation</h6>
        </div>
        <div className="card-body" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {[...messages]
            .filter((m) => !m.is_internal_note)
            .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
            .map((m) => (
              <div
                key={m.id}
                className={`mb-3 p-3 rounded ${
                  m.sender_type === 'super_admin' ? 'bg-success-subtle ms-4' : 'bg-light me-4'
                }`}
              >
                <div className="small fw-semibold">{m.sender_name}</div>
                <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
                <div className="small text-muted">{new Date(m.created_at).toLocaleString()}</div>
              </div>
            ))}
          {messages.filter((m) => m.is_internal_note).length > 0 && (
            <div className="border-top pt-3 mt-3">
              <h6 className="small text-muted text-uppercase">Internal notes</h6>
              {messages
                .filter((m) => m.is_internal_note)
                .map((m) => (
                  <div key={m.id} className="mb-2 p-2 rounded border border-warning-subtle bg-warning-subtle">
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
                    <div className="small text-muted">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="card-footer bg-transparent">
          <div className="form-check mb-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="internalNote"
              checked={internalNote}
              onChange={(e) => setInternalNote(e.target.checked)}
            />
            <label className="form-check-label small" htmlFor="internalNote">
              Internal note (not visible to school)
            </label>
          </div>
          <textarea
            className="form-control mb-2"
            rows={3}
            placeholder="Reply to school…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={sending}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={sending || !reply.trim() || ticket.status === 'closed'}
            onClick={sendReply}
          >
            {sending ? 'Sending…' : ticket.status === 'closed' ? 'Ticket closed' : 'Send reply'}
          </button>
          {ticket.status === 'closed' && (
            <p className="small text-muted mt-2 mb-0">
              Change status to reopen this ticket before sending a reply.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminSupportTicketDetail;
