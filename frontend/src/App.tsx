import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ScheduledEmailsTable } from './components/ScheduledEmailsTable';
import { SentEmailsTable } from './components/SentEmailsTable';
import { QueueMonitor } from './components/QueueMonitor';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginModal } from './components/LoginModal';
import { EmailJob, EmailStats, Sender, User } from './types';
import {
  getMeApi,
  getEmailStatsApi,
  getScheduledEmailsApi,
  getSentEmailsApi,
  getSendersApi,
} from './services/api';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<EmailStats | null>(null);
  const [senders, setSenders] = useState<Sender[]>([]);

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'queue'>('scheduled');

  const [scheduledEmails, setScheduledEmails] = useState<EmailJob[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [scheduledPage, setScheduledPage] = useState(1);
  const [scheduledTotalPages, setScheduledTotalPages] = useState(1);
  const [scheduledSearch, setScheduledSearch] = useState('');
  const [scheduledSender, setScheduledSender] = useState('');
  const [scheduledLoading, setScheduledLoading] = useState(false);

  const [sentEmails, setSentEmails] = useState<EmailJob[]>([]);
  const [sentTotal, setSentTotal] = useState(0);
  const [sentPage, setSentPage] = useState(1);
  const [sentTotalPages, setSentTotalPages] = useState(1);
  const [sentSearch, setSentSearch] = useState('');
  const [sentSender, setSentSender] = useState('');
  const [sentLoading, setSentLoading] = useState(false);

  const [showCompose, setShowCompose] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [alert, setAlert] = useState<{ type: 'success' | 'danger' | 'info'; message: string } | null>(null);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('reachinbox_token');
    if (!token) {
      setUser(null);
      return;
    }
    try {
      const res = await getMeApi();
      setUser(res.user);
    } catch {
      localStorage.removeItem('reachinbox_token');
      setUser(null);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getEmailStatsApi();
      setStats(res);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchSenders = useCallback(async () => {
    try {
      const res = await getSendersApi();
      setSenders(res.senders);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchScheduled = useCallback(async () => {
    try {
      setScheduledLoading(true);
      const res = await getScheduledEmailsApi({
        page: scheduledPage,
        limit: 15,
        q: scheduledSearch.trim() || undefined,
        senderEmail: scheduledSender || undefined,
      });
      setScheduledEmails(res.emails);
      setScheduledTotal(res.total);
      setScheduledTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setScheduledLoading(false);
    }
  }, [scheduledPage, scheduledSearch, scheduledSender]);

  const fetchSent = useCallback(async () => {
    try {
      setSentLoading(true);
      const res = await getSentEmailsApi({
        page: sentPage,
        limit: 15,
        q: sentSearch.trim() || undefined,
        senderEmail: sentSender || undefined,
      });
      setSentEmails(res.emails);
      setSentTotal(res.total);
      setSentTotalPages(res.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setSentLoading(false);
    }
  }, [sentPage, sentSearch, sentSender]);

  useEffect(() => {
    fetchUser();
    fetchStats();
    fetchSenders();

    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'connected') {
      setAlert({ type: 'success', message: 'Slack connected successfully' });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('slack_error')) {
      setAlert({ type: 'danger', message: `Slack error: ${params.get('slack_error')}` });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchUser, fetchStats, fetchSenders]);

  useEffect(() => {
    if (activeTab === 'scheduled') {
      fetchScheduled();
    } else if (activeTab === 'sent') {
      fetchSent();
    }
  }, [activeTab, fetchScheduled, fetchSent]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats();
      if (activeTab === 'scheduled') {
        fetchScheduled();
      } else if (activeTab === 'sent') {
        fetchSent();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [activeTab, fetchStats, fetchScheduled, fetchSent]);

  const handleLogout = () => {
    localStorage.removeItem('reachinbox_token');
    setUser(null);
    setAlert({ type: 'info', message: 'Logged out successfully' });
  };

  const handleCampaignScheduled = () => {
    setAlert({
      type: 'success',
      message: 'Email campaign enqueued successfully',
    });
    fetchStats();
    fetchScheduled();
  };

  return (
    <div className="min-vh-100 d-flex flex-column pb-5 bg-main">
      <Header
        user={user}
        onOpenCompose={() => setShowCompose(true)}
        onOpenSlackModal={() => setShowSlackModal(true)}
        onOpenLogin={() => setShowLoginModal(true)}
        onLogout={handleLogout}
      />

      <main className="container-fluid px-4 flex-grow-1">
        {alert && (
          <div
            className={`alert alert-${alert.type} alert-dismissible fade show d-flex align-items-center justify-content-between mb-4 shadow-sm`}
            role="alert"
          >
            <div className="d-flex align-items-center gap-2">
              <i
                className={`bi ${
                  alert.type === 'success'
                    ? 'bi-check-circle-fill'
                    : alert.type === 'danger'
                    ? 'bi-exclamation-triangle-fill'
                    : 'bi-info-circle-fill'
                }`}
              ></i>
              <span>{alert.message}</span>
            </div>
            <button
              type="button"
              className="btn-close"
              onClick={() => setAlert(null)}
              aria-label="Close"
            ></button>
          </div>
        )}

        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center gap-3 mb-4">
          <div>
            <h4 className="text-dark fw-bold mb-1">Email Scheduler Dashboard</h4>
            <p className="text-muted small mb-0">
              Reliable job scheduling engine powered by BullMQ, Redis, and MySQL.
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              onClick={() => {
                fetchStats();
                if (activeTab === 'scheduled') fetchScheduled();
                if (activeTab === 'sent') fetchSent();
              }}
              className="btn btn-sm btn-secondary-custom d-flex align-items-center gap-2"
            >
              <i className="bi bi-arrow-repeat"></i>
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowCompose(true)}
              className="btn btn-sm btn-primary-custom d-flex align-items-center gap-2"
            >
              <i className="bi bi-plus-lg"></i>
              <span>Compose Email</span>
            </button>
          </div>
        </div>

        <StatsCards stats={stats} loading={false} />

        <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
          <ul className="nav nav-pills gap-2">
            <li className="nav-item">
              <button
                className={`nav-link d-flex align-items-center gap-2 ${
                  activeTab === 'scheduled' ? 'active' : ''
                }`}
                onClick={() => setActiveTab('scheduled')}
              >
                <i className="bi bi-clock-history"></i>
                <span>Scheduled</span>
                <span className="badge bg-secondary bg-opacity-25 rounded-pill small">
                  {stats?.scheduledCount ?? 0}
                </span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link d-flex align-items-center gap-2 ${
                  activeTab === 'sent' ? 'active' : ''
                }`}
                onClick={() => setActiveTab('sent')}
              >
                <i className="bi bi-check2-circle"></i>
                <span>Sent History</span>
                <span className="badge bg-secondary bg-opacity-25 rounded-pill small">
                  {stats?.sentCount ?? 0}
                </span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link d-flex align-items-center gap-2 ${
                  activeTab === 'queue' ? 'active' : ''
                }`}
                onClick={() => setActiveTab('queue')}
              >
                <i className="bi bi-cpu"></i>
                <span>Queue Monitor</span>
              </button>
            </li>
          </ul>
        </div>

        {activeTab === 'scheduled' && (
          <ScheduledEmailsTable
            emails={scheduledEmails}
            loading={scheduledLoading}
            total={scheduledTotal}
            page={scheduledPage}
            totalPages={scheduledTotalPages}
            searchQuery={scheduledSearch}
            selectedSender={scheduledSender}
            senders={senders}
            onSearchChange={setScheduledSearch}
            onSenderChange={setScheduledSender}
            onPageChange={setScheduledPage}
            onRefresh={fetchScheduled}
          />
        )}

        {activeTab === 'sent' && (
          <SentEmailsTable
            emails={sentEmails}
            loading={sentLoading}
            total={sentTotal}
            page={sentPage}
            totalPages={sentTotalPages}
            searchQuery={sentSearch}
            selectedSender={sentSender}
            senders={senders}
            onSearchChange={setSentSearch}
            onSenderChange={setSentSender}
            onPageChange={setSentPage}
            onRefresh={fetchSent}
          />
        )}

        {activeTab === 'queue' && (
          <QueueMonitor
            stats={stats}
            loading={false}
            onRefresh={fetchStats}
          />
        )}
      </main>

      <ComposeModal
        show={showCompose}
        senders={senders}
        onClose={() => setShowCompose(false)}
        onScheduled={handleCampaignScheduled}
      />

      <SlackModal
        show={showSlackModal}
        user={user}
        onClose={() => setShowSlackModal(false)}
        onUpdated={() => {
          fetchUser();
          fetchStats();
        }}
      />

      <LoginModal
        show={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={(loggedInUser) => {
          setUser(loggedInUser);
          setAlert({ type: 'success', message: `Welcome, ${loggedInUser.name || loggedInUser.email}!` });
          fetchStats();
        }}
      />
    </div>
  );
};

export default App;
