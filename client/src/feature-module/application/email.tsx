
import { Link } from 'react-router-dom'
import { all_routes } from '../router/all_routes'
import { useEmails } from '../../core/hooks/useEmails'
import { useState } from 'react'

const  Email = () => {
  const routes =all_routes
  const [folder, setFolder] = useState('inbox')
  const { emails, loading, error } = useEmails(folder)
  
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
  }
  
  return (
    <div className="page-wrapper">
    <div className="content">
      {/* Page Header */}
      <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
        <div className="my-auto mb-2">
          <h3 className="mb-1">Inbox</h3>
          <nav>
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <Link to={routes.adminDashboard}>Dashboard</Link>
              </li>
              <li className="breadcrumb-item">Application</li>
              <li className="breadcrumb-item active" aria-current="page">
                Inbox
              </li>
            </ol>
          </nav>
        </div>
      </div>
      {/* /Page Header */}
      <div className="row">
        {/* Inbox Menu */}
        <div className="col-lg-3 col-md-12">
          <div className="mb-4">
            <Link to="#" className="btn btn-primary w-100">
              Compose
            </Link>
          </div>
          <div className="list-group list-group-flush mb-4">
            <Link 
              to="#" 
              className={`list-group-item list-group-item-action ${folder === 'inbox' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setFolder('inbox'); }}
            >
              <i className="ti ti-download me-2" />
              Inbox ({emails.filter(e => !e.is_read).length})
            </Link>
            <Link 
              to="#" 
              className={`list-group-item list-group-item-action ${folder === 'sent' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setFolder('sent'); }}
            >
              <i className="ti ti-send me-2" />
              Sent Mail
            </Link>
            <Link 
              to="#" 
              className={`list-group-item list-group-item-action ${folder === 'drafts' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setFolder('drafts'); }}
            >
              <i className="ti ti-file-database me-2" />
              Drafts
            </Link>
            <Link 
              to="#" 
              className={`list-group-item list-group-item-action ${folder === 'trash' ? 'active' : ''}`}
              onClick={(e) => { e.preventDefault(); setFolder('trash'); }}
            >
              <i className="ti ti-trash me-2" />
              Trash
            </Link>
          </div>
        </div>
        {/* /Inbox Menu */}
        {/* Inbox */}
        <div className="col-lg-9 col-md-12">
          <div className="card">
            <div className="card-body">
              <div className="email-header">
                <div className="row">
                  <div className="col-xl-9 col-sm-12">
                    <div className="float-left">
                      <div className="btn-group me-1 mb-2">
                        <button
                          type="button"
                          className="btn btn-outline-light dropdown-toggle"
                          data-bs-toggle="dropdown"
                        >
                          Select
                        </button>
                        <div className="dropdown-menu">
                          <Link className="dropdown-item" to="#">
                            All
                          </Link>
                          <Link className="dropdown-item" to="#">
                            None
                          </Link>
                          <div className="dropdown-divider" />
                          <Link className="dropdown-item" to="#">
                            Read
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Unread
                          </Link>
                        </div>
                      </div>
                      <div className="btn-group me-1 mb-2">
                        <button
                          type="button"
                          className="btn btn-outline-light dropdown-toggle"
                          data-bs-toggle="dropdown"
                        >
                          Actions
                        </button>
                        <div className="dropdown-menu">
                          <Link className="dropdown-item" to="#">
                            Reply
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Forward
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Archive
                          </Link>
                          <div className="dropdown-divider" />
                          <Link className="dropdown-item" to="#">
                            Mark As Read
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Mark As Unread
                          </Link>
                          <div className="dropdown-divider" />
                          <Link className="dropdown-item" to="#">
                            Delete
                          </Link>
                        </div>
                      </div>
                      <div className="btn-group me-1 mb-2">
                        <button
                          type="button"
                          className="btn btn-outline-light dropdown-toggle"
                          data-bs-toggle="dropdown"
                        >
                          <i className="fas fa-folder" />
                        </button>
                        <div role="menu" className="dropdown-menu">
                          <Link className="dropdown-item" to="#">
                            Social
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Forums
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Updates
                          </Link>
                          <div className="dropdown-divider" />
                          <Link className="dropdown-item" to="#">
                            Spam
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Trash
                          </Link>
                          <div className="dropdown-divider" />
                          <Link className="dropdown-item" to="#">
                            New
                          </Link>
                        </div>
                      </div>
                      <div className="btn-group me-1 mb-2">
                        <button
                          type="button"
                          data-bs-toggle="dropdown"
                          className="btn btn-outline-light dropdown-toggle"
                        >
                          <i className="fas fa-tags" />
                        </button>
                        <div role="menu" className="dropdown-menu">
                          <Link className="dropdown-item" to="#">
                            Work
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Family
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Social
                          </Link>
                          <div className="dropdown-divider" />
                          <Link className="dropdown-item" to="#">
                            Primary
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Promotions
                          </Link>
                          <Link className="dropdown-item" to="#">
                            Forums
                          </Link>
                        </div>
                      </div>
                      <div className="btn-group mb-2">
                        <input
                          type="text"
                          placeholder="Search Messages"
                          className="form-control"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-xl-3 col-sm-12">
                    <div className="text-xl-end ">
                      <button
                        type="button"
                        title="Refresh"
                        data-toggle="tooltip"
                        className="btn btn-outline-light d-none d-md-inline-block me-1  mb-2"
                      >
                        <i className="fas fa-sync-alt" />
                      </button>
                      <div className="btn-group  mb-2">
                        <Link to='' className="btn btn-white">
                          <i className="fas fa-angle-left" />
                        </Link>
                        <Link to="" className="btn btn-white">
                          <i className="fas fa-angle-right" />
                        </Link>
                      </div>
                      <span className="text-muted d-none d-md-inline-block mb-2">
                        Showing {emails.length} of {emails.length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="email-content">
                <div className="table-responsive">
                  <table className="table table-inbox table-hover">
                    <thead>
                      <tr>
                        <th colSpan={6}>
                          <div className="form-check form-check-md">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="select-all"
                            />
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="text-center p-4">
                            Loading...
                          </td>
                        </tr>
                      ) : error ? (
                        <tr>
                          <td colSpan={6} className="text-center p-4 text-danger">
                            Error: {error}
                          </td>
                        </tr>
                      ) : emails.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center p-4 text-muted">
                            No emails found
                          </td>
                        </tr>
                      ) : (
                        emails.map((email: any) => (
                          <tr key={email.id} className={`clickable-row ${!email.is_read ? 'fw-semibold' : ''}`}>
                            <td>
                              <div className="form-check form-check-md">
                                <input className="form-check-input" type="checkbox" />
                              </div>
                            </td>
                            <td>
                              <span className="mail-important">
                                <i className={`fas fa-star ${email.is_starred ? 'starred' : ''}`} />
                              </span>
                            </td>
                            <td className={email.is_read ? '' : 'text-dark fw-semibold'}>
                              {email.sender_username || email.sender_email || 'Unknown'}
                            </td>
                            <td className={email.is_read ? '' : 'text-dark fw-semibold'}>
                              {email.subject}
                            </td>
                            <td>
                              {email.has_attachment && <i className="fas fa-paperclip" />}
                            </td>
                            <td className={email.is_read ? '' : 'text-dark fw-semibold'}>
                              {formatDate(email.sent_at)}
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
        </div>
        {/* /Inbox */}
      </div>
    </div>
  </div>
  

  )
}

export default Email
