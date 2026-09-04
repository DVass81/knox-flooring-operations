import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const CREWS = ["Crew A", "Crew B", "Crew C", "Crew D"];

export default function Reports() {
  const { jobs, materials } = useStore();

  const completedJobs = jobs.filter((j) => ["Completed", "Invoiced"].includes(j.status));

  // 1. Revenue by City
  const revByCity = completedJobs.reduce((acc: Record<string, number>, job) => {
    acc[job.city] = (acc[job.city] || 0) + job.estRevenue;
    return acc;
  }, {});
  const cityData = Object.keys(revByCity)
    .map((k) => ({ name: k, value: revByCity[k] }))
    .sort((a, b) => b.value - a.value);

  // 2. Revenue by Flooring Type
  const revByFlooring = completedJobs.reduce((acc: Record<string, number>, job) => {
    acc[job.flooringType] = (acc[job.flooringType] || 0) + job.estRevenue;
    return acc;
  }, {});
  const flooringRevData = Object.keys(revByFlooring)
    .map((k) => ({ name: k, value: revByFlooring[k] }))
    .sort((a, b) => b.value - a.value);

  // 3. Gross Profit by Crew
  const profitByCrew = completedJobs.reduce((acc: Record<string, number>, job) => {
    if (job.crewAssigned !== "Unassigned") {
      acc[job.crewAssigned] = (acc[job.crewAssigned] || 0) + job.estGrossProfit;
    }
    return acc;
  }, {});
  const crewData = CREWS.map((c) => ({ name: c.replace("Crew ", ""), value: profitByCrew[c] || 0 }));

  // 4. Average Margin by Flooring Type
  const marginAgg = completedJobs.reduce(
    (acc: Record<string, { sum: number; count: number }>, job) => {
      if (!acc[job.flooringType]) acc[job.flooringType] = { sum: 0, count: 0 };
      acc[job.flooringType].sum += job.grossMarginPct;
      acc[job.flooringType].count += 1;
      return acc;
    },
    {}
  );
  const marginData = Object.keys(marginAgg)
    .map((k) => ({ name: k, value: Number((marginAgg[k].sum / marginAgg[k].count).toFixed(1)) }))
    .sort((a, b) => b.value - a.value);

  // 5. Jobs Completed by Month
  const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const completedByMonth = monthOrder.map((m) => ({ name: m, value: 0 }));
  completedJobs.forEach((job) => {
    const ref = job.estCompletionDate || job.updatedAt || job.createdAt;
    if (!ref) return;
    const d = new Date(ref);
    if (Number.isNaN(d.getTime())) return;
    completedByMonth[d.getMonth()].value += 1;
  });
  const monthData = completedByMonth.filter((m) => m.value > 0);

  // 6. Callback Count by Crew (proxy: completed high-risk jobs)
  const callbackByCrew = CREWS.map((c) => ({
    name: c.replace("Crew ", ""),
    value: completedJobs.filter((j) => j.crewAssigned === c && j.riskLevel === "High").length,
  }));

  // 7. Material Delays by Supplier
  const delaysBySupplier = materials
    .filter((m) => ["Delayed", "Damaged", "Missing Items"].includes(m.status))
    .reduce((acc: Record<string, number>, m) => {
      acc[m.supplier] = (acc[m.supplier] || 0) + 1;
      return acc;
    }, {});
  const supplierData = Object.keys(delaysBySupplier)
    .map((k) => ({ name: k, value: delaysBySupplier[k] }))
    .sort((a, b) => b.value - a.value);

  const emptyMsg = (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      No data available yet.
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-1">Performance analytics across completed jobs and suppliers.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by City</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {cityData.length === 0 ? (
                emptyMsg
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} fontSize={12} />
                    <YAxis dataKey="name" type="category" width={90} fontSize={11} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Flooring Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {flooringRevData.length === 0 ? (
                emptyMsg
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={flooringRevData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} fontSize={12} />
                    <YAxis dataKey="name" type="category" width={110} fontSize={10} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gross Profit by Crew</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crewData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis tickFormatter={(v) => `$${v / 1000}k`} fontSize={12} />
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                  <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Margin by Flooring Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {marginData.length === 0 ? (
                emptyMsg
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={marginData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(v) => `${v}%`} fontSize={12} />
                    <YAxis dataKey="name" type="category" width={110} fontSize={10} />
                    <Tooltip formatter={(value: number) => `${value}%`} />
                    <Bar dataKey="value" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jobs Completed by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {monthData.length === 0 ? (
                emptyMsg
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" fontSize={12} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Callback Count by Crew</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callbackByCrew} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Material Delays by Supplier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              {supplierData.length === 0 ? (
                emptyMsg
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={supplierData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" fontSize={11} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
