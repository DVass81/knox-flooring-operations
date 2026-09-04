import { useEffect, useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { useStore } from "@/hooks/use-store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectOrOther } from "@/components/ui/select-or-other";
import { SUPPLIERS } from "@/lib/options";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImagePlus, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  PRODUCT_INVENTORY_TYPES,
  marginPct,
  productImageSrc,
} from "@/lib/inventory";
import type {
  Product,
  ProductCategory,
  ProductUnit,
  ProductInventoryType,
} from "@/lib/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing product to edit; omit for create mode */
  product?: Product | null;
}

export function ProductDialog({ open, onOpenChange, product }: Props) {
  const { addProduct, updateProduct } = useStore();
  const { toast } = useToast();
  const isEdit = Boolean(product);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Vinyl Plank");
  const [sku, setSku] = useState("");
  const [supplier, setSupplier] = useState("");
  const [color, setColor] = useState("");
  const [unit, setUnit] = useState<ProductUnit>("sqft");
  const [cost, setCost] = useState(0);
  const [price, setPrice] = useState(0);
  const [quantityOnHand, setQuantityOnHand] = useState(0);
  const [inventoryType, setInventoryType] =
    useState<ProductInventoryType>("Inventory");
  const [active, setActive] = useState(true);
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadFile, isUploading } = useUpload({
    onError: (err: Error) =>
      toast({
        title: "Image upload failed",
        description: err.message,
        variant: "destructive",
      }),
  });

  useEffect(() => {
    if (!open) return;
    if (product) {
      setName(product.name);
      setCategory(product.category);
      setSku(product.sku);
      setSupplier(product.supplier);
      setColor(product.color);
      setUnit(product.unit);
      setCost(product.cost);
      setPrice(product.price);
      setQuantityOnHand(product.quantityOnHand);
      setInventoryType(product.inventoryType);
      setActive(product.active);
      setNotes(product.notes);
      setImageUrl(product.imageUrl ?? "");
    } else {
      setName("");
      setCategory("Vinyl Plank");
      setSku("");
      setSupplier("");
      setColor("");
      setUnit("sqft");
      setCost(0);
      setPrice(0);
      setQuantityOnHand(0);
      setInventoryType("Inventory");
      setActive(true);
      setNotes("");
      setImageUrl("");
    }
  }, [open, product]);

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await uploadFile(file);
    if (result) {
      setImageUrl(result.objectPath);
      toast({ title: "Photo uploaded" });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const margin = marginPct(cost, price);

  const handleSave = async () => {
    if (name.trim() === "") {
      toast({ title: "Product name is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: name.trim(),
      category,
      sku: sku.trim(),
      supplier: supplier.trim(),
      color: color.trim(),
      unit,
      cost,
      price,
      quantityOnHand: inventoryType === "Special Order" ? 0 : quantityOnHand,
      inventoryType,
      active,
      notes: notes.trim(),
      imageUrl: imageUrl || null,
    };
    setSaving(true);
    try {
      if (product) {
        await updateProduct(product.id, payload);
        toast({ title: "Product updated" });
      } else {
        await addProduct(payload);
        toast({ title: "Product added" });
      }
      onOpenChange(false);
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product Photo</Label>
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border bg-muted/40 flex items-center justify-center">
                {imageUrl ? (
                  <img
                    src={productImageSrc(imageUrl)}
                    alt="Product"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-7 w-7 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ImagePlus className="w-4 h-4 mr-2" />
                  )}
                  {isUploading
                    ? "Uploading…"
                    : imageUrl
                      ? "Replace Photo"
                      : "Upload Photo"}
                </Button>
                {imageUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    onClick={() => setImageUrl("")}
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Remove
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageFile}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Product Name</Label>
            <Input
              placeholder="e.g. Coretec Pro Plus 7&quot; Oak"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v: ProductCategory) => setCategory(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>SKU / Style #</Label>
              <Input
                placeholder="e.g. CP-7OAK-NAT"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Supplier / Manufacturer</Label>
              <SelectOrOther
                value={supplier}
                options={SUPPLIERS}
                placeholder="Select supplier"
                otherPlaceholder="Custom supplier"
                onChange={setSupplier}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color / Finish</Label>
              <Input
                placeholder="e.g. Natural Oak"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(v: ProductUnit) => setUnit(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cost ($/{unit})</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Sell Price ($/{unit})</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5">
              <Label>Inventory Type</Label>
              <Select
                value={inventoryType}
                onValueChange={(v: ProductInventoryType) => setInventoryType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_INVENTORY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>On-Hand Qty ({unit})</Label>
              <Input
                type="number"
                min={0}
                step="any"
                value={quantityOnHand}
                disabled={inventoryType === "Special Order"}
                onChange={(e) => setQuantityOnHand(Number(e.target.value))}
              />
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">
                Margin
              </div>
              <div className="text-lg font-bold">
                {margin === null ? "—" : `${margin.toFixed(0)}%`}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div>
              <Label className="cursor-pointer">Active</Label>
              <p className="text-xs text-muted-foreground">
                Archived products stay hidden from the catalog.
              </p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lead time, packaging, warranty, etc."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isUploading}>
            {isEdit ? "Save Changes" : "Add Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
