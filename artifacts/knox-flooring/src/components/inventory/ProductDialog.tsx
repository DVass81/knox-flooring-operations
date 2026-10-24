import { useEffect, useRef, useState } from "react";
import { useUpload } from "@workspace/object-storage-web";
import { useStore } from "@/hooks/use-store";
import { useUnsavedForm } from "@/hooks/use-unsaved-changes";
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
  const [error, setError] = useState("");
  const [coverage, setCoverage] = useState<number | null>(null);
  const [multiple, setMultiple] = useState(1);
  const [minimum, setMinimum] = useState(0);
  const [reorder, setReorder] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const values = {
    name,
    category,
    sku,
    supplier,
    color,
    unit,
    cost,
    price,
    quantityOnHand,
    inventoryType,
    active,
    notes,
    imageUrl,
    coverage,
    multiple,
    minimum,
    reorder,
  };
  const initialValues = {
    name: product?.name ?? "",
    category: product?.category ?? "Vinyl Plank",
    sku: product?.sku ?? "",
    supplier: product?.supplier ?? "",
    color: product?.color ?? "",
    unit: product?.unit ?? "sqft",
    cost: product?.cost ?? 0,
    price: product?.price ?? 0,
    quantityOnHand: product?.quantityOnHand ?? 0,
    inventoryType: product?.inventoryType ?? "Inventory",
    active: product?.active ?? true,
    notes: product?.notes ?? "",
    imageUrl: product?.imageUrl ?? "",
    coverage: product?.coveragePerUnit ?? null,
    multiple: product?.orderMultiple ?? 1,
    minimum: product?.minimumOrderQty ?? 0,
    reorder: product?.reorderPoint ?? null,
  };
  const guard = useUnsavedForm(open, values);
  const close = (next: boolean) => {
    if (!saving && !isUploading && (next || guard.confirmDiscard()))
      onOpenChange(next);
  };

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
    guard.reset(initialValues);
    setError("");
    setCoverage(product?.coveragePerUnit ?? null);
    setMultiple(product?.orderMultiple ?? 1);
    setMinimum(product?.minimumOrderQty ?? 0);
    setReorder(product?.reorderPoint ?? null);
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
  }, [open, product?.id]);

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
    if (saving || isUploading) return;
    setError("");
    if (name.trim() === "") {
      setError("Product name is required.");
      return;
    }
    if (
      ![cost, price, quantityOnHand, minimum].every(
        (v) => Number.isFinite(v) && v >= 0,
      ) ||
      !Number.isFinite(multiple) ||
      multiple <= 0 ||
      (coverage !== null && (!Number.isFinite(coverage) || coverage <= 0)) ||
      (reorder !== null && (!Number.isFinite(reorder) || reorder < 0))
    ) {
      setError(
        "Use nonnegative costs, prices, stock, minimums and reorder points. Coverage and order multiples must be positive.",
      );
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
      quantityOnHand:
        inventoryType === "Special Order" || inventoryType === "Service"
          ? 0
          : quantityOnHand,
      inventoryType,
      active,
      notes: notes.trim(),
      imageUrl: imageUrl || null,
      coveragePerUnit: unit === "sqft" ? 1 : coverage,
      coverageUnit: "sqft",
      orderMultiple: multiple,
      minimumOrderQty: minimum,
      reorderPoint: reorder,
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
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Save failed. Your entries are preserved.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <fieldset disabled={saving} className="space-y-4">
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
            <Label htmlFor="product-name">Product Name</Label>
            <Input
              id="product-name"
              placeholder='e.g. Coretec Pro Plus 7" Oak'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="product-category">Category</Label>
              <Select
                value={category}
                onValueChange={(v: ProductCategory) => setCategory(v)}
              >
                <SelectTrigger id="product-category">
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
              <Label htmlFor="product-sku">SKU / Style #</Label>
              <Input
                id="product-sku"
                placeholder="e.g. CP-7OAK-NAT"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-supplier">Supplier / Manufacturer</Label>
              <SelectOrOther
                id="product-supplier"
                value={supplier}
                options={SUPPLIERS}
                placeholder="Select supplier"
                otherPlaceholder="Custom supplier"
                onChange={setSupplier}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-color">Color / Finish</Label>
              <Input
                id="product-color"
                placeholder="e.g. Natural Oak"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="product-unit">Unit</Label>
              <Select
                value={unit}
                onValueChange={(v: ProductUnit) => setUnit(v)}
              >
                <SelectTrigger id="product-unit">
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
              <Label htmlFor="product-cost">Cost ($/{unit})</Label>
              <Input
                id="product-cost"
                type="number"
                min={0}
                step="0.01"
                value={cost}
                onChange={(e) => setCost(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-price">Sell Price ($/{unit})</Label>
              <Input
                id="product-price"
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
              <Label htmlFor="product-type">Inventory Type</Label>
              <Select
                value={inventoryType}
                onValueChange={(v: ProductInventoryType) => setInventoryType(v)}
              >
                <SelectTrigger id="product-type">
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
              <Label htmlFor="product-stock">On-Hand Qty ({unit})</Label>
              <Input
                id="product-stock"
                type="number"
                min={0}
                step="any"
                value={quantityOnHand}
                disabled={
                  isEdit ||
                  inventoryType === "Special Order" ||
                  inventoryType === "Service"
                }
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

          {isEdit && (
            <p className="text-xs text-muted-foreground">
              Record receipts, usage and adjustments through Stock activity to
              preserve the inventory history.
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-sm">
              Coverage (sq ft per {unit})
              <Input
                type="number"
                min="0.000001"
                step="any"
                disabled={unit === "sqft"}
                value={unit === "sqft" ? 1 : (coverage ?? "")}
                placeholder="Verify manufacturer coverage"
                onChange={(e) =>
                  setCoverage(
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
            <label className="space-y-1.5 text-sm">
              Order multiple ({unit})
              <Input
                type="number"
                min="0.000001"
                step="any"
                value={multiple}
                onChange={(e) => setMultiple(Number(e.target.value))}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              Minimum order ({unit})
              <Input
                type="number"
                min="0"
                step="any"
                value={minimum}
                onChange={(e) => setMinimum(Number(e.target.value))}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              Reorder point ({unit})
              <Input
                type="number"
                min="0"
                step="any"
                value={reorder ?? ""}
                placeholder="Not configured"
                onChange={(e) =>
                  setReorder(
                    e.target.value === "" ? null : Number(e.target.value),
                  )
                }
              />
            </label>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div>
              <Label htmlFor="product-active" className="cursor-pointer">
                Active
              </Label>
              <p className="text-xs text-muted-foreground">
                Archived products stay hidden from the catalog.
              </p>
            </div>
            <Switch
              id="product-active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-notes">Notes</Label>
            <Textarea
              id="product-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Lead time, packaging, warranty, etc."
              rows={2}
            />
          </div>
        </fieldset>

        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-sm text-red-900"
          >
            {error}
          </p>
        )}
        <DialogFooter className="sticky bottom-0 border-t bg-background pt-4">
          <Button
            disabled={saving || isUploading}
            variant="outline"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || isUploading}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
