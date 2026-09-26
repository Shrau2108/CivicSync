import type { Volunteer, Task, VolunteerMatchResult } from '@/types';
import { haversineDistance } from './dijkstra';

export function matchVolunteersToTask(
  task: Task,
  volunteers: Volunteer[],
  taskLocation: { lat: number; lng: number } | null
): VolunteerMatchResult[] {
  const requiredSkills = task.required_skills || [];
  const results: VolunteerMatchResult[] = [];

  for (const volunteer of volunteers) {
    if (!volunteer.is_verified) continue;
    if (volunteer.current_workload >= volunteer.max_workload) continue;

    const reasons: string[] = [];
    let score = 0;

    const volunteerSkills = (volunteer.skills || []).map((s) => s.skill.toLowerCase());
    const matchedSkills = requiredSkills.filter((rs) =>
      volunteerSkills.includes(rs.toLowerCase())
    );
    const skillMatch =
      requiredSkills.length > 0
        ? (matchedSkills.length / requiredSkills.length) * 100
        : 50;

    if (matchedSkills.length > 0) {
      score += skillMatch * 0.4;
      reasons.push(`Skills match (${matchedSkills.length}/${requiredSkills.length} required skills)`);
    } else if (requiredSkills.length === 0) {
      score += 20;
      reasons.push('No specific skills required');
    }

    const workloadOk = volunteer.current_workload < volunteer.max_workload;
    if (workloadOk) {
      const capacity = (volunteer.max_workload - volunteer.current_workload) / volunteer.max_workload;
      score += capacity * 25;
      reasons.push(`Available capacity (${volunteer.max_workload - volunteer.current_workload} slots free)`);
    }

    const availabilityMatch = true;
    if (availabilityMatch) {
      score += 15;
      reasons.push('Available during required period');
    }

    let distance: number | null = null;
    if (taskLocation && volunteer.latitude && volunteer.longitude) {
      distance = haversineDistance(
        taskLocation.lat,
        taskLocation.lng,
        volunteer.latitude,
        volunteer.longitude
      );
      if (distance < 10) {
        score += 20;
        reasons.push(`Geographic proximity (${distance.toFixed(1)} km away)`);
      } else if (distance < 25) {
        score += 10;
        reasons.push(`Reasonable distance (${distance.toFixed(1)} km away)`);
      } else {
        score += 5;
        reasons.push(`Distant but reachable (${distance.toFixed(1)} km away)`);
      }
    } else {
      score += 10;
      reasons.push('Location proximity not calculated');
    }

    if (volunteer.rating && volunteer.rating > 0) {
      score += volunteer.rating * 2;
      reasons.push(`Rated ${volunteer.rating.toFixed(1)}/5 by community`);
    }

    results.push({
      volunteer,
      score: Math.round(score),
      reasons,
      skillMatch,
      availabilityMatch,
      workloadOk,
      distance,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}
