import { useState, useMemo } from "react";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { ROOM_NAMES } from "@/lib/options";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Lightbulb, AlertTriangle, CheckCircle, Calculator, FileText, Briefcase, Package, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { FlooringType, ProductCategory, ProductUnit, ProposalLineItem, Product } from "@/lib/types";
import { useLocation } from "wouter";
import { customFetch } from "@workspace/api-client-react";

type CopilotResult = { mode: "live" | "fallback"; scopeOfWork: string; wasteFactor: number; wasteExplanation: string; labor: { hours: number; crewSize: number; durationDays: number }; preparation: string[]; risks: string[]; missingInformation: string[]; marginWarnings: string[]; proposalSummary: string; internalNotes: string; confidence: string; assumptions: string[]; model?: string | null; fallbackReason?: string };

const FLOORING_CATEGORY_MAP: Record<FlooringType, ProductCategory[]> = {
  Carpet: ["Carpet"],
  Hardwood: ["Hardwood"],
  Tile: ["Tile"],
  Laminate: ["Laminate", "Waterproof"],
  "Luxury Vinyl Plank (LVP)": ["Vinyl Plank", "Waterproof"],
  "Luxury Vinyl Tile (LVT)": ["Vinyl Tile", "Vinyl Plank"],
  "Waterproof Flooring": ["Waterproof", "Vinyl Plank"],
  "Commercial Carpet Tile": ["Commercial", "Carpet"],
  "Commercial LVT": ["Commercial", "Vinyl Tile"],
};

const BOX_COVERAGE_SQFT = 30;

function quantityForUnit(unit: ProductUnit, coverageSqFt: number): number {
  if (unit === "sqft") return coverageSqFt;
  if (unit === "box") return Math.max(1, Math.ceil(coverageSqFt / BOX_COVERAGE_SQFT));
  return 1;
}

function lineItemFromProduct(product: Product, quantity: number): ProposalLineItem {
  return {
    id: crypto.randomUUID(),
    productId: product.id,
    name: product.name,
    category: product.category,
    sku: product.sku,
    unit: product.unit,
    quantity,
    unitPrice: product.price,
  };
}

