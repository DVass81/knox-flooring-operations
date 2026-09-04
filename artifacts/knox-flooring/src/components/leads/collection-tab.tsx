import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export type FieldType = "text" | "number" | "date" | "textarea" | "select";

export interface FieldDef {
  key: string;
  label: string;
  type?: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
}

export interface CollectionItem {
  id: string;
  createdAt: string;
}

interface CollectionTabProps<T extends CollectionItem> {
  description?: string;
  addLabel: string;
  emptyLabel: string;
  items: T[];
  fields: FieldDef[];
  /** Field key used as the heading for each saved item. */
  titleKey: keyof T & string;
  onSave: (items: T[]) => Promise<void> | void;
  /** Custom rendering for a saved item (overrides the default). */
  renderItem?: (item: T, helpers: ItemHelpers<T>) => ReactNode;
}

export interface ItemHelpers<T extends CollectionItem> {
  remove: (id: string) => void;
  patch: (id: string, partial: Partial<T>) => void;
}

function buildItem<T extends CollectionItem>(
  fields: FieldDef[],
  values: Record<string, string>,
): T {
  const out: Record<string, unknown> = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  for (const f of fields) {
    const raw = (values[f.key] ?? "").trim();
    if (raw === "") continue;
    out[f.key] = f.type === "number" ? Number(raw) : raw;
  }
  return out as T;
}

export function CollectionTab<T extends CollectionItem>({
  description,
  addLabel,
  emptyLabel,
  items,
  fields,
  titleKey,
  onSave,
  renderItem,
}: CollectionTabProps<T>) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});

  const helpers: ItemHelpers<T> = {
    remove: (id) => onSave(items.filter((i) => i.id !== id)),
    patch: (id, partial) =>
      onSave(items.map((i) => (i.id === id ? { ...i, ...partial } : i))),
  };

  const reset = () => setValues({});

  const handleAdd = async () => {
    const missing = fields.find(
      (f) => f.required && !(values[f.key] ?? "").trim(),
    );
    if (missing) {
      toast({
        title: `${missing.label} is required`,
        variant: "destructive",
      });
      return;
    }
    const item = buildItem<T>(fields, values);
    await onSave([...items, item]);
    reset();
    setOpen(false);
    toast({ title: "Saved" });
  };

  const sorted = [...items].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : (
          <span />
        )}
        <Button
          size="sm"
          onClick={() => {
            reset();
            setOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" /> {addLabel}
        </Button>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {emptyLabel}
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((item) =>
            renderItem ? (
              <div key={item.id}>{renderItem(item, helpers)}</div>
            ) : (
              <div
                key={item.id}
                className="rounded-md border p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="font-medium text-sm text-foreground">
                    {String(
                      (item as Record<string, unknown>)[titleKey] ?? "—",
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {fields
                      .filter((f) => {
                        const v = (item as Record<string, unknown>)[f.key];
                        return f.key !== titleKey && v !== undefined && v !== "";
                      })
                      .map((f) => (
                        <span key={f.key}>
                          <span className="font-medium">{f.label}:</span>{" "}
                          {String((item as Record<string, unknown>)[f.key])}
                        </span>
                      ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => helpers.remove(item.id)}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ),
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{addLabel}</DialogTitle>
            {description && (
              <DialogDescription>{description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="grid sm:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div
                key={f.key}
                className={f.fullWidth ? "sm:col-span-2 space-y-2" : "space-y-2"}
              >
                <Label>
                  {f.label}
                  {f.required ? " *" : ""}
                </Label>
                {f.type === "textarea" ? (
                  <Textarea
                    value={values[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  />
                ) : f.type === "select" ? (
                  <Select
                    value={values[f.key] ?? ""}
                    onValueChange={(val) =>
                      setValues((v) => ({ ...v, [f.key]: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(f.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type={
                      f.type === "number"
                        ? "number"
                        : f.type === "date"
                          ? "date"
                          : "text"
                    }
                    value={values[f.key] ?? ""}
                    placeholder={f.placeholder}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>{addLabel}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
