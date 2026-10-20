import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Crown, BriefcaseBusiness, Users, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';

const roleIcons: Record<UserRole, typeof Users> = {
  admin: Crown,
  supervisor: ShieldCheck,
  volunteer: BriefcaseBusiness,
  citizen: Users,
};

const roleColors: Record<UserRole, { badge: string; text: string }> = {
  admin: { badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300', text: 'text-purple-600' },
  supervisor: { badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300', text: 'text-amber-600' },
  volunteer: { badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300', text: 'text-blue-600' },
  citizen: { badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300', text: 'text-emerald-600' },
};

export function RoleChangeModal() {
  const { roleChangeNotice, clearRoleChangeNotice, signOut } = useAuth();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    if (!roleChangeNotice) {
      setCountdown(4);
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate(roleChangeNotice.redirectUrl, { replace: true });
          clearRoleChangeNotice();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [roleChangeNotice, navigate, clearRoleChangeNotice]);

  if (!roleChangeNotice) return null;

  const FromIcon = roleIcons[roleChangeNotice.fromRole] || Users;
  const ToIcon = roleIcons[roleChangeNotice.toRole] || Crown;
  const toStyle = roleColors[roleChangeNotice.toRole] || roleColors.admin;

  const handleProceed = () => {
    navigate(roleChangeNotice.redirectUrl, { replace: true });
    clearRoleChangeNotice();
  };

  const handleSignOut = async () => {
    clearRoleChangeNotice();
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-elevated p-6 sm:p-7 text-center animate-scale-in">
        {/* Animated Badge */}
        <div className="relative w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5 shadow-inner">
          <ToIcon className={`w-8 h-8 ${toStyle.text} animate-bounce`} />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary" />
          </span>
        </div>

        <h3 className="text-xl font-bold text-foreground mb-2">
          Your Role Has Been Updated!
        </h3>

        <p className="text-sm text-muted-foreground mb-5">
          Your permissions were updated in the database. You are now assigned to the{' '}
          <strong className="text-foreground capitalize">{roleChangeNotice.toRole}</strong> role.
        </p>

        {/* Transition Visual */}
        <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-muted/40 border border-border mb-6 text-xs font-semibold">
          <span className="flex items-center gap-1 text-muted-foreground capitalize">
            <FromIcon className="w-3.5 h-3.5" />
            {roleChangeNotice.fromRole}
          </span>
          <ArrowRight className="w-4 h-4 text-primary" />
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border capitalize ${toStyle.badge}`}>
            <ToIcon className="w-3.5 h-3.5" />
            {roleChangeNotice.toRole}
          </span>
        </div>

        {/* Countdown Progress Bar */}
        <div className="mb-6">
          <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${((4 - countdown) / 4) * 100}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Automatically redirecting to your new dashboard in {countdown}s...
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <button
            type="button"
            onClick={handleProceed}
            className="btn-primary w-full justify-center text-sm"
          >
            <span>Go to {roleChangeNotice.toRole} Dashboard</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="btn-secondary w-full sm:w-auto justify-center text-sm text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-1" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
