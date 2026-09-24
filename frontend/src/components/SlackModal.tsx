import React, { useState } from 'react';
import { User } from '../types';
import {
  getSlackAuthorizeUrlApi,
  connectSlackWebhookApi,
  testSlackNotificationApi,
  disconnectSlackApi,
} from '../services/api';

interface SlackModalProps {
  show: boolean;
  user: User | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  show,
  user,
  onClose,
  onUpdated,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'danger'; text: string } | null>(null);

  if (!show) return null;

  const handleOAuthConnect = async () => {
    try {
      setLoading(true);
      setStatusMessage(null);
      const { url } = await getSlackAuthorizeUrlApi();
      window.location.href = url;
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: err.response?.data?.error || err.message || 'Failed to initialize Slack OAuth',
      });
      setLoading(false);
    }
  };

  const handleWebhookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    try {
      setLoading(true);
      setStatusMessage(null);
      await connectSlackWebhookApi(webhookUrl.trim(), channel.trim() || undefined);
      setStatusMessage({
        type: 'success',
        text: 'Slack webhook connected successfully',
      });
      onUpdated();
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: err.response?.data?.error || err.message || 'Failed to save webhook',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      setLoading(true);
      setStatusMessage(null);
      const res = await testSlackNotificationApi();
      setStatusMessage({
        type: 'success',
        text: res.message || 'Test notification delivered',
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: err.response?.data?.error || err.message || 'Failed to send test alert',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect Slack notifications?')) return;
    try {
      setLoading(true);
      setStatusMessage(null);
      await disconnectSlackApi();
      setStatusMessage({
        type: 'success',
        text: 'Slack disconnected',
      });
      onUpdated();
    } catch (err: any) {
      setStatusMessage({
        type: 'danger',
        text: err.response?.data?.error || err.message || 'Failed to disconnect',
      });
    } finally {
      setLoading(false);
    }
  };

  const isConnected = !!user?.slackConnected;

  return (
    <div
      className="modal show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}
      tabIndex={-1}
    >
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-slack fs-5 text-warning"></i>
              <h5 className="modal-title text-dark fw-bold mb-0">Slack Notifications</h5>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          <div className="modal-body p-4">
            {statusMessage && (
              <div
                className={`alert alert-${statusMessage.type} py-2 px-3 small d-flex align-items-center gap-2 mb-3`}
              >
                <i className={`bi ${statusMessage.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}></i>
                <span>{statusMessage.text}</span>
              </div>
            )}

            <div className="stat-card mb-3 p-3">
              <div className="d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2">
                  <span
                    className={`rounded-circle d-inline-block ${
                      isConnected ? 'bg-success' : 'bg-secondary'
                    }`}
                    style={{ width: '10px', height: '10px' }}
                  ></span>
                  <div>
                    <div className="fw-semibold text-dark small">
                      {isConnected ? 'Slack Connected' : 'Not Connected'}
                    </div>
                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                      {isConnected
                        ? `Channel: ${user.slackChannel || 'Default channel'}`
                        : 'Rate limit alerts are muted'}
                    </div>
                  </div>
                </div>

                {isConnected && (
                  <div className="d-flex gap-2">
                    <button
                      onClick={handleTestNotification}
                      disabled={loading}
                      className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1"
                    >
                      <i className="bi bi-send small"></i>
                      <span className="small">Test Alert</span>
                    </button>
                    <button
                      onClick={handleDisconnect}
                      disabled={loading}
                      className="btn btn-sm btn-outline-danger small"
                    >
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 rounded-2 mb-3 bg-light border">
              <div className="d-flex gap-2">
                <i className="bi bi-info-circle text-primary"></i>
                <div className="small text-muted" style={{ fontSize: '0.8rem' }}>
                  When a sender hits their configured hourly limit, excess jobs are rescheduled to the next hour window, and a Slack alert is sent immediately with details and next window time.
                </div>
              </div>
            </div>

            {!isConnected ? (
              <div>
                <div className="text-center mb-3">
                  <button
                    onClick={handleOAuthConnect}
                    disabled={loading}
                    className="btn btn-primary-custom w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                  >
                    <i className="bi bi-slack fs-5"></i>
                    <span>Connect with Slack OAuth</span>
                  </button>
                </div>

                <div className="d-flex align-items-center my-3">
                  <hr className="flex-grow-1" />
                  <span className="px-2 text-muted small" style={{ fontSize: '0.75rem' }}>
                    OR ENTER WEBHOOK
                  </span>
                  <hr className="flex-grow-1" />
                </div>

                <form onSubmit={handleWebhookSubmit}>
                  <div className="mb-2">
                    <label className="form-label text-muted small fw-medium">
                      Webhook URL
                    </label>
                    <input
                      type="url"
                      className="form-control form-control-sm"
                      placeholder="https://hooks.slack.com/services/..."
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label text-muted small fw-medium">
                      Channel Name
                    </label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="#rate-limit-alerts"
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !webhookUrl}
                    className="btn btn-sm btn-secondary-custom w-100"
                  >
                    Save Webhook
                  </button>
                </form>
              </div>
            ) : (
              <div className="text-center text-success small py-2">
                <i className="bi bi-check-circle fs-4 d-block mb-1"></i>
                Rate-limit notifications are active
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary-custom" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
