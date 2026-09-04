import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { productImageSrc } from "@/lib/inventory";
import { Package } from "lucide-react";
import type { Product } from "@/lib/types";

interface ProductComboboxProps {
  value: string;
  onChange: (value: string) => void;
  onSelectProduct?: (product: Product) => void;
  products: Product[];
  /** Which product field the value represents and is matched against. */
  field?: "name" | "sku";
  placeholder?: string;
  className?: string;
}

export function ProductCombobox({
  value,
  onChange,
  onSelectProduct,
  products,
  field = "name",
  placeholder = "Search catalog…",
  className,
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const active = products.filter((p) => p.active);
  const term = search.trim().toLowerCase();
  const filtered = term
    ? active.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku.toLowerCase().includes(term) ||
          p.color.toLowerCase().includes(term),
      )
    : active;
  const shown = filtered.slice(0, 50);

  const matchesValue = (p: Product) =>
    (field === "sku" ? p.sku : p.name) === value;

  const handleSelectProduct = (product: Product) => {
    onChange(field === "sku" ? product.sku : product.name);
    onSelectProduct?.(product);
    setOpen(false);
    setSearch("");
  };

  const handleUseCustom = () => {
    onChange(search.trim());
    setOpen(false);
    setSearch("");
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {shown.length === 0 && (
              <CommandEmpty>No catalog matches.</CommandEmpty>
            )}
            {shown.length > 0 && (
              <CommandGroup heading="Catalog">
                {shown.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={p.id}
                    onSelect={() => handleSelectProduct(p)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        matchesValue(p) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="mr-2 h-8 w-8 shrink-0 overflow-hidden rounded border bg-muted/40 flex items-center justify-center">
                      {p.imageUrl ? (
                        <img
                          src={productImageSrc(p.imageUrl)}
                          alt={p.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <Package className="h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate">{p.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {p.sku} · {p.category}
                        {p.color ? ` · ${p.color}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {term && (
              <CommandGroup heading="Custom">
                <CommandItem
                  value={`__custom__${search}`}
                  onSelect={handleUseCustom}
                >
                  Use “{search.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
