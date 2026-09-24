import React, { useState } from 'react';
import { EmailJob, Sender } from '../types';
import { format } from 'date-fns';

interface SentEmailsTableProps {
  emails: EmailJob[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  searchQuery: string;
  selectedSender: string;
  senders: Sender[];
  onSearchChange: (q: string) => void;
  onSenderChange: (s: string) => void;
  onPageChange: (p: number) => void;
  onRefresh: () => void;
}

export const SentEmailsTable: React.FC<SentEmailsTableProps> = ({
  emails,
  loading,
  total,
  page,
  totalPages,
  searchQuery,
  selectedSender,
  senders,
  onSearchChange,
  onSenderChange,
  onPageChange,
  onRefresh,
}) => {
  const [viewingEmail, setViewingEmail] = useState<EmailJob | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="badge-status badge-sent">
            <i className="bi bi-check-circle-fill"></i> Sent
          </span>
        );
      case 'FAILED':
        return (
          <span className="badge-status badge-failed">
            <i className="bi bi-x-circle-fill"></i> Failed
          </span>
        );
      default:
        return <span className="badge-status badge-scheduled">{status}</span>;
    }
  };

  return (
    <div className="card border-0 bg-transparent">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '380px' }}>
          <div className="input-group">
            <span className="input-group-text bg-white border-end-0 text-muted">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control border-start-0 ps-0"
              placeholder="Search sent emails..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={selectedSender}
            onChange={(e) => onSenderChange(e.target.value)}
          >
            <option value="">All Senders</option>
            {senders.map((s) => (
              <option key={s.id} value={s.email}>
                {s.name}
              </option>
            ))}
          </select>

          <button
            onClick={onRefresh}
            className="btn btn-sm btn-secondary-custom d-flex align-items-center gap-1"
            title="Refresh"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
            <span className="d-none d-sm-inline">Refresh</span>
          </button>
        </div>
      </div>

      <div className="custom-table-container">
        <div className="table-responsive">
          <table className="table custom-table align-middle">
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Subject</th>
                <th>Sender</th>
                <th>Dispatched At</th>
                <th>Status</th>
                <th className="text-end">Preview</th>
              </tr>
            </thead>
            <tbody>
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                    <span className="text-muted small">Loading sent history...</span>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-5">
                    <div className="text-muted mb-1">
                      <i className="bi bi-inbox fs-2 d-block opacity-50 mb-2"></i>
                      <span className="fw-semibold">No sent emails yet</span>
                    </div>
                    <div className="small text-muted">
                      Processed jobs sent via Ethereal SMTP will be listed here.
                    </div>
                  </td>
                </tr>
              ) : (
                emails.map((job) => {
                  let formattedDate = job.sentAt || job.updatedAt;
                  try {
                    formattedDate = format(new Date(formattedDate), 'MMM dd, yyyy • hh:mm:ss a');
                  } catch {}

                  return (
                    <tr key={job.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-check-circle text-success small"></i>
                          <span className="fw-medium text-dark">{job.recipientEmail}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-truncate text-dark" style={{ maxWidth: '280px' }} title={job.subject}>
                          {job.subject}
                        </div>
                        {job.errorMessage && (
                          <div className="text-danger small mt-1" style={{ fontSize: '0.75rem' }}>
                            {job.errorMessage}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-light text-secondary border small font-monospace">
                          {job.senderEmail}
                        </span>
                      </td>
                      <td>
                        <div className="small text-muted">
                          {formattedDate}
                        </div>
                      </td>
                      <td>{getStatusBadge(job.status)}</td>
                      <td className="text-end">
                        <button
                          onClick={() => setViewingEmail(job)}
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 py-1 px-2"
                        >
                          <i className="bi bi-envelope-open"></i>
                          <span className="small">View Email</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top bg-light">
          <div className="small text-muted">
            Showing <strong>{emails.length}</strong> of <strong>{total}</strong> emails
          </div>
          {totalPages > 1 && (
            <div className="d-flex gap-1">
              <button
                className="btn btn-sm btn-secondary-custom"
                disabled={page <= 1 || loading}
                onClick={() => onPageChange(page - 1)}
              >
                Previous
              </button>
              <span className="btn btn-sm btn-light disabled border text-dark">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-sm btn-secondary-custom"
                disabled={page >= totalPages || loading}
                onClick={() => onPageChange(page + 1)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {viewingEmail && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
          tabIndex={-1}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header border-bottom d-flex justify-content-between align-items-center px-4 py-3">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-envelope-paper-fill fs-5 text-primary"></i>
                  <h5 className="modal-title text-dark fw-bold mb-0">Email Details</h5>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setViewingEmail(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="bg-light p-3 rounded-3 mb-3 border">
                  <div className="row g-2 small">
                    <div className="col-12 col-md-7">
                      <span className="text-muted fw-semibold">Subject:</span>
                      <span className="text-dark fw-bold ms-2">{viewingEmail.subject}</span>
                    </div>
                    <div className="col-12 col-md-5 text-md-end">
                      <span className="text-muted fw-semibold">Time:</span>
                      <span className="text-dark ms-2">
                        {viewingEmail.sentAt ? new Date(viewingEmail.sentAt).toLocaleString() : 'Recently'}
                      </span>
                    </div>
                    <div className="col-12 col-md-7">
                      <span className="text-muted fw-semibold">From:</span>
                      <span className="text-dark ms-2 font-monospace">{viewingEmail.senderEmail}</span>
                    </div>
                    <div className="col-12 col-md-5 text-md-end">
                      <span className="text-muted fw-semibold">To:</span>
                      <span className="text-dark ms-2 font-monospace">{viewingEmail.recipientEmail}</span>
                    </div>
                    <div className="col-12">
                      <span className="text-muted fw-semibold">Message-ID:</span>
                      <span className="text-muted font-monospace ms-2" style={{ fontSize: '0.78rem' }}>
                        &lt;email_{viewingEmail.id}@reachinbox.ai&gt;
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <span className="form-label text-muted small fw-medium">Message Body:</span>
                </div>
                <div
                  className="p-3 rounded-2 border bg-white text-dark"
                  style={{ minHeight: '120px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}
                >
                  {viewingEmail.body}
                </div>

                {viewingEmail.etherealPreviewUrl && (
                  <div className="mt-3 p-3 bg-light rounded-2 border d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-2">
                    <div className="small text-muted">
                      <i className="bi bi-info-circle me-1 text-primary"></i>
                      <span>Ethereal Mailbox Login: <code>a4ct2pxwmslx2pyy@ethereal.email</code> / <code>ku6W3VZdSEmwJRYFZn</code></span>
                    </div>
                    <a
                      href={viewingEmail.etherealPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1 flex-shrink-0"
                    >
                      <i className="bi bi-box-arrow-up-right"></i>
                      <span>Open in Ethereal</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="modal-footer px-4 py-3 bg-light border-top">
                <button
                  type="button"
                  className="btn btn-secondary-custom"
                  onClick={() => setViewingEmail(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