export default function Estimator() {
  const { settings, products, addProposal, addJob } = useStore();
  const [, setLocation] = useLocation();

  const [customerName, setCustomerName] = useState("");
  const [city, setCity] = useState("Knoxville");
  const [flooringType, setFlooringType] = useState<FlooringType>("Luxury Vinyl Plank (LVP)");
  const [rooms, setRooms] = useState([{ id: 'r1', name: "Living Room", length: 20, width: 15 }]);
  const [wasteFactor, setWasteFactor] = useState(settings.defaultWasteFactor);
  const [materialCost, setMaterialCost] = useState(3.50);
  const [laborCost, setLaborCost] = useState(settings.defaultLaborRateLVP);
  const [underlaymentCost, setUnderlaymentCost] = useState(0);
  const [trimCost, setTrimCost] = useState(250);
  const [tearOutCost, setTearOutCost] = useState(500);
  const [stairCount, setStairCount] = useState(0);
  const [furnitureMoving, setFurnitureMoving] = useState(false);
  const [subfloorRepair, setSubfloorRepair] = useState(false);
  const [moistureBarrier, setMoistureBarrier] = useState(false);
  const [complexityNotes, setComplexityNotes] = useState("");
  const [copilot, setCopilot] = useState<CopilotResult | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState("");

  const runCopilot = async () => {
    setCopilotLoading(true); setCopilotError("");
    try {
      const result = await customFetch<CopilotResult>("/api/ai/estimate", { method: "POST", responseType: "json", body: JSON.stringify({ customer: { name: customerName, city }, flooringType, rooms, complexityNotes, options: { furnitureMoving, subfloorRepair, moistureBarrier, stairCount }, catalog: products.filter((product) => product.active).slice(0, 40).map(({ id, name, sku, category, unit, price }) => ({ id, name, sku, category, unit, price })), policies: { targetMarginPercent: 35, currentWasteFactor: wasteFactor }, deterministicTotals: { rawSquareFeet: rawSqFt, suggestedPrice: suggestedSellingPrice, grossMarginPercent: grossMargin } }) });
      setCopilot(result);
    } catch (error) { setCopilotError(error instanceof Error ? error.message : "Unable to reach the copilot"); }
    finally { setCopilotLoading(false); }
  };

  const addRoom = () => {
    setRooms([...rooms, { id: Math.random().toString(), name: "", length: 10, width: 10 }]);
  };

  const updateRoom = (id: string, field: string, value: string | number) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRoom = (id: string) => {
    setRooms(rooms.filter(r => r.id !== id));
  };

  // Calculations
  const rawSqFt = rooms.reduce((acc, r) => acc + (r.length * r.width), 0);
  const wasteSqFt = Math.ceil(rawSqFt * (1 + wasteFactor / 100));
  
  const totalMaterialCost = wasteSqFt * materialCost;
  const totalLaborCost = rawSqFt * laborCost;
  const stairCost = stairCount * 120; // $120 per stair
  const furnitureCost = furnitureMoving ? 250 : 0;
  const subfloorCost = subfloorRepair ? 400 : 0;
  const moistureCost = moistureBarrier ? rawSqFt * 0.5 : 0;

  const additionalCosts = trimCost + tearOutCost + stairCost + furnitureCost + subfloorCost + moistureCost + underlaymentCost;
  const estimatedTotalCost = totalMaterialCost + totalLaborCost + additionalCosts;
  
  // Pricing Strategy (Target 35-40% margin)
  const suggestedSellingPrice = estimatedTotalCost / 0.65; // Target ~35% margin
  const grossProfit = suggestedSellingPrice - estimatedTotalCost;
  const grossMargin = (grossProfit / suggestedSellingPrice) * 100;

  const estimatedHours = Math.ceil(rawSqFt / 50); // Assuming 50 sq ft per hour
  const recommendedCrewSize = rawSqFt > 1200 ? 3 : 2;
  const estimatedDays = Math.ceil(estimatedHours / (8 * recommendedCrewSize));

  // AI Logic
  const ai = useMemo(() => {
    const recs: { type: string; text: string }[] = [];

    // Suggested waste factor by flooring type
    const suggestedWaste =
      flooringType === 'Tile'
        ? 15
        : flooringType === 'Hardwood'
        ? 10
        : ['Carpet', 'Commercial Carpet Tile'].includes(flooringType)
        ? 5
        : 8;

    // Install complexity rating
    let complexityScore = 0;
    if (['Tile', 'Hardwood'].includes(flooringType)) complexityScore += 2;
    if (['Commercial Carpet Tile', 'Commercial LVT'].includes(flooringType)) complexityScore += 1;
    if (stairCount > 0) complexityScore += 2;
    if (subfloorRepair) complexityScore += 1;
    if (rawSqFt > 1500) complexityScore += 1;
    const installComplexity = complexityScore >= 4 ? 'High' : complexityScore >= 2 ? 'Medium' : 'Low';

    // Crew recommendation
    const crewRec =
      installComplexity === 'High' || rawSqFt > 1200
        ? '3-person crew recommended for efficient completion.'
        : rawSqFt > 600
        ? '2-person crew is sufficient for this project size.'
        : 'A single experienced installer can handle this small job.';

    // Travel / schedule recommendation
    const travelCities = ['Sevierville', 'Lenoir City', 'Pigeon Forge', 'Loudon', 'Tellico Village'];
    const needsTravel = travelCities.includes(city);
    const scheduleRec = needsTravel
      ? `Add travel time for ${city}. Plan an earlier start to account for drive time.`
      : `Plan for ${estimatedDays} working ${estimatedDays === 1 ? 'day' : 'days'} on site.`;

    // Risk areas
    const riskAreas: string[] = [];
    if (flooringType === 'Hardwood') riskAreas.push('Hardwood needs 72hr acclimation before install.');
    if (flooringType === 'Tile') riskAreas.push('Tile requires extra cure time and precise subfloor prep.');
    if (moistureBarrier) riskAreas.push('Moisture-prone area — verify barrier coverage.');
    if (stairCount > 0) riskAreas.push(`${stairCount} stair(s) add labor and risk of waste.`);
    if (riskAreas.length === 0) riskAreas.push('No significant risk areas detected.');

    // Recommendation chips
    if (wasteFactor < suggestedWaste) {
      recs.push({
        type: 'warning',
        text: `Suggested waste factor for ${flooringType} is ${suggestedWaste}% (currently ${wasteFactor}%).`,
      });
    }
    if (grossMargin < 35) {
      recs.push({ type: 'alert', text: `Profitability warning: margin is ${grossMargin.toFixed(1)}%. Target is 35%+.` });
    }
    if (wasteFactor < 7 && rawSqFt > 500) {
      recs.push({ type: 'alert', text: `Waste risk: ${wasteFactor}% is very low for this size. Recommend 10% minimum.` });
    }
    // Material ordering warning by lead time
    const longLead = ['Hardwood', 'Tile', 'Commercial Carpet Tile', 'Commercial LVT'].includes(flooringType);
    recs.push({
      type: longLead ? 'warning' : 'info',
      text: longLead
        ? `Order ${flooringType} early — typical lead time is 2-3 weeks. Do not schedule install until material is received.`
        : `${flooringType} is usually in stock (3-7 day lead). Confirm receipt before scheduling crews.`,
    });
    if (needsTravel) {
      recs.push({ type: 'warning', text: scheduleRec });
    }

    // Customer-facing summary
    const customerSummary = `${customerName || 'The homeowner'} has requested ${flooringType} installation across ${rooms.length} ${rooms.length === 1 ? 'room' : 'rooms'} (${rawSqFt} sq ft) in ${city}. Our team will tear out existing flooring, prep the subfloor${subfloorRepair ? ' including repairs' : ''}, and professionally install the new flooring with a ${suggestedWaste}% material allowance. Estimated investment is $${suggestedSellingPrice.toFixed(0)}, completed in approximately ${estimatedDays} ${estimatedDays === 1 ? 'day' : 'days'}.`;

    return {
      recs,
      suggestedWaste,
      installComplexity,
      crewRec,
      scheduleRec,
      riskAreas,
      customerSummary,
    };
  }, [
    flooringType,
    rawSqFt,
    city,
    grossMargin,
    wasteFactor,
    stairCount,
    subfloorRepair,
    moistureBarrier,
    estimatedDays,
    customerName,
    rooms.length,
    suggestedSellingPrice,
  ]);

  const aiRecommendations = ai.recs;

  // Auto-select catalog materials for the proposal based on flooring type & area.
  const suggestedLineItems = useMemo<ProposalLineItem[]>(() => {
    const activeProducts = products.filter((p) => p.active);
    if (activeProducts.length === 0) return [];

    const items: ProposalLineItem[] = [];
    const usedIds = new Set<string>();

    // 1) Primary flooring material — match by mapped catalog category, ordered by preference.
    const categoryPriority = FLOORING_CATEGORY_MAP[flooringType] ?? [];
    let primary: Product | undefined;
    for (const cat of categoryPriority) {
      primary = activeProducts.find((p) => p.category === cat);
      if (primary) break;
    }
    if (primary) {
      items.push(lineItemFromProduct(primary, quantityForUnit(primary.unit, wasteSqFt)));
      usedIds.add(primary.id);
    }

    // 2) Moisture barrier / underlayment when the toggle is on.
    if (moistureBarrier) {
      const barrier = activeProducts.find(
        (p) =>
          !usedIds.has(p.id) &&
          p.category === "Trim/Supplies" &&
          /underlayment|membrane|moisture|barrier|ditra/i.test(p.name),
      );
      if (barrier) {
        items.push(lineItemFromProduct(barrier, quantityForUnit(barrier.unit, rawSqFt)));
        usedIds.add(barrier.id);
      }
    }

    // 3) Trim / transition supplies when there's a trim allowance.
    if (trimCost > 0) {
      const trim = activeProducts.find(
        (p) =>
          !usedIds.has(p.id) &&
          p.category === "Trim/Supplies" &&
          /trim|molding|transition|t-molding|quarter|nosing|reducer/i.test(p.name),
      );
      if (trim) {
        items.push(lineItemFromProduct(trim, 1));
        usedIds.add(trim.id);
      }
    }

    return items;
  }, [products, flooringType, wasteSqFt, rawSqFt, moistureBarrier, trimCost]);

  const suggestedMaterialsTotal = suggestedLineItems.reduce(
    (acc, li) => acc + li.quantity * li.unitPrice,
    0,
  );

  const handleConvertToProposal = async () => {
    if (!customerName) {
      alert("Please enter a customer name first.");
      return;
    }
    await addProposal({
      customerName,
      projectLocation: city,
      flooringType,
      roomList: rooms,
      lineItems: suggestedLineItems,
      totalSqFt: rawSqFt,
      scopeOfWork: `Install ${flooringType} in ${rooms.map(r=>r.name).join(', ')}. Includes ${wasteFactor}% waste factor.${subfloorRepair ? ' Includes subfloor repair.' : ''}${tearOutCost > 0 ? ' Includes tear-out and disposal of existing flooring.' : ''}${complexityNotes ? ` Notes: ${complexityNotes}` : ''}`,
      estimatedPrice: suggestedSellingPrice,
      expectedTimeline: `${estimatedDays} ${estimatedDays === 1 ? 'day' : 'days'}`,
      materialAssumptions: `Customer selection of ${flooringType}`,
      exclusions: 'Plumbing disconnects, moving delicate antiques, structural repairs.',
      warrantyNote: 'Standard 1-year installation warranty.',
      status: 'Draft'
    });
    setLocation('/proposals');
  };

  const handleSaveAsJob = async () => {
    if (!customerName) {
      alert("Please enter a customer name first.");
      return;
    }
    const newJob = await addJob({
      customerName,
      city,
      flooringType,
      phone: "",
      email: "",
      address: "",
      rooms: rooms,
      squareFootage: rawSqFt,
      crewAssigned: "Unassigned",
      materialStatus: "Ordered",
      laborEstimate: totalLaborCost,
      materialEstimate: totalMaterialCost,
      scopeOfWork: `Install ${flooringType} in ${rooms.map(r => r.name).join(", ")}.`,
      estLaborHours: estimatedHours,
      estRevenue: suggestedSellingPrice,
      estGrossProfit: grossProfit,
      grossMarginPct: grossMargin,
      actualRevenue: 0,
      actualLaborCost: 0,
      actualMaterialCost: 0,
      actualAddOnCost: 0,
      notes: "Job created from Estimator.",
      priorityLevel: "Medium",
      riskLevel: "Low",
      status: "Estimate Completed",
    });
    setLocation(`/jobs/${newJob.id}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">AI Quote Copilot</h1>
          <p className="text-muted-foreground mt-1">Grounded recommendations from your measurements and catalog; Knox Ops remains authoritative for every price and total.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Basics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. John Smith" />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Knoxville', 'Farragut', 'Maryville', 'Alcoa', 'Lenoir City', 'Oak Ridge', 'Sevierville', 'Powell', 'Clinton'].map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Flooring Type</Label>
                  <Select value={flooringType} onValueChange={(v: FlooringType) => setFlooringType(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['Carpet', 'Hardwood', 'Tile', 'Laminate', 'Luxury Vinyl Plank (LVP)', 'Commercial LVT'].map(f => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rooms & Measurements</CardTitle>
              <Button variant="outline" size="sm" onClick={addRoom}><Plus className="w-4 h-4 mr-2" />Add Room</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {rooms.map((room, i) => (
                <div key={room.id} className="flex gap-4 items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Room {i + 1}</Label>
                    <SelectOrOther
                      value={room.name}
                      options={ROOM_NAMES}
                      placeholder="Select room"
                      otherPlaceholder="Custom room name"
                      onChange={(v) => updateRoom(room.id, 'name', v)}
                    />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Length (ft)</Label>
                    <Input type="number" value={room.length} onChange={e => updateRoom(room.id, 'length', Number(e.target.value))} />
                  </div>
                  <div className="w-24 space-y-2">
                    <Label>Width (ft)</Label>
                    <Input type="number" value={room.width} onChange={e => updateRoom(room.id, 'width', Number(e.target.value))} />
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeRoom(room.id)} className="text-destructive mb-0.5">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="pt-4 border-t flex justify-between font-medium">
                <span>Total Raw Area</span>
                <span>{rawSqFt} sq ft</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Costs & Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Waste Factor (%)</Label>
                  <Input type="number" value={wasteFactor} onChange={e => setWasteFactor(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Material Cost ($/sqft)</Label>
                  <Input type="number" value={materialCost} onChange={e => setMaterialCost(Number(e.target.value))} step="0.1" />
                </div>
                <div className="space-y-2">
                  <Label>Labor Rate ($/sqft)</Label>
                  <Input type="number" value={laborCost} onChange={e => setLaborCost(Number(e.target.value))} step="0.1" />
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Underlayment Cost ($)</Label>
                  <Input type="number" value={underlaymentCost} onChange={e => setUnderlaymentCost(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Trim / Transition Cost ($)</Label>
                  <Input type="number" value={trimCost} onChange={e => setTrimCost(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Tear-Out Cost ($)</Label>
                  <Input type="number" value={tearOutCost} onChange={e => setTearOutCost(Number(e.target.value))} />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                 <div className="flex items-center justify-between">
                  <Label htmlFor="furniture">Furniture Moving</Label>
                  <Switch id="furniture" checked={furnitureMoving} onCheckedChange={setFurnitureMoving} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="subfloor">Subfloor Repair Prep</Label>
                  <Switch id="subfloor" checked={subfloorRepair} onCheckedChange={setSubfloorRepair} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="moisture">Moisture Barrier</Label>
                  <Switch id="moisture" checked={moistureBarrier} onCheckedChange={setMoistureBarrier} />
                </div>
                 <div className="space-y-2">
                  <Label>Stair Count</Label>
                  <Input type="number" value={stairCount} onChange={e => setStairCount(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Job Complexity Notes</Label>
                <Textarea
                  value={complexityNotes}
                  onChange={e => setComplexityNotes(e.target.value)}
                  placeholder="e.g. tight closets, diagonal pattern, pets in home, tight access..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Estimate Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Quantity</span>
                  <span className="font-medium">{wasteSqFt} sq ft</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Material Cost</span>
                  <span>${totalMaterialCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Labor Cost</span>
                  <span>${totalLaborCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Additional/Prep</span>
                  <span>${additionalCosts.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t flex justify-between font-bold text-base">
                  <span>Suggested Price</span>
                  <span className="text-primary">${suggestedSellingPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-muted-foreground">Est. Margin</span>
                  <span className={grossMargin >= 35 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                    {grossMargin.toFixed(1)}% (${grossProfit.toFixed(0)})
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
               <Button className="w-full" size="lg" onClick={handleConvertToProposal}>
                  <FileText className="w-4 h-4 mr-2" /> Convert to Proposal
               </Button>
               <Button className="w-full" variant="outline" onClick={handleSaveAsJob}>
                  <Briefcase className="w-4 h-4 mr-2" /> Save as Job Tracker
               </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Suggested Materials
              </CardTitle>
              <CardDescription>
                Auto-selected from your catalog. These carry onto the proposal and into the job on conversion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {suggestedLineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No matching catalog products found for {flooringType}. Add products to your inventory to auto-attach them, or add them manually on the proposal.
                </p>
              ) : (
                <>
                  {suggestedLineItems.map((li) => (
                    <div key={li.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <div className="font-medium">{li.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {li.quantity} {li.unit} × ${li.unitPrice.toFixed(2)}
                          {li.sku ? ` · ${li.sku}` : ""}
                        </div>
                      </div>
                      <div className="font-medium whitespace-nowrap">
                        ${(li.quantity * li.unitPrice).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t flex justify-between font-medium text-sm">
                    <span>Materials Subtotal</span>
                    <span>${suggestedMaterialsTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" />
                AI Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={runCopilot} disabled={copilotLoading || rawSqFt <= 0} className="w-full bg-gradient-to-r from-primary to-sky-500 text-white">
                {copilotLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{copilotLoading ? "Analyzing project…" : "Generate AI recommendations"}
              </Button>
              <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>Human approval required. AI cannot change products, prices, measurements, taxes, or send a proposal.</span></div>
              {copilotError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{copilotError}</div>}
              {copilot && <div className="space-y-4 rounded-xl border border-primary/20 bg-primary/[.03] p-4">
                <div className="flex items-center justify-between"><span className="text-sm font-semibold">Copilot analysis</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${copilot.mode === "live" ? "bg-emerald-500/15 text-emerald-700" : "bg-amber-500/15 text-amber-700"}`}>{copilot.mode === "live" ? "Live AI" : "Fallback mode"}</span></div>
                <div><h4 className="text-sm font-medium">Scope draft</h4><p className="mt-1 text-sm text-muted-foreground">{copilot.scopeOfWork}</p></div>
                <div className="grid grid-cols-2 gap-2"><div className="rounded-lg bg-background p-3"><p className="text-xs text-muted-foreground">Suggested waste</p><p className="text-lg font-bold">{copilot.wasteFactor}%</p></div><div className="rounded-lg bg-background p-3"><p className="text-xs text-muted-foreground">Crew plan</p><p className="text-lg font-bold">{copilot.labor.crewSize} · {copilot.labor.durationDays}d</p></div></div>
                {copilot.risks.length > 0 && <div><h4 className="text-sm font-medium">Risks to review</h4><ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">{copilot.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul></div>}
                {copilot.missingInformation.length > 0 && <div><h4 className="text-sm font-medium">Before finalizing</h4><ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">{copilot.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul></div>}
                <div className="flex gap-2"><Button size="sm" onClick={() => { setWasteFactor(copilot.wasteFactor); setComplexityNotes((previous) => `${previous}${previous ? "\n\n" : ""}${copilot.internalNotes}`); }}>Apply approved guidance</Button><Button size="sm" variant="outline" onClick={() => setCopilot(null)}>Dismiss</Button></div>
              </div>}
              {aiRecommendations.map((rec, i) => (
                <div key={i} className={`p-3 rounded-md text-sm flex gap-3 items-start ${
                  rec.type === 'alert' ? 'bg-destructive/10 text-destructive' :
                  rec.type === 'warning' ? 'bg-amber-500/10 text-amber-700' :
                  'bg-blue-500/10 text-blue-700'
                }`}>
                  {rec.type === 'alert' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {rec.type === 'warning' && <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
                  {rec.type === 'info' && <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                  <span>{rec.text}</span>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3 pt-4 border-t">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Install Complexity</div>
                  <div className={`text-lg font-bold ${
                    ai.installComplexity === 'High' ? 'text-destructive' :
                    ai.installComplexity === 'Medium' ? 'text-amber-600' : 'text-green-600'
                  }`}>{ai.installComplexity}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Suggested Waste</div>
                  <div className="text-lg font-bold">{ai.suggestedWaste}%</div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">Crew Recommendation</h4>
                <p className="text-sm text-muted-foreground">{ai.crewRec}</p>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">Schedule Recommendation</h4>
                <p className="text-sm text-muted-foreground">{ai.scheduleRec}</p>
                <div className="text-xs text-muted-foreground mt-1">
                  Est. {estimatedHours} hours · {recommendedCrewSize}-person crew · {estimatedDays} {estimatedDays === 1 ? 'day' : 'days'}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-1">Risk Areas</h4>
                <ul className="text-sm text-muted-foreground list-disc pl-4 space-y-0.5">
                  {ai.riskAreas.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>

              <div className="pt-3 border-t">
                <h4 className="text-sm font-medium mb-1">Customer-Facing Summary</h4>
                <p className="text-sm text-muted-foreground italic">{ai.customerSummary}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
