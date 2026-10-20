import { useState, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Leaf, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export function ResetPasswordPage() {
  const { resetPassword, updatePassword, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Recovery Mode State (when user clicks link in email)
  const [isRecoveryMode, setIsRecoveryMode] = useState(isPasswordRecovery);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.location.hash.includes('type=recovery') || isPasswordRecovery)) {
      setIsRecoveryMode(true);
    }
  }, [isPasswordRecovery]);

  const handleSendReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: resetError } = await resetPassword(email);
    setLoading(false);

    if (resetError) {
      setError(resetError);
    } else {
      setSent(true);
    }
  };

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await updatePassword(newPassword);
    setLoading(false);

    if (updateError) {
      setError(updateError);
    } else {
      setPasswordUpdated(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-md">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-foreground">CivicSync</span>
        </Link>

        <div className="card p-6 sm:p-8 shadow-elevated">
          {isRecoveryMode ? (
            /* Update New Password Form */
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold text-foreground">Set New Password</h1>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Choose a strong password for your CivicSync account.
              </p>

              {error && (
                <div className="flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {passwordUpdated ? (
                <div className="text-center py-6 animate-fade-in">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-foreground">Password Updated!</h3>
                  <p className="text-sm text-muted-foreground mt-1">Redirecting you to sign in...</p>
                </div>
              ) : (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <div>
                    <label className="label">New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="input pl-10 pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label">Confirm New Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="input pl-10"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                    {loading ? 'Updating...' : 'Update Password'}
                    {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
                  </button>
                </form>
              )}
            </div>
          ) : (
            /* Request Reset Link Form */
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Reset Password</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {error && (
                <div className="flex items-center gap-2.5 p-3.5 mb-5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {sent ? (
                <div className="flex flex-col items-center text-center py-4 animate-fade-in">
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Reset Link Sent</h3>
                  <p className="text-sm text-muted-foreground mt-2 mb-6">
                    If an account exists for <span className="font-medium text-foreground">{email}</span>, we've sent password reset instructions to your inbox.
                  </p>
                  <Link to="/login" className="btn-secondary w-full justify-center">
                    Back to Sign In
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSendReset} className="space-y-4">
                  <div>
                    <label className="label">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="input pl-10"
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                    {loading ? 'Sending link...' : 'Send Reset Link'}
                    {!loading && <ArrowRight className="w-4 h-4 ml-1.5" />}
                  </button>
                </form>
              )}

              <p className="text-center text-sm text-muted-foreground mt-6">
                Remember your password?{' '}
                <Link to="/login" className="text-primary hover:text-primary-600 font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
