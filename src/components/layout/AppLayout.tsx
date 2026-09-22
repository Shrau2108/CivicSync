import { type ReactNode, useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Map, Bell, Settings, LogOut, Menu, X,
  Home, ClipboardList, PlusCircle, ListChecks, User, Users, ShieldCheck,
  Inbox, Copy, ArrowUpDown, UserCheck, CheckSquare, BarChart3, ScrollText,
  UserCog, MapPin, ClipboardCheck, ChevronRight, Leaf,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
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
  const { profile, signOut, demoMode } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = profile?.role || 'citizen';
  const navItems = navByRole[role] || navByRole.citizen;

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const isActive = (path: string) => {
    if (path === `/app/${role}`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-charcoal-50 flex">
      {demoMode && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 px-3 py-1 text-center text-xs font-semibold text-amber-950">
          FRONTEND DEMO MODE - local data only
        </div>
      )}
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-charcoal-200 fixed inset-y-0 left-0 z-30">
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-charcoal-100">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <Leaf className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-charcoal-800 leading-none">CivicSync</h1>
            <p className="text-[10px] text-charcoal-400 mt-0.5">Community Platform</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3">
          <div className="space-y-0.5">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  isActive(item.path)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-charcoal-600 hover:bg-charcoal-50 hover:text-charcoal-800'
                )}
              >
                {item.icon}
                {item.label}
                {isActive(item.path) && <ChevronRight className="w-4 h-4 ml-auto" />}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-charcoal-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-charcoal-800 truncate">{profile?.full_name}</p>
              <div className="mt-0.5"><RoleBadge role={role} /></div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 mt-2 rounded-lg text-sm font-medium text-charcoal-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-charcoal-200 h-16 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-charcoal-800">CivicSync</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-charcoal-100">
          <Menu className="w-5 h-5 text-charcoal-600" />
        </button>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-fade-in">
          <div className="absolute inset-0 bg-charcoal-900/40 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white shadow-elevated animate-slide-in-right">
            <div className="flex items-center justify-between px-5 h-16 border-b border-charcoal-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                  <Leaf className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-charcoal-800">CivicSync</span>
              </div>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg hover:bg-charcoal-100">
                <X className="w-5 h-5 text-charcoal-500" />
              </button>
            </div>
            <nav className="py-4 px-3 overflow-y-auto scrollbar-thin" style={{ maxHeight: 'calc(100vh - 4rem)' }}>
              <div className="space-y-0.5">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                      isActive(item.path)
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-charcoal-600 hover:bg-charcoal-50'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </div>
              <div className="border-t border-charcoal-100 mt-4 pt-4">
                <div className="flex items-center gap-3 px-2 py-2 mb-2">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-charcoal-800">{profile?.full_name}</p>
                    <RoleBadge role={role} />
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-charcoal-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-charcoal-800">{title}</h1>
        {description && <p className="text-sm text-charcoal-500 mt-1">{description}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
}
