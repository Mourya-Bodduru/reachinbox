import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { googleLoginApi, devLoginApi } from '../services/api';
import { User } from '../types';

interface LoginModalProps {
  show: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  show,
  onClose,
  onLoginSuccess,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!show) return null;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      setLoading(true);
      setError(null);
      if (!credentialResponse.credential) {
        throw new Error('No credential received from Google');
      }
      const data = await googleLoginApi(credentialResponse.credential);
      localStorage.setItem('reachinbox_token', data.token);
      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Google authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await devLoginApi();
      localStorage.setItem('reachinbox_token', data.token);
      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Dev login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header border-0 pb-0">
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 text-center">
            {/* Logo */}
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center text-white mb-3 shadow"
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              }}
            >
              <i className="bi bi-envelope-paper-fill fs-4"></i>
            </div>
            <h5 className="modal-title text-white fw-bold mb-1">Welcome to ReachInbox</h5>
            <p className="text-secondary small mb-4">
              Sign in to manage persistent BullMQ email campaigns and real-time queues.
            </p>

            {error && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <span className="text-start">{error}</span>
              </div>
            )}

            {/* Real Google OAuth Login */}
            <div className="d-flex justify-content-center mb-3">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google OAuth Login failed')}
                useOneTap={false}
                theme="filled_black"
                shape="pill"
              />
            </div>

            <div className="d-flex align-items-center my-3">
              <hr className="flex-grow-1 border-secondary-subtle" />
              <span className="px-2 text-secondary small" style={{ fontSize: '0.75rem' }}>
                DEMO ACCESS
              </span>
              <hr className="flex-grow-1 border-secondary-subtle" />
            </div>

            {/* One-click Dev Login */}
            <button
              onClick={handleDevLogin}
              disabled={loading}
              className="btn btn-secondary-custom w-100 py-2 d-flex align-items-center justify-content-center gap-2 small"
            >
              <i className="bi bi-person-badge-fill text-primary"></i>
              <span>Continue as Demo Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
