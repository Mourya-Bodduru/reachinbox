import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { googleLoginApi, devLoginApi, emailLoginApi } from '../services/api';
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
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeMode, setActiveMode] = useState<'quick' | 'email'>('quick');

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
      setError(err.response?.data?.error || err.message || 'Authentication failed');
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
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await emailLoginApi(email.trim(), name.trim() || undefined);
      localStorage.setItem('reachinbox_token', data.token);
      onLoginSuccess(data.user, data.token);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '400px' }}>
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header border-0 pb-0 d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-2 d-inline-flex align-items-center justify-content-center text-white"
                style={{ width: '32px', height: '32px', backgroundColor: '#4f46e5' }}
              >
                <i className="bi bi-person-fill"></i>
              </div>
              <h5 className="modal-title text-dark fw-bold mb-0">Sign In</h5>
            </div>
            <button type="button" className="btn-close" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4">
            <p className="text-muted small mb-3">
              Choose your preferred sign-in method to access the ReachInbox dashboard.
            </p>

            {error && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="bi bi-exclamation-triangle-fill"></i>
                <span className="text-start">{error}</span>
              </div>
            )}

            <div className="btn-group w-100 mb-3" role="group">
              <button
                type="button"
                className={`btn btn-sm ${activeMode === 'quick' ? 'btn-primary-custom' : 'btn-outline-secondary'}`}
                onClick={() => setActiveMode('quick')}
              >
                Quick Demo Sign In
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeMode === 'email' ? 'btn-primary-custom' : 'btn-outline-secondary'}`}
                onClick={() => setActiveMode('email')}
              >
                Sign In with Email
              </button>
            </div>

            {activeMode === 'quick' ? (
              <div>
                <button
                  onClick={handleDevLogin}
                  disabled={loading}
                  className="btn btn-primary-custom w-100 py-2 d-flex align-items-center justify-content-center gap-2 mb-3"
                >
                  <i className="bi bi-lightning-charge-fill"></i>
                  <span className="fw-semibold">1-Click Demo Sign In</span>
                </button>
                <div className="text-muted small text-center mb-3" style={{ fontSize: '0.78rem' }}>
                  Instantly signs in as <strong>demo@reachinbox.ai</strong> with full dashboard permissions.
                </div>

                <div className="d-flex align-items-center my-3">
                  <hr className="flex-grow-1" />
                  <span className="px-2 text-muted small" style={{ fontSize: '0.75rem' }}>
                    OR GOOGLE OAUTH
                  </span>
                  <hr className="flex-grow-1" />
                </div>

                <div className="d-flex justify-content-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => setError('Google sign-in was closed or client ID is not configured.')}
                    useOneTap={false}
                    theme="outline"
                    shape="rectangular"
                  />
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit}>
                <div className="mb-2">
                  <label className="form-label text-muted small fw-medium mb-1">
                    Your Email <span className="text-danger">*</span>
                  </label>
                  <input
                    type="email"
                    className="form-control form-control-sm"
                    placeholder="e.g. alex@reachinbox.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label text-muted small fw-medium mb-1">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. Alex Johnson"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="btn btn-primary-custom w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                >
                  <i className="bi bi-box-arrow-in-right"></i>
                  <span>Sign In</span>
                </button>
              </form>
            )}
          </div>

          <div className="modal-footer bg-light py-2 px-3 border-top d-flex justify-content-end">
            <button type="button" className="btn btn-sm btn-secondary-custom" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
