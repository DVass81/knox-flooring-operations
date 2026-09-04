import { useMemo, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Archive,
  ArchiveRestore,
  Package,
  PackageX,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import {
  PRODUCT_CATEGORIES,
  marginPct,
  stockStatus,
  stockStatusClass,
  productImageSrc,
} from "@/lib/inventory";
import type { Product } from "@/lib/types";

type CategoryFilter = "All" | (typeof PRODUCT_CATEGORIES)[number];
type SortKey =
  | "name"
  | "category"
  | "supplier"
  | "cost"
  | "price"
  | "margin"
  | "quantityOnHand";
type SortDir = "asc" | "desc";

const currency = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const qtyFmt = (n: number) =>
  n.toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function Inventory() {
  const { products, updateProduct, deleteProduct } = useStore();
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const visible = useMemo(
    () => products.filter((p) => (showArchived ? !p.active : p.active)),
    [products, showArchived],
  );

  const stats = useMemo(() => {
    const active = products.filter((p) => p.active);
    const inventory = active.filter((p) => p.inventoryType === "Inventory");
    const stockValue = inventory.reduce(
      (acc, p) => acc + p.cost * p.quantityOnHand,
      0,
    );
    const lowOrOut = inventory.filter((p) => {
      const s = stockStatus(p);
      return s === "Low Stock" || s === "Out of Stock";
    }).length;
    const specialOrder = active.filter(
      (p) => p.inventoryType === "Special Order",
    ).length;
    return {
      total: active.length,
      stockValue,
      lowOrOut,
      specialOrder,
    };
  }, [products]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: visible.length };
    for (const cat of PRODUCT_CATEGORIES) c[cat] = 0;
    for (const p of visible) c[p.category] = (c[p.category] || 0) + 1;
    return c;
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = visible
      .filter((p) => category === "All" || p.category === category)
      .filter(
        (p) =>
          q === "" ||
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.supplier.toLowerCase().includes(q) ||
          p.color.toLowerCase().includes(q),
      );

    const dir = sortDir === "asc" ? 1 : -1;
    return rows.sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      switch (sortKey) {
        case "margin":
          av = marginPct(a.cost, a.price) ?? -Infinity;
          bv = marginPct(b.cost, b.price) ?? -Infinity;
          break;
        case "cost":
        case "price":
        case "quantityOnHand":
          av = a[sortKey];
          bv = b[sortKey];
          break;
        default:
          av = a[sortKey].toLowerCase();
          bv = b[sortKey].toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [visible, category, search, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortHeader = ({
    label,
    sortField,
    align = "left",
  }: {
    label: string;
    sortField: SortKey;
    align?: "left" | "right";
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(sortField)}
      className={cn(
        "inline-flex items-center gap-1 font-medium select-none hover:text-foreground transition-colors",
        align === "right" && "flex-row-reverse",
      )}
    >
      {label}
      {sortKey === sortField ? (
        sortDir === "asc" ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )
      ) : (
        <ChevronUp className="w-3.5 h-3.5 opacity-20" />
      )}
    </button>
  );

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: Product) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteTarget) await deleteProduct(deleteTarget.id);
    setDeleteTarget(null);
  };

  const toggleArchive = async (p: Product) => {
    await updateProduct(p.id, { active: !p.active });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Inventory
          </h1>
          <p className="text-muted-foreground mt-1">
            Your product catalog — what the store carries, by category.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">In the catalog</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inventory Value
            </CardTitle>
            <Package className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {`$${stats.stockValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
            </div>
            <p className="text-xs text-muted-foreground">On-hand at cost</p>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">
              Low / Out of Stock
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {stats.lowOrOut}
            </div>
            <p className="text-xs text-muted-foreground">Stocked items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Special Order</CardTitle>
            <PackageX className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.specialOrder}</div>
            <p className="text-xs text-muted-foreground">Non-stock items</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(["All", ...PRODUCT_CATEGORIES] as CategoryFilter[]).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors border",
                category === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground hover:bg-muted border-border",
              )}
            >
              {c} <span className="opacity-70">({counts[c] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search name, SKU, supplier, color..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={showArchived ? "archived" : "active"}
            onValueChange={(v) => setShowArchived(v === "archived")}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active products</SelectItem>
              <SelectItem value="archived">Archived products</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <SortHeader label="Product" sortField="name" />
                </TableHead>
                <TableHead>
                  <SortHeader label="Category" sortField="category" />
                </TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>
                  <SortHeader label="Supplier" sortField="supplier" />
                </TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Cost" sortField="cost" align="right" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Price" sortField="price" align="right" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader label="Margin" sortField="margin" align="right" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHeader
                    label="On Hand"
                    sortField="quantityOnHand"
                    align="right"
                  />
                </TableHead>
                <TableHead>Stock</TableHead>
                <TableHead className="w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const status = stockStatus(p);
                const margin = marginPct(p.cost, p.price);
                return (
                  <TableRow key={p.id} className={cn(!p.active && "opacity-60")}>
                    <TableCell className="font-medium max-w-[260px]">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border bg-muted/40 flex items-center justify-center">
                          {p.imageUrl ? (
                            <img
                              src={productImageSrc(p.imageUrl)}
                              alt={p.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <Package className="h-4 w-4 text-muted-foreground/40" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate">{p.name}</div>
                          {p.notes && (
                            <div className="text-xs text-muted-foreground truncate">
                              {p.notes}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {p.category}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground font-mono text-xs">
                      {p.sku || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {p.supplier || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {p.color || "—"}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {currency(p.cost)}
                      <span className="text-muted-foreground text-xs">
                        /{p.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      {currency(p.price)}
                      <span className="text-muted-foreground text-xs font-normal">
                        /{p.unit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {margin === null ? "—" : `${margin.toFixed(0)}%`}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {p.inventoryType === "Special Order"
                        ? "—"
                        : `${qtyFmt(p.quantityOnHand)} ${p.unit}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={stockStatusClass(status)}
                        variant="secondary"
                      >
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={p.active ? "Archive" : "Restore"}
                          onClick={() => toggleArchive(p)}
                        >
                          {p.active ? (
                            <Archive className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ArchiveRestore className="w-4 h-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete"
                          onClick={() => setDeleteTarget(p)}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11}>
                    <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                      <Package className="w-8 h-8 opacity-40" />
                      {showArchived
                        ? "No archived products."
                        : "No products match your filters."}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ProductDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={editing}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} will be permanently removed from the catalog.
              This cannot be undone — consider archiving instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
