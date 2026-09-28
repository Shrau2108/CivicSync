import { Link } from 'react-router-dom';
import {
  Leaf, ArrowRight, FileText, Brain, Copy, ArrowUpDown, UserCheck,
  MapPin, Route, CheckSquare, BarChart3, ShieldCheck, Bell, Star,
  Users, ClipboardList, CheckCircle2, Zap,
} from 'lucide-react';

const repairPhoto = 'https://bogota.gov.co/sites/default/files/styles/1050px/public/2024-08/umvarreglo.png';

const features = [
  { icon: <FileText className="h-5 w-5" />, title: 'Smart issue reporting', desc: 'Share what happened, add a photo, and pin the exact location.' },
  { icon: <Brain className="h-5 w-5" />, title: 'Automatic categorization', desc: 'Reports are sorted so they can reach the right local team.' },
  { icon: <Copy className="h-5 w-5" />, title: 'Duplicate detection', desc: 'Similar nearby reports are grouped to keep the response focused.' },
  { icon: <ArrowUpDown className="h-5 w-5" />, title: 'Priority scheduling', desc: 'Urgent issues rise to the top and get attention sooner.' },
  { icon: <UserCheck className="h-5 w-5" />, title: 'Volunteer matching', desc: 'Tasks are matched with nearby volunteers and useful skills.' },
  { icon: <MapPin className="h-5 w-5" />, title: 'Live map view', desc: 'See reports, assigned work, and completed fixes in one place.' },
  { icon: <Route className="h-5 w-5" />, title: 'Smart routing', desc: 'Help volunteers plan a practical route between tasks.' },
  { icon: <CheckSquare className="h-5 w-5" />, title: 'Verified repairs', desc: 'Photo evidence and supervisor review confirm completed work.' },
  { icon: <BarChart3 className="h-5 w-5" />, title: 'Community analytics', desc: 'Understand response times, resolution rates, and local trends.' },
  { icon: <ShieldCheck className="h-5 w-5" />, title: 'Role-based access', desc: 'Citizens, volunteers, and staff each get the tools they need.' },
  { icon: <Bell className="h-5 w-5" />, title: 'Status notifications', desc: 'Know when a report is reviewed, assigned, or resolved.' },
  { icon: <Star className="h-5 w-5" />, title: 'Community feedback', desc: 'Rate the resolution or reopen an issue if it returns.' },
];

const steps = [
  'Citizen reports an issue', 'Evidence and location are captured', 'Issue is categorized',
  'Duplicate reports are checked', 'Priority is calculated', 'Supervisor verifies the report',
  'Suitable volunteer is recommended', 'Task is assigned', 'Volunteer accepts the task',
  'Volunteer updates progress', 'Evidence is uploaded', 'Supervisor verifies the evidence',
  'Issue is marked resolved', 'Feedback and analytics are updated',
];

