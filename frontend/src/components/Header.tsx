import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onOpenCompose: () => void;
  onOpenSlackModal: () => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  onOpenCompose,
  onOpenSlackModal,
  onLogout,
  onOpenLogin,
}) => {
  return (
    <header className="app-header py-3 px-4 mb-4">
      <div className="container-fluid d-flex justify-content-between align-items-center">
        {/* Brand */}
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center text-white rounded-3 shadow-sm"
            style={{
              width: '38px',
              height: '38px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            }}
          >
            <i className="bi bi-envelope-paper-fill fs-5"></i>
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold fs-5 tracking-tight text-white">ReachInbox</span>
              <span className="brand-badge">PRO</span>
            </div>
            <div className="text-secondary small" style={{ fontSize: '0.72rem' }}>
              Distributed Email Job Scheduler
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="d-flex align-items-center gap-3">
          {/* Live BullMQ Dashboard link */}
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-secondary-custom d-flex align-items-center gap-2"
            title="Open real-time BullMQ Dashboard in new tab"
          >
            <span
              className="rounded-circle bg-success d-inline-block"
              style={{ width: '8px', height: '8px' }}
            ></span>
            <i className="bi bi-speedometer2"></i>
            <span className="d-none d-md-inline">BullMQ Dashboard</span>
          </a>

          {/* Slack Integration Button */}
          <button
            onClick={onOpenSlackModal}
            className={`btn btn-sm ${
              user?.slackConnected ? 'btn-outline-success' : 'btn-secondary-custom'
            } d-flex align-items-center gap-2`}
          >
            <i className="bi bi-slack"></i>
            <span className="d-none d-md-inline">
              {user?.slackConnected
                ? `Slack: ${user.slackChannel || 'Connected'}`
                : 'Connect Slack'}
            </span>
          </button>

          {/* Primary Compose Button */}
          <button
            onClick={onOpenCompose}
            className="btn btn-sm btn-primary-custom d-flex align-items-center gap-2"
          >
            <i className="bi bi-plus-lg fw-bold"></i>
            <span>Compose Email</span>
          </button>

          {/* User Profile / Auth */}
          {user ? (
            <div className="dropdown">
              <button
                className="btn btn-sm btn-secondary-custom dropdown-toggle d-flex align-items-center gap-2 p-1 pe-2"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <img
                  src={
                    user.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      user.name || user.email
                    )}&background=6366f1&color=fff`
                  }
                  alt={user.name || user.email}
                  className="rounded-circle"
                  style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                />
                <span className="small d-none d-lg-inline text-white fw-medium">
                  {user.name || user.email.split('@')[0]}
                </span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow border-secondary-subtle">
                <li className="px-3 py-2 border-bottom border-secondary-subtle">
                  <div className="fw-semibold text-white small">{user.name || 'User'}</div>
                  <div className="text-secondary small">{user.email}</div>
                </li>
                <li>
                  <button
                    className="dropdown-item d-flex align-items-center gap-2 text-danger small py-2"
                    onClick={onLogout}
                  >
                    <i className="bi bi-box-arrow-right"></i> Logout
                  </button>
                </li>
              </ul>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="btn btn-sm btn-primary-custom d-flex align-items-center gap-1"
            >
              <i className="bi bi-google"></i>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
