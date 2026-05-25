import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { apiService } from '../../core/services/apiService';
import { useDebouncedValue } from '../../core/hooks/useDebouncedValue';
import { all_routes } from '../router/all_routes';
import { extractMessageFromApiError } from '../../core/utils/apiErrorMessage';
import {
  TICKET_PRIORITY_BADGE,
  TICKET_STATUS_BADGE,
  formatCategoryLabel,
  formatStatusLabel,
} from './supportUiUtils';
import './help-support.scss';

type TabKey = 'guides' | 'faq' | 'raise' | 'tickets';

type Category = {
  id: number;
  slug: string;
  name: string;
  description?: string;
  article_count?: number;
};

type Article = {
  id: number;
  title: string;
  description?: string;
  category_slug?: string;
  category_name?: string;
  updated_at?: string;
};

type Faq = {
  id: number;
  question: string;
  answer: string;
  category_slug?: string;
};

type TicketRow = {
  id: number;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  latest_reply_preview?: string;
};

type MetaOption = { value: string; label: string };

const HelpSupportPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabKey>('guides');

  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 350);
  const [searchResults, setSearchResults] = useState<{
    articles: Article[];
    faqs: Faq[];
    suggestions: { type: string; label: string; slug?: string; id?: number }[];
  } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loadingGuides, setLoadingGuides] = useState(true);

  const [selectedArticle, setSelectedArticle] = useState<{
    title: string;
    content: string;
    related_articles?: Article[];
  } | null>(null);
  const [articleModalOpen, setArticleModalOpen] = useState(false);

  const [metaCategories, setMetaCategories] = useState<MetaOption[]>([]);
  const [metaPriorities, setMetaPriorities] = useState<MetaOption[]>([]);
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    description: '',
    category: 'technical_issue',
    priority: 'medium',
  });
  const [ticketFiles, setTicketFiles] = useState<File[]>([]);
  const [submittingTicket, setSubmittingTicket] = useState(false);

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketFilters, setTicketFilters] = useState({ status: '', search: '' });
  const debouncedTicketSearch = useDebouncedValue(ticketFilters.search, 400);
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketTotalPages, setTicketTotalPages] = useState(1);
  const [articleLoading, setArticleLoading] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const res = await apiService.getHelpSupportMeta();
      if (res.status === 'SUCCESS' && res.data) {
        const d = res.data as { categories: MetaOption[]; priorities: MetaOption[] };
        setMetaCategories(d.categories || []);
        setMetaPriorities(d.priorities || []);
      }
    } catch {
      /* optional */
    }
  }, []);

  const loadGuides = useCallback(async () => {
    setLoadingGuides(true);
    try {
      const [catRes, artRes] = await Promise.all([
        apiService.getHelpCategories(),
        apiService.getHelpArticles(selectedCategory || undefined),
      ]);
      if (catRes.status === 'SUCCESS') setCategories((catRes.data as Category[]) || []);
      if (artRes.status === 'SUCCESS') setArticles((artRes.data as Article[]) || []);
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: extractMessageFromApiError(e) });
    } finally {
      setLoadingGuides(false);
    }
  }, [selectedCategory]);

  const loadFaqs = useCallback(async () => {
    try {
      const res = await apiService.getHelpFaqs(selectedCategory || undefined);
      if (res.status === 'SUCCESS') setFaqs((res.data as Faq[]) || []);
    } catch {
      setFaqs([]);
    }
  }, [selectedCategory]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const res = await apiService.getSupportTickets({
        page: ticketPage,
        page_size: 10,
        status: ticketFilters.status || undefined,
        search: debouncedTicketSearch.trim() || undefined,
      });
      if (res.status === 'SUCCESS') {
        setTickets((res.data as TicketRow[]) || []);
        setTicketTotalPages((res as { totalPages?: number }).totalPages || 1);
      }
    } catch (e) {
      Swal.fire({ icon: 'error', title: 'Error', text: extractMessageFromApiError(e) });
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketPage, ticketFilters.status, debouncedTicketSearch]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    if (activeTab === 'guides' || activeTab === 'faq') {
      loadGuides();
      if (activeTab === 'faq') loadFaqs();
    }
  }, [activeTab, loadGuides, loadFaqs]);

  useEffect(() => {
    if (activeTab === 'tickets') loadTickets();
  }, [activeTab, loadTickets]);

  useEffect(() => {
    if (!articleModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setArticleModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [articleModalOpen]);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setSearchLoading(true);
      try {
        const res = await apiService.searchHelpCenter({ q });
        if (!cancelled && res.status === 'SUCCESS' && res.data) {
          setSearchResults(res.data as typeof searchResults);
        }
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const openArticle = async (articleId: number) => {
    setArticleLoading(true);
    setArticleModalOpen(true);
    try {
      const res = await apiService.getHelpArticle(articleId);
      if (res.status === 'SUCCESS' && res.data) {
        const d = res.data as {
          title: string;
          content: string;
          related_articles?: Article[];
        };
        setSelectedArticle(d);
      } else {
        setArticleModalOpen(false);
        Swal.fire({ icon: 'error', title: 'Error', text: res.message || 'Article not found' });
      }
    } catch (e) {
      setArticleModalOpen(false);
      Swal.fire({ icon: 'error', title: 'Error', text: extractMessageFromApiError(e) });
    } finally {
      setArticleLoading(false);
    }
  };

  const ALLOWED_UPLOAD_EXT = /\.(jpe?g|png|gif|webp|pdf|docx?|txt)$/i;

  const uploadTicketFiles = async () => {
    const out: { file_name: string; file_path: string; file_type: string; file_size: number }[] = [];
    for (const file of ticketFiles) {
      if (!ALLOWED_UPLOAD_EXT.test(file.name)) {
        throw new Error(`${file.name}: file type not allowed`);
      }
      if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} exceeds 10MB`);
      const res = await apiService.uploadSupportAttachment(file);
      if (res.status !== 'SUCCESS' || !res.data) throw new Error('Upload failed');
      const data = res.data as { relativePath?: string };
      if (!data.relativePath) throw new Error('Invalid upload');
      out.push({
        file_name: file.name,
        file_path: data.relativePath,
        file_type: file.type,
        file_size: file.size,
      });
    }
    return out;
  };

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketForm.subject.trim().length < 3) {
      Swal.fire({ icon: 'warning', title: 'Subject required', text: 'Enter at least 3 characters.' });
      return;
    }
    if (ticketForm.description.trim().length < 10) {
      Swal.fire({ icon: 'warning', title: 'Description required', text: 'Please describe your issue (min 10 characters).' });
      return;
    }
    if (submittingTicket) return;
    setSubmittingTicket(true);
    try {
      const attachments = ticketFiles.length ? await uploadTicketFiles() : [];
      const res = await apiService.createSupportTicket({
        subject: ticketForm.subject.trim(),
        description: ticketForm.description.trim(),
        category: ticketForm.category,
        priority: ticketForm.priority,
        attachments,
      });
      if (res.status === 'SUCCESS' && res.data) {
        const t = res.data as { id: number };
        Swal.fire({ icon: 'success', title: 'Ticket created', timer: 2000, showConfirmButton: false });
        setTicketForm({ subject: '', description: '', category: 'technical_issue', priority: 'medium' });
        setTicketFiles([]);
        navigate(all_routes.helpSupportTicket.replace(':id', String(t.id)));
      } else {
        Swal.fire({ icon: 'error', title: 'Failed', text: res.message });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Failed', text: extractMessageFromApiError(err) });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const filteredArticles =
    searchResults && debouncedSearch.trim().length >= 2
      ? searchResults.articles
      : articles;

  const filteredFaqs =
    searchResults && debouncedSearch.trim().length >= 2 ? searchResults.faqs : faqs;

  return (
    <div className="page-wrapper help-support-page">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Help &amp; Support</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={all_routes.adminDashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Help &amp; Support
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div className="hs-hero">
          <h1 className="h3 fw-bold mb-2">How can we help you?</h1>
          <p className="text-muted mb-3 mb-md-4">
            Search guides, browse FAQs, or raise a support ticket for platform assistance.
          </p>
          <div className="hs-search-wrap">
            <div className="input-group input-group-lg">
              <span className="input-group-text bg-white border-end-0">
                <i className="ti ti-search text-muted" />
              </span>
              <input
                type="search"
                className="form-control border-start-0"
                placeholder="Search guides, tutorials, FAQs…"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                aria-label="Search help center"
              />
              {searchLoading && (
                <span className="input-group-text bg-white">
                  <span className="spinner-border spinner-border-sm text-primary" />
                </span>
              )}
            </div>
            {showSuggestions && searchResults?.suggestions && searchResults.suggestions.length > 0 && (
              <div className="hs-search-suggestions">
                {searchResults.suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="dropdown-item py-2 px-3 text-start w-100 border-0 bg-transparent"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      if (s.type === 'article' && s.id) openArticle(s.id);
                      setSearchInput(s.label);
                      setShowSuggestions(false);
                    }}
                  >
                    <i className={`ti ${s.type === 'faq' ? 'ti-help' : 'ti-file-text'} me-2 text-primary`} />
                    {s.label}
                  </button>
                ))}
              </div>
            )}
            {showSuggestions && debouncedSearch.length >= 2 && !searchLoading && searchResults?.suggestions?.length === 0 && (
              <div className="hs-search-suggestions p-3 text-muted small">No suggestions — try different keywords</div>
            )}
          </div>
        </div>

        <ul className="nav nav-tabs nav-tabs-bottom hs-tab-nav mb-3" role="tablist">
          {(
            [
              ['guides', 'Guides', 'ti-book'],
              ['faq', 'FAQ', 'ti-help'],
              ['raise', 'Raise ticket', 'ti-ticket'],
              ['tickets', 'My tickets', 'ti-list'],
            ] as const
          ).map(([key, label, icon]) => (
            <li className="nav-item" key={key}>
              <button
                type="button"
                className={`nav-link ${activeTab === key ? 'active' : ''}`}
                onMouseDown={() => setShowSuggestions(false)}
                onClick={() => {
                  setShowSuggestions(false);
                  setActiveTab(key);
                }}
              >
                <i className={`ti ${icon} me-1`} />
                {label}
              </button>
            </li>
          ))}
        </ul>

        {activeTab === 'guides' && (
          <div className="row g-3">
            <div className="col-lg-3">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent">
                  <h6 className="mb-0">Categories</h6>
                </div>
                <div className="list-group list-group-flush">
                  <button
                    type="button"
                    className={`list-group-item list-group-item-action ${!selectedCategory ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('')}
                  >
                    All topics
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      className={`list-group-item list-group-item-action d-flex justify-content-between ${
                        selectedCategory === c.slug ? 'active' : ''
                      }`}
                      onClick={() => setSelectedCategory(c.slug)}
                    >
                      <span>{c.name}</span>
                      <span className="badge bg-light text-dark">{c.article_count ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="col-lg-9">
              {loadingGuides ? (
                <div className="row g-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div className="col-md-6" key={n}>
                      <div className="hs-skeleton" />
                    </div>
                  ))}
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="hs-empty card border-0 shadow-sm">
                  <i className="ti ti-file-off fs-1 d-block mb-2 opacity-50" />
                  <p>No articles found. Try another category or search term.</p>
                </div>
              ) : (
                <div className="row g-3">
                  {filteredArticles.map((a) => (
                    <div className="col-md-6" key={a.id}>
                      <div
                        className="card hs-article-card h-100 border-0 shadow-sm"
                        role="button"
                        tabIndex={0}
                        onClick={() => openArticle(a.id)}
                        onKeyDown={(e) => e.key === 'Enter' && openArticle(a.id)}
                      >
                        <div className="card-body">
                          {a.category_name && (
                            <span className="badge badge-soft-primary mb-2">{a.category_name}</span>
                          )}
                          <h5 className="card-title">{a.title}</h5>
                          <p className="card-text text-muted small">{a.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="card border-0 shadow-sm">
            <div className="card-body">
              {filteredFaqs.length === 0 ? (
                <div className="hs-empty">No FAQs match your filters.</div>
              ) : (
                <div className="accordion hs-faq-item" id="helpFaqAccordion">
                  {filteredFaqs.map((f) => (
                    <div className="accordion-item border-0 mb-2" key={f.id}>
                      <h2 className="accordion-header">
                        <button
                          className="accordion-button collapsed rounded"
                          type="button"
                          data-bs-toggle="collapse"
                          data-bs-target={`#faq-${f.id}`}
                        >
                          {f.question}
                        </button>
                      </h2>
                      <div id={`faq-${f.id}`} className="accordion-collapse collapse" data-bs-parent="#helpFaqAccordion">
                        <div
                          className="accordion-body text-muted"
                          dangerouslySetInnerHTML={{ __html: f.answer }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'raise' && (
          <div className="row justify-content-center">
            <div className="col-lg-8">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent">
                  <h5 className="mb-0">Raise a support ticket</h5>
                  <p className="text-muted small mb-0 mt-1">
                    Our platform team will respond via the ticket conversation.
                  </p>
                </div>
                <form className="card-body" onSubmit={submitTicket}>
                  <div className="mb-3">
                    <label className="form-label">Subject *</label>
                    <input
                      className="form-control"
                      value={ticketForm.subject}
                      onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
                      maxLength={255}
                      required
                    />
                  </div>
                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label">Category *</label>
                      <select
                        className="form-select"
                        value={ticketForm.category}
                        onChange={(e) => setTicketForm((f) => ({ ...f, category: e.target.value }))}
                      >
                        {metaCategories.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Priority</label>
                      <select
                        className="form-select"
                        value={ticketForm.priority}
                        onChange={(e) => setTicketForm((f) => ({ ...f, priority: e.target.value }))}
                      >
                        {metaPriorities.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Description *</label>
                    <textarea
                      className="form-control"
                      rows={5}
                      value={ticketForm.description}
                      onChange={(e) => setTicketForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Describe the issue in detail…"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Attachments (max 5, 10MB each)</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt"
                      multiple
                      onChange={(e) => setTicketFiles(Array.from(e.target.files || []).slice(0, 5))}
                    />
                    {ticketFiles.length > 0 && (
                      <p className="small text-muted mt-1">{ticketFiles.map((f) => f.name).join(', ')}</p>
                    )}
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={submittingTicket}>
                    {submittingTicket ? 'Submitting…' : 'Submit ticket'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent d-flex flex-wrap gap-2 align-items-center justify-content-between">
              <h5 className="mb-0">My tickets</h5>
              <div className="d-flex flex-wrap gap-2">
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search…"
                  style={{ width: 160 }}
                  value={ticketFilters.search}
                  onChange={(e) => {
                    setTicketFilters((f) => ({ ...f, search: e.target.value }));
                    setTicketPage(1);
                  }}
                />
                <select
                  className="form-select form-select-sm"
                  style={{ width: 160 }}
                  value={ticketFilters.status}
                  onChange={(e) => {
                    setTicketFilters((f) => ({ ...f, status: e.target.value }));
                    setTicketPage(1);
                  }}
                >
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="waiting_for_response">Waiting for response</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <div className="table-responsive">
              {ticketsLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" />
                </div>
              ) : tickets.length === 0 ? (
                <div className="hs-empty">No tickets yet. Raise a ticket if you need help.</div>
              ) : (
                <table className="table table-hover mb-0 hs-ticket-table">
                  <thead>
                    <tr>
                      <th>Ticket</th>
                      <th>Subject</th>
                      <th className="d-none d-md-table-cell">Priority</th>
                      <th>Status</th>
                      <th className="d-none d-lg-table-cell">Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map((t) => (
                      <tr
                        key={t.id}
                        className="hs-ticket-row"
                        onClick={() =>
                          navigate(all_routes.helpSupportTicket.replace(':id', String(t.id)))
                        }
                      >
                        <td className="fw-medium text-primary">{t.ticket_number}</td>
                        <td>
                          <div>{t.subject}</div>
                          {t.latest_reply_preview && (
                            <small className="text-muted text-truncate d-block" style={{ maxWidth: 280 }}>
                              {t.latest_reply_preview}
                            </small>
                          )}
                        </td>
                        <td className="d-none d-md-table-cell">
                          <span className={`badge ${TICKET_PRIORITY_BADGE[t.priority] || ''}`}>
                            {t.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${TICKET_STATUS_BADGE[t.status] || ''}`}>
                            {formatStatusLabel(t.status)}
                          </span>
                        </td>
                        <td className="text-muted small d-none d-lg-table-cell">
                          {new Date(t.updated_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {ticketTotalPages > 1 && (
              <div className="card-footer bg-transparent d-flex justify-content-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={ticketPage <= 1}
                  onClick={() => setTicketPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="align-self-center small text-muted">
                  Page {ticketPage} of {ticketTotalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={ticketPage >= ticketTotalPages}
                  onClick={() => setTicketPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {articleModalOpen && (
        <div
          className="hs-modal-backdrop"
          role="presentation"
          onClick={() => setArticleModalOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setArticleModalOpen(false)}
        >
          <div
            className="hs-modal-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hs-article-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header border-bottom px-3 py-3">
              <h5 className="modal-title mb-0" id="hs-article-title">
                {selectedArticle?.title || 'Loading…'}
              </h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={() => setArticleModalOpen(false)}
              />
            </div>
            <div className="hs-modal-body px-3 py-3 flex-grow-1">
              {articleLoading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : selectedArticle ? (
                <div dangerouslySetInnerHTML={{ __html: selectedArticle.content }} />
              ) : null}
            </div>
            {selectedArticle?.related_articles && selectedArticle.related_articles.length > 0 && (
              <div className="border-top px-3 py-3">
                <h6 className="mb-2">Related articles</h6>
                <div className="d-flex flex-wrap gap-2">
                  {selectedArticle.related_articles.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => openArticle(r.id)}
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HelpSupportPage;
