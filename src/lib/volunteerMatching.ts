import type { Volunteer, Task, VolunteerMatchResult } from '@/types';
import { haversineDistance } from './dijkstra';

export const VOLUNTEER_MATCH_WEIGHTS = {
  skill: 40,
  workload: 25,
  availability: 15,
  distance: 20,
} as const;

const MAX_DISTANCE_KM = 50;

export function getVolunteerAvailability(volunteer: Volunteer, now = new Date()): 'available' | 'schedule_unset' | 'unavailable' {
  const schedule = volunteer.availability || [];
  if (schedule.length === 0) return 'schedule_unset';

  const day = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isAvailable = schedule.some((slot) =>
    slot.is_available &&
    slot.day_of_week === day &&
    currentTime >= slot.start_time.slice(0, 5) &&
    currentTime < slot.end_time.slice(0, 5)
  );
  return isAvailable ? 'available' : 'unavailable';
}

export function calculateSkillMatch(requiredSkills: string[], volunteerSkills: string[]): number {
  if (requiredSkills.length === 0) return 50;
  const availableSkills = new Set(volunteerSkills.map((skill) => skill.trim().toLowerCase()));
  const matchedCount = requiredSkills.filter((skill) => availableSkills.has(skill.trim().toLowerCase())).length;
  return (matchedCount / requiredSkills.length) * 100;
}

export function isVolunteerEligibleForTask(
  volunteer: Volunteer,
  requiredSkills: string[],
  now = new Date()
): boolean {
  if (!volunteer.is_verified || volunteer.verification_status !== 'verified') return false;
  if (volunteer.current_workload >= volunteer.max_workload) return false;
  if (getVolunteerAvailability(volunteer, now) !== 'available') return false;
  if (requiredSkills.length > 0 && calculateSkillMatch(requiredSkills, (volunteer.skills || []).map((skill) => skill.skill)) < 100) return false;
  return true;
}

export function matchVolunteersToTask(
  task: Pick<Task, 'required_skills'>,
  volunteers: Volunteer[],
  taskLocation: { lat: number; lng: number } | null,
  now = new Date()
): VolunteerMatchResult[] {
  const requiredSkills = task.required_skills || [];
  const results: VolunteerMatchResult[] = [];

  for (const volunteer of volunteers) {
    if (!isVolunteerEligibleForTask(volunteer, requiredSkills, now)) continue;

    const reasons: string[] = [];
    const skillMatch = calculateSkillMatch(requiredSkills, (volunteer.skills || []).map((skill) => skill.skill));
    const matchedCount = Math.round((skillMatch / 100) * requiredSkills.length);
    if (requiredSkills.length > 0) reasons.push(`Required skills matched (${matchedCount}/${requiredSkills.length})`);
    else reasons.push('No required skills are recorded for this task');

    const workloadOk = volunteer.current_workload < volunteer.max_workload;
    const workloadScore = volunteer.max_workload > 0
      ? Math.max(0, Math.min(100, ((volunteer.max_workload - volunteer.current_workload) / volunteer.max_workload) * 100))
      : 0;
    reasons.push(`Workload capacity (${volunteer.current_workload}/${volunteer.max_workload} active tasks)`);

    const observedAvailability = getVolunteerAvailability(volunteer, now);
    if (observedAvailability === 'unavailable') continue;
    const availabilityStatus = observedAvailability;
    const availabilityMatch = true;
    const availabilityScore = availabilityStatus === 'available' ? 100 : 50;
    reasons.push(availabilityStatus === 'available' ? 'Available during this schedule window' : 'No availability schedule is recorded');

    let distance: number | null = null;
    if (taskLocation && volunteer.latitude !== null && volunteer.longitude !== null) {
      distance = haversineDistance(
        taskLocation.lat,
        taskLocation.lng,
        volunteer.latitude,
        volunteer.longitude
      );
      reasons.push(`Straight-line distance (${distance.toFixed(1)} km)`);
    } else {
      reasons.push('Location coordinates unavailable; distance not scored');
    }

    const distanceScore = distance === null ? null : Math.max(0, (1 - distance / MAX_DISTANCE_KM) * 100);
    const normalizedDistanceScore = distanceScore ?? 50;
    const score =
      skillMatch * VOLUNTEER_MATCH_WEIGHTS.skill / 100 +
      workloadScore * VOLUNTEER_MATCH_WEIGHTS.workload / 100 +
      availabilityScore * VOLUNTEER_MATCH_WEIGHTS.availability / 100 +
      normalizedDistanceScore * VOLUNTEER_MATCH_WEIGHTS.distance / 100;

    results.push({
      volunteer,
      score: Math.round(score * 10) / 10,
      reasons,
      skillMatch,
      availabilityStatus,
      availabilityScore,
      distanceScore,
      workloadScore,
      availabilityMatch,
      workloadOk,
      distance,
    });
  }

  results.sort((a, b) =>
    b.score - a.score ||
    b.skillMatch - a.skillMatch ||
    (a.distance ?? Infinity) - (b.distance ?? Infinity) ||
    b.workloadScore - a.workloadScore ||
    (a.volunteer.profile?.full_name || '').localeCompare(b.volunteer.profile?.full_name || '')
  );
  return results;
}
