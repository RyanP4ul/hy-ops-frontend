"use client";

import * as React from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Eye,
  Package2,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type ProductStatus = "Active" | "Archived";

type VariantDraft = {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  price: string;
  unit: string;
  weightKg: string;
  widthValue: string;
  widthUnit: string;
  lengthValue: string;
  lengthUnit: string;
  heightValue: string;
  heightUnit: string;
  material: string;
  color: string;
  size: string;
  lowStockThreshold: string;
  highStockThreshold: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  status: ProductStatus;
  variantCount: number;
  updatedAt: string;
  variants: VariantDraft[];
};

const makeVariant = (): VariantDraft => ({
  id: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: "",
  sku: "",
  barcode: "",
  description: "",
  price: "",
  unit: "roll",
  weightKg: "",
  widthValue: "",
  widthUnit: "m",
  lengthValue: "",
  lengthUnit: "m",
  heightValue: "",
  heightUnit: "cm",
  material: "",
  color: "",
  size: "",
  lowStockThreshold: "20",
  highStockThreshold: "100",
});

const seedProducts: Product[] = [
  {
    id: "PRD-001",
    name: "Tarpaulin",
    description: "Tarpaulin rolls for printing and covering.",
    category: "Covering",
    brand: "HY",
    status: "Active",
    variantCount: 3,
    updatedAt: "Oct 9, 2026",
    variants: [],
  },
  {
    id: "PRD-002",
    name: "Sakolin",
    description: "Flexible flooring material in different widths.",
    category: "Flooring",
    brand: "HY",
    status: "Active",
    variantCount: 4,
    updatedAt: "Oct 8, 2026",
    variants: [],
  },
  {
    id: "PRD-003",
    name: "Linoleum",
    description: "Floor covering sold by thickness and roll size.",
    category: "Flooring",
    brand: "HY",
    status: "Active",
    variantCount: 5,
    updatedAt: "Oct 7, 2026",
    variants: [],
  },
  {
    id: "PRD-004",
    name: "PVC Pipe",
    description: "PVC pipe for general construction use.",
    category: "Construction",
    brand: "HY",
    status: "Active",
    variantCount: 2,
    updatedAt: "Oct 6, 2026",
    variants: [],
  },
  {
    id: "PRD-005",
    name: "Packaging Tape",
    description: "Adhesive tape for packing and shipping.",
    category: "Packaging",
    brand: "HY",
    status: "Active",
    variantCount: 3,
    updatedAt: "Oct 5, 2026",
    variants: [],
  },
  {
    id: "PRD-006",
    name: "Plastic Sheet",
    description: "Protective plastic sheet in assorted sizes.",
    category: "Covering",
    brand: "HY",
    status: "Archived",
    variantCount: 2,
    updatedAt: "Oct 3, 2026",
    variants: [],
  },
  {
    id: "PRD-007",
    name: "Floor Mat",
    description: "Textured mat for indoor and commercial use.",
    category: "Flooring",
    brand: "HY",
    status: "Active",
    variantCount: 4,
    updatedAt: "Oct 2, 2026",
    variants: [],
  },
  {
    id: "PRD-008",
    name: "Stretch Film",
    description: "Stretch wrap for palletizing products.",
    category: "Packaging",
    brand: "HY",
    status: "Active",
    variantCount: 2,
    updatedAt: "Sep 30, 2026",
    variants: [],
  },
];

const categories = [
  "Covering",
  "Flooring",
  "Construction",
  "Packaging",
  "Other",
];

// The seeded catalog has summary counts but intentionally omits persisted variant
// records. Generate clearly illustrative rows for those mock products in the details view.
const demoVariantLabels: Record<string, string[]> = {
  Tarpaulin: ["C1", "S4", "S2"],
  Sakolin: ["17", "24", "36", "60"],
  Linoleum: ["0.32 mm", "0.50 mm", "0.70 mm", "0.80 mm", "1.00 mm"],
  "PVC Pipe": ["1/2 inch", "3/4 inch"],
  "Packaging Tape": ["1 inch", "2 inch", "3 inch"],
  "Plastic Sheet": ["Small", "Large"],
  "Floor Mat": ["Small", "Medium", "Large", "Extra large"],
  "Stretch Film": ["17 micron", "20 micron"],
};

