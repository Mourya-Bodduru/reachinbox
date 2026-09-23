import React from 'react';
import { EmailStats } from '../types';

interface StatsCardsProps {
  stats: EmailStats | null;
  loading: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({ stats, loading }) => {
  return (
    <div className="row g-3 mb-4">
      {/* Total Scheduled */}
      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-secondary small fw-medium">Scheduled / Delayed</span>
            <div
              className="stat-icon"
              style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8' }}
            >
              <i className="bi bi-clock-history"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-white mb-1">
            {loading ? '...' : stats?.scheduledCount ?? 0}
          </div>
          <div className="small text-secondary d-flex align-items-center gap-1">
            <i className="bi bi-layer-forward text-info"></i>
            <span>{stats?.queue.delayed ?? 0} active in BullMQ delayed</span>
          </div>
        </div>
      </div>

      {/* Total Sent */}
      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-secondary small fw-medium">Delivered via SMTP</span>
            <div
              className="stat-icon"
              style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
            >
              <i className="bi bi-check2-circle"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-white mb-1">
            {loading ? '...' : stats?.sentCount ?? 0}
          </div>
          <div className="small text-secondary d-flex align-items-center gap-1">
            <i className="bi bi-shield-check text-success"></i>
            <span>Ethereal preview verified</span>
          </div>
        </div>
      </div>

      {/* Rate Limited & Rescheduled */}
      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-secondary small fw-medium">Rate-Limited & Rescheduled</span>
            <div
              className="stat-icon"
              style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}
            >
              <i className="bi bi-shield-exclamation"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-white mb-1">
            {loading ? '...' : stats?.rateLimitedCount ?? 0}
          </div>
          <div className="small text-secondary d-flex align-items-center gap-1">
            <i className="bi bi-arrow-repeat text-warning"></i>
            <span>Delayed to next hour window</span>
          </div>
        </div>
      </div>

      {/* Worker Queue Engine */}
      <div className="col-12 col-sm-6 col-lg-3">
        <div className="stat-card h-100">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="text-secondary small fw-medium">Worker Throughput</span>
            <div
              className="stat-icon"
              style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}
            >
              <i className="bi bi-cpu"></i>
            </div>
          </div>
          <div className="fs-3 fw-bold text-white mb-1">
            {loading ? '...' : `${stats?.queue.active ?? 0} Active`}
          </div>
          <div className="small text-secondary d-flex align-items-center gap-1">
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
