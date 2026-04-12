/**
 * Real-time notification service using Server-Sent Events (SSE).
 * No extra dependencies — pure Node.js/Express.
 *
 * Usage:
 *   const { notify } = require('./notificationService');
 *   await notify(userId, { type, title, message, data });
 */

const Notification = require('../models/Notification');

// Map of userId (string) → Set of SSE response objects
const clients = new Map();

/**
 * Register an SSE client connection for a user.
 * Called from the /api/notifications/stream route.
 */
function addClient(userId, res) {
  const id = String(userId);
  if (!clients.has(id)) clients.set(id, new Set());
  clients.get(id).add(res);
}

/**
 * Remove an SSE client (on disconnect).
 */
function removeClient(userId, res) {
  const id = String(userId);
  const set = clients.get(id);
  if (set) {
    set.delete(res);
    if (set.size === 0) clients.delete(id);
  }
}

/**
 * Push a raw SSE event to all open connections for a user.
 */
function pushToUser(userId, payload) {
  const id = String(userId);
  const set = clients.get(id);
  if (!set || set.size === 0) return;
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try { res.write(data); } catch { /* client disconnected */ }
  }
}

/**
 * Create a Notification document and push it live to the user.
 *
 * @param {string|ObjectId} userId
 * @param {{ type, title, message, priority?, data? }} opts
 */
async function notify(userId, { type, title, message, priority = 'normal', data = {} }) {
  try {
    const doc = await Notification.create({
      user: userId,
      type,
      title,
      message,
      priority,
      data,
      channels: { inApp: true }
    });

    pushToUser(userId, {
      event: 'notification',
      notification: {
        _id: doc._id,
        type: doc.type,
        title: doc.title,
        message: doc.message,
        priority: doc.priority,
        data: doc.data,
        isRead: false,
        createdAt: doc.createdAt
      }
    });

    return doc;
  } catch (err) {
    console.error('notificationService.notify error:', err.message);
  }
}

module.exports = { addClient, removeClient, pushToUser, notify };