function makeDemoVariant(product: Product, index: number): VariantDraft {
  const label =
    demoVariantLabels[product.name]?.[index] ?? `Option ${index + 1}`;
  const unit =
    product.category === "Packaging"
      ? "box"
      : product.category === "Construction"
        ? "pcs"
        : "roll";
  const skuPrefix = product.id.replace(/[^a-zA-Z0-9]/g, "");
  return {
    id: `${product.id}-demo-${index + 1}`,
    name: `${product.name} ${label}`,
    sku: `${skuPrefix}-V${String(index + 1).padStart(2, "0")}`.toUpperCase(),
    barcode: "",
    description: "Illustrative variant data for the UI prototype.",
    price: String((index + 1) * 250),
    unit,
    weightKg: "",
    widthValue: "",
    widthUnit: "m",
    lengthValue: "",
    lengthUnit: "m",
    heightValue: "",
    heightUnit: "mm",
    material: "",
    color: "",
    size: label,
    lowStockThreshold: "20",
    highStockThreshold: "100",
  };
}

function getDisplayVariants(product: Product): VariantDraft[] {
  const total = Math.max(product.variantCount, product.variants.length);
  return Array.from(
    { length: total },
    (_, index) => product.variants[index] ?? makeDemoVariant(product, index),
  );
}
const inputClass = "h-9 w-full min-w-0";
const selectClass =
  "flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function VariantFields({
  value,
  onChange,
}: {
  value: VariantDraft;
  onChange: (next: VariantDraft) => void;
}) {
  const update = (key: keyof VariantDraft, nextValue: string) =>
    onChange({ ...value, [key]: nextValue });

  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Variant name *">
          <Input
            className={inputClass}
            placeholder="e.g. Tarpaulin C1"
            value={value.name}
            onChange={(e) => update("name", e.target.value)}
            required
          />
        </Field>
        <Field label="SKU *" hint="Must be unique across variants.">
          <Input
            className={inputClass}
            placeholder="e.g. TAR-C1"
            value={value.sku}
            onChange={(e) => update("sku", e.target.value)}
            required
          />
        </Field>
        <Field label="Barcode">
          <Input
            className={inputClass}
            placeholder="Optional barcode"
            value={value.barcode}
            onChange={(e) => update("barcode", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Variant description">
        <Textarea
          className="min-h-16 resize-y"
          placeholder="Details specific to this variant"
          value={value.description}
          onChange={(e) => update("description", e.target.value)}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Price (₱) *">
          <Input
            className={inputClass}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={value.price}
            onChange={(e) => update("price", e.target.value)}
            required
          />
        </Field>
        <Field
          label="Inventory unit *"
          hint="The unit used when receiving and selling stock."
        >
          <select
            className={selectClass}
            value={value.unit}
            onChange={(e) => update("unit", e.target.value)}
          >
            <option value="pcs">pcs</option>
            <option value="roll">roll</option>
            <option value="sheet">sheet</option>
            <option value="box">box</option>
            <option value="pack">pack</option>
            <option value="set">set</option>
            <option value="meter">meter</option>
            <option value="kg">kg</option>
          </select>
        </Field>
        <Field label="Weight (kg)">
          <Input
            className={inputClass}
            type="number"
            min="0"
            step="0.001"
            placeholder="e.g. 12.5"
            value={value.weightKg}
            onChange={(e) => update("weightKg", e.target.value)}
          />
        </Field>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <span className="flex size-7 items-center justify-center rounded-md border bg-background text-muted-foreground">
            ↔
          </span>
          Dimensions
          <span className="text-xs font-normal text-muted-foreground">
            Optional
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2">
            <Field label="Width">
              <Input
                className={inputClass}
                type="number"
                min="0"
                step="0.001"
                placeholder="0"
                value={value.widthValue}
                onChange={(e) => update("widthValue", e.target.value)}
              />
            </Field>
            <Field label="Unit">
              <select
                className={selectClass}
                value={value.widthUnit}
                onChange={(e) => update("widthUnit", e.target.value)}
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="in">in</option>
                <option value="ft">ft</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2">
            <Field label="Length">
              <Input
                className={inputClass}
                type="number"
                min="0"
                step="0.001"
                placeholder="0"
                value={value.lengthValue}
                onChange={(e) => update("lengthValue", e.target.value)}
              />
            </Field>
            <Field label="Unit">
              <select
                className={selectClass}
                value={value.lengthUnit}
                onChange={(e) => update("lengthUnit", e.target.value)}
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="in">in</option>
                <option value="ft">ft</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_82px] gap-2">
            <Field label="Height / thickness">
              <Input
                className={inputClass}
                type="number"
                min="0"
                step="0.001"
                placeholder="0"
                value={value.heightValue}
                onChange={(e) => update("heightValue", e.target.value)}
              />
            </Field>
            <Field label="Unit">
              <select
                className={selectClass}
                value={value.heightUnit}
                onChange={(e) => update("heightUnit", e.target.value)}
              >
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="m">m</option>
                <option value="in">in</option>
                <option value="ft">ft</option>
              </select>
            </Field>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Material">
          <Input
            className={inputClass}
            placeholder="e.g. PVC"
            value={value.material}
            onChange={(e) => update("material", e.target.value)}
          />
        </Field>
        <Field label="Color">
          <Input
            className={inputClass}
            placeholder="e.g. Blue"
            value={value.color}
            onChange={(e) => update("color", e.target.value)}
          />
        </Field>
        <Field label="Size / grade">
          <Input
            className={inputClass}
            placeholder="e.g. C1, 1.0 mm, 20 × 30"
            value={value.size}
            onChange={(e) => update("size", e.target.value)}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Low-stock threshold"
          hint="Show a warning when stock is at or below this number."
        >
          <Input
            className={inputClass}
            type="number"
            min="0"
            step="1"
            value={value.lowStockThreshold}
            onChange={(e) => update("lowStockThreshold", e.target.value)}
          />
        </Field>
        <Field
          label="High-stock threshold"
          hint="Optional reference for overstock monitoring."
        >
          <Input
            className={inputClass}
            type="number"
            min="0"
            step="1"
            value={value.highStockThreshold}
            onChange={(e) => update("highStockThreshold", e.target.value)}
          />
        </Field>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = React.useState<Product[]>(seedProducts);
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(5);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [productName, setProductName] = React.useState("");
  const [productDescription, setProductDescription] = React.useState("");
  const [productCategory, setProductCategory] = React.useState("Covering");
  const [productBrand, setProductBrand] = React.useState("HY");
  const [draftVariants, setDraftVariants] = React.useState<VariantDraft[]>([
    makeVariant(),
  ]);
  const [createError, setCreateError] = React.useState("");

  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [viewedProduct, setViewedProduct] = React.useState<Product | null>(
    null,
  );

  const [variantOpen, setVariantOpen] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(
    null,
  );
  const [standaloneVariant, setStandaloneVariant] =
    React.useState<VariantDraft>(makeVariant());
  const [variantError, setVariantError] = React.useState("");

  const filteredProducts = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.id.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        categoryFilter === "all" || product.category === categoryFilter;
      const matchesStatus =
        statusFilter === "all" || product.status.toLowerCase() === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [products, query, categoryFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const totalVariants = products.reduce(
    (total, product) => total + product.variantCount,
    0,
  );
  const activeProducts = products.filter(
    (product) => product.status === "Active",
  ).length;

  React.useEffect(() => {
    setPage(1);
  }, [query, categoryFilter, statusFilter, pageSize]);

  const resetCreateForm = () => {
    setProductName("");
    setProductDescription("");
    setProductCategory("Covering");
    setProductBrand("HY");
    setDraftVariants([makeVariant()]);
    setCreateError("");
  };

  const handleCreateProduct = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!productName.trim()) {
      setCreateError("Enter a product name to continue.");
      return;
    }
    if (
      draftVariants.length === 0 ||
      draftVariants.some(
        (variant) =>
          !variant.name.trim() || !variant.sku.trim() || variant.price === "",
      )
    ) {
      setCreateError(
        "Each variant needs a name, SKU, and price. Remove unused variant cards or complete their required fields.",
      );
      return;
    }

    const newProduct: Product = {
      id: `PRD-${String(Date.now()).slice(-6)}`,
      name: productName.trim(),
      description: productDescription.trim(),
      category: productCategory,
      brand: productBrand.trim() || "HY",
      status: "Active",
      variantCount: draftVariants.length,
      updatedAt: "Oct 10, 2026",
      variants: draftVariants,
    };
    setProducts((current) => [newProduct, ...current]);
    setCreateOpen(false);
    resetCreateForm();
    setQuery("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  const openProductDetails = (product: Product) => {
    setViewedProduct(product);
    setDetailsOpen(true);
  };

  const openAddVariant = (product?: Product) => {
    setSelectedProduct(product ?? null);
    setStandaloneVariant(makeVariant());
    setVariantError("");
    setVariantOpen(true);
  };

  const handleAddVariant = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedProduct) {
      setVariantError("Choose the parent product for this variant.");
      return;
    }
    if (
      !standaloneVariant.name.trim() ||
      !standaloneVariant.sku.trim() ||
      standaloneVariant.price === ""
    ) {
      setVariantError("Variant name, SKU, and price are required.");
      return;
    }
    setProducts((current) =>
      current.map((product) =>
        product.id === selectedProduct.id
          ? {
              ...product,
              variantCount: product.variantCount + 1,
              variants: [...product.variants, standaloneVariant],
              updatedAt: "Oct 10, 2026",
            }
          : product,
      ),
    );
    setVariantOpen(false);
  };

  return (
    <main className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package2 className="size-4" /> Inventory / Catalog
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Manage product records, variants, pricing, units, and dimensions
              in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => openAddVariant()}>
              <CirclePlus className="mr-2 size-4" />
              Add variant
            </Button>
            <Button
              onClick={() => {
                resetCreateForm();
                setCreateOpen(true);
              }}
            >
              <Plus className="mr-2 size-4" />
              Create product
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Total products</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {products.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Across all categories
            </p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Total variants</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {totalVariants}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Distinct SKUs / sellable options
            </p>
          </div>
          <div className="rounded-xl border bg-background p-4">
            <p className="text-sm text-muted-foreground">Active products</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {activeProducts}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Available for order entry
            </p>
          </div>
        </div>

        <section className="overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">Product catalog</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Search and filter the catalog, then manage each product's
                variants.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <div className="relative min-w-0 sm:w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 pr-8"
                  placeholder="Search name, ID, category..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Search products"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label="Clear search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </div>
              <select
                className={`${selectClass} sm:w-40`}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
              >
                <option value="all">All categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <select
                className={`${selectClass} sm:w-36`}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="min-w-[260px]">Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Variants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground">
                          <Package2 className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {product.id} <span className="px-1">·</span>{" "}
                            {product.brand || "No brand"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{product.category}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="font-normal">
                        {product.variantCount}{" "}
                        {product.variantCount === 1 ? "variant" : "variants"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {product.status === "Active" ? (
                        <Badge className="font-medium" variant="outline">
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="font-normal">
                          <Archive className="mr-1 size-3" />
                          Archived
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {product.updatedAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openProductDetails(product)}
                        >
                          <Eye className="mr-1.5 size-3.5" />
                          View details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openAddVariant(product)}
                        >
                          <Plus className="mr-1.5 size-3.5" />
                          Variant
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {pageProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-5" />
                        <p className="text-sm font-medium">No products found</p>
                        <p className="text-xs">
                          Try a different search or clear your filters.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setQuery("");
                            setCategoryFilter("all");
                            setStatusFilter("all");
                          }}
                        >
                          Clear filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {filteredProducts.length ? (currentPage - 1) * pageSize + 1 : 0}
                –{Math.min(currentPage * pageSize, filteredProducts.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">
                {filteredProducts.length}
              </span>{" "}
              products
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page</span>
                <select
                  className={`${selectClass} h-8 w-[72px]`}
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="min-w-20 text-center text-sm tabular-nums">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage >= pageCount}
                  aria-label="Next page"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* View product details. The sample catalog rows use illustrative variant data. */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <div className="flex items-start gap-3 pr-6">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/40 text-muted-foreground">
                <Package2 className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-xl">
                  {viewedProduct?.name ?? "Product details"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {viewedProduct
                    ? `${viewedProduct.id} · ${viewedProduct.brand || "No brand"}`
                    : "Review product information and variants."}
                </DialogDescription>
              </div>
              {viewedProduct ? (
                viewedProduct.status === "Active" ? (
                  <Badge variant="outline" className="mt-1">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="mt-1">
                    <Archive className="mr-1 size-3" />
                    Archived
                  </Badge>
                )
              ) : null}
            </div>
          </DialogHeader>

          {viewedProduct ? (
            <div className="max-h-[calc(92vh-145px)] space-y-6 overflow-y-auto p-6">
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Product information</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    General details shared by the product's variants.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Product ID</p>
                    <p className="mt-1 break-all text-sm font-medium">
                      {viewedProduct.id}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="mt-1 text-sm font-medium">
                      {viewedProduct.category || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Brand / manufacturer
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {viewedProduct.brand || "—"}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 sm:col-span-2 lg:col-span-3">
                    <p className="text-xs text-muted-foreground">Description</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {viewedProduct.description || "No description provided."}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground">
                      Number of variants
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {viewedProduct.variantCount}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 sm:col-span-1 lg:col-span-2">
                    <p className="text-xs text-muted-foreground">
                      Last updated
                    </p>
                    <p className="mt-1 text-sm font-medium">
                      {viewedProduct.updatedAt}
                    </p>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold">Product variants</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      SKU, price, stock thresholds, and measurement details for
                      each option.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDetailsOpen(false);
                      openAddVariant(viewedProduct);
                    }}
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add variant
                  </Button>
                </div>
                <div className="overflow-hidden rounded-lg border">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableHead className="min-w-[180px]">
                            Variant
                          </TableHead>
                          <TableHead className="min-w-[130px]">SKU</TableHead>
                          <TableHead className="text-right">Price</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead className="min-w-[160px]">
                            Dimensions
                          </TableHead>
                          <TableHead>Weight</TableHead>
                          <TableHead className="min-w-[130px]">
                            Stock thresholds
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getDisplayVariants(viewedProduct).map((variant) => (
                          <TableRow key={variant.id}>
                            <TableCell>
                              <p className="font-medium">
                                {variant.name || "Unnamed variant"}
                              </p>
                              {variant.size ? (
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {variant.size}
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {variant.sku || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                              {variant.price !== "" &&
                              Number.isFinite(Number(variant.price))
                                ? `₱${Number(variant.price).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "—"}
                            </TableCell>
                            <TableCell>{variant.unit || "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {[
                                variant.widthValue
                                  ? `W ${variant.widthValue} ${variant.widthUnit}`
                                  : "",
                                variant.lengthValue
                                  ? `L ${variant.lengthValue} ${variant.lengthUnit}`
                                  : "",
                                variant.heightValue
                                  ? `H ${variant.heightValue} ${variant.heightUnit}`
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" · ") || "Not specified"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {variant.weightKg
                                ? `${variant.weightKg} kg`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              Low: {variant.lowStockThreshold || "—"}
                              <br />
                              High: {variant.highStockThreshold || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        {getDisplayVariants(viewedProduct).length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={7}
                              className="h-24 text-center text-sm text-muted-foreground"
                            >
                              No variants have been added yet.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {viewedProduct.variants.length < viewedProduct.variantCount ? (
                  <p className="text-xs text-muted-foreground">
                    Some rows shown for this seeded product are illustrative
                    mock data. Newly created products and added variants use the
                    values entered in the form.
                  </p>
                ) : null}
              </section>
            </div>
          ) : null}
          <DialogFooter className="border-t bg-background px-6 py-4">
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create product with nested variants. Their product_id is assigned automatically on save. */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle className="text-xl">Create product</DialogTitle>
            <DialogDescription>
              Create the parent product first, then define its sellable variants
              and measurements.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleCreateProduct}
            className="flex min-h-0 flex-col"
          >
            <div className="max-h-[calc(92vh-150px)] space-y-6 overflow-y-auto p-6">
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold">Product information</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Shared information for all variants under this product.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Product name *">
                    <Input
                      className={inputClass}
                      placeholder="e.g. Tarpaulin"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      required
                      autoFocus
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      className={selectClass}
                      value={productCategory}
                      onChange={(e) => setProductCategory(e.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Brand / manufacturer">
                    <Input
                      className={inputClass}
                      placeholder="e.g. HY"
                      value={productBrand}
                      onChange={(e) => setProductBrand(e.target.value)}
                    />
                  </Field>
                  <Field label="Product description">
                    <Input
                      className={inputClass}
                      placeholder="Brief description of this product"
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                    />
                  </Field>
                </div>
              </section>

              <div className="border-t" />

              <section className="space-y-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Product variants{" "}
                      <span className="ml-1 text-muted-foreground">
                        ({draftVariants.length})
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Each variant has its own SKU, price, unit, dimensions, and
                      stock thresholds.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraftVariants((current) => [...current, makeVariant()])
                    }
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    Add variant
                  </Button>
                </div>
                <div className="space-y-4">
                  {draftVariants.map((variant, index) => (
                    <div className="rounded-xl border" key={variant.id}>
                      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-md border bg-background text-xs font-semibold">
                            {index + 1}
                          </span>
                          <span className="text-sm font-medium">
                            Variant details
                          </span>
                        </div>
                        {draftVariants.length > 1 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setDraftVariants((current) =>
                                current.filter(
                                  (item) => item.id !== variant.id,
                                ),
                              )
                            }
                            aria-label={`Remove variant ${index + 1}`}
                          >
                            <X className="size-4" />
                          </Button>
                        ) : null}
                      </div>
                      <div className="p-4">
                        <VariantFields
                          value={variant}
                          onChange={(next) =>
                            setDraftVariants((current) =>
                              current.map((item) =>
                                item.id === variant.id ? next : item,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              {createError ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {createError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="border-t bg-background px-6 py-4 sm:justify-between">
              <p className="hidden self-center text-xs text-muted-foreground sm:block">
                Required fields are marked with *
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create product</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Separate variant flow: this is where selecting product_id with a combobox makes sense. */}
      <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
        <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-6 py-5 text-left">
            <DialogTitle className="text-xl">Add product variant</DialogTitle>
            <DialogDescription>
              Select the parent product, then enter the variant's SKU, pricing,
              unit, and measurements.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddVariant} className="flex min-h-0 flex-col">
            <div className="max-h-[calc(92vh-150px)] space-y-5 overflow-y-auto p-6">
              <Field
                label="Parent product *"
                hint="This selection becomes product_id for the new variant."
              >
                <Combobox
                  items={products}
                  value={selectedProduct}
                  onValueChange={(value) =>
                    setSelectedProduct(value as Product | null)
                  }
                  itemToStringValue={(product) => product.name}
                >
                  <ComboboxInput
                    placeholder="Search for a product..."
                    className="h-9 w-full"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No product found.</ComboboxEmpty>
                    <ComboboxList>
                      {(product: Product) => (
                        <ComboboxItem key={product.id} value={product}>
                          {product.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {product.id}
                          </span>
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </Field>
              <div className="rounded-xl border p-4">
                <VariantFields
                  value={standaloneVariant}
                  onChange={setStandaloneVariant}
                />
              </div>
              {variantError ? (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                  {variantError}
                </p>
              ) : null}
            </div>
            <DialogFooter className="border-t bg-background px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setVariantOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add variant</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
