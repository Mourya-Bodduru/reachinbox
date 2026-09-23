import React, { useState, useRef, useEffect } from 'react';
import { Sender } from '../types';
import { scheduleEmailsApi } from '../services/api';

interface ComposeModalProps {
  show: boolean;
  senders: Sender[];
  onClose: () => void;
  onScheduled: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  show,
  senders,
  onClose,
  onScheduled,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [selectedSender, setSelectedSender] = useState('');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [rawTextRecipients, setRawTextRecipients] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delayBetweenEmails, setDelayBetweenEmails] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (senders.length > 0 && !selectedSender) {
      const defaultSender = senders.find((s) => s.isDefault) || senders[0];
      setSelectedSender(defaultSender.email);
    }
  }, [senders, selectedSender]);

  if (!show) return null;

  // Extract valid emails from text or file
  const extractEmails = (text: string): string[] => {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const matches = text.match(emailRegex) || [];
    const unique = Array.from(new Set(matches.map((e) => e.toLowerCase().trim())));
    return unique;
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) || '';
      const parsed = extractEmails(content);
      if (parsed.length === 0) {
        setError('No valid email addresses found in the uploaded file.');
      } else {
        setError(null);
        setRecipients(parsed);
        setRawTextRecipients(parsed.join(', '));
      }
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleTextRecipientsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawTextRecipients(val);
    const parsed = extractEmails(val);
    setRecipients(parsed);
  };

  // Quick preset buttons for Start Time
  const setQuickTime = (type: 'now' | '15m' | 'tomorrow') => {
    const d = new Date();
    if (type === '15m') {
      d.setMinutes(d.getMinutes() + 15);
    } else if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
    }
    // format as YYYY-MM-DDTHH:mm
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    setStartTime(type === 'now' ? '' : localISOTime);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!subject.trim()) {
      setError('Please provide an email subject.');
      return;
    }
    if (!body.trim()) {
      setError('Please provide the email body content.');
      return;
    }
    if (recipients.length === 0) {
      setError('Please upload a CSV or specify at least one recipient email address.');
      return;
    }
    if (!selectedSender) {
      setError('Please choose a sender identity.');
      return;
    }

    try {
      setLoading(true);
      await scheduleEmailsApi({
        subject,
        body,
        recipients,
        senderEmail: selectedSender,
        scheduledAt: startTime ? new Date(startTime).toISOString() : undefined,
        delayBetweenEmails,
        hourlyLimit,
      });

      onScheduled();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to schedule emails');
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
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content">
          <div className="modal-header d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-2">
              <div
                className="rounded-circle d-flex align-items-center justify-content-center text-white"
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                }}
              >
                <i className="bi bi-send-plus-fill small"></i>
              </div>
              <h5 className="modal-title text-white fw-bold mb-0">Schedule Email Campaign</h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {error && (
                <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>{error}</span>
                </div>
              )}

              <div className="row g-3">
                {/* Sender Identity */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-secondary small fw-medium">
                    Sender Account
                  </label>
                  <select
                    className="form-select"
                    value={selectedSender}
                    onChange={(e) => setSelectedSender(e.target.value)}
                  >
                    {senders.map((s) => (
                      <option key={s.id} value={s.email}>
                        {s.name} ({s.email}) {s.isDefault ? '• Default' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Email Subject */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-secondary small fw-medium">Subject Line</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Quick question regarding your outreach pipeline"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                {/* Leads CSV / File Upload */}
                <div className="col-12">
                  <label className="form-label text-secondary small fw-medium d-flex justify-content-between">
                    <span>Leads & Recipients</span>
                    {recipients.length > 0 && (
                      <span className="text-success fw-bold">
                        ✓ {recipients.length} valid email{recipients.length > 1 ? 's' : ''} detected
                      </span>
                    )}
                  </label>

                  <div
                    className={`dropzone mb-2 ${dragActive ? 'active' : ''}`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.txt"
                      className="d-none"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileUpload(e.target.files[0]);
                        }
                      }}
                    />
                    <i className="bi bi-cloud-arrow-up fs-2 text-primary mb-1 d-block"></i>
                    <div className="fw-semibold text-white small">
                      Drop CSV or TXT file here, or <span className="text-primary text-decoration-underline">browse</span>
                    </div>
                    <div className="text-secondary small mt-1" style={{ fontSize: '0.78rem' }}>
                      Automatically parses email addresses from comma-separated or row-by-row lists
                    </div>
                  </div>

                  {/* Manual Paste / Edit Area */}
                  <textarea
                    rows={2}
                    className="form-control font-monospace small"
                    placeholder="Or paste emails directly (comma, semicolon, or newline separated)..."
                    value={rawTextRecipients}
                    onChange={handleTextRecipientsChange}
                  ></textarea>

                  {/* Preview Chips */}
                  {recipients.length > 0 && (
                    <div className="mt-2 d-flex flex-wrap gap-1 align-items-center">
                      <span className="small text-secondary me-1">Preview:</span>
                      {recipients.slice(0, 5).map((r, idx) => (
                        <span key={idx} className="lead-chip">
                          {r}
                        </span>
                      ))}
                      {recipients.length > 5 && (
                        <span className="badge bg-secondary-subtle text-secondary small">
                          +{recipients.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Email Body */}
                <div className="col-12">
                  <label className="form-label text-secondary small fw-medium">Email Content</label>
                  <textarea
                    rows={4}
                    className="form-control"
                    placeholder="Write your email body here... (e.g. Hi there, I noticed your company is scaling sales outreach...)"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                  ></textarea>
                </div>

                {/* Start Time with Quick Presets */}
                <div className="col-12 col-md-6">
                  <label className="form-label text-secondary small fw-medium d-flex justify-content-between">
                    <span>Campaign Start Time</span>
                    <span className="text-secondary small">Leave empty to send immediately</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-control mb-2"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        !startTime ? 'btn-primary-custom' : 'btn-secondary-custom'
                      } py-0 px-2 small`}
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setQuickTime('now')}
                    >
                      Now
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary-custom py-0 px-2 small"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setQuickTime('15m')}
                    >
                      +15 Mins
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary-custom py-0 px-2 small"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => setQuickTime('tomorrow')}
                    >
                      Tomorrow 9 AM
                    </button>
                  </div>
                </div>

                {/* Delay & Rate Limiting Controls */}
                <div className="col-12 col-md-6">
                  <div className="row g-2">
                    <div className="col-6">
                      <label className="form-label text-secondary small fw-medium">
                        Delay (Seconds)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="300"
                        className="form-control"
                        value={delayBetweenEmails}
                        onChange={(e) => setDelayBetweenEmails(parseInt(e.target.value) || 2)}
                      />
                      <div className="text-secondary small mt-1" style={{ fontSize: '0.72rem' }}>
                        Min 2s provider throttling
                      </div>
                    </div>
                    <div className="col-6">
                      <label className="form-label text-secondary small fw-medium">
                        Hourly Limit
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        className="form-control"
                        value={hourlyLimit}
                        onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 50)}
                      />
                      <div className="text-secondary small mt-1" style={{ fontSize: '0.72rem' }}>
                        Max emails/hour per sender
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer d-flex justify-content-between">
              <div className="text-secondary small">
                {recipients.length > 0 ? (
                  <span>
                    Queue will dispatch <strong>{recipients.length}</strong> email
                    {recipients.length > 1 ? 's' : ''} via BullMQ delayed jobs.
                  </span>
                ) : (
                  <span>Upload leads to schedule campaign</span>
                )}
              </div>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-secondary-custom"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary-custom d-flex align-items-center gap-2"
                  disabled={loading || recipients.length === 0}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status"></span>
                      <span>Enqueuing...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-calendar-check fw-bold"></i>
                      <span>Schedule Campaign</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
