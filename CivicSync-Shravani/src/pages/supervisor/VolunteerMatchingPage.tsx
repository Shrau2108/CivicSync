import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UserCheck, Search, MapPin, Star, Clock, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppLayout';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState, LoadingState, ErrorState } from '@/components/ui/States';
import { fetchVolunteers, fetchAvailableTasks } from '@/services/api';
import { matchVolunteersToTask } from '@/lib/volunteerMatching';
import type { Volunteer, Task, VolunteerMatchResult } from '@/types';

export function VolunteerMatchingPage() {
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, t] = await Promise.all([fetchVolunteers(), fetchAvailableTasks()]);
      setVolunteers(v);
      setTasks(t.filter(task => task.status === 'assigned'));
      if (t.length > 0 && !selectedTaskId) setSelectedTaskId(t[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedTaskId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingState message="Loading matching data..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const selectedTask = tasks.find(t => t.id === selectedTaskId);
  const matches: VolunteerMatchResult[] = selectedTask
    ? matchVolunteersToTask(
        selectedTask,
        volunteers,
        selectedTask.report?.location
          ? { lat: selectedTask.report.location.latitude, lng: selectedTask.report.location.longitude }
          : null
      )
    : [];

  return (
    <div>
      <PageHeader
        title="Volunteer Matching"
        description="Find the best volunteers for each task using skill, availability, and proximity matching"
      />

      <div className="card p-4 mb-4 bg-primary-50 border-primary-200">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary-800">Explainable Recommendation Engine</p>
            <p className="text-xs text-primary-700 mt-1">
              Recommendations are based on rule-based matching: skill overlap (40%), workload capacity (25%),
              availability (15%), and geographic proximity (20%). Each recommendation includes
              human-readable reasons. ML-based recommendation is a future scope feature.
            </p>
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={<UserCheck className="w-8 h-8" />} title="No tasks to match" description="There are no tasks currently awaiting volunteer assignment" />
        </CardBody></Card>
      ) : (
        <>
          <div className="mb-4">
            <label className="label">Select Task</label>
            <select value={selectedTaskId} onChange={(e) => setSelectedTaskId(e.target.value)} className="input">
              {tasks.map(t => (
                <option key={t.id} value={t.id}>{t.task_id} — {t.title}</option>
              ))}
            </select>
          </div>

          {selectedTask && (
            <Card className="mb-4">
              <CardBody>
                <p className="font-medium text-charcoal-800">{selectedTask.title}</p>
                {selectedTask.description && <p className="text-sm text-charcoal-500 mt-1">{selectedTask.description}</p>}
                {selectedTask.required_skills && selectedTask.required_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedTask.required_skills.map((s, i) => (
                      <span key={i} className="badge bg-primary-50 text-primary-700 border border-primary-200">{s}</span>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {matches.length === 0 ? (
            <Card><CardBody>
              <EmptyState icon={<UserCheck className="w-8 h-8" />} title="No matching volunteers" description="No verified volunteers available with matching skills" />
            </CardBody></Card>
          ) : (
            <div className="space-y-3">
              {matches.map((match, i) => (
                <Card key={match.volunteer.id}>
                  <CardBody>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        i === 0 ? 'bg-primary-100 text-primary-700' : 'bg-charcoal-100 text-charcoal-600'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-charcoal-800">{match.volunteer.profile?.full_name || 'Unknown'}</p>
                          {match.volunteer.is_verified && (
                            <span className="badge bg-primary-50 text-primary-700 border border-primary-200">Verified</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-charcoal-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {match.volunteer.current_workload}/{match.volunteer.max_workload} tasks
                          </span>
                          {match.volunteer.rating && (
                            <span className="flex items-center gap-1">
                              <Star className="w-3 h-3 text-amber-400" /> {match.volunteer.rating.toFixed(1)}
                            </span>
                          )}
                          {match.distance !== null && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {match.distance.toFixed(1)} km
                            </span>
                          )}
                          <span className="font-mono">Score: {match.score}</span>
                        </div>
                        {match.volunteer.skills && match.volunteer.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {match.volunteer.skills.map(s => (
                              <span key={s.id} className="badge bg-charcoal-100 text-charcoal-700 border border-charcoal-200">{s.skill}</span>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 p-2 rounded-lg bg-primary-50/50 border border-primary-100">
                          <p className="text-xs font-medium text-primary-700 mb-1">Recommended because:</p>
                          <ul className="space-y-0.5">
                            {match.reasons.map((reason, ri) => (
                              <li key={ri} className="text-xs text-primary-600 flex items-start gap-1">
                                <span className="text-primary-400">•</span> {reason}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <Link to="/app/supervisor/assignment" className="btn-primary text-sm flex-shrink-0">
                        Assign
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
