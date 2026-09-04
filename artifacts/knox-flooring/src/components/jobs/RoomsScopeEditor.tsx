import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Ruler } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Job, Room } from "@/lib/types";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function roomSqFt(room: Room): number {
  return Math.round(room.length * room.width);
}

function totalSqFt(rooms: Room[]): number {
  return rooms.reduce((sum, r) => sum + r.length * r.width, 0);
}

const emptyRoom = { name: "", length: 0, width: 0, scope: "" };

export function RoomsScopeEditor({
  job,
  updateJob,
}: {
  job: Job;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
}) {
  const { toast } = useToast();

  const [isRoomOpen, setIsRoomOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState(emptyRoom);

  const [scopeDraft, setScopeDraft] = useState(job.scopeOfWork);
  const [savingScope, setSavingScope] = useState(false);

  const persistRooms = async (rooms: Room[]) => {
    await updateJob(job.id, {
      rooms,
      squareFootage: Math.round(totalSqFt(rooms)),
    });
  };

  const openAddRoom = () => {
    setEditingRoomId(null);
    setRoomForm(emptyRoom);
    setIsRoomOpen(true);
  };

  const openEditRoom = (room: Room) => {
    setEditingRoomId(room.id);
    setRoomForm({
      name: room.name,
      length: room.length,
      width: room.width,
      scope: room.scope ?? "",
    });
    setIsRoomOpen(true);
  };

  const handleRoomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Room = {
      id: editingRoomId ?? uid(),
      name: roomForm.name.trim() || "Room",
      length: Number(roomForm.length) || 0,
      width: Number(roomForm.width) || 0,
      scope: roomForm.scope.trim() || undefined,
    };
    const rooms = editingRoomId
      ? job.rooms.map((r) => (r.id === editingRoomId ? next : r))
      : [...job.rooms, next];
    await persistRooms(rooms);
    setIsRoomOpen(false);
    setEditingRoomId(null);
    setRoomForm(emptyRoom);
    toast({ title: editingRoomId ? "Room updated" : "Room added" });
  };

  const removeRoom = async (id: string) => {
    await persistRooms(job.rooms.filter((r) => r.id !== id));
    toast({ title: "Room removed" });
  };

  const saveScope = async () => {
    setSavingScope(true);
    try {
      await updateJob(job.id, { scopeOfWork: scopeDraft });
      toast({ title: "Scope of work saved" });
    } finally {
      setSavingScope(false);
    }
  };

  const scopeChanged = scopeDraft !== job.scopeOfWork;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Rooms & Scope</CardTitle>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5" />
            {Math.round(totalSqFt(job.rooms))} sq ft total
          </p>
        </div>
        <Button size="sm" onClick={openAddRoom}>
          <Plus className="w-4 h-4 mr-2" /> Add Room
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {job.rooms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-md border">
            No rooms yet. Add the rooms involved in this job.
          </p>
        ) : (
          <div className="rounded-md border divide-y">
            {job.rooms.map((room) => (
              <div key={room.id} className="p-3 group">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-medium">{room.name}</span>
                    <span className="text-muted-foreground text-sm ml-2">
                      {room.length}' x {room.width}'
                    </span>
                    <span className="text-muted-foreground text-xs ml-2">
                      ({roomSqFt(room)} sq ft)
                    </span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditRoom(room)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeRoom(room.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {room.scope && (
                  <p className="text-sm text-muted-foreground mt-1.5 whitespace-pre-wrap">
                    {room.scope}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <Separator />

        <div className="space-y-2">
          <Label>Scope of Work (overall)</Label>
          <Textarea
            value={scopeDraft}
            onChange={(e) => setScopeDraft(e.target.value)}
            placeholder="Describe the work to be done for this job…"
            rows={4}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={saveScope}
              disabled={!scopeChanged || savingScope}
            >
              {savingScope ? "Saving…" : "Save Scope"}
            </Button>
          </div>
        </div>
      </CardContent>

      <Dialog open={isRoomOpen} onOpenChange={setIsRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoomId ? "Edit Room" : "Add Room"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRoomSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Room Name</Label>
              <Input
                value={roomForm.name}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, name: e.target.value })
                }
                placeholder="e.g. Living Room"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Length (ft)</Label>
                <Input
                  type="number"
                  step="any"
                  value={roomForm.length}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, length: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Width (ft)</Label>
                <Input
                  type="number"
                  step="any"
                  value={roomForm.width}
                  onChange={(e) =>
                    setRoomForm({ ...roomForm, width: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {Math.round((roomForm.length || 0) * (roomForm.width || 0))} sq ft
            </p>
            <div className="space-y-2">
              <Label>Scope for this room (optional)</Label>
              <Textarea
                value={roomForm.scope}
                onChange={(e) =>
                  setRoomForm({ ...roomForm, scope: e.target.value })
                }
                placeholder="e.g. Remove old carpet, install LVP, new baseboards"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="submit">
                {editingRoomId ? "Save Room" : "Add Room"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
