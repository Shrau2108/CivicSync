import { Link } from 'react-router-dom';
import {
  Leaf, ArrowRight, FileText, Brain, Copy, ArrowUpDown, UserCheck,
  MapPin, Route, CheckSquare, BarChart3, ShieldCheck, Bell, Star,
  Users, ClipboardList, CheckCircle2, Search, Zap,
} from 'lucide-react';

const features = [
  { icon: <FileText className="w-5 h-5" />, title: 'Smart Issue Reporting', desc: 'Multi-step forms with evidence capture, location, and category selection.' },
  { icon: <Brain className="w-5 h-5" />, title: 'AI-Ready Categorization', desc: 'Integration-ready interface for ML text and image classification.' },
  { icon: <Copy className="w-5 h-5" />, title: 'Duplicate Detection', desc: 'Text similarity, geographic proximity, and file hash comparison.' },
  { icon: <ArrowUpDown className="w-5 h-5" />, title: 'Priority-Based Scheduling', desc: 'Max-heap priority queue with configurable scoring weights.' },
  { icon: <UserCheck className="w-5 h-5" />, title: 'Skill-Based Matching', desc: 'Explainable volunteer recommendations based on skills and proximity.' },
  { icon: <MapPin className="w-5 h-5" />, title: 'Location-Based Coordination', desc: 'Map dashboard with report locations, task tracking, and filters.' },
  { icon: <Route className="w-5 h-5" />, title: 'Dijkstra-Ready Routing', desc: 'Graph-based shortest path algorithm with defined nodes and edges.' },
  { icon: <CheckSquare className="w-5 h-5" />, title: 'Before-and-After Verification', desc: 'Evidence upload, file integrity hashing, and supervisor approval.' },
  { icon: <BarChart3 className="w-5 h-5" />, title: 'Analytics', desc: 'Charts, trends, and export-ready data for decision-making.' },
  { icon: <ShieldCheck className="w-5 h-5" />, title: 'Role-Based Access', desc: 'Database-level authorization for citizens, volunteers, and staff.' },
  { icon: <Bell className="w-5 h-5" />, title: 'Notifications', desc: 'In-app notification center with category-based filtering.' },
  { icon: <Star className="w-5 h-5" />, title: 'Community Feedback', desc: 'Citizen ratings, comments, and issue reopening requests.' },
];

const steps = [
  'Citizen reports an issue',
  'Evidence and location are captured',
  'Issue is categorized',
  'Duplicate reports are checked',
  'Priority is calculated',
  'Supervisor verifies the report',
  'Suitable volunteer is recommended',
  'Task is assigned',
  'Volunteer accepts the task',
  'Volunteer updates progress',
  'Evidence is uploaded',
  'Supervisor verifies the evidence',
  'Issue is marked resolved',
  'Feedback and analytics are updated',
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-charcoal-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-charcoal-800">CivicSync</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="btn-ghost text-sm">Login</Link>
            <Link to="/register" className="btn-primary text-sm">Register</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-700 text-xs font-medium mb-6 animate-fade-in">
            <Zap className="w-3.5 h-3.5" />
            Smart Community Issue Reporting & Resolution
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold text-charcoal-800 leading-tight tracking-tight animate-slide-up">
            Turn Civic Problems Into{' '}
            <span className="text-primary-600">Verified Solutions</span>
          </h1>
          <p className="mt-6 text-base sm:text-lg text-charcoal-500 max-w-2xl mx-auto animate-slide-up">
            CivicSync connects citizens, volunteers, NGOs, and administrators to report,
            prioritize, assign, resolve, and verify community issues.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 animate-slide-up">
            <Link to="/register" className="btn-primary w-full sm:w-auto">
              Report an Issue
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how-it-works" className="btn-secondary w-full sm:w-auto">
              Explore How It Works
            </a>
            <Link to="/login" className="btn-ghost w-full sm:w-auto">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-navy-900 py-12 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { value: '4', label: 'User Roles' },
            { value: '37', label: 'Pages' },
            { value: '10', label: 'Categories' },
            { value: '14', label: 'Workflow Steps' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="text-sm text-navy-300 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-charcoal-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-charcoal-800">Platform Features</h2>
            <p className="text-charcoal-500 mt-2">Everything needed for end-to-end civic issue resolution</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="card p-5 hover:shadow-elevated transition-all duration-200 group">
                <div className="w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-charcoal-800 mb-1.5">{f.title}</h3>
                <p className="text-sm text-charcoal-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-charcoal-800">How It Works</h2>
            <p className="text-charcoal-500 mt-2">From report to resolution in 14 steps</p>
          </div>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center text-sm font-bold group-hover:scale-110 transition-transform">
                  {i + 1}
                </div>
                <div className="flex-1 card p-4 group-hover:border-primary-300 transition-colors">
                  <p className="text-sm font-medium text-charcoal-700">{step}</p>
                </div>
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute" style={{ left: '20px' }}>
                    <div className="w-px h-8 bg-charcoal-200" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section className="py-20 px-4 sm:px-6 bg-navy-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Built for Every Role</h2>
            <p className="text-navy-300 mt-2">Role-specific dashboards and permissions</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { icon: <Users className="w-6 h-6" />, title: 'Citizen', desc: 'Report issues, track status, provide feedback' },
              { icon: <UserCheck className="w-6 h-6" />, title: 'Volunteer', desc: 'Find tasks, accept assignments, upload evidence' },
              { icon: <ShieldCheck className="w-6 h-6" />, title: 'Supervisor', desc: 'Review reports, assign tasks, verify evidence' },
              { icon: <ClipboardList className="w-6 h-6" />, title: 'Administrator', desc: 'Manage users, configure system, view analytics' },
            ].map((r) => (
              <div key={r.title} className="bg-navy-800 rounded-xl p-5 border border-navy-700 hover:border-primary-500 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-primary-600 text-white flex items-center justify-center mb-4">
                  {r.icon}
                </div>
                <h3 className="font-semibold text-white mb-1">{r.title}</h3>
                <p className="text-sm text-navy-300">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-charcoal-800">Ready to Make a Difference?</h2>
          <p className="text-charcoal-500 mt-3 mb-8">
            Join CivicSync and help your community resolve issues faster.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/register" className="btn-primary w-full sm:w-auto">
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link to="/login" className="btn-secondary w-full sm:w-auto">
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-charcoal-800 text-charcoal-300 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white">CivicSync</span>
          </div>
          <p className="text-sm text-charcoal-400">
            From community problems to verified solutions.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
