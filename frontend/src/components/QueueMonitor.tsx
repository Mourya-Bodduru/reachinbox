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
      {/* Header Banner */}
      <div className="stat-card mb-4 p-4">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span
                className="rounded-circle bg-success d-inline-block"
                style={{ width: '10px', height: '10px' }}
              ></span>
              <h5 className="text-white fw-bold mb-0">BullMQ Distributed Queue Architecture</h5>
            </div>
            <p className="text-secondary small mb-0">
              Persistent Redis-backed job scheduling with zero OS-level or Node cron dependencies. Survives server restarts.
            </p>
          </div>
          <div className="d-flex gap-2">
            <button onClick={onRefresh} className="btn btn-sm btn-secondary-custom">
              <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i>
              Refresh Metrics
            </button>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm btn-primary-custom d-flex align-items-center gap-2"
            >
              <i className="bi bi-box-arrow-up-right"></i>
              <span>Launch Bull-Board UI</span>
            </a>
          </div>
        </div>
      </div>

      {/* Grid of Queue State Counters */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-secondary small fw-medium">Delayed (Future Scheduled)</span>
              <span className="badge bg-info-subtle text-info">BullMQ Delayed</span>
            </div>
            <div className="fs-2 fw-bold text-white mb-1">{stats?.queue.delayed ?? 0}</div>
            <div className="small text-secondary">
              Persisted in Redis ZSET. Resumes firing accurately even if server restarts.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-secondary small fw-medium">Active (In Flight)</span>
              <span className="badge bg-primary-subtle text-primary">Concurrency: 5</span>
            </div>
            <div className="fs-2 fw-bold text-white mb-1">{stats?.queue.active ?? 0}</div>
            <div className="small text-secondary">
              Currently executing across worker threads with 2s provider throttling.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-secondary small fw-medium">Waiting (Ready to Send)</span>
              <span className="badge bg-secondary-subtle text-secondary">BullMQ Waiting</span>
            </div>
            <div className="fs-2 fw-bold text-white mb-1">{stats?.queue.waiting ?? 0}</div>
            <div className="small text-secondary">
              Eligible jobs waiting in Redis FIFO list for an available worker thread.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-secondary small fw-medium">Completed Jobs (24h)</span>
              <span className="badge bg-success-subtle text-success">Retained for Audit</span>
            </div>
            <div className="fs-2 fw-bold text-white mb-1">{stats?.queue.completed ?? 0}</div>
            <div className="small text-secondary">
              Cleanly dispatched and acknowledged jobs.
            </div>
          </div>
        </div>

        <div className="col-12 col-md-6">
          <div className="stat-card p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-secondary small fw-medium">Failed Jobs</span>
              <span className="badge bg-danger-subtle text-danger">3x Exponential Backoff</span>
            </div>
            <div className="fs-2 fw-bold text-white mb-1">{stats?.queue.failed ?? 0}</div>
            <div className="small text-secondary">
              Jobs that failed all retry attempts with error logs captured.
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Iframe Preview Option */}
      <div className="custom-table-container p-3">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="fw-semibold text-white small">
            <i className="bi bi-display me-2 text-primary"></i>Live Bull-Board Queue Dashboard
          </div>
          <span className="text-secondary small">Mounted at /admin/queues</span>
        </div>
        <div className="rounded-3 overflow-hidden" style={{ height: '480px', border: '1px solid #1e293b' }}>
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
