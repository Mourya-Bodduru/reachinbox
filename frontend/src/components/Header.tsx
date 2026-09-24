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
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center text-white rounded-2"
            style={{
              width: '36px',
              height: '36px',
              backgroundColor: '#4f46e5',
            }}
          >
            <i className="bi bi-envelope-fill fs-5"></i>
          </div>
          <div>
            <div className="d-flex align-items-center gap-2">
              <span className="fw-bold fs-5 tracking-tight text-dark">ReachInbox</span>
              <span className="brand-badge">Scheduler</span>
            </div>
            <div className="text-muted small" style={{ fontSize: '0.72rem' }}>
              Queue & Dispatch Engine
            </div>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-sm btn-secondary-custom d-flex align-items-center gap-2"
          >
            <span
              className="rounded-circle bg-success d-inline-block"
              style={{ width: '8px', height: '8px' }}
            ></span>
            <i className="bi bi-speedometer2"></i>
            <span className="d-none d-md-inline">BullMQ Dashboard</span>
          </a>

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

          <button
            onClick={onOpenCompose}
            className="btn btn-sm btn-primary-custom d-flex align-items-center gap-2"
          >
            <i className="bi bi-plus-lg"></i>
            <span>Compose Email</span>
          </button>

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
                    )}&background=e0e7ff&color=4338ca`
                  }
                  alt={user.name || user.email}
                  className="rounded-circle"
                  style={{ width: '28px', height: '28px', objectFit: 'cover' }}
                />
                <span className="small d-none d-lg-inline text-dark fw-medium">
                  {user.name || user.email.split('@')[0]}
                </span>
              </button>
              <ul className="dropdown-menu dropdown-menu-end shadow-sm border">
                <li className="px-3 py-2 border-bottom">
                  <div className="fw-semibold text-dark small">{user.name || 'User'}</div>
                  <div className="text-muted small">{user.email}</div>
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
              <i className="bi bi-box-arrow-in-right"></i>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
