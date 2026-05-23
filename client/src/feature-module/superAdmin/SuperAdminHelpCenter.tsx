import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { superAdminToast } from './superAdminToast';

type TabKey = 'categories' | 'articles' | 'faqs';

type HelpCategory = {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_active: boolean;
  article_count?: number;
  linked_article_count?: number;
};

type HelpArticle = {
  id: number;
  title: string;
  status: string;
  sort_order: number;
  updated_at: string;
  category_name?: string;
  category_slug?: string;
};

type HelpArticleDetail = HelpArticle & {
  category_id: number;
  description?: string;
  content: string;
};

type HelpFaq = {
  id: number;
  category_slug?: string | null;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
};

const ARTICLE_STATUSES = ['draft', 'published', 'archived'] as const;
const HELP_SORT_ORDER_MIN = 1;

function nextHelpSortOrder(items: { sort_order: number }[]) {
  const max = items.reduce((m, x) => Math.max(m, Number(x.sort_order) || 0), 0);
  return max < HELP_SORT_ORDER_MIN ? 10 : max + 10;
}

function isValidHelpSortOrder(value: number) {
  return Number.isInteger(value) && value >= HELP_SORT_ORDER_MIN;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const SuperAdminHelpCenter = () => {
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const [tab, setTab] = useState<TabKey>('categories');
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [articles, setArticles] = useState<HelpArticle[]>([]);
  const [faqs, setFaqs] = useState<HelpFaq[]>([]);

  const [catForm, setCatForm] = useState({
    id: 0,
    slug: '',
    name: '',
    description: '',
    sort_order: 10,
    is_active: true,
  });
  const [catSaving, setCatSaving] = useState(false);

  const [artForm, setArtForm] = useState({
    id: 0,
    category_id: 0,
    title: '',
    description: '',
    content: '',
    status: 'published' as (typeof ARTICLE_STATUSES)[number],
    sort_order: 10,
  });
  const [artSaving, setArtSaving] = useState(false);
  const [artLoading, setArtLoading] = useState(false);

  const [faqForm, setFaqForm] = useState({
    id: 0,
    category_slug: '',
    question: '',
    answer: '',
    sort_order: 10,
    is_active: true,
  });
  const [faqSaving, setFaqSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, aRes, fRes] = await Promise.all([
        superAdminApiService.listHelpCategories(),
        superAdminApiService.listHelpArticles(),
        superAdminApiService.listHelpFaqs(),
      ]);
      if (cRes.status === 'SUCCESS') setCategories((cRes.data as HelpCategory[]) || []);
      if (aRes.status === 'SUCCESS') setArticles((aRes.data as HelpArticle[]) || []);
      if (fRes.status === 'SUCCESS') setFaqs((fRes.data as HelpFaq[]) || []);
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Failed to load help content');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authChecked || !isAuthenticated) return;
    loadAll();
  }, [authChecked, isAuthenticated, loadAll]);

  const resetCatForm = () => {
    setCatForm({
      id: 0,
      slug: '',
      name: '',
      description: '',
      sort_order: nextHelpSortOrder(categories),
      is_active: true,
    });
  };

  const saveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (catSaving) return;

    const sortOrder = Number(catForm.sort_order);
    if (!isValidHelpSortOrder(sortOrder)) {
      superAdminToast.error('Sort order must be at least 1 (0 is not allowed).');
      return;
    }
    const sortConflict = categories.find((c) => c.sort_order === sortOrder && c.id !== catForm.id);
    if (sortConflict) {
      superAdminToast.error(
        `Sort order ${sortOrder} is already used by topic "${sortConflict.name}". Choose a different value.`
      );
      return;
    }

    setCatSaving(true);
    try {
      const payload = {
        slug: catForm.slug.trim().toLowerCase(),
        name: catForm.name.trim(),
        description: catForm.description.trim(),
        sort_order: sortOrder,
        is_active: catForm.is_active,
      };
      const res = catForm.id
        ? await superAdminApiService.patchHelpCategory(catForm.id, payload)
        : await superAdminApiService.createHelpCategory(payload);
      if (res.status === 'SUCCESS') {
        superAdminToast.success(catForm.id ? 'Category updated' : 'Category created');
        resetCatForm();
        await loadAll();
      } else {
        superAdminToast.error(res.message || 'Save failed');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCatSaving(false);
    }
  };

  const editCategory = (c: HelpCategory) => {
    setCatForm({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description || '',
      sort_order: c.sort_order,
      is_active: c.is_active,
    });
    setTab('categories');
  };

  const removeCategory = async (c: HelpCategory) => {
    const activeArticles = c.article_count ?? 0;
    const linkedArticles = c.linked_article_count ?? activeArticles;
    let msg = `Delete topic "${c.name}"?`;
    if (activeArticles > 0) {
      msg = `"${c.name}" has ${activeArticles} active guide article(s). It will be deactivated instead of deleted. Continue?`;
    } else if (linkedArticles > 0) {
      msg = `"${c.name}" has ${linkedArticles} archived article link(s). Those records will be removed and the topic will be deleted. Continue?`;
    }
    if (!window.confirm(msg)) return;
    try {
      const res = await superAdminApiService.deleteHelpCategory(c.id);
      if (res.status === 'SUCCESS') {
        superAdminToast.success(res.message || 'Done');
        if (catForm.id === c.id) resetCatForm();
        await loadAll();
      } else {
        superAdminToast.error(res.message || 'Delete failed');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const resetArtForm = () => {
    const firstCat = categories.find((c) => c.is_active) || categories[0];
    setArtForm({
      id: 0,
      category_id: firstCat?.id ?? 0,
      title: '',
      description: '',
      content: '',
      status: 'published',
      sort_order: nextHelpSortOrder(articles),
    });
  };

  const loadArticleForEdit = async (id: number) => {
    setArtLoading(true);
    try {
      const res = await superAdminApiService.getHelpArticle(id);
      if (res.status === 'SUCCESS' && res.data) {
        const a = res.data as HelpArticleDetail;
        setArtForm({
          id: a.id,
          category_id: a.category_id,
          title: a.title,
          description: a.description || '',
          content: a.content || '',
          status: (ARTICLE_STATUSES.includes(a.status as (typeof ARTICLE_STATUSES)[number])
            ? a.status
            : 'draft') as (typeof ARTICLE_STATUSES)[number],
          sort_order: a.sort_order ?? 0,
        });
        setTab('articles');
      } else {
        superAdminToast.error(res.message || 'Could not load article');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Could not load article');
    } finally {
      setArtLoading(false);
    }
  };

  const saveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (artSaving || !artForm.category_id) return;

    const sortOrder = Number(artForm.sort_order);
    if (!isValidHelpSortOrder(sortOrder)) {
      superAdminToast.error('Sort order must be at least 1 (0 is not allowed).');
      return;
    }
    const sortConflict = articles.find((a) => a.sort_order === sortOrder && a.id !== artForm.id);
    if (sortConflict) {
      superAdminToast.error(
        `Sort order ${sortOrder} is already used by "${sortConflict.title}". Choose a different value.`
      );
      return;
    }

    setArtSaving(true);
    try {
      const payload = {
        category_id: artForm.category_id,
        title: artForm.title.trim(),
        description: artForm.description.trim(),
        content: artForm.content,
        status: artForm.status,
        sort_order: sortOrder,
      };
      const res = artForm.id
        ? await superAdminApiService.patchHelpArticle(artForm.id, payload)
        : await superAdminApiService.createHelpArticle(payload);
      if (res.status === 'SUCCESS') {
        superAdminToast.success(artForm.id ? 'Article updated' : 'Article created');
        resetArtForm();
        await loadAll();
      } else {
        superAdminToast.error(res.message || 'Save failed');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setArtSaving(false);
    }
  };

  const removeArticle = async (a: HelpArticle) => {
    if (!window.confirm(`Delete article "${a.title}"?`)) return;
    try {
      const res = await superAdminApiService.deleteHelpArticle(a.id);
      if (res.status === 'SUCCESS') {
        superAdminToast.success('Article deleted');
        if (artForm.id === a.id) resetArtForm();
        await loadAll();
      } else {
        superAdminToast.error(res.message || 'Delete failed');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const resetFaqForm = () => {
    setFaqForm({
      id: 0,
      category_slug: '',
    question: '',
    answer: '',
    sort_order: nextHelpSortOrder(faqs),
      is_active: true,
    });
  };

  const saveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (faqSaving) return;

    const sortOrder = Number(faqForm.sort_order);
    if (!isValidHelpSortOrder(sortOrder)) {
      superAdminToast.error('Sort order must be at least 1 (0 is not allowed).');
      return;
    }
    const sortConflict = faqs.find((f) => f.sort_order === sortOrder && f.id !== faqForm.id);
    if (sortConflict) {
      superAdminToast.error(
        `Sort order ${sortOrder} is already used by "${sortConflict.question.slice(0, 80)}". Choose a different value.`
      );
      return;
    }

    setFaqSaving(true);
    try {
      const payload = {
        category_slug: faqForm.category_slug.trim() || null,
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        sort_order: sortOrder,
        is_active: faqForm.is_active,
      };
      const res = faqForm.id
        ? await superAdminApiService.patchHelpFaq(faqForm.id, payload)
        : await superAdminApiService.createHelpFaq(payload);
      if (res.status === 'SUCCESS') {
        superAdminToast.success(faqForm.id ? 'FAQ updated' : 'FAQ created');
        resetFaqForm();
        await loadAll();
      } else {
        superAdminToast.error(res.message || 'Save failed');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setFaqSaving(false);
    }
  };

  const editFaq = (f: HelpFaq) => {
    setFaqForm({
      id: f.id,
      category_slug: f.category_slug || '',
      question: f.question,
      answer: f.answer,
      sort_order: f.sort_order,
      is_active: f.is_active,
    });
    setTab('faqs');
  };

  const removeFaq = async (f: HelpFaq) => {
    if (!window.confirm(`Delete FAQ "${f.question.slice(0, 60)}…"?`)) return;
    try {
      const res = await superAdminApiService.deleteHelpFaq(f.id);
      if (res.status === 'SUCCESS') {
        superAdminToast.success('FAQ deleted');
        if (faqForm.id === f.id) resetFaqForm();
        await loadAll();
      } else {
        superAdminToast.error(res.message || 'Delete failed');
      }
    } catch (err: unknown) {
      superAdminToast.error(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  useEffect(() => {
    if (categories.length && !artForm.category_id && !artForm.id) {
      const first = categories.find((c) => c.is_active) || categories[0];
      if (first) setArtForm((f) => ({ ...f, category_id: first.id }));
    }
  }, [categories, artForm.category_id, artForm.id]);

  return (
    <div>
      <h3 className="mb-2 text-body">Help center CMS</h3>
      <p className="small text-body-secondary mb-4">
        Manage guides, topics, and FAQs shown to school headmasters on Help &amp; Support. Changes apply
        to all schools immediately.
      </p>

      <ul className="nav nav-tabs mb-4">
        {(
          [
            ['categories', 'Topics (categories)', 'ti ti-folders'],
            ['articles', 'Guide articles', 'ti ti-file-text'],
            ['faqs', 'FAQs', 'ti ti-help'],
          ] as const
        ).map(([key, label, icon]) => (
          <li className="nav-item" key={key}>
            <button
              type="button"
              className={`nav-link ${tab === key ? 'active' : ''}`}
              onClick={() => setTab(key)}
            >
              <i className={`${icon} me-1`} />
              {label}
            </button>
          </li>
        ))}
      </ul>

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" />
        </div>
      ) : (
        <>
          {tab === 'categories' && (
            <div className="row g-4">
              <div className="col-lg-4">
                <div className="card border-secondary shadow-sm">
                  <div className="card-header bg-body">
                    {catForm.id ? 'Edit topic' : 'Add topic'}
                  </div>
                  <div className="card-body">
                    <form onSubmit={saveCategory} className="vstack gap-2">
                      <div>
                        <label className="form-label small">Name *</label>
                        <input
                          className="form-control form-control-sm"
                          required
                          value={catForm.name}
                          onChange={(e) => {
                            const name = e.target.value;
                            setCatForm((f) => ({
                              ...f,
                              name,
                              slug: !f.id && !f.slug ? slugify(name) : f.slug,
                            }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="form-label small">Slug *</label>
                        <input
                          className="form-control form-control-sm font-monospace"
                          required
                          value={catForm.slug}
                          onChange={(e) => setCatForm((f) => ({ ...f, slug: e.target.value }))}
                          placeholder="getting-started"
                        />
                      </div>
                      <div>
                        <label className="form-label small">Description</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={2}
                          value={catForm.description}
                          onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label small">Sort order *</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min={HELP_SORT_ORDER_MIN}
                            step={1}
                            required
                            value={catForm.sort_order}
                            onChange={(e) =>
                              setCatForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                            }
                          />
                        </div>
                        <div className="col-6 d-flex align-items-end">
                          <div className="form-check mb-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={catForm.is_active}
                              onChange={(e) =>
                                setCatForm((f) => ({ ...f, is_active: e.target.checked }))
                              }
                              id="catActive"
                            />
                            <label className="form-check-label small" htmlFor="catActive">
                              Active
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2 pt-2">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={catSaving}>
                          {catSaving ? 'Saving…' : catForm.id ? 'Update' : 'Create'}
                        </button>
                        {catForm.id > 0 && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={resetCatForm}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="card border-0 shadow-sm">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Topic</th>
                          <th>Slug</th>
                          <th>NO. OF ARTICLES</th>
                          <th>Order</th>
                          <th>Status</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {categories.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-4">
                              No categories yet
                            </td>
                          </tr>
                        ) : (
                          categories.map((c) => (
                            <tr key={c.id}>
                              <td>{c.name}</td>
                              <td className="small font-monospace">{c.slug}</td>
                              <td>{c.article_count ?? 0}</td>
                              <td>{c.sort_order}</td>
                              <td>
                                <span
                                  className={`badge ${c.is_active ? 'bg-success-subtle text-success' : 'bg-secondary-subtle'}`}
                                >
                                  {c.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="text-end text-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary me-1"
                                  onClick={() => editCategory(c)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeCategory(c)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'articles' && (
            <div className="row g-4">
              <div className="col-lg-5">
                <div className="card border-secondary shadow-sm">
                  <div className="card-header bg-body d-flex justify-content-between align-items-center">
                    <span>{artForm.id ? 'Edit article' : 'New article'}</span>
                    {artLoading && <span className="spinner-border spinner-border-sm" />}
                  </div>
                  <div className="card-body">
                    {categories.length === 0 ? (
                      <p className="text-muted small mb-0">Create a topic (category) first.</p>
                    ) : (
                      <form onSubmit={saveArticle} className="vstack gap-2">
                        <div>
                          <label className="form-label small">Topic *</label>
                          <select
                            className="form-select form-select-sm"
                            required
                            value={artForm.category_id}
                            onChange={(e) =>
                              setArtForm((f) => ({ ...f, category_id: Number(e.target.value) }))
                            }
                          >
                            <option value={0}>Select…</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="form-label small">Title *</label>
                          <input
                            className="form-control form-control-sm"
                            required
                            value={artForm.title}
                            onChange={(e) => setArtForm((f) => ({ ...f, title: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="form-label small">Short description</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={2}
                            value={artForm.description}
                            onChange={(e) => setArtForm((f) => ({ ...f, description: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="form-label small">Content *</label>
                          <textarea
                            className="form-control form-control-sm font-monospace"
                            rows={8}
                            required
                            value={artForm.content}
                            onChange={(e) => setArtForm((f) => ({ ...f, content: e.target.value }))}
                          />
                        </div>
                        <div className="row g-2">
                          <div className="col-6">
                            <label className="form-label small">Status</label>
                            <select
                              className="form-select form-select-sm"
                              value={artForm.status}
                              onChange={(e) =>
                                setArtForm((f) => ({
                                  ...f,
                                  status: e.target.value as (typeof ARTICLE_STATUSES)[number],
                                }))
                              }
                            >
                              {ARTICLE_STATUSES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-6">
                            <label className="form-label small">Sort order *</label>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              min={HELP_SORT_ORDER_MIN}
                              step={1}
                              required
                              value={artForm.sort_order}
                              onChange={(e) =>
                                setArtForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                              }
                            />
                          </div>
                        </div>
                        <div className="d-flex gap-2 pt-2">
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm"
                            disabled={artSaving || !artForm.category_id}
                          >
                            {artSaving ? 'Saving…' : artForm.id ? 'Update' : 'Create'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={resetArtForm}
                          >
                            {artForm.id ? 'Cancel' : 'Clear'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-lg-7">
                <div className="card border-0 shadow-sm">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Topic</th>
                          <th>Sort order</th>
                          <th>Status</th>
                          <th>Updated</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {articles.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="text-center text-muted py-4">
                              No articles yet
                            </td>
                          </tr>
                        ) : (
                          articles.map((a) => (
                            <tr key={a.id}>
                              <td>{a.title}</td>
                              <td className="small">{a.category_name}</td>
                              <td className="text-center">{a.sort_order ?? 0}</td>
                              <td>
                                <span className="badge bg-light text-dark border">{a.status}</span>
                              </td>
                              <td className="small text-muted">
                                {new Date(a.updated_at).toLocaleDateString()}
                              </td>
                              <td className="text-end text-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary me-1"
                                  onClick={() => loadArticleForEdit(a.id)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeArticle(a)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'faqs' && (
            <div className="row g-4">
              <div className="col-lg-4">
                <div className="card border-secondary shadow-sm">
                  <div className="card-header bg-body">{faqForm.id ? 'Edit FAQ' : 'Add FAQ'}</div>
                  <div className="card-body">
                    <form onSubmit={saveFaq} className="vstack gap-2">
                      <div>
                        <label className="form-label small">Topic slug (optional)</label>
                        <select
                          className="form-select form-select-sm"
                          value={faqForm.category_slug}
                          onChange={(e) => setFaqForm((f) => ({ ...f, category_slug: e.target.value }))}
                        >
                          <option value="">— Any / none —</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.slug}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="form-label small">Question *</label>
                        <input
                          className="form-control form-control-sm"
                          required
                          value={faqForm.question}
                          onChange={(e) => setFaqForm((f) => ({ ...f, question: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="form-label small">Answer *</label>
                        <textarea
                          className="form-control form-control-sm"
                          rows={5}
                          required
                          value={faqForm.answer}
                          onChange={(e) => setFaqForm((f) => ({ ...f, answer: e.target.value }))}
                        />
                      </div>
                      <div className="row g-2">
                        <div className="col-6">
                          <label className="form-label small">Sort order *</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min={HELP_SORT_ORDER_MIN}
                            step={1}
                            required
                            value={faqForm.sort_order}
                            onChange={(e) =>
                              setFaqForm((f) => ({ ...f, sort_order: Number(e.target.value) }))
                            }
                          />
                        </div>
                        <div className="col-6 d-flex align-items-end">
                          <div className="form-check mb-2">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={faqForm.is_active}
                              onChange={(e) =>
                                setFaqForm((f) => ({ ...f, is_active: e.target.checked }))
                              }
                              id="faqActive"
                            />
                            <label className="form-check-label small" htmlFor="faqActive">
                              Active
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="d-flex gap-2 pt-2">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={faqSaving}>
                          {faqSaving ? 'Saving…' : faqForm.id ? 'Update' : 'Create'}
                        </button>
                        {faqForm.id > 0 && (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={resetFaqForm}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </div>
              <div className="col-lg-8">
                <div className="card border-0 shadow-sm">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 align-middle">
                      <thead>
                        <tr>
                          <th>Question</th>
                          <th>Topic</th>
                          <th>Sort order</th>
                          <th>Active</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {faqs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-muted py-4">
                              No FAQs yet
                            </td>
                          </tr>
                        ) : (
                          faqs.map((f) => (
                            <tr key={f.id}>
                              <td className="text-break">{f.question}</td>
                              <td className="small">{f.category_slug || '—'}</td>
                              <td className="text-center">{f.sort_order ?? 0}</td>
                              <td>{f.is_active ? 'Yes' : 'No'}</td>
                              <td className="text-end text-nowrap">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary me-1"
                                  onClick={() => editFaq(f)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => removeFaq(f)}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SuperAdminHelpCenter;
