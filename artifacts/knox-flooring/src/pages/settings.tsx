import { useEffect, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { OWNER_ROLES } from "@/lib/options";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { resolveStages } from "@/lib/lead-links";
import { WON_STAGE, LOST_STAGE, type CommissionBasis } from "@/lib/types";
import { QuickBooksSettings } from "@/components/settings/QuickBooksSettings";
import { DemoSettings } from "@/components/settings/DemoSettings";
import { useAuth } from "@/contexts/auth";

export default function Settings() {
  const { settings, updateSettings } = useStore();
  const { changePassword } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState(settings);
  const [stages, setStages] = useState<string[]>(
    resolveStages(settings.leadStages).filter(
      (s) => s !== WON_STAGE && s !== LOST_STAGE,
    ),
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    setForm(settings);
    setStages(
      resolveStages(settings.leadStages).filter(
        (s) => s !== WON_STAGE && s !== LOST_STAGE,
      ),
    );
  }, [settings]);

  const set = (updates: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...updates }));

  const setStage = (index: number, value: string) =>
    setStages((prev) => prev.map((s, i) => (i === index ? value : s)));

  const addStage = () => setStages((prev) => [...prev, ""]);

  const removeStage = (index: number) =>
    setStages((prev) => prev.filter((_, i) => i !== index));

  const moveStage = (index: number, dir: -1 | 1) =>
    setStages((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const saveStages = async () => {
    const cleaned = stages.map((s) => s.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      toast({
        title: "Add at least one stage",
        description: "The pipeline needs at least one open stage.",
        variant: "destructive",
      });
      return;
    }
    const unique = new Set(cleaned.map((s) => s.toLowerCase()));
    if (unique.size !== cleaned.length) {
      toast({
        title: "Stage names must be unique",
        variant: "destructive",
      });
      return;
    }
    const reserved = cleaned.find(
      (s) =>
        s.toLowerCase() === WON_STAGE.toLowerCase() ||
        s.toLowerCase() === LOST_STAGE.toLowerCase(),
    );
    if (reserved) {
      toast({
        title: `"${reserved}" is reserved`,
        description: `"${WON_STAGE}" and "${LOST_STAGE}" are added automatically.`,
        variant: "destructive",
      });
      return;
    }
    await updateSettings({ leadStages: cleaned });
    toast({
      title: "Pipeline stages saved",
      description: "Your lead pipeline columns were updated.",
    });
  };

  const saveOwner = async () => {
    await updateSettings({ ownerName: form.ownerName, ownerRole: form.ownerRole });
    toast({ title: "Owner saved", description: "Owner profile updated." });
  };

  const savePassword = async () => {
    if (newPassword.length < 12) { toast({ title: "Password is too short", description: "Use at least 12 characters.", variant: "destructive" }); return; }
    if (newPassword !== confirmPassword) { toast({ title: "Passwords do not match", variant: "destructive" }); return; }
    setPasswordBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast({ title: "Password updated", description: "Use the new password the next time you sign in." });
    } catch (error) {
      toast({ title: "Password was not changed", description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setPasswordBusy(false); }
  };

  const saveProfile = async () => {
    await updateSettings({
      companyName: form.companyName,
      phone: form.phone,
      email: form.email,
      website: form.website,
      address: form.address,
    });
    toast({ title: "Profile saved", description: "Company profile updated." });
  };

  const saveDefaults = async () => {
    await updateSettings({
      defaultWasteFactor: form.defaultWasteFactor,
      defaultLaborRateLVP: form.defaultLaborRateLVP,
      defaultLaborRateHardwood: form.defaultLaborRateHardwood,
      defaultLaborRateCarpet: form.defaultLaborRateCarpet,
      defaultLaborRateTile: form.defaultLaborRateTile,
    });
    toast({ title: "Defaults saved", description: "Estimator defaults updated." });
  };

  const saveCommission = async () => {
    await updateSettings({
      commissionBasis: form.commissionBasis,
      defaultCommissionRate: form.defaultCommissionRate,
    });
    toast({
      title: "Commission settings saved",
      description: "Default commission scheme updated.",
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your company profile and estimator defaults.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Owner Profile</CardTitle>
          <CardDescription>Shown in the sidebar and used to identify the account owner.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Owner Name</Label>
              <Input
                value={form.ownerName}
                onChange={(e) => set({ ownerName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <SelectOrOther
                value={form.ownerRole}
                options={OWNER_ROLES}
                placeholder="Select role"
                otherPlaceholder="Custom role"
                onChange={(v) => set({ ownerRole: v })}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={saveOwner}>
            Save Owner
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Owner Password</CardTitle>
          <CardDescription>Change the demo owner password without changing any business or accounting data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
          </div>
          <Button disabled={passwordBusy || !currentPassword || !newPassword || !confirmPassword} onClick={savePassword}>{passwordBusy ? "Updating…" : "Update Password"}</Button>
        </CardContent>
      </Card>

      <QuickBooksSettings />
      <DemoSettings />

      <Card>
        <CardHeader>
          <CardTitle>Company Profile</CardTitle>
          <CardDescription>This information appears on proposals and invoices.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={form.companyName}
                onChange={(e) => set({ companyName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                value={form.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={(e) => set({ website: e.target.value })}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={saveProfile}>
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lead Pipeline Stages</CardTitle>
          <CardDescription>
            Customize the open stages (columns) of your lead pipeline board.
            "{WON_STAGE}" and "{LOST_STAGE}" are always added at the end as
            terminal stages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {stages.map((stage, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={stage}
                  placeholder="Stage name"
                  onChange={(e) => setStage(index, e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => moveStage(index, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  disabled={index === stages.length - 1}
                  onClick={() => moveStage(index, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => removeStage(index)}
                  aria-label="Remove stage"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1 text-sm text-muted-foreground">
              <span className="rounded bg-emerald-500/15 px-2 py-1 font-medium text-emerald-600">
                {WON_STAGE}
              </span>
              <span className="rounded bg-destructive/10 px-2 py-1 font-medium text-destructive">
                {LOST_STAGE}
              </span>
              <span className="text-xs">(terminal — always present)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={addStage}>
              <Plus className="mr-2 h-4 w-4" /> Add Stage
            </Button>
            <Button type="button" onClick={saveStages}>
              Save Stages
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Estimator Defaults</CardTitle>
          <CardDescription>Default labor rates and waste factors used in the AI Estimator.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Default Waste Factor (%)</Label>
              <Input
                type="number"
                value={form.defaultWasteFactor}
                onChange={(e) => set({ defaultWasteFactor: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default LVP Labor ($/sqft)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.defaultLaborRateLVP}
                onChange={(e) => set({ defaultLaborRateLVP: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Hardwood Labor ($/sqft)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.defaultLaborRateHardwood}
                onChange={(e) => set({ defaultLaborRateHardwood: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Carpet Labor ($/sqft)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.defaultLaborRateCarpet}
                onChange={(e) => set({ defaultLaborRateCarpet: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Tile Labor ($/sqft)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.defaultLaborRateTile}
                onChange={(e) => set({ defaultLaborRateTile: Number(e.target.value) })}
              />
            </div>
          </div>
          <Button className="mt-4" onClick={saveDefaults}>
            Save Defaults
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commission Defaults</CardTitle>
          <CardDescription>
            How sales commissions are calculated across the team. Individual reps can
            override the rate on their profile.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Commission Basis</Label>
              <Select
                value={form.commissionBasis}
                onValueChange={(v: CommissionBasis) => set({ commissionBasis: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gross Profit">Gross Profit</SelectItem>
                  <SelectItem value="Revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Commissions are paid as a percentage of{" "}
                {form.commissionBasis.toLowerCase()}.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Default Commission Rate (%)</Label>
              <Input
                type="number"
                min={0}
                step="0.1"
                value={form.defaultCommissionRate}
                onChange={(e) =>
                  set({ defaultCommissionRate: Number(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Applied to any rep without a custom rate.
              </p>
            </div>
          </div>
          <Button className="mt-4" onClick={saveCommission}>
            Save Commission Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
