import { useState, useEffect, useCallback } from 'react';
import { Map, Search, MapPin, Filter, List, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/AppLayout';
import { StatusBadge, PriorityBadge } from '@/components/ui/Badge';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchReports, fetchCategories } from '@/services/api';
import { formatDate } from '@/lib/utils';
import type { Report, ReportCategory } from '@/types';

export function MapDashboardPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, c] = await Promise.all([fetchReports(), fetchCategories()]);
      setReports(r.filter(rpt => rpt.location));
      setCategories(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = reports.filter(r => {
    const matchesSearch = !search || r.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || r.priority_level === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) return <LoadingState message="Loading map data..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Community Map"
        description="View all reported issues on a geographic map"
        action={
          <div className="flex gap-2">
            <button onClick={() => setViewMode('list')} className={`btn text-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}>
              <List className="w-4 h-4" /> List
            </button>
            <button onClick={() => setViewMode('map')} className={`btn text-sm ${viewMode === 'map' ? 'btn-primary' : 'btn-secondary'}`}>
              <Map className="w-4 h-4" /> Map
            </button>
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-charcoal-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search reports..." />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-40">
          <option value="all">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="verified">Verified</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="input sm:w-40">
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {viewMode === 'map' && (
        <div className="card p-4 mb-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Map Provider Integration</p>
              <p className="text-xs text-amber-700 mt-1">
                A live map requires a map provider (e.g., Google Maps, Mapbox) with an API key.
                Currently showing coordinates in list format. To enable live maps, configure a map provider
                in Settings. Coordinates shown are from actual database entries.
              </p>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<MapPin className="w-8 h-8" />} title="No reports with location data" description="Reports with location coordinates will appear here" />
        </CardBody></Card>
      ) : viewMode === 'list' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((report) => (
            <Link key={report.id} to={`/app/reports/${report.id}`}>
              <Card hoverable className="h-full">
                <CardBody>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <StatusBadge status={report.status} />
                    <PriorityBadge level={report.priority_level} />
                  </div>
                  <p className="font-medium text-charcoal-800 truncate">{report.title}</p>
                  {report.category && <p className="text-xs text-charcoal-500 mt-1">{report.category.name}</p>}
                  {report.location && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-charcoal-400">
                      <MapPin className="w-3 h-3" />
                      {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}
                      {report.location.address && <span className="truncate">— {report.location.address}</span>}
                    </div>
                  )}
                  <p className="text-xs text-charcoal-400 mt-1">{formatDate(report.created_at)}</p>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardBody>
            <div className="space-y-2">
              {filtered.map((report) => (
                <div
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-charcoal-50 cursor-pointer border border-transparent hover:border-charcoal-200 transition-all"
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    report.priority_level === 'critical' ? 'bg-red-500' :
                    report.priority_level === 'high' ? 'bg-orange-500' :
                    report.priority_level === 'medium' ? 'bg-amber-500' :
                    'bg-primary-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-800 truncate">{report.title}</p>
                    <p className="text-xs text-charcoal-400 font-mono">
                      {report.location?.latitude.toFixed(4)}, {report.location?.longitude.toFixed(4)}
                    </p>
                  </div>
                  <StatusBadge status={report.status} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Legend */}
      <div className="card p-4 mt-4">
        <p className="text-sm font-medium text-charcoal-700 mb-2">Priority Legend</p>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-xs text-charcoal-600">Critical</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-500" /><span className="text-xs text-charcoal-600">High</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-amber-500" /><span className="text-xs text-charcoal-600">Medium</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary-500" /><span className="text-xs text-charcoal-600">Low</span></div>
        </div>
      </div>
    </div>
  );
}
