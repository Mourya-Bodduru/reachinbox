import React, { useState } from 'react';
import { EmailJob, Sender } from '../types';
import { cancelEmailApi } from '../services/api';
import { format } from 'date-fns';

interface ScheduledEmailsTableProps {
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

export const ScheduledEmailsTable: React.FC<ScheduledEmailsTableProps> = ({
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
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!window.confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      setCancellingId(id);
      await cancelEmailApi(id);
      onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.error || err.message || 'Failed to cancel email');
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <span className="badge-status badge-scheduled">
            <i className="bi bi-clock"></i> Scheduled
          </span>
        );
      case 'RATE_LIMITED_RESCHEDULED':
        return (
          <span className="badge-status badge-rescheduled" title="Hourly limit exceeded; rescheduled into next hour window">
            <i className="bi bi-hourglass-split"></i> Rescheduled (Rate Limit)
          </span>
        );
      case 'QUEUED':
        return (
          <span className="badge-status badge-scheduled">
            <i className="bi bi-stack"></i> Queued
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="badge-status badge-cancelled">
            <i className="bi bi-x-circle"></i> Cancelled
          </span>
        );
      default:
        return <span className="badge-status badge-scheduled">{status}</span>;
    }
  };

  return (
    <div className="card border-0 bg-transparent">
      {/* Controls Bar: Search & Filter */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '420px' }}>
          <div className="input-group">
            <span className="input-group-text bg-dark border-secondary-subtle text-secondary">
              <i className="bi bi-search"></i>
            </span>
            <input
              type="text"
              className="form-control"
              placeholder="Search by recipient, subject, or content (Elasticsearch)..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Sender Filter */}
          <select
            className="form-select form-select-sm"
            style={{ width: 'auto' }}
            value={selectedSender}
            onChange={(e) => onSenderChange(e.target.value)}
          >
            <option value="">All Sender Identities</option>
            {senders.map((s) => (
              <option key={s.id} value={s.email}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            className="btn btn-sm btn-secondary-custom d-flex align-items-center gap-1"
            title="Refresh Table"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
            <span className="d-none d-sm-inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="custom-table-container shadow-sm">
        <div className="table-responsive">
          <table className="table custom-table align-middle">
            <thead>
              <tr>
                <th>Recipient Lead</th>
                <th>Subject Line</th>
                <th>Sender Identity</th>
                <th>Scheduled Delivery</th>
                <th>Throttling</th>
                <th>Status</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && emails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="spinner-border text-primary spinner-border-sm me-2" role="status"></div>
                    <span className="text-secondary small">Searching & querying queue index...</span>
                  </td>
                </tr>
              ) : emails.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-5">
                    <div className="text-secondary mb-2">
                      <i className="bi bi-calendar2-x fs-1 d-block opacity-50 mb-2"></i>
                      <span className="fw-semibold">No scheduled emails found</span>
                    </div>
                    <div className="small text-secondary">
                      {searchQuery
                        ? 'No emails match your Elasticsearch search query. Try clearing the search.'
                        : 'Click "Compose Email" above to schedule your first cold email sequence.'}
                    </div>
                  </td>
                </tr>
              ) : (
                emails.map((job) => {
                  let formattedDate = job.scheduledAt;
                  try {
                    formattedDate = format(new Date(job.scheduledAt), 'MMM dd, yyyy • hh:mm:ss a');
                  } catch {}

                  return (
                    <tr key={job.id}>
                      <td>
                        <div className="d-flex align-items-center gap-2">
                          <i className="bi bi-envelope text-primary small"></i>
                          <span className="fw-semibold text-white">{job.recipientEmail}</span>
                        </div>
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '280px' }} title={job.subject}>
                          {job.subject}
                        </div>
                      </td>
                      <td>
                        <span className="badge bg-secondary-subtle text-secondary small font-monospace">
                          {job.senderEmail}
                        </span>
                      </td>
                      <td>
                        <div className="small text-white">
                          <i className="bi bi-calendar3 text-secondary me-1"></i>
                          {formattedDate}
                        </div>
                      </td>
                      <td>
                        <span className="small text-secondary">
                          {job.delaySeconds}s delay • {job.hourlyLimit}/hr
                        </span>
                      </td>
                      <td>{getStatusBadge(job.status)}</td>
                      <td className="text-end">
                        <button
                          onClick={() => handleCancel(job.id)}
                          disabled={cancellingId === job.id}
                          className="btn btn-sm btn-outline-danger py-1 px-2 small"
                          title="Cancel scheduled delivery"
                        >
                          {cancellingId === job.id ? (
                            <span className="spinner-border spinner-border-sm" role="status"></span>
                          ) : (
                            <i className="bi bi-x-lg"></i>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Count Footer */}
        <div className="d-flex justify-content-between align-items-center px-4 py-3 border-top border-secondary-subtle bg-dark-subtle">
          <div className="small text-secondary">
            Showing <strong>{emails.length}</strong> of <strong>{total}</strong> scheduled emails
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
              <span className="btn btn-sm btn-outline-secondary disabled border-0 text-white">
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
    </div>
  );
};
