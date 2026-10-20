import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Leaf, Mail, Lock, Eye, EyeOff, User, Phone, ArrowRight, AlertCircle,
  CheckCircle2, Users, BriefcaseBusiness, ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';

const roles: { value: UserRole; label: string; icon: typeof Users; desc: string }[] = [
  { value: 'citizen', label: 'Citizen', icon: Users, desc: 'Report issues and track resolutions in your neighborhood' },
  { value: 'volunteer', label: 'Volunteer', icon: BriefcaseBusiness, desc: 'Take on community tasks and upload proof of fixes' },
];

export function RegisterPage() {
  const { signUp, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<UserRole>('citizen');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const passwordStrength = (pwd: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-primary-400', 'bg-primary'];
    return { score, label: labels[score], color: colors[score] };
  };

  const strength = passwordStrength(password);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    try {
      const { error: signUpError, message: infoMsg } = await signUp(email, password, fullName, role, phone);
      if (signUpError) {
        setError(signUpError);
      } else if (infoMsg) {
        setMessage(infoMsg);
      } else {
        navigate('/app', { replace: true });
      }
    } catch (caughtError) {
      setError(getSignupErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-lg">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">CivicSync</span>
        </Link>

        <div className="card p-6 sm:p-8 shadow-elevated">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Create Your Account</h1>
            <p className="text-sm text-muted-foreground mt-1">Join your community in making local improvements</p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {message ? (
            <div className="text-center py-6 animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-foreground">Registration Successful!</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                {message}
              </p>
              <div className="mt-6">
                <Link to="/login" className="btn-primary inline-flex">
                  Go to Sign In <ArrowRight className="w-4 h-4 ml-1.5" />
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    className="input pl-10"
                    placeholder="Jane Doe"
                  />
                </div>
              </div>

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
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="label">
                  Phone Number <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    className="input pl-10"
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="input pl-10 pr-10"
                    placeholder="At least 8 characters"
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
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full ${i < strength.score ? strength.color : 'bg-muted'}`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{strength.label}</p>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="input pl-10"
                    placeholder="Repeat your password"
                  />
                </div>
                {confirmPassword && password === confirmPassword && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                  </p>
                )}
              </div>

              <div>
                <label className="label">Choose Your Role</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {roles.map((r) => {
                    const Icon = r.icon;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setRole(r.value)}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                          role === r.value
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <Icon className={`w-5 h-5 mt-0.5 ${role === r.value ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div>
                          <p className={`text-sm font-semibold ${role === r.value ? 'text-primary' : 'text-foreground'}`}>
                            {r.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                  <span>Supervisor and Administrator roles are assigned by an existing admin.</span>
                </p>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? 'Creating account...' : 'Create Account'}
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:text-primary-600 font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function getSignupErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return 'Unable to create your account. Check your connection and Supabase configuration, then try again.';
}