const roles = [
  { icon: <Users className="h-6 w-6" />, title: 'Citizen', desc: 'Report issues, follow progress, and share feedback.' },
  { icon: <UserCheck className="h-6 w-6" />, title: 'Volunteer', desc: 'Pick up local tasks and share proof of completed work.' },
  { icon: <ShieldCheck className="h-6 w-6" />, title: 'Supervisor', desc: 'Review reports, coordinate assignments, and verify fixes.' },
  { icon: <ClipboardList className="h-6 w-6" />, title: 'Administrator', desc: 'Manage users and monitor community-wide activity.' },
];

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#080d1c] text-white">
      <nav className="absolute inset-x-0 top-0 z-20 border-b border-white/15 bg-[#080d1c]/70 backdrop-blur-sm">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="CivicSync home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f4b43d] text-[#111827]"><Leaf className="h-6 w-6" /></span>
            <span className="text-xl font-bold tracking-tight text-white">CivicSync</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-7">
            <a href="#how-it-works" className="hidden text-sm font-medium text-white/80 transition hover:text-white sm:inline">How it works</a>
            <a href="#features" className="hidden text-sm font-medium text-white/80 transition hover:text-white sm:inline">Features</a>
            <Link to="/login" className="px-2 py-2 text-sm font-semibold text-white/90 hover:text-white">Login</Link>
            <Link to="/register" className="rounded-lg bg-[#f4b43d] px-4 py-2.5 text-sm font-bold text-[#111827] transition hover:bg-[#ffca63]">Get started</Link>
          </div>
        </div>
      </nav>

      <section className="relative flex min-h-[690px] items-center overflow-hidden bg-cover bg-center pt-24 sm:min-h-[740px]" style={{ backgroundImage: `linear-gradient(90deg, rgba(5,9,20,.95) 0%, rgba(5,9,20,.81) 39%, rgba(5,9,20,.42) 72%, rgba(5,9,20,.55) 100%), linear-gradient(0deg, #080d1c 0%, transparent 26%, rgba(4,8,18,.45) 100%), url('${repairPhoto}')` }}>
        <div className="pointer-events-none absolute -right-28 top-24 h-[430px] w-[430px] rounded-full border border-white/10 shadow-[0_0_0_55px_rgba(255,255,255,0.025),0_0_0_110px_rgba(255,255,255,0.02)]" />
        <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.03fr_.97fr]">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#f4b43d]/45 bg-[#080d1c]/55 px-4 py-2 text-xs font-bold uppercase tracking-[.14em] text-[#ffd274]"><MapPin className="h-4 w-4" /> Your city. Your voice. Real progress.</div>
            <h1 className="text-5xl font-bold leading-[1.02] tracking-[-.055em] text-white sm:text-6xl lg:text-7xl">See a problem?<br /><span className="text-[#f4b43d]">Let’s fix it.</span></h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-lg sm:leading-8">From the pothole on your street to the broken light on your way home, report it, follow the fix, and help make your neighborhood safer for everyone.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex min-h-12 items-center justify-center gap-3 rounded-lg bg-[#f4b43d] px-5 font-bold text-[#111827] shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-[#ffca63]">Report a neighborhood issue <ArrowRight className="h-4 w-4" /></Link>
              <a href="#how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/45 bg-white/5 px-5 font-semibold text-white transition hover:bg-white/10">See how it works</a>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-white/65">
              <div className="flex -space-x-2"><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#121a2b] bg-[#e7c18f] text-[9px] font-bold text-[#29212b]">AM</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#121a2b] bg-[#a8c4b5] text-[9px] font-bold text-[#29212b]">JR</span><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#121a2b] bg-[#d8bfd5] text-[9px] font-bold text-[#29212b]">SK</span></div>
              <span><strong className="block text-sm text-white">Neighbors and city crews, working together</strong>Every report moves a real repair forward.</span>
            </div>
          </div>

          <div className="relative hidden min-h-[410px] lg:block" aria-label="A pothole report progressing to a verified repair">
            <div className="absolute left-[10%] top-[20%] rounded-xl border border-white/25 bg-[#0b1222]/90 px-4 py-3 shadow-2xl backdrop-blur-sm"><p className="text-sm font-bold">Pothole reported</p><p className="mt-1 text-xs text-white/60">2nd Ave &amp; Oak St · 9:42 AM</p></div>
            <svg viewBox="0 0 500 340" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true"><path d="M70 185 C 160 185, 153 97, 245 101 S 360 107, 422 46" stroke="#f4b43d" strokeWidth="3" strokeDasharray="8 9" strokeLinecap="round" /></svg>
            <div className="absolute left-[8%] top-[48%] grid h-11 w-11 place-items-center rounded-full border-4 border-white bg-[#f4b43d] text-lg font-bold text-[#111827] shadow-[0_0_0_10px_rgba(244,180,61,.25)]">!</div>
            <div className="absolute right-[11%] top-[17%] grid h-14 w-14 place-items-center rounded-2xl bg-[#2e5aa8] shadow-xl shadow-black/30 ring-4 ring-white/20"><CheckCircle2 className="h-7 w-7 text-white" /></div>
            <div className="absolute right-[1%] top-[36%] rounded-xl border border-white/25 bg-[#0b1222]/90 px-4 py-3 text-right shadow-2xl backdrop-blur-sm"><p className="text-sm font-bold">Marked resolved</p><p className="mt-1 text-xs text-white/60">Verified by supervisor</p></div>
            <div className="absolute bottom-4 left-[8%] flex items-center gap-3 rounded-xl border border-white/20 bg-[#0b1222]/95 px-4 py-3 shadow-2xl"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#172e52] text-[#f4b43d]"><BarChart3 className="h-5 w-5" /></span><span><strong className="block text-sm">14-step workflow</strong><small className="text-xs text-white/55">From first report to verified fix</small></span></div>
            <div className="absolute right-[24%] top-[57%] rounded-full border border-white/20 bg-[#0b1222]/90 px-3 py-2 text-xs text-white/85"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#c8f36a]" />Crew on site</div>
          </div>
        </div>
        <p className="absolute bottom-3 right-5 z-10 text-[9px] text-white/65">Background photo: <a className="underline" href={repairPhoto} target="_blank" rel="noreferrer">Bogotá District</a></p>
      </section>

      <section className="border-y border-white/10 bg-[#10182b] px-5 py-8 sm:px-8"><div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 md:grid-cols-4 md:gap-4">{[['4', 'user roles'], ['37', 'pages'], ['10', 'issue categories'], ['14', 'workflow steps']].map(([value, label]) => <div key={label} className="text-center"><p className="text-3xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-white/55 sm:text-sm">{label}</p></div>)}</div></section>

      <section id="features" className="bg-[#080d1c] px-5 py-20 sm:px-8 sm:py-24"><div className="mx-auto max-w-6xl"><div className="mb-12 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#f4b43d]">One clear path to a fix</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">Everything a report needs to get resolved.</h2><p className="mt-4 leading-7 text-white/60">CivicSync keeps the full process visible, from the first photo to verified repair.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{features.map((feature) => <article key={feature.title} className="rounded-2xl border border-white/10 bg-[#10182b] p-5 transition hover:-translate-y-1 hover:border-[#f4b43d]/55"><span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[#1d3a67] text-[#f4b43d]">{feature.icon}</span><h3 className="font-semibold text-white">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-white/55">{feature.desc}</p></article>)}</div></div></section>

      <section id="how-it-works" className="bg-[#10182b] px-5 py-20 sm:px-8 sm:py-24"><div className="mx-auto max-w-5xl"><div className="mb-12 text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#f4b43d]">A transparent process</p><h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">From report to resolution.</h2><p className="mt-3 text-white/55">Every step is tracked, so no issue gets lost along the way.</p></div><div className="grid gap-3 sm:grid-cols-2">{steps.map((step, index) => <div key={step} className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#080d1c]/65 p-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#26314a] text-sm font-bold text-[#ffd274]">{String(index + 1).padStart(2, '0')}</span><span className="text-sm text-white/80">{step}</span></div>)}</div></div></section>

      <section className="bg-[#080d1c] px-5 py-20 sm:px-8 sm:py-24"><div className="mx-auto max-w-6xl"><div className="mb-10 text-center"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#f4b43d]">One shared community effort</p><h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Built for every role.</h2><p className="mt-3 text-white/55">The right tools for every person moving a fix forward.</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{roles.map((role) => <article key={role.title} className="rounded-2xl border border-white/10 bg-[#10182b] p-5 transition hover:border-[#f4b43d]/55"><span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1d3a67] text-[#ffd274]">{role.icon}</span><h3 className="font-semibold text-white">{role.title}</h3><p className="mt-2 text-sm leading-6 text-white/55">{role.desc}</p></article>)}</div></div></section>

      <section className="px-5 py-20 sm:px-8"><div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-gradient-to-br from-[#263d75] via-[#111a31] to-[#111827] px-6 py-12 text-center sm:px-12 sm:py-16"><Zap className="mx-auto h-8 w-8 text-[#f4b43d]" /><h2 className="mt-5 text-3xl font-bold text-white sm:text-4xl">Your neighborhood is worth fixing.</h2><p className="mx-auto mt-4 max-w-xl text-white/65">Join CivicSync and help turn everyday reports into visible progress.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link to="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#f4b43d] px-5 font-bold text-[#111827] hover:bg-[#ffca63]">Get started <ArrowRight className="h-4 w-4" /></Link><Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/30 px-5 font-semibold text-white hover:bg-white/10">Login</Link></div></div></section>

      <footer className="border-t border-white/10 bg-[#080d1c] px-5 py-7 sm:px-8"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row"><Link to="/" className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4b43d] text-[#111827]"><Leaf className="h-4 w-4" /></span><span className="font-semibold text-white">CivicSync</span></Link><p className="text-xs text-white/45">From community problems to verified solutions.</p><div className="flex gap-5 text-sm text-white/65"><Link to="/login" className="hover:text-white">Login</Link><Link to="/register" className="hover:text-white">Register</Link></div></div></footer>
    </main>
  );
}
