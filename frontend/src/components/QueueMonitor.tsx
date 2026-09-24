import React from 'react';
import { EmailStats } from '../types';

interface QueueMonitorProps {
  stats: EmailStats | null;
  loading: boolean;
  onRefresh: () => void;
}

export const QueueMonitor: React.FC<QueueMonitorProps> = ({
  stats,
  loading,
  onRefresh,
}) => {
  return (
    <div className="card border-0 bg-transparent">
      <div className="stat-card mb-4 p-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span
                className="rounded-circle bg-success d-inline-block"
                style={{ width: '8px', height: '8px' }}
              ></span>
              <h5 className="text-dark fw-bold mb-0">BullMQ Queue Monitor</h5>
            </div>
            <p className="text-muted small mb-0">
              Redis-backed delayed job queue running with 5 concurrent workers. No cron dependencies.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button onClick={onRefresh} className="btn btn-sm btn-secondary-custom">
              <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
              Refresh
            </button>
            <a
              href={
                import.meta.env.VITE_API_URL
                  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/admin/queues`
                  : '/admin/queues'
              }
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary-custom d-flex align-items-center gap-2"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              <span>Open Dashboard</span>
            </a>
          </div>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-medium">Delayed (Scheduled)</span>
              <span className="badge bg-info-subtle text-info border border-info-subtle">Delayed</span>
            </div>
            <div className="fs-2 fw-bold text-dark mb-1">{stats?.queue.delayed ?? 0}</div>
            <div className="small text-muted">
              Future jobs stored in Redis. Fires automatically at execution time.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-medium">Active (In Flight)</span>
              <span className="badge bg-primary-subtle text-primary border border-primary-subtle">Active</span>
            </div>
            <div className="fs-2 fw-bold text-dark mb-1">{stats?.queue.active ?? 0}</div>
            <div className="small text-muted">
              Jobs currently being processed by worker threads with 2s delay.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-medium">Waiting</span>
              <span className="badge bg-light text-secondary border">Waiting</span>
            </div>
            <div className="fs-2 fw-bold text-dark mb-1">{stats?.queue.waiting ?? 0}</div>
            <div className="small text-muted">
              Jobs ready to execute awaiting next available worker.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-medium">Completed</span>
              <span className="badge bg-success-subtle text-success border border-success-subtle">Success</span>
            </div>
            <div className="fs-2 fw-bold text-dark mb-1">{stats?.queue.completed ?? 0}</div>
            <div className="small text-muted">
              Successfully delivered emails through SMTP transporter.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-medium">Failed</span>
              <span className="badge bg-danger-subtle text-danger border border-danger-subtle">Failed</span>
            </div>
            <div className="fs-2 fw-bold text-dark mb-1">{stats?.queue.failed ?? 0}</div>
            <div className="small text-muted">
              Jobs that encountered errors after 3 retry attempts.
            </div>
          </div>
        </div>
      </div>

      <div className="custom-table-container p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="fw-semibold text-dark small">
            <i className="bi bi-display me-2 text-primary"></i>Bull-Board Interface
          </div>
          <span className="text-muted small">Mounted at /admin/queues</span>
        </div>
        <div className="rounded-2 overflow-hidden border" style={{ height: '480px' }}>
          <iframe
            src="/admin/queues"
            title="BullMQ Dashboard"
            style={{ width: '100%', height: '100%', border: 'none' }}
          ></iframe>
        </div>
      </div>
    </div>
  );
};
