import { useMemo, useState } from "react";
import { useStore } from "@/hooks/use-store";
import { useAuth } from "@/contexts/auth";
import { useUrlState, useQueryControls } from "@/hooks/use-url-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ProductDialog } from "@/components/inventory/ProductDialog";
import { StockActivity } from "@/components/inventory/StockActivity";
import { PRODUCT_CATEGORIES, marginPct, stockStatus, stockStatusClass, productImageSrc } from "@/lib/inventory";
import { useOperation, currency, quantity, type StockSummary } from "@/lib/operations";
import { Plus, Search, Pencil, Archive, ArchiveRestore, Trash2, Package, ArrowDownUp } from "lucide-react";
import type { Product } from "@/lib/types";

type SortKey = "name" | "category" | "supplier" | "cost" | "price" | "quantityOnHand";
const selectStyle = "h-11 rounded-lg border bg-background px-3 text-sm";

export default function Inventory() {
  const { products, updateProduct, deleteProduct, queryState } = useStore();
  const { user } = useAuth();
  const canWrite = user?.role === "owner" || user?.role === "operations";
  const stock = useOperation<StockSummary[]>("/inventory/summary", ["owner", "operations"]);
  const [category, setCategory] = useUrlState<string>("category", "All");
  const [search, setSearch] = useUrlState<string>("q", "");
  const [state, setState] = useUrlState<string>("state", "active");
  const [filter, setFilter] = useUrlState<string>("stock", "all");
  const [sortKey, setSortKey] = useUrlState<SortKey>("sort", "name");
  const [sortDir, setSortDir] = useUrlState<string>("direction", "asc");
  const { update } = useQueryControls();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [activity, setActivity] = useState<Product | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const active = products.filter(p => p.active);
  const low = (p: Product) => ["Low Stock", "Out of Stock"].includes(stockStatus(p));
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => p.active === (state !== "archived"))
      .filter(p => category === "All" || category === p.category)
      .filter(p => filter === "all" || (filter === "low" ? low(p) : filter === "special" ? p.inventoryType === "Special Order" : p.inventoryType === "Inventory"))
      .filter(p => !q || [p.name, p.sku, p.supplier, p.color].some(v => v.toLowerCase().includes(q)))
      .sort((a, b) => {
        const key = ["name", "category", "supplier", "cost", "price", "quantityOnHand"].includes(sortKey) ? sortKey : "name";
        const av = a[key], bv = b[key];
        return (typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv))) * (sortDir === "desc" ? -1 : 1);
      });
  }, [products, category, search, state, filter, sortKey, sortDir]);
  const edit = (p: Product | null) => { setEditing(p); setDialogOpen(true); };
  const mutate = async (action: () => Promise<unknown>) => { setBusy(true); setError(""); try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update the product."); } finally { setBusy(false); } };
  const actions = (p: Product) => <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" onClick={() => setActivity(p)}>Stock activity</Button>{canWrite && <><Button variant="ghost" size="icon" aria-label={`Edit ${p.name}`} onClick={() => edit(p)}><Pencil className="h-4 w-4" /></Button><Button disabled={busy} variant="ghost" size="icon" aria-label={`${p.active ? "Archive" : "Restore"} ${p.name}`} onClick={() => mutate(() => updateProduct(p.id, { active: !p.active }))}>{p.active ? <Archive className="h-4 w-4" /> : <ArchiveRestore className="h-4 w-4" />}</Button>{user?.role === "owner" && !p.active && <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => setDeleteTarget(p)}><Trash2 className="h-4 w-4" /></Button>}</>}</div>;
  const thumbnail = (p: Product) => p.imageUrl ? <img src={productImageSrc(p.imageUrl)} alt={`${p.name} product photograph`} className="h-14 w-14 shrink-0 rounded-lg border object-cover" /> : <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted text-muted-foreground"><Package className="h-4 w-4" /><span className="mt-1 text-[10px]">No image</span></div>;
  const stockNumbers = (p: Product) => {
    const s = stock.data?.find(v => v.productId === p.id);
    return <div className="text-sm tabular-nums"><span className="font-medium">{s ? quantity(s.available) : "—"} {p.unit} available</span><p className="mt-1 text-xs text-muted-foreground">{s ? `${quantity(s.onHand)} on hand · ${quantity(s.reserved)} reserved` : stock.isError ? "Stock unavailable" : "Loading stock…"}</p></div>;
  };
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Inventory</h1><p className="mt-1 text-sm text-muted-foreground">Product specifications, available stock, and movements.</p></div>{canWrite && <Button onClick={() => edit(null)}><Plus className="mr-2 h-4 w-4" />Add product</Button>}</header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
      { label: "Active products", value: active.length.toLocaleString(), detail: "Catalog records", filter: "all" },
      { label: "Stock at cost", value: currency(active.filter(p => p.inventoryType === "Inventory").reduce((s, p) => s + p.cost * p.quantityOnHand, 0)), detail: "On-hand inventory", filter: "inventory" },
      { label: "Reorder attention", value: active.filter(low).length.toLocaleString(), detail: "At or below configured levels", filter: "low" },
      { label: "Special order", value: active.filter(p => p.inventoryType === "Special Order").length.toLocaleString(), detail: "Ordered for each project", filter: "special" },
    ].map(s => <button key={s.label} onClick={() => update({ stock: s.filter === "all" ? null : s.filter, state: null, category: null, q: null })} className="rounded-xl border bg-card p-4 text-left hover:bg-muted/40"><p className="text-xs font-medium text-muted-foreground">{s.label}</p><p className="my-1 text-xl font-semibold tabular-nums">{queryState.products.isLoading ? "—" : s.value}</p><p className="text-xs text-muted-foreground">{s.detail}</p></button>)}</div>
    <div className="flex flex-wrap gap-2"><label className="relative min-w-48 flex-1"><span className="sr-only">Search inventory</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input className="h-11 pl-9" placeholder="Search name, SKU, supplier, color…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Product category" className={selectStyle} value={category} onChange={e => setCategory(e.target.value)}><option value="All">All categories</option>{PRODUCT_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select><select aria-label="Product status" className={selectStyle} value={state} onChange={e => setState(e.target.value)}><option value="active">Active</option><option value="archived">Archived</option></select><select aria-label="Sort products" className={selectStyle} value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}>{["name", "category", "supplier", "cost", "price", "quantityOnHand"].map(k => <option key={k} value={k}>{k === "quantityOnHand" ? "Stock quantity" : k[0].toUpperCase() + k.slice(1)}</option>)}</select><Button variant="outline" className="h-11" aria-label={`Sort ${sortDir === "asc" ? "descending" : "ascending"}`} onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}><ArrowDownUp className="h-4 w-4" /><span className="ml-2">{sortDir === "asc" ? "Ascending" : "Descending"}</span></Button></div>
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span>{filtered.length} products{filter !== "all" && ` · ${filter === "low" ? "Reorder attention" : filter === "special" ? "Special orders" : "Stocked inventory"}`}</span>{(search || category !== "All" || filter !== "all" || state !== "active") && <Button size="sm" variant="ghost" onClick={() => update({ q: null, category: null, stock: null, state: null })}>Clear filters</Button>}</div>
    {(error || queryState.products.error) && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error || "The product catalog could not load. Refresh to try again."}</p>}
    {queryState.products.isLoading ? <p role="status" className="p-8 text-center text-muted-foreground">Loading products…</p> : !queryState.products.error && filtered.length === 0 ? <div className="rounded-xl border border-dashed p-10 text-center"><Package className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><h2 className="font-semibold">No products match this view</h2><p className="mt-1 text-sm text-muted-foreground">Adjust your filters or add a product to the catalog.</p></div> : <>
      <div className="space-y-3 md:hidden">{filtered.map(p => <article key={p.id} className="rounded-xl border bg-card p-4"><div className="flex gap-3">{thumbnail(p)}<div className="min-w-0 flex-1"><h2 className="font-semibold break-words">{p.name}</h2><p className="mt-1 text-xs text-muted-foreground">{p.sku || "SKU not set"} · {p.category}</p></div></div><div className="my-3 flex flex-wrap justify-between gap-2">{stockNumbers(p)}<div className="text-right text-sm"><strong>{currency(p.price)}</strong><p className="text-xs text-muted-foreground">per {p.unit}</p></div></div><Badge className={stockStatusClass(stockStatus(p))}>{stockStatus(p)}</Badge><details className="my-3 text-sm"><summary className="cursor-pointer text-muted-foreground">Specifications & pricing</summary><dl className="mt-3 grid grid-cols-2 gap-2"><dt>Supplier</dt><dd>{p.supplier || "Not recorded"}</dd><dt>Cost / unit</dt><dd>{currency(p.cost)}</dd><dt>Coverage / unit</dt><dd>{p.coveragePerUnit == null ? "Not verified" : `${quantity(p.coveragePerUnit)} sq ft`}</dd><dt>Order multiple</dt><dd>{p.orderMultiple ?? 1}</dd><dt>Minimum order</dt><dd>{p.minimumOrderQty ?? 0}</dd></dl></details>{actions(p)}</article>)}</div>
      <div className="hidden rounded-xl border bg-card md:block"><table className="w-full table-fixed text-left text-sm"><thead className="border-b bg-muted/40 text-xs text-muted-foreground"><tr><th className="w-[30%] p-3" aria-sort={sortKey === "name" ? sortDir === "desc" ? "descending" : "ascending" : "none"}>Product / supplier</th><th className="w-[18%] p-3">Price / cost</th><th className="w-[26%] p-3">Availability</th><th className="p-3">Actions</th></tr></thead><tbody>{filtered.map(p => <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20"><td className="p-3"><div className="flex gap-3">{thumbnail(p)}<div className="min-w-0"><p className="font-semibold break-words">{p.name}</p><p className="mt-1 text-xs text-muted-foreground break-words">{p.sku || "SKU not set"} · {p.category}</p><p className="text-xs text-muted-foreground">{p.supplier}</p></div></div></td><td className="p-3 tabular-nums"><p className="font-medium">{currency(p.price)} / {p.unit}</p><p className="mt-1 text-xs text-muted-foreground">Cost {currency(p.cost)}{marginPct(p.cost, p.price) != null && ` · ${marginPct(p.cost, p.price)!.toFixed(1)}% margin`}</p></td><td className="p-3">{stockNumbers(p)}<Badge className={`mt-2 ${stockStatusClass(stockStatus(p))}`}>{stockStatus(p)}</Badge></td><td className="p-3">{actions(p)}</td></tr>)}</tbody></table></div>
    </>}
    <ProductDialog open={dialogOpen} onOpenChange={setDialogOpen} product={editing} />
    {activity && <StockActivity product={activity} onClose={() => setActivity(null)} />}
    <Dialog open={!!deleteTarget} onOpenChange={v => !v && !busy && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Delete archived product?</DialogTitle><DialogDescription>{deleteTarget?.name} can only be deleted if it has no business history. Archived records remain available for historical documents.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => mutate(async () => { if (deleteTarget) await deleteProduct(deleteTarget.id); setDeleteTarget(null); })}>{busy ? "Deleting…" : "Delete product"}</Button></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</DialogContent></Dialog>
  </div>;
}
