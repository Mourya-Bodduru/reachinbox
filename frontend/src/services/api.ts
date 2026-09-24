import axios from 'axios';
import { EmailJob, EmailStats, SchedulePayload, Sender, User } from '../types';

const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function googleLoginApi(credential: string): Promise<{ token: string; user: User }> {
  const res = await api.post('/auth/google', { credential });
  return res.data;
}

export async function devLoginApi(): Promise<{ token: string; user: User }> {
  const res = await api.post('/auth/dev-login');
  return res.data;
}

export async function emailLoginApi(email: string, name?: string): Promise<{ token: string; user: User }> {
  const res = await api.post('/auth/login', { email, name });
  return res.data;
}

export async function getMeApi(): Promise<{ user: User }> {
  const res = await api.get('/auth/me');
  return res.data;
}

export async function scheduleEmailsApi(payload: SchedulePayload) {
  const res = await api.post('/emails/schedule', payload);
  return res.data;
}

export async function getScheduledEmailsApi(params: {
  page?: number;
  limit?: number;
  q?: string;
  senderEmail?: string;
}): Promise<{ total: number; emails: EmailJob[]; page: number; totalPages: number; source?: string }> {
  const res = await api.get('/emails/scheduled', { params });
  return res.data;
}

export async function getSentEmailsApi(params: {
  page?: number;
  limit?: number;
  q?: string;
  senderEmail?: string;
}): Promise<{ total: number; emails: EmailJob[]; page: number; totalPages: number; source?: string }> {
  const res = await api.get('/emails/sent', { params });
  return res.data;
}

export async function getEmailStatsApi(): Promise<EmailStats> {
  const res = await api.get('/emails/stats');
  return res.data;
}

export async function getSendersApi(): Promise<{ senders: Sender[] }> {
  const res = await api.get('/emails/senders');
  return res.data;
}

export async function cancelEmailApi(id: string) {
  const res = await api.delete(`/emails/${id}`);
  return res.data;
}

export async function getSlackAuthorizeUrlApi(): Promise<{ url: string }> {
  const res = await api.get('/slack/authorize');
  return res.data;
}

export async function connectSlackWebhookApi(webhookUrl: string, channel?: string) {
  const res = await api.post('/slack/webhook', { webhookUrl, channel });
  return res.data;
}

export async function testSlackNotificationApi() {
  const res = await api.post('/slack/test');
  return res.data;
}

export async function disconnectSlackApi() {
  const res = await api.post('/slack/disconnect');
  return res.data;
}

export default api;
