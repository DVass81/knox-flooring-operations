import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useJobMaterials } from "@/hooks/use-store";
import type { JobMaterial } from "@/lib/types";

const emptyForm = { name: "", quantity: 0, unit: "" };

export function MaterialsNeeded({ jobId }: { jobId: string }) {
  const { materials, addMaterial, updateMaterial, deleteMaterial } =
    useJobMaterials(jobId);
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setIsOpen(true);
  };

  const openEdit = (m: JobMaterial) => {
    setEditingId(m.id);
    setForm({ name: m.name, quantity: m.quantity, unit: m.unit });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: form.name.trim(),
      quantity: Number(form.quantity) || 0,
      unit: form.unit.trim(),
    };
    if (editingId) {
      await updateMaterial(editingId, data);
      toast({ title: "Material updated" });
    } else {
      await addMaterial(data);
      toast({ title: "Material added" });
    }
    setIsOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle>Materials Needed</CardTitle>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Material
        </Button>
      </CardHeader>
      <CardContent>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-md border">
            No materials listed yet. Add the materials this job requires.
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-muted-foreground text-sm ml-2">
                    {m.quantity} {m.unit}
                  </span>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMaterial(m.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Material" : "Add Material"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Material Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Oak LVP"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="any"
                  value={form.quantity}
                  onChange={(e) =>
                    setForm({ ...form, quantity: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="e.g. sq ft, boxes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">
                {editingId ? "Save Material" : "Add Material"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
