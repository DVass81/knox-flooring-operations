---
name: Knox chart/theme color tokens
description: How to use Knox Flooring's HSL theme vars in inline styles and gradients, and the dashboard funnel rule.
---

# Knox chart theming

Knox Flooring's color tokens in `src/index.css` (e.g. `--chart-1..5`, `--primary`)
are stored as **space-separated HSL components** (e.g. `--chart-5: 192 28% 44%;`),
not full color strings.

**Rule:** wrap them as `hsl(var(--chart-5))` and add alpha with the slash form
`hsl(var(--chart-5) / 0.7)`. Never build `hsl(var(--x))` + `"cc"` or any hex/8-digit
suffix — that yields invalid CSS and the element renders transparent/invisible.

**Why:** the dashboard pipeline funnel bars once appended `cc` to an `hsl(var())`
string for a gradient; the gradient silently failed and the bars looked blank.

**How to apply:** any inline `style` gradient/fill using these tokens in chart
components (`src/components/dashboard/DashboardCharts.tsx`) must use the
`hsl(var(--token) / alpha)` syntax.

## Dashboard pipeline funnel
The funnel's top stage = open leads (stage not Won/Lost) + all jobs, because the
`leads` table is sparse and using raw `leads.length` produced an inverted >100%
funnel (more quoted jobs than tracked leads). Subsequent stages are cumulative
job-stage counts (`stageIndex(j.status) >= IDX`) which guarantees a monotonically
narrowing funnel.
