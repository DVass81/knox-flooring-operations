import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, MapPin, Calendar, Clock, Package, Users } from "lucide-react";
import { Job } from "@/lib/types";

const TRAVEL_CITIES = ['Sevierville', 'Lenoir City', 'Pigeon Forge', 'Loudon', 'Tellico Village'];

function estimateDays(job: Job) {
  const hours = Math.ceil(job.squareFootage / 50);
  const crewSize = job.squareFootage > 1200 ? 3 : 2;
  return Math.max(1, Math.ceil(hours / (8 * crewSize)));
}

function materialReady(job: Job) {
  return job.materialStatus === 'Received';
}

function jobRisks(job: Job, crewLoad: number): string[] {
  const risks: string[] = [];
  if (job.riskLevel === 'High' || ['Tile', 'Hardwood'].includes(job.flooringType)) {
    risks.push('High-complexity installation — allow extra prep/cure time.');
  }
  if (TRAVEL_CITIES.includes(job.city)) {
    risks.push(`Outside Knoxville — travel time to ${job.city} required.`);
  }
  if (!materialReady(job)) {
    risks.push(`Material not ready (${job.materialStatus.toLowerCase()}).`);
  }
  if (crewLoad > 2) {
    risks.push('Crew overbooked — more than 2 active jobs this week.');
  }
  return risks;
}

export default function Schedule() {
  const { jobs } = useStore();

  const crews = ['Crew A', 'Crew B', 'Crew C', 'Crew D'];
  const scheduledJobs = jobs.filter(j => ['Scheduled', 'In Progress'].includes(j.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Crew Schedule</h1>
          <p className="text-muted-foreground mt-1">Weekly installation schedule by crew, with readiness and risk alerts.</p>
        </div>
      </div>

      <div className="grid xl:grid-cols-4 gap-6">
        {crews.map(crew => {
          const crewJobs = scheduledJobs.filter(j => j.crewAssigned === crew);
          const overbooked = crewJobs.length > 2;

          return (
            <div key={crew} className="space-y-4">
              <div className="px-1 space-y-2">
                <h3 className="font-semibold text-lg flex items-center justify-between">
                  {crew}
                  <Badge variant={overbooked ? 'destructive' : 'outline'} className="flex items-center gap-1">
                    <Users className="w-3 h-3" /> {crewJobs.length} Jobs
                  </Badge>
                </h3>
                {overbooked && (
                  <div className="bg-destructive/10 text-destructive text-xs p-2 rounded flex gap-2 items-start">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>Crew overbooked this week — consider redistributing jobs.</span>
                  </div>
                )}
              </div>

              {crewJobs.length === 0 ? (
                <Card className="bg-muted/30 border-dashed">
                  <CardContent className="py-8 text-center text-sm text-muted-foreground">
                    No jobs scheduled
                  </CardContent>
                </Card>
              ) : (
                crewJobs.map(job => {
                  const days = estimateDays(job);
                  const ready = materialReady(job);
                  const risks = jobRisks(job, crewJobs.length);

                  return (
                    <Card key={job.id} className="border-l-4 border-l-primary hover:shadow-md transition-shadow">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex justify-between items-start gap-2">
                          <CardTitle className="text-base font-semibold">{job.customerName}</CardTitle>
                          <Badge variant={job.status === 'In Progress' ? 'secondary' : 'outline'} className="text-[10px] shrink-0">
                            {job.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 space-y-3">
                        <div className="text-sm space-y-1 text-muted-foreground">
                          <div className="flex items-center gap-1.5 text-foreground">
                            <MapPin className="w-3.5 h-3.5" /> {job.city}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" /> {job.estStartDate || 'TBD'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> Duration: {days} {days === 1 ? 'day' : 'days'}
                          </div>
                          <div className="font-medium pt-1 text-foreground">{job.flooringType} ({job.squareFootage} sqft)</div>
                        </div>

                        {/* Material readiness badge */}
                        <Badge
                          variant={ready ? 'secondary' : 'outline'}
                          className={`flex w-fit items-center gap-1 text-[11px] ${ready ? 'text-green-700 border-green-600/40' : 'text-amber-700 border-amber-600/40'}`}
                        >
                          <Package className="w-3 h-3" />
                          {ready ? 'Material Ready' : `Material: ${job.materialStatus}`}
                        </Badge>

                        {/* Risk alerts */}
                        {risks.length > 0 && (
                          <div className="space-y-1.5">
                            {risks.map((r, i) => (
                              <div key={i} className="bg-amber-500/10 text-amber-700 text-xs p-2 rounded flex gap-2 items-start">
                                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                                <span>{r}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
