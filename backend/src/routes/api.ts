import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as authController from '../controllers/authController';
import * as emailController from '../controllers/emailController';
import * as slackController from '../controllers/slackController';

const router = Router();

router.post('/auth/google', authController.googleLogin);
router.post('/auth/login', authController.emailLogin);
router.post('/auth/dev-login', authController.devLogin);
router.get('/auth/me', authenticate, authController.getMe);

router.post('/emails/schedule', authenticate, emailController.scheduleEmails);
router.get('/emails/scheduled', authenticate, emailController.getScheduledEmails);
router.get('/emails/sent', authenticate, emailController.getSentEmails);
router.get('/emails/stats', authenticate, emailController.getEmailStats);
router.get('/emails/senders', authenticate, emailController.getSenders);
router.delete('/emails/:id', authenticate, emailController.cancelEmail);

router.get('/slack/authorize', authenticate, slackController.getAuthorizeUrl);
router.get('/slack/callback', slackController.slackCallback);
router.post('/slack/disconnect', authenticate, slackController.disconnect);
router.post('/slack/webhook', authenticate, slackController.connectWebhookDirect);
router.post('/slack/test', authenticate, slackController.testNotification);

export default router;
