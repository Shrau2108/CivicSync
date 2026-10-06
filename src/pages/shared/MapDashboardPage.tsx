import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Filter,
  Layers3,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Minus,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchCategories, fetchReports } from '@/services/api';
import { formatDate } from '@/lib/utils';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/States';
import type { Report, ReportCategory } from '@/types';

type ViewMode = 'map' | 'list';
type MapType = 'roadmap' | 'satellite';
type IssueScope = 'all' | 'mine';

const DEFAULT_CENTER = { lat: 17.385, lng: 78.4867 };
const DEFAULT_CLUSTER_SIZE = 0.02;

function getPriorityColor(priority: string | null | undefined) {
  switch (priority) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'medium': return '#eab308';
    case 'low':
    default: return '#38bdf8';
  }
}

function getStatusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function MapDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [categories, setCategories] = useState<ReportCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [issueScope, setIssueScope] = useState<IssueScope>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [draftStatus, setDraftStatus] = useState(statusFilter);
  const [draftPriority, setDraftPriority] = useState(priorityFilter);
  const [mapType, setMapType] = useState<MapType>('roadmap');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMapError(null);
    try {
      const [reportList, categoryList] = await Promise.all([fetchReports(), fetchCategories()]);
      setReports(reportList.filter((report) => Boolean(report.location)));
      setCategories(categoryList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setMapLoaded(false);
      setMapReady(false);
      return;
    }

    const scriptId = 'civicsync-google-maps-script';
    const script = document.getElementById(scriptId) as HTMLScriptElement | null;

    if ((window as any).google && (window as any).google.maps) {
      setMapLoaded(true);
      setMapReady(true);
      return;
    }

    if (script) {
      script.addEventListener('load', () => {
        setMapLoaded(true);
        setMapReady(true);
      });
      script.addEventListener('error', () => {
        setMapError('Google Maps failed to load. Check the API configuration.');
      });
      return;
    }

    const newScript = document.createElement('script');
    newScript.id = scriptId;
    newScript.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker&v=weekly`;
    newScript.async = true;
    newScript.onload = () => {
      setMapLoaded(true);
      setMapReady(true);
    };
    newScript.onerror = () => {
      setMapError('Google Maps failed to load. Check the API configuration.');
    };
    document.body.appendChild(newScript);

    return undefined;
  }, [apiKey]);

  const categoryChips = useMemo(() => {
    const base = ['All Issues', ...categories.slice(0, 6).map((category) => category.name)];
    return Array.from(new Set(base));
  }, [categories]);

  const scopedReports = useMemo(() => {
    if (issueScope === 'mine' && user?.id) {
      return reports.filter((report) => report.reporter_id === user.id);
    }
    return reports;
  }, [issueScope, reports, user?.id]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();

    return scopedReports.filter((report) => {
      const locationText = [
        report.location?.address,
        report.location?.city,
        report.location?.area,
        report.category?.name,
        report.title,
        report.report_id,
      ].filter(Boolean).join(' ').toLowerCase();

      const matchesSearch = !query || locationText.includes(query);
      const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || report.priority_level === priorityFilter;
      const matchesCategory = categoryFilter === 'all' || report.category?.name === categoryFilter || report.category?.slug === categoryFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
    });
  }, [categoryFilter, priorityFilter, scopedReports, search, statusFilter]);

  useEffect(() => {
    if (filteredReports.length > 0 && !selectedReport) {
      setSelectedReport(filteredReports[0]);
    }
    if (selectedReport && !filteredReports.some((report) => report.id === selectedReport.id)) {
      setSelectedReport(filteredReports[0] ?? null);
    }
  }, [filteredReports, selectedReport]);

  useEffect(() => {
    const googleMaps = (window as any).google;
    if (!mapReady || !apiKey || !mapContainerRef.current || !googleMaps) return;

    if (!mapInstanceRef.current) {
      const map = new googleMaps.maps.Map(mapContainerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 11,
        mapTypeId: mapType,
        disableDefaultUI: true,
        zoomControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        mapTypeControl: false,
        gestureHandling: 'greedy',
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#111827' }] },
          { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
          { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a', lightness: 0 }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
        ],
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    map.setMapTypeId(mapType);

    const allMarkers = markersRef.current;
    allMarkers.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!filteredReports.length) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(11);
      return;
    }

    const groups = new globalThis.Map<string, { lat: number; lng: number; reports: Report[] }>();

    filteredReports.forEach((report) => {
      const { latitude, longitude } = report.location!;
      const bucketLat = Math.round(latitude / DEFAULT_CLUSTER_SIZE);
      const bucketLng = Math.round(longitude / DEFAULT_CLUSTER_SIZE);
      const key = `${bucketLat}:${bucketLng}`;

      if (!groups.has(key)) {
        groups.set(key, { lat: 0, lng: 0, reports: [] });
      }

      const group = groups.get(key)!;
      group.lat += latitude;
      group.lng += longitude;
      group.reports.push(report);
    });

    const clusterGroups = Array.from(groups.values()).map((group: { lat: number; lng: number; reports: Report[] }) => ({
      lat: group.lat / group.reports.length,
      lng: group.lng / group.reports.length,
      reports: group.reports,
    }));

    const bounds = new (window as any).google.maps.LatLngBounds();

    clusterGroups.forEach((group) => {
      const center = { lat: group.lat, lng: group.lng };
      const report = group.reports[0];
      const clusterCount = group.reports.length;
      const color = getPriorityColor(group.reports.some((item: Report) => item.priority_level === 'critical') ? 'critical' : group.reports.some((item: Report) => item.priority_level === 'high') ? 'high' : group.reports.some((item: Report) => item.priority_level === 'medium') ? 'medium' : 'low');
      const marker = new (window as any).google.maps.Marker({
        position: center,
        map,
        title: clusterCount > 1 ? `${clusterCount} reports near this location` : report.title,
        icon: {
          path: clusterCount > 1 ? (window as any).google.maps.SymbolPath.CIRCLE : (window as any).google.maps.SymbolPath.CIRCLE,
          scale: clusterCount > 1 ? 14 : 11,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        label: clusterCount > 1 ? { text: String(clusterCount), color: '#ffffff', fontSize: '10px', fontWeight: '700' } : undefined,
        zIndex: clusterCount > 1 ? 50 : 100,
      });

      marker.addListener('click', () => {
        if (clusterCount === 1) {
          setSelectedReport(report);
          map.panTo(center);
          return;
        }

        const newBounds = new (window as any).google.maps.LatLngBounds();
        group.reports.forEach((item: Report) => {
          if (item.location) {
            newBounds.extend({ lat: item.location.latitude, lng: item.location.longitude });
          }
        });
        map.fitBounds(newBounds);
      });

      markersRef.current.push(marker);
      bounds.extend(center);
    });

    if (selectedReport && filteredReports.some((report) => report.id === selectedReport.id)) {
      const selected = filteredReports.find((report) => report.id === selectedReport.id)!;
      const target = { lat: selected.location!.latitude, lng: selected.location!.longitude };
      map.panTo(target);
      map.setZoom(12);
    } else if (filteredReports.length > 0) {
      const firstReport = filteredReports[0];
      if (firstReport.location) {
        map.setCenter({ lat: firstReport.location.latitude, lng: firstReport.location.longitude });
        map.setZoom(11);
      }
    }

    if (clusterGroups.length > 1) {
      map.fitBounds(bounds);
    }
  }, [apiKey, filteredReports, mapReady, mapType, selectedReport]);

  const applyFilters = () => {
    setStatusFilter(draftStatus);
    setPriorityFilter(draftPriority);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setPriorityFilter('all');
    setDraftStatus('all');
    setDraftPriority('all');
    setCategoryFilter('all');
    setSearch('');
    setShowFilters(false);
  };

  if (loading) return <LoadingState message="Loading nearby reports..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-soft">
      <div className="border-b border-border bg-slate-950/60 p-4 sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-[720px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-900/80 pl-10 pr-20 text-sm text-slate-100 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
              placeholder="Search places, issues, streets or locations..."
              aria-label="Search issues"
            />
            {search ? (
              <button type="button" onClick={() => setSearch('')} className="absolute right-12 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            ) : null}
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
              Ctrl K
            </span>
          </div>

          <div className="flex items-center gap-2 self-end xl:self-auto">
            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900/80 p-1">
              <button type="button" onClick={() => setViewMode('map')} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${viewMode === 'map' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:text-white'}`}>
                <MapIcon className="h-4 w-4" /> Map
              </button>
              <button type="button" onClick={() => setViewMode('list')} className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition ${viewMode === 'list' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:text-white'}`}>
                <List className="h-4 w-4" /> List
              </button>
            </div>

            <button type="button" onClick={() => setShowFilters((current) => !current)} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm font-medium text-slate-200 hover:border-cyan-500/40 hover:text-white">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>

            <Link to="/app/citizen/report" className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400">
              <Plus className="h-4 w-4" /> Report an Issue
            </Link>
          </div>
        </div>

        {showFilters ? (
          <div className="relative mt-3">
            <div className="absolute right-0 z-30 w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl shadow-slate-950/60">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Filters</p>
                  <p className="text-xs text-slate-400">Refine the map results</p>
                </div>
                <button type="button" onClick={() => setShowFilters(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Status</label>
                  <select value={draftStatus} onChange={(event) => setDraftStatus(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                    <option value="all">All</option>
                    <option value="submitted">Submitted</option>
                    <option value="under_review">Under Review</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">Priority</label>
                  <select value={draftPriority} onChange={(event) => setDraftPriority(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100">
                    <option value="all">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-2">
                <button type="button" onClick={clearFilters} className="text-sm font-medium text-slate-300 hover:text-white">Clear</button>
                <button type="button" onClick={applyFilters} className="rounded-xl bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">Apply filters</button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {categoryChips.map((name) => {
            const isActive = categoryFilter === (name === 'All Issues' ? 'all' : name);
            return (
              <button
                key={name}
                type="button"
                onClick={() => setCategoryFilter(name === 'All Issues' ? 'all' : name)}
                className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium transition ${isActive ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-100' : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-white'}`}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-[620px] flex-col xl:flex-row">
        <div className={`${viewMode === 'map' ? 'block' : 'hidden xl:block'} relative flex-1 min-w-0`}>
          <div ref={mapContainerRef} className="h-[620px] w-full bg-slate-950" />

          {!apiKey && !mapError ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/80">
              <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-center shadow-2xl">
                <MapPin className="mx-auto h-8 w-8 text-cyan-400" />
                <p className="mt-3 text-lg font-semibold text-white">Map provider not configured</p>
                <p className="mt-2 text-sm text-slate-300">
                  Add <span className="font-medium text-cyan-300">VITE_GOOGLE_MAPS_API_KEY</span> to <span className="font-medium text-cyan-300">.env.local</span> and restart Vite to enable the full interactive map.
                </p>
              </div>
            </div>
          ) : null}

          {mapError ? (
            <div className="absolute inset-x-4 top-4 z-20 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              {mapError}
            </div>
          ) : null}

          {selectedReport && apiKey && mapReady && (
            <div className="absolute bottom-4 left-4 z-20 w-[min(92%,360px)] rounded-2xl border border-slate-700 bg-slate-950/90 p-4 shadow-2xl shadow-slate-950/70 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-white">{selectedReport.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.12em] text-cyan-300">{selectedReport.category?.name || 'Uncategorized'}</p>
                </div>
                <button type="button" onClick={() => setSelectedReport(null)} className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 font-medium text-slate-100">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getPriorityColor(selectedReport.priority_level ?? 'low') }} />
                  {selectedReport.priority_level ? selectedReport.priority_level.charAt(0).toUpperCase() + selectedReport.priority_level.slice(1) : 'Priority'}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200">
                  {getStatusLabel(selectedReport.status)}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 text-cyan-300" /> {selectedReport.location?.address || selectedReport.location?.area || 'Location unavailable'}</p>
                <p className="text-slate-400">{selectedReport.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div>
                    <p className="uppercase tracking-[0.12em] text-slate-500">Reported on</p>
                    <p className="mt-1 text-slate-200">{formatDate(selectedReport.created_at)}</p>
                  </div>
                  <div>
                    <p className="uppercase tracking-[0.12em] text-slate-500">Report ID</p>
                    <p className="mt-1 text-slate-200">#{selectedReport.report_id}</p>
                  </div>
                </div>
              </div>

              <button type="button" onClick={() => navigate(`/app/reports/${selectedReport.id}`)} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200">
                View Full Details <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="absolute right-4 top-4 z-20 flex flex-col gap-2">
            <button type="button" onClick={() => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom((mapInstanceRef.current.getZoom() || 11) + 1); }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/90 text-slate-100 shadow-lg shadow-slate-950/60 hover:border-cyan-500/50 hover:text-cyan-200">
              <Plus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => { if (mapInstanceRef.current) mapInstanceRef.current.setZoom(Math.max(3, (mapInstanceRef.current.getZoom() || 11) - 1)); }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/90 text-slate-100 shadow-lg shadow-slate-950/60 hover:border-cyan-500/50 hover:text-cyan-200">
              <Minus className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => {
              if (!navigator.geolocation) {
                setMapError('Geolocation is not available in this browser.');
                return;
              }

              navigator.geolocation.getCurrentPosition(
                (position) => {
                  const location = { lat: position.coords.latitude, lng: position.coords.longitude };
                  if (mapInstanceRef.current) {
                    mapInstanceRef.current.panTo(location);
                    mapInstanceRef.current.setZoom(14);
                  }
                },
                () => {
                  setMapError('Location access was denied. You can still browse the map.');
                },
                { enableHighAccuracy: true, timeout: 10000 }
              );
            }} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/90 text-slate-100 shadow-lg shadow-slate-950/60 hover:border-cyan-500/50 hover:text-cyan-200" aria-label="Use my current location">
              <LocateFixed className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setMapType((current) => current === 'roadmap' ? 'satellite' : 'roadmap')} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-950/90 text-slate-100 shadow-lg shadow-slate-950/60 hover:border-cyan-500/50 hover:text-cyan-200" aria-label="Toggle map type">
              <Layers3 className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute bottom-4 right-4 z-20 rounded-xl border border-slate-700 bg-slate-950/90 p-3 shadow-lg shadow-slate-950/60">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">Legend</p>
            <div className="space-y-2 text-xs text-slate-200">
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Critical</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> High</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Medium</div>
              <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-cyan-500" /> Low</div>
            </div>
          </div>
        </div>

        <aside className={`${viewMode === 'list' ? 'flex' : 'hidden xl:flex'} w-full flex-col border-t border-border bg-slate-950/40 xl:w-[360px] xl:border-l xl:border-t-0`}>
          <div className="flex items-center justify-between border-b border-border bg-slate-950/60 p-4">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setIssueScope('all')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${issueScope === 'all' ? 'bg-cyan-500/15 text-cyan-200' : 'bg-slate-900 text-slate-300 hover:text-white'}`}>
                All Issues
              </button>
              <button type="button" onClick={() => setIssueScope('mine')} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${issueScope === 'mine' ? 'bg-cyan-500/15 text-cyan-200' : 'bg-slate-900 text-slate-300 hover:text-white'}`}>
                My Reports
              </button>
            </div>
            <button type="button" onClick={() => setShowFilters((current) => !current)} className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-white">
              <Filter className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none" placeholder="Search issues in this area..." />
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-border px-4 py-3 text-xs text-slate-400">
            <span>{filteredReports.length} issues</span>
            <select className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 focus:outline-none">
              <option>Newest First</option>
            </select>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filteredReports.length === 0 ? (
              <div className="flex h-full min-h-[220px] items-center justify-center">
                <EmptyState icon={<SearchX className="h-8 w-8" />} title="No matching reports" description="Adjust your search or filters to find nearby issues." />
              </div>
            ) : (
              <div className="space-y-3">
                {filteredReports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => {
                      setSelectedReport(report);
                      if (report.location && mapInstanceRef.current) {
                        mapInstanceRef.current.panTo({ lat: report.location.latitude, lng: report.location.longitude });
                        mapInstanceRef.current.setZoom(13);
                      }
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition ${selectedReport?.id === report.id ? 'border-cyan-500/60 bg-cyan-500/5' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700 hover:bg-slate-900'}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
                        <div className="flex h-full items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 text-slate-200">
                          <MapPin className="h-6 w-6 text-cyan-300" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-white">{report.title}</p>
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-slate-200">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getPriorityColor(report.priority_level ?? 'low') }} />
                            {report.priority_level ? report.priority_level.charAt(0).toUpperCase() + report.priority_level.slice(1) : 'Low'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{report.category?.name || 'Uncategorized'}</p>
                        <p className="mt-1 text-xs text-slate-300">{report.location?.address || report.location?.area || 'Location unavailable'}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                          <span>{formatDate(report.created_at)}</span>
                          <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-slate-300">{getStatusLabel(report.status)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
