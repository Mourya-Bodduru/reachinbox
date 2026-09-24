import React from 'react';
import { EmailStats } from '../types';

interface StatsCardsProps {
  stats: EmailStats | null;
  loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  return (
    <div className="row g-3 mb-4">
      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-muted small fw-medium">Scheduled</span>
            <div
              className="stat-icon"
              style={{ background: '#e0f2fe', color: '#0284c7' }}
            >
              <i className="bi bi-clock-history"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-dark mb-1">
            {loading ? '...' : stats?.scheduledCount ?? 0}
          </div>
          <div className="small text-muted d-flex align-items-center gap-1">
            <i className="bi bi-layer-forward text-info"></i>
            <span>{stats?.queue.delayed ?? 0} delayed in queue</span>
          </div>
        </div>
      </div>

      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-muted small fw-medium">Sent (SMTP)</span>
            <div
              className="stat-icon"
              style={{ background: '#dcfce7', color: '#16a34a' }}
            >
              <i className="bi bi-check2-circle"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-dark mb-1">
            {loading ? '...' : stats?.sentCount ?? 0}
          </div>
          <div className="small text-muted d-flex align-items-center gap-1">
            <i className="bi bi-shield-check text-success"></i>
            <span>Delivered via Ethereal</span>
          </div>
        </div>
      </div>

      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-muted small fw-medium">Rate Limited</span>
            <div
              className="stat-icon"
              style={{ background: '#fef3c7', color: '#d97706' }}
            >
              <i className="bi bi-shield-exclamation"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-dark mb-1">
            {loading ? '...' : stats?.rateLimitedCount ?? 0}
          </div>
          <div className="small text-muted d-flex align-items-center gap-1">
            <i className="bi bi-arrow-repeat text-warning"></i>
            <span>Moved to next hour</span>
          </div>
        </div>
      </div>

      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-muted small fw-medium">Worker Threads</span>
            <div
              className="stat-icon"
              style={{ background: '#f3e8ff', color: '#9333ea' }}
            >
              <i className="bi bi-cpu"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-dark mb-1">
            {loading ? '...' : `${stats?.queue.active ?? 0} Active`}
          </div>
          <div className="small text-muted d-flex align-items-center gap-1">
            <span
              className="rounded-circle bg-success d-inline-block"
              style={{ width: '6px', height: '6px' }}
            ></span>
            <span>Concurrency: 5 • Min delay: 2s</span>
          </div>
        </div>
      </div>
    </div>
  );
};
