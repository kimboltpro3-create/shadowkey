import { useState, useEffect } from 'react';
import { Bell, CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { Button } from '../ui/Button';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'access_request';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  onAction?: () => void;
  metadata?: Record<string, unknown>;
}

interface NotificationCenterProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearAll: () => void;
}

export function NotificationCenter({
  notifications,
  onMarkAsRead,
  onDismiss,
  onClearAll,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (unreadCount > 0 && 'Notification' in window && Notification.permission === 'granted') {
      const latest = notifications.filter((n) => !n.read)[0];
      if (latest && Date.now() - latest.timestamp.getTime() < 5000) {
        new Notification(latest.title, {
          body: latest.message,
          icon: '/favicon.ico',
          tag: latest.id,
        });
      }
    }
  }, [notifications, unreadCount]);

  function getIcon(type: Notification['type']) {
    switch (type) {
      case 'success':
        return <CheckCircle size={18} className="text-emerald-400" />;
      case 'error':
        return <XCircle size={18} className="text-rose-400" />;
      case 'warning':
      case 'access_request':
        return <AlertTriangle size={18} className="text-amber-400" />;
      default:
        return <Info size={18} className="text-cyan-400" />;
    }
  }

  function formatTimestamp(date: Date): string {
    const now = Date.now();
    const diff = now - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
      >
        <Bell size={20} className="text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-12 w-96 max-h-[32rem] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <p className="text-xs text-slate-500">{unreadCount} unread</p>
                )}
              </div>
              {notifications.length > 0 && (
                <Button size="sm" variant="outline" onClick={onClearAll}>
                  Clear All
                </Button>
              )}
            </div>

            <div className="overflow-y-auto max-h-96">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell size={32} className="text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-slate-800/40 transition-colors ${
                        !notification.read ? 'bg-cyan-500/5' : ''
                      }`}
                      onClick={() => {
                        if (!notification.read) {
                          onMarkAsRead(notification.id);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <p className="text-sm font-medium text-white">
                              {notification.title}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismiss(notification.id);
                              }}
                              className="text-slate-600 hover:text-slate-400 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-600">
                              {formatTimestamp(notification.timestamp)}
                            </span>
                            {notification.actionLabel && notification.onAction && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  notification.onAction?.();
                                  setIsOpen(false);
                                }}
                                className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                              >
                                {notification.actionLabel}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
