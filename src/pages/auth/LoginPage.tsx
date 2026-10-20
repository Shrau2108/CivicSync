import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Leaf, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle,
  Users, BriefcaseBusiness, ShieldCheck, Crown,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function LoginPage() {
  const { signIn, startDemoSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/app';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: authError, profile: signedProfile } = await signIn(email, password);
    setLoading(false);

    if (authError) {
      setError(authError);
    } else {
      const targetRole = signedProfile?.role || 'citizen';
      const roleRoute = `/app/${targetRole}`;
      // If from was generic /app or belongs to a different role dashboard, navigate to user's real role dashboard
      if (!from || from === '/app' || (from.startsWith('/app/') && !from.startsWith(roleRoute))) {
        navigate(roleRoute, { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  };

  const handleQuickDemo = (role: 'citizen' | 'supervisor' | 'volunteer' | 'admin') => {
    startDemoSession(role);
    navigate(`/app/${role}`, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-lg">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">CivicSync</span>
        </Link>

        {/* Login Card */}
        <div className="card p-6 sm:p-8 shadow-elevated">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to manage reports, tasks, and community issues
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Secure Sign In Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="input pl-10"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label mb-0">Password</label>
                <Link to="/reset-password" className="text-xs text-primary hover:text-primary-600 font-medium">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="input pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
            </button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-8 pt-6 border-t border-border">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Role Preview
              </span>
              <span className="text-[11px] text-muted-foreground">Test instant access</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => handleQuickDemo('citizen')}
                className="flex flex-col items-center p-2.5 rounded-xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all text-center group"
              >
                <Users className="w-4 h-4 text-primary mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-foreground">Citizen</span>
                <span className="text-[10px] text-muted-foreground">Report issues</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('volunteer')}
                className="flex flex-col items-center p-2.5 rounded-xl border border-border bg-card hover:border-blue-500 hover:bg-blue-500/5 transition-all text-center group"
              >
                <BriefcaseBusiness className="w-4 h-4 text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-foreground">Volunteer</span>
                <span className="text-[10px] text-muted-foreground">Field tasks</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('supervisor')}
                className="flex flex-col items-center p-2.5 rounded-xl border border-border bg-card hover:border-amber-500 hover:bg-amber-500/5 transition-all text-center group"
              >
                <ShieldCheck className="w-4 h-4 text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-foreground">Supervisor</span>
                <span className="text-[10px] text-muted-foreground">Verify & assign</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickDemo('admin')}
                className="flex flex-col items-center p-2.5 rounded-xl border border-border bg-card hover:border-purple-500 hover:bg-purple-500/5 transition-all text-center group"
              >
                <Crown className="w-4 h-4 text-purple-500 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-medium text-foreground">Admin</span>
                <span className="text-[10px] text-muted-foreground">Management</span>
              </button>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary hover:text-primary-600 font-semibold">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
