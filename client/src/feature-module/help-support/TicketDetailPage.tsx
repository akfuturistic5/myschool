import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { apiService } from '../../core/services/apiService';
import { all_routes } from '../router/all_routes';
import { extractMessageFromApiError } from '../../core/utils/apiErrorMessage';
import {
  TICKET_PRIORITY_BADGE,
  TICKET_STATUS_BADGE,
  formatCategoryLabel,
  formatStatusLabel,
} from './supportUiUtils';
import './help-support.scss';

type Ticket = {
  id: number;
  ticket_number: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Message = {
  id: number;
  sender_type: string;
  sender_name: string;
  message: string;
  created_at: string;
};

type Attachment = {
  id: number;
  file_name: string;
  file_path: string;
  file_type?: string;
};

type StatusHistory = {
  id: number;
  from_status: string | null;
  to_status: string;
  changed_by_name: string | null;
  note: string | null;
  created_at: string;
};

const ALLOWED_UPLOAD_EXT = /\.(jpe?g|png|gif|webp|pdf|docx?|txt)$/i;

const TicketDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiService.getSupportTicket(id);
      if (res.status === 'SUCCESS' && res.data) {
        const d = res.data as {
          ticket: Ticket;
          messages: Message[];
          attachments: Attachment[];
          status_history?: StatusHistory[];
        };
        setTicket(d.ticket);
        setMessages(d.messages || []);
        setAttachments(d.attachments || []);
        setStatusHistory(d.status_history || []);
      } else {
        Swal.fire({ icon: 'error', title: 'Not found', text: res.message || 'Ticket not found' });
        navigate(all_routes.helpSupport);
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: extractMessageFromApiError(e) });
      navigate(all_routes.helpSupport);
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const uploadFiles = async (files: File[]) => {
    const out: { file_name: string; file_path: string; file_type: string; file_size: number }[] = [];
    for (const file of files) {
      if (!ALLOWED_UPLOAD_EXT.test(file.name)) {
        throw new Error(`${file.name}: file type not allowed`);
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new Error(`${file.name} exceeds 10MB limit`);
      }
      const res = await apiService.uploadSupportAttachment(file);
      if (res.status !== 'SUCCESS' || !res.data) throw new Error(res.message || 'Upload failed');
      const data = res.data as { relativePath?: string; url?: string };
      const file_path = data.relativePath || '';
      if (!file_path) throw new Error('Invalid upload response');
      out.push({
        file_name: file.name,
        file_path,
        file_type: file.type,
        file_size: file.size,
      });
    }
    return out;
  };

  const sendReply = async () => {
    if (!id || !reply.trim()) return;
    if (sending) return;
    if (ticket?.status === 'closed') {
      Swal.fire({ icon: 'info', title: 'Ticket closed', text: 'This ticket is closed.' });
      return;
    }
    setSending(true);
    try {
      const attachmentsPayload = pendingFiles.length ? await uploadFiles(pendingFiles) : [];
      const res = await apiService.replySupportTicket(id, {
        message: reply.trim(),
        attachments: attachmentsPayload,
      });
      if (res.status === 'SUCCESS') {
        setReply('');
        setPendingFiles([]);
        await load();
        Swal.fire({ icon: 'success', title: 'Reply sent', timer: 1800, showConfirmButton: false });
      } else {
        Swal.fire({ icon: 'error', title: 'Failed', text: res.message });
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Failed', text: extractMessageFromApiError(e) });
    } finally {
      setSending(false);
    }
  };

  const openAttachment = async (att: Attachment) => {
    try {
      const url = await apiService.getSchoolStorageFileAbsoluteUrl(att.file_path);
      if (!url) throw new Error('Missing file URL');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'File unavailable',
        text: 'This attachment may have been removed or is temporarily unavailable.',
      });
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status" />
            <p className="mt-2 text-muted">Loading ticket…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  return (
    <div className="page-wrapper help-support-page">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Ticket {ticket.ticket_number}</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={all_routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={all_routes.helpSupport}>Help &amp; Support</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  {ticket.ticket_number}
                </li>
              </ol>
            </nav>
          </div>
          <Link to={all_routes.helpSupport} className="btn btn-outline-light bg-white">
            <i className="ti ti-arrow-left me-1" />
            Back
          </Link>
        </div>

        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex flex-wrap gap-2 align-items-start justify-content-between mb-2">
              <h4 className="mb-0">{ticket.subject}</h4>
              <div className="d-flex flex-wrap gap-2">
                <span className={`badge ${TICKET_STATUS_BADGE[ticket.status] || 'badge-soft-secondary'}`}>
                  {formatStatusLabel(ticket.status)}
                </span>
                <span className={`badge ${TICKET_PRIORITY_BADGE[ticket.priority] || 'badge-soft-secondary'}`}>
                  {ticket.priority}
                </span>
                <span className="badge badge-soft-dark">{formatCategoryLabel(ticket.category)}</span>
              </div>
            </div>
            <p className="text-muted small mb-0">
              Created {new Date(ticket.created_at).toLocaleString()} · Updated{' '}
              {new Date(ticket.updated_at).toLocaleString()}
            </p>
            {ticket.status === 'closed' && (
              <div className="alert alert-secondary py-2 px-3 mt-3 mb-0 small">
                This ticket is closed. Replies are disabled.
              </div>
            )}
            {ticket.status === 'resolved' && (
              <div className="alert alert-info py-2 px-3 mt-3 mb-0 small">
                Marked resolved — you can still reply to reopen the conversation.
              </div>
            )}
          </div>
        </div>

        <div className="row g-3">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent border-0 pb-0">
                <h5 className="mb-0">Conversation</h5>
              </div>
              <div className="card-body hs-conversation-panel">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`hs-chat-bubble mb-3 ${
                      m.sender_type === 'school_admin' ? 'from-school' : 'from-support'
                    }`}
                  >
                    <div className="small fw-semibold mb-1">
                      {m.sender_name?.trim() ||
                        (m.sender_type === 'school_admin' ? 'School' : 'Platform Support')}
                    </div>
                    <div className="text-break" style={{ whiteSpace: 'pre-wrap' }}>
                      {m.message}
                    </div>
                    <div className="small text-muted mt-1">{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {ticket.status !== 'closed' && (
                <div className="card-footer bg-transparent border-top">
                  {pendingFiles.length > 0 && (
                    <div className="mb-2 d-flex flex-wrap gap-1">
                      {pendingFiles.map((f, i) => (
                        <span key={i} className="badge bg-light text-dark border">
                          {f.name}
                          <button
                            type="button"
                            className="btn-close btn-close-sm ms-1"
                            aria-label="Remove"
                            onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}
                          />
                        </span>
                      ))}
                    </div>
                  )}
                  <textarea
                    className="form-control mb-2"
                    rows={3}
                    placeholder="Write your reply…"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    disabled={sending}
                  />
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="d-none"
                        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || []);
                          setPendingFiles((p) => [...p, ...files].slice(0, 5));
                          e.target.value = '';
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending}
                      >
                        <i className="ti ti-paperclip me-1" />
                        Attach
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={sending || !reply.trim()}
                      onClick={sendReply}
                    >
                      {sending ? 'Sending…' : 'Send reply'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="col-lg-4">
            {statusHistory.length > 0 && (
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-header bg-transparent">
                  <h6 className="mb-0">Status timeline</h6>
                </div>
                <ul className="list-group list-group-flush small">
                  {statusHistory.map((h) => (
                    <li key={h.id} className="list-group-item">
                      <div className="fw-medium">
                        {h.from_status
                          ? `${formatStatusLabel(h.from_status)} → ${formatStatusLabel(h.to_status)}`
                          : formatStatusLabel(h.to_status)}
                      </div>
                      <div className="text-muted">
                        {h.changed_by_name || 'System'} · {new Date(h.created_at).toLocaleString()}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {attachments.length > 0 && (
              <div className="card border-0 shadow-sm mb-3">
                <div className="card-header bg-transparent">
                  <h6 className="mb-0">Attachments</h6>
                </div>
                <ul className="list-group list-group-flush">
                  {attachments.map((a) => (
                    <li key={a.id} className="list-group-item">
                      <button
                        type="button"
                        className="btn btn-link p-0 text-start"
                        onClick={() => openAttachment(a)}
                      >
                        <i className="ti ti-file me-1" />
                        {a.file_name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailPage;
