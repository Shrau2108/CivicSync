import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Map, Bell, Settings, LogOut, Menu, X,
  Home, ClipboardList, PlusCircle, ListChecks, User, Users, ShieldCheck,
  Inbox, Copy, ArrowUpDown, UserCheck, CheckSquare, BarChart3, ScrollText,
  ClipboardCheck, ChevronRight, Leaf, Moon, Sun, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { RoleBadge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

const navByRole: Record<UserRole, NavItem[]> = {
  citizen: [
    { label: 'Home', path: '/app/citizen', icon: <Home className="w-[18px] h-[18px]" /> },
    { label: 'Report Issue', path: '/app/citizen/report', icon: <PlusCircle className="w-[18px] h-[18px]" /> },
    { label: 'My Reports', path: '/app/citizen/reports', icon: <FileText className="w-[18px] h-[18px]" /> },
    { label: 'Track Reports', path: '/app/citizen/track', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { label: 'Community Map', path: '/app/map', icon: <Map className="w-[18px] h-[18px]" /> },
    { label: 'Notifications', path: '/app/notifications', icon: <Bell className="w-[18px] h-[18px]" /> },
    { label: 'Profile', path: '/app/profile', icon: <User className="w-[18px] h-[18px]" /> },
  ],
  volunteer: [
    { label: 'Overview', path: '/app/volunteer', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { label: 'Available Tasks', path: '/app/volunteer/available', icon: <ListChecks className="w-[18px] h-[18px]" /> },
    { label: 'My Tasks', path: '/app/volunteer/tasks', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { label: 'Completed Tasks', path: '/app/volunteer/completed', icon: <CheckSquare className="w-[18px] h-[18px]" /> },
    { label: 'Map', path: '/app/map', icon: <Map className="w-[18px] h-[18px]" /> },
    { label: 'Notifications', path: '/app/notifications', icon: <Bell className="w-[18px] h-[18px]" /> },
    { label: 'Profile', path: '/app/profile', icon: <User className="w-[18px] h-[18px]" /> },
  ],
  supervisor: [
    { label: 'Operations', path: '/app/supervisor', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { label: 'Incoming Reports', path: '/app/supervisor/incoming', icon: <Inbox className="w-[18px] h-[18px]" /> },
    { label: 'Priority Queue', path: '/app/supervisor/priority', icon: <ArrowUpDown className="w-[18px] h-[18px]" /> },
    { label: 'Duplicate Review', path: '/app/supervisor/duplicates', icon: <Copy className="w-[18px] h-[18px]" /> },
    { label: 'Volunteer Matching', path: '/app/supervisor/matching', icon: <UserCheck className="w-[18px] h-[18px]" /> },
    { label: 'Task Assignment', path: '/app/supervisor/assignment', icon: <ClipboardCheck className="w-[18px] h-[18px]" /> },
    { label: 'Evidence Verification', path: '/app/supervisor/verification', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
    { label: 'Analytics', path: '/app/analytics', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
    { label: 'Audit Logs', path: '/app/audit', icon: <ScrollText className="w-[18px] h-[18px]" /> },
  ],
  admin: [
    { label: 'Dashboard', path: '/app/admin', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
    { label: 'User Management', path: '/app/admin/users', icon: <Users className="w-[18px] h-[18px]" /> },
    { label: 'Reports', path: '/app/admin/reports', icon: <FileText className="w-[18px] h-[18px]" /> },
    { label: 'Volunteers', path: '/app/admin/volunteers', icon: <UserCheck className="w-[18px] h-[18px]" /> },
    { label: 'Tasks', path: '/app/admin/tasks', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
    { label: 'Verification', path: '/app/admin/verification', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
    { label: 'Analytics', path: '/app/analytics', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
    { label: 'Settings', path: '/app/settings', icon: <Settings className="w-[18px] h-[18px]" /> },
    { label: 'Audit Logs', path: '/app/audit', icon: <ScrollText className="w-[18px] h-[18px]" /> },
  ],
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const role = profile?.role || 'citizen';
  const navItems = navByRole[role] || navByRole.citizen;

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const isActive = (path: string) => {
    if (path === `/app/${role}`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside
        className={cn(
          'hidden lg:flex fixed inset-y-0 left-0 z-30 flex-col border-r border-border bg-card/95 backdrop-blur-xl transition-all duration-200',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        <div className={cn('flex items-center h-16 border-b border-border px-3', sidebarCollapsed ? 'justify-center' : 'gap-2.5 px-5')}>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-base font-bold text-foreground leading-none">CivicSync</h1>
              <p className="text-[10px] text-muted-foreground mt-0.5">Stronger Communities Together</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-2">
          <div className="space-y-1.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  'flex items-center rounded-xl text-sm font-medium transition-all duration-200',
                  sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
                  isActive(item.path)
                    ? 'bg-primary/10 text-primary shadow-sm border border-primary/10'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <span className="flex-shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span className="flex-1">{item.label}</span>}
                {!sidebarCollapsed && isActive(item.path) && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-border p-3 space-y-3">
          <div className={cn('flex items-center justify-between px-1', sidebarCollapsed && 'justify-center')}>
            {!sidebarCollapsed && <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Theme</span>}
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Toggle Theme"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {!sidebarCollapsed ? (
            <>
              <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl bg-muted/40">
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-semibold text-sm flex items-center justify-center">
                  {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || 'Demo Citizen'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{profile?.email || 'demo@civicsync.in'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Collapse
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="w-full flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className={cn(
              'w-full flex items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors',
              sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            )}
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && 'Sign Out'}
          </button>
        </div>
      </aside>

      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b border-border h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-foreground">CivicSync</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted" aria-label="Open menu">
          <Menu className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-card shadow-elevated animate-slide-in-right">
            <div className="flex items-center justify-between px-5 h-16 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-foreground">CivicSync</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-muted" aria-label="Close menu">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <nav className="py-4 px-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
              <div className="space-y-1.5">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                      isActive(item.path)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>

              <div className="border-t border-border mt-4 pt-4">
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Theme</span>
                  <button
                    type="button"
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Toggle theme"
                  >
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl bg-muted/40 mb-2">
                  <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-semibold text-sm flex items-center justify-center">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{profile?.full_name || 'Demo Citizen'}</p>
                    <RoleBadge role={role} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      <main className={cn('min-w-0 flex-1 pt-16 lg:pt-0 min-h-screen', sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64')}>
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
