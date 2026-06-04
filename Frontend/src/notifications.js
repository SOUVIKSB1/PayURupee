import { store } from './store.js';

export function getNotifications() {
  if (!store.user) return [];
  const userId = store.user.id || store.user.email || 'guest';
  const key = `ewallet_notifications_${userId}`;
  try {
    return JSON.parse(localStorage.getItem(key) || '[]');
  } catch (e) {
    return [];
  }
}

export function saveNotifications(list) {
  if (!store.user) return;
  const userId = store.user.id || store.user.email || 'guest';
  const key = `ewallet_notifications_${userId}`;
  localStorage.setItem(key, JSON.stringify(list));
}

export function addNotification(message, type = 'info') {
  const list = getNotifications();
  const newNotif = {
    id: Date.now() + Math.random().toString(36).substring(2, 7),
    message,
    type,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false
  };
  list.unshift(newNotif);
  saveNotifications(list);
  
  // Update badge & dropdown if open
  updateNotificationBadge();
  renderNotificationsList();
}

export function clearNotifications() {
  saveNotifications([]);
  updateNotificationBadge();
  renderNotificationsList();
}

export function markAsRead() {
  const list = getNotifications();
  let changed = false;
  list.forEach(n => {
    if (!n.read) {
      n.read = true;
      changed = true;
    }
  });
  if (changed) {
    saveNotifications(list);
    updateNotificationBadge();
  }
}

export function updateNotificationBadge() {
  const list = getNotifications();
  const unreadCount = list.filter(n => !n.read).length;
  const badge = document.querySelector('.notification-badge');
  if (badge) {
    if (unreadCount > 0) {
      badge.style.display = 'inline-flex';
      badge.textContent = unreadCount;
    } else {
      badge.style.display = 'none';
    }
  }
}

export function renderNotificationsList() {
  const listEl = document.getElementById('notifications-list');
  if (!listEl) return;
  
  const list = getNotifications();
  if (list.length === 0) {
    listEl.innerHTML = '<div class="notification-empty">No notifications</div>';
    return;
  }
  
  listEl.innerHTML = list.map(n => `
    <div class="notification-item ${n.read ? 'read' : 'unread'}">
      <div class="notification-content">${n.message}</div>
      <span class="time">${n.timestamp}</span>
    </div>
  `).join('');
}
