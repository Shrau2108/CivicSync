import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '@/services/api';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types';

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const n = await fetchNotifications(user.id);
      setNotifications(n);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    load();
  };

  const handleMarkAllRead = async () => {
    if (!user) return;
    await markAllNotificationsRead(user.id);
    load();
  };

  const filtered = notifications.filter(n => {
    const matchesSearch = !search || n.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || !n.is_read;
    return matchesSearch && matchesFilter;
  });

  if (loading) return <LoadingState message="Loading notifications..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`}
        action={unreadCount > 0 && <button onClick={handleMarkAllRead} className="btn-secondary text-sm"><CheckCheck className="w-4 h-4" /> Mark All Read</button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search notifications..." />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'unread')} className="input sm:w-40">
          <option value="all">All</option>
          <option value="unread">Unread Only</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<Bell className="w-8 h-8" />} title={notifications.length === 0 ? 'No notifications' : 'No matching notifications'} />
        </CardBody></Card>
      ) : (
        <Card>
          <div className="divide-y divide-charcoal-100">
            {filtered.map((notif) => (
              <div
                key={notif.id}
                className={`p-4 flex items-start gap-3 ${!notif.is_read ? 'bg-primary-50/30' : ''} hover:bg-charcoal-50 transition-colors cursor-pointer`}
                onClick={() => { if (!notif.is_read) handleMarkRead(notif.id); }}
              >
                {!notif.is_read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-2 flex-shrink-0" />}
                {notif.is_read && <div className="w-2 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.is_read ? 'font-medium text-charcoal-800' : 'text-charcoal-600'}`}>{notif.title}</p>
                  {notif.description && <p className="text-xs text-charcoal-500 mt-0.5">{notif.description}</p>}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-charcoal-400">{timeAgo(notif.created_at)}</span>
                    <span className="text-xs text-charcoal-400">&bull;</span>
                    <span className="text-xs text-charcoal-400 capitalize">{notif.category.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                {(notif.related_report_id || notif.related_task_id) && (
                  <Link
                    to={notif.related_report_id ? `/app/reports/${notif.related_report_id}` : `/app/tasks/${notif.related_task_id}`}
                    className="text-xs text-primary-600 hover:text-primary-700 flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    View
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
