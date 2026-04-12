const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');
const { addClient, removeClient } = require('../services/notificationService');

/**
 * GET /api/notifications/stream
 * SSE endpoint — browser keeps this connection open to receive live pushes.
 * Auth via ?token= query param (EventSource can't set headers).
 */
router.get('/stream', async (req, res) => {
  // Authenticate via query token
  const token = req.query.token;
  if (!token) return res.status(401).end();

  let userId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch {
    return res.status(401).end();
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  // Send initial unread count
  const unread = await Notification.getUnreadCount(userId);
  res.write(`data: ${JSON.stringify({ event: 'init', unreadCount: unread })}\n\n`);

  // Keep-alive ping every 25s
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 25000);

  addClient(userId, res);

  req.on('close', () => {
    clearInterval(ping);
    removeClient(userId, res);
  });
});

// All routes below require normal JWT auth
router.use(protect);

/** GET /api/notifications — paginated list */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;
    const notifications = await Notification.getUserNotifications(req.user.id, {
      page: Number(page),
      limit: Number(limit),
      unreadOnly: unreadOnly === 'true'
    });
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    res.json({ success: true, data: { notifications, unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/notifications/:id/read — mark one as read */
router.post('/:id/read', async (req, res) => {
  try {
    const n = await Notification.findOne({ _id: req.params.id, user: req.user.id });
    if (!n) return res.status(404).json({ success: false, message: 'Not found' });
    await n.markAsRead();
    const unreadCount = await Notification.getUnreadCount(req.user.id);
    res.json({ success: true, data: { unreadCount } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/notifications/read-all — mark all as read */
router.post('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ success: true, data: { unreadCount: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
