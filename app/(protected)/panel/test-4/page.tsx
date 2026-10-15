"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronDown,
  Eye,
  FileText,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// --------------------------------------------------
// Types based on the Drizzle orders schema
// --------------------------------------------------

type DeliveryType = "LALAMOVE" | "PICKUP" | "INTERNAL";

type Product = {
  id: number;
  name: string;
  sku: string;
  price: number;
};

type OrderItem = {
  id: number;
  product_id: number;
  quantity: number;
};

type Order = {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_company: string;
  customer_email: string;
  delivery_type: DeliveryType;
  notes: string | null;
  created_at: number;
  updated_at: number;
  items: OrderItem[];
};

// --------------------------------------------------
// Mock data
// --------------------------------------------------

const products: Product[] = [
  { id: 1, name: "Tarpaulin C1", sku: "TAR-C1", price: 350 },
  { id: 2, name: "Tarpaulin S4", sku: "TAR-S4", price: 420 },
  { id: 3, name: "Sakolin 30", sku: "SAK-030", price: 180 },
  { id: 4, name: "Sakolin 40", sku: "SAK-040", price: 230 },
  { id: 5, name: "Linoleum 0.5mm", sku: "LIN-050", price: 650 },
  { id: 6, name: "Linoleum 1mm", sku: "LIN-100", price: 950 },
];

const initialOrders: Order[] = [
  {
    id: 125,
    customer_id: 2,
    customer_name: "Juan Dela Cruz",
    customer_company: "ABC Trading",
    customer_email: "juan@example.com",
    delivery_type: "LALAMOVE",
    notes: "Deliver before 3 PM. Call upon arrival.",
    created_at: 1791453600,
    updated_at: 1791453600,
    items: [
      { id: 1, product_id: 1, quantity: 10 },
      { id: 2, product_id: 3, quantity: 20 },
    ],
  },
  {
    id: 124,
    customer_id: 3,
    customer_name: "Maria Santos",
    customer_company: "Santos General Merchandise",
    customer_email: "maria@example.com",
    delivery_type: "INTERNAL",
    notes: "Use the company delivery truck.",
    created_at: 1791367200,
    updated_at: 1791367200,
    items: [
      { id: 3, product_id: 2, quantity: 5 },
      { id: 4, product_id: 5, quantity: 8 },
    ],
  },
  {
    id: 123,
    customer_id: 4,
    customer_name: "Pedro Reyes",
    customer_company: "Reyes Construction",
    customer_email: "pedro@example.com",
    delivery_type: "PICKUP",
    notes: null,
    created_at: 1791280800,
    updated_at: 1791280800,
    items: [{ id: 5, product_id: 6, quantity: 4 }],
  },
  {
    id: 122,
    customer_id: 2,
    customer_name: "Juan Dela Cruz",
    customer_company: "ABC Trading",
    customer_email: "juan@example.com",
    delivery_type: "INTERNAL",
    notes: "Handle products carefully.",
    created_at: 1791194400,
    updated_at: 1791194400,
    items: [
      { id: 6, product_id: 4, quantity: 15 },
      { id: 7, product_id: 1, quantity: 3 },
    ],
  },
  {
    id: 121,
    customer_id: 5,
    customer_name: "Ana Garcia",
    customer_company: "Garcia Retail",
    customer_email: "ana@example.com",
    delivery_type: "LALAMOVE",
    notes: null,
    created_at: 1791108000,
    updated_at: 1791108000,
    items: [{ id: 8, product_id: 3, quantity: 12 }],
  },
];

const deliveryLabels: Record<DeliveryType, string> = {
  LALAMOVE: "Lalamove",
  PICKUP: "Customer pickup",
  INTERNAL: "Company delivery",
};

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getProduct(productId: number) {
  return products.find((product) => product.id === productId);
}

function getOrderTotal(order: Order) {
  return order.items.reduce((total, item) => {
    const product = getProduct(item.product_id);
    return total + (product?.price ?? 0) * item.quantity;
  }, 0);
}

function getItemCount(order: Order) {
  return order.items.reduce((total, item) => total + item.quantity, 0);
}

function nextTimestamp() {
  return Math.floor(Date.now() / 1000);
}

// --------------------------------------------------
// Page
// --------------------------------------------------

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(initialOrders);

  // Table filters
  const [search, setSearch] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  // Order edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [editDelivery, setEditDelivery] = useState<DeliveryType>("INTERNAL");
  const [editNotes, setEditNotes] = useState("");

  // Add item dialog
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");

  // Edit item quantity dialog
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingQuantity, setEditingQuantity] = useState("1");

  // Remove confirmation dialog
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removingOrderId, setRemovingOrderId] = useState<number | null>(null);

  const selectedOrder =
    orders.find((order) => order.id === selectedOrderId) ?? null;

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        const matchesSearch =
          !query ||
          String(order.id).includes(query) ||
          order.customer_name.toLowerCase().includes(query) ||
          order.customer_company.toLowerCase().includes(query) ||
          (order.notes ?? "").toLowerCase().includes(query);

        const matchesDelivery =
          deliveryFilter === "ALL" || order.delivery_type === deliveryFilter;

        return matchesSearch && matchesDelivery;
      })
      .sort((a, b) =>
        sortOrder === "newest"
          ? b.created_at - a.created_at
          : a.created_at - b.created_at,
      );
  }, [orders, search, deliveryFilter, sortOrder]);

  const totalValue = orders.reduce(
    (total, order) => total + getOrderTotal(order),
    0,
  );

  // ------------------------------------------------
  // Open and edit orders
  // ------------------------------------------------

  function viewOrder(order: Order) {
    setSelectedOrderId(order.id);
    setDrawerOpen(true);
  }

  function startEditingOrder(order: Order) {
    setEditingOrderId(order.id);
    setEditDelivery(order.delivery_type);
    setEditNotes(order.notes ?? "");
    setEditOpen(true);
  }

  function saveOrderChanges() {
    if (editingOrderId === null) return;

    setOrders((current) =>
      current.map((order) =>
        order.id === editingOrderId
          ? {
              ...order,
              delivery_type: editDelivery,
              notes: editNotes.trim() || null,
              updated_at: nextTimestamp(),
            }
          : order,
      ),
    );

    setEditOpen(false);
  }

  // ------------------------------------------------
  // Order items
  // ------------------------------------------------

  function addOrderItem() {
    if (!selectedOrder || !selectedProductId) return;

    const productId = Number(selectedProductId);
    const quantity = Number(itemQuantity);

    if (!Number.isInteger(quantity) || quantity < 1) return;

    setOrders((current) =>
      current.map((order) => {
        if (order.id !== selectedOrder.id) return order;

        // The database has a unique constraint on
        // (order_id, product_id). Merge duplicate products.
        const existingItem = order.items.find(
          (item) => item.product_id === productId,
        );

        const items = existingItem
          ? order.items.map((item) =>
              item.product_id === productId
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            )
          : [
              ...order.items,
              {
                id:
                  Math.max(
                    0,
                    ...current.flatMap((o) => o.items.map((i) => i.id)),
                  ) + 1,
                product_id: productId,
                quantity,
              },
            ];

        return {
          ...order,
          items,
          updated_at: nextTimestamp(),
        };
      }),
    );

    setAddItemOpen(false);
    setSelectedProductId("");
    setItemQuantity("1");
  }

  function startEditingItem(item: OrderItem) {
    setEditingItemId(item.id);
    setEditingQuantity(String(item.quantity));
    setEditItemOpen(true);
  }

  function saveItemQuantity() {
    if (!selectedOrder || editingItemId === null) return;

    const quantity = Number(editingQuantity);

    if (!Number.isInteger(quantity) || quantity < 1) return;

    setOrders((current) =>
      current.map((order) =>
        order.id === selectedOrder.id
          ? {
              ...order,
              items: order.items.map((item) =>
                item.id === editingItemId ? { ...item, quantity } : item,
              ),
              updated_at: nextTimestamp(),
            }
          : order,
      ),
    );

    setEditItemOpen(false);
  }

  function removeOrderItem(itemId: number) {
    if (!selectedOrder) return;

    setOrders((current) =>
      current.map((order) =>
        order.id === selectedOrder.id
          ? {
              ...order,
              items: order.items.filter((item) => item.id !== itemId),
              updated_at: nextTimestamp(),
            }
          : order,
      ),
    );
  }

  // ------------------------------------------------
  // Delete order
  // ------------------------------------------------

  function confirmRemoveOrder(orderId: number) {
    setRemovingOrderId(orderId);
    setRemoveOpen(true);
  }

  function removeOrder() {
    if (removingOrderId === null) return;

    setOrders((current) =>
      current.filter((order) => order.id !== removingOrderId),
    );

    if (selectedOrderId === removingOrderId) {
      setDrawerOpen(false);
      setSelectedOrderId(null);
    }

    setRemoveOpen(false);
    setRemovingOrderId(null);
  }

  // ------------------------------------------------
  // Render
  // ------------------------------------------------

  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingCart className="size-4" />
            Inventory &amp; sales
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>

          <p className="text-sm text-muted-foreground">
            Manage customer orders, products, and delivery methods.
          </p>
        </div>

        <Button
          onClick={() => {
            alert("Connect this button to your Create Order form or route.");
          }}
        >
          <Plus className="mr-2 size-4" />
          Create order
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total orders</p>
            <ShoppingCart className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-2xl font-semibold">{orders.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            All recorded orders
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Total order value</p>
            <FileText className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-2xl font-semibold">
            {formatCurrency(totalValue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on mock product prices
          </p>
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Lalamove orders</p>
            <Truck className="size-4 text-muted-foreground" />
          </div>
          <p className="mt-3 text-2xl font-semibold">
            {orders.filter((o) => o.delivery_type === "LALAMOVE").length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Orders using third-party delivery
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold">All orders</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredOrders.length} of {orders.length} orders
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <div className="relative sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search orders..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={deliveryFilter} onValueChange={setDeliveryFilter}>
              <SelectTrigger className="sm:w-48">
                <SelectValue placeholder="Delivery method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All delivery methods</SelectItem>
                <SelectItem value="LALAMOVE">Lalamove</SelectItem>
                <SelectItem value="PICKUP">Customer pickup</SelectItem>
                <SelectItem value="INTERNAL">Company delivery</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={() =>
                setSortOrder((current) =>
                  current === "newest" ? "oldest" : "newest",
                )
              }
            >
              <ArrowDownUp className="mr-2 size-4" />
              {sortOrder === "newest" ? "Newest first" : "Oldest first"}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Delivery method</TableHead>
                <TableHead>Date created</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-36 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Search className="size-6" />
                      <p className="font-medium">No orders found</p>
                      <p className="text-sm">
                        Try changing your search or filters.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => viewOrder(order)}
                  >
                    <TableCell>
                      <span className="font-medium">ORD-{order.id}</span>
                    </TableCell>

                    <TableCell>
                      <div className="min-w-36 space-y-1">
                        <p className="font-medium">{order.customer_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.customer_company}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <p>{order.items.length} products</p>
                        <p className="text-xs text-muted-foreground">
                          {getItemCount(order)} units
                        </p>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant="secondary">
                        {deliveryLabels[order.delivery_type]}
                      </Badge>
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatDate(order.created_at)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-right font-medium">
                      {formatCurrency(getOrderTotal(order))}
                    </TableCell>

                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for order ${order.id}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          }
                        />

                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => viewOrder(order)}>
                            <Eye className="mr-2 size-4" />
                            View details
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() => startEditingOrder(order)}
                          >
                            <Pencil className="mr-2 size-4" />
                            Edit order
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => confirmRemoveOrder(order.id)}
                          >
                            <Trash2 className="mr-2 size-4" />
                            Remove order
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="border-t px-4 py-3 text-xs text-muted-foreground">
          Showing {filteredOrders.length} orders
        </div>
      </div>

      {/* ==========================================
          ORDER DETAILS DRAWER
          ========================================== */}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="!w-[min(700px,95vw)] !max-w-[min(700px,95vw)]">
          {selectedOrder && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <DrawerHeader className="border-b px-6 pb-5 pt-6 text-left">
                <div className="flex items-start justify-between gap-3 pr-8">
                  <div className="space-y-1">
                    <DrawerTitle className="text-xl">
                      Order ORD-{selectedOrder.id}
                    </DrawerTitle>
                    <DrawerDescription>
                      View and manage order information and items.
                    </DrawerDescription>
                  </div>

                  <Badge variant="secondary">
                    {deliveryLabels[selectedOrder.delivery_type]}
                  </Badge>
                </div>
              </DrawerHeader>

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
                {/* Customer */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Customer information</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEditingOrder(selectedOrder)}
                    >
                      <Pencil className="mr-2 size-3.5" />
                      Edit order
                    </Button>
                  </div>

                  <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Customer name
                      </p>
                      <p className="mt-1 font-medium">
                        {selectedOrder.customer_name}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Company</p>
                      <p className="mt-1 font-medium">
                        {selectedOrder.customer_company}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="mt-1 break-all">
                        {selectedOrder.customer_email}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        Date created
                      </p>
                      <p className="mt-1 flex items-center gap-2">
                        <CalendarDays className="size-4 text-muted-foreground" />
                        {formatDate(selectedOrder.created_at)}
                      </p>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Delivery */}
                <section className="space-y-3">
                  <h3 className="font-semibold">Delivery information</h3>

                  <div className="rounded-lg border p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                        <Truck className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {deliveryLabels[selectedOrder.delivery_type]}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Delivery method
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-3">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm">
                        {selectedOrder.notes || "No additional notes."}
                      </p>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Order items */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Order items</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedOrder.items.length} products ·{" "}
                        {getItemCount(selectedOrder)} total units
                      </p>
                    </div>

                    <Button size="sm" onClick={() => setAddItemOpen(true)}>
                      <Plus className="mr-2 size-4" />
                      Add item
                    </Button>
                  </div>

                  {selectedOrder.items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
                      <Package className="size-8 text-muted-foreground" />
                      <p className="font-medium">No items yet</p>
                      <p className="text-sm text-muted-foreground">
                        Add products to this order.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead className="text-right">
                              Subtotal
                            </TableHead>
                            <TableHead className="w-12" />
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {selectedOrder.items.map((item) => {
                            const product = getProduct(item.product_id);

                            return (
                              <TableRow key={item.id}>
                                <TableCell>
                                  <p className="font-medium">
                                    {product?.name ?? "Unknown product"}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {product?.sku ?? "—"} ·{" "}
                                    {formatCurrency(product?.price ?? 0)}
                                  </p>
                                </TableCell>

                                <TableCell>{item.quantity}</TableCell>

                                <TableCell className="whitespace-nowrap text-right font-medium">
                                  {formatCurrency(
                                    (product?.price ?? 0) * item.quantity,
                                  )}
                                </TableCell>

                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label="Order item actions"
                                        >
                                          <MoreHorizontal className="size-4" />
                                        </Button>
                                      }
                                    />

                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem
                                        onClick={() => startEditingItem(item)}
                                      >
                                        <Pencil className="mr-2 size-4" />
                                        Edit quantity
                                      </DropdownMenuItem>

                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => removeOrderItem(item.id)}
                                      >
                                        <Trash2 className="mr-2 size-4" />
                                        Remove item
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total order value
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getItemCount(selectedOrder)} units
                      </p>
                    </div>

                    <p className="text-xl font-semibold">
                      {formatCurrency(getOrderTotal(selectedOrder))}
                    </p>
                  </div>
                </section>

                <Separator />

                {/* Timestamps */}
                <section className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between gap-4">
                    <span>Created at</span>
                    <span>{formatDate(selectedOrder.created_at)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Last updated</span>
                    <span>{formatDate(selectedOrder.updated_at)}</span>
                  </div>
                </section>
              </div>

              <div className="flex justify-between gap-3 border-t p-4">
                <Button
                  variant="destructive"
                  onClick={() => confirmRemoveOrder(selectedOrder.id)}
                >
                  <Trash2 className="mr-2 size-4" />
                  Remove order
                </Button>

                <Button variant="outline" onClick={() => setDrawerOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* ==========================================
          ADD ORDER ITEM DIALOG
          Opens over the Drawer.
          ========================================== */}

      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add order item</DialogTitle>
            <DialogDescription>
              Add a product to order ORD-{selectedOrder?.id}. If the product
              already exists in the order, its quantity will be increased.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Product</Label>

              <Select
                value={selectedProductId}
                onValueChange={setSelectedProductId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>

                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name} — {product.sku} (
                      {formatCurrency(product.price)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                type="number"
                min={1}
                step={1}
                value={itemQuantity}
                onChange={(event) => setItemQuantity(event.target.value)}
              />
            </div>

            {selectedProductId && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Unit price</span>
                  <span className="font-medium">
                    {formatCurrency(
                      getProduct(Number(selectedProductId))?.price ?? 0,
                    )}
                  </span>
                </div>

                <div className="mt-2 flex justify-between gap-3">
                  <span className="text-muted-foreground">Line total</span>
                  <span className="font-semibold">
                    {formatCurrency(
                      (getProduct(Number(selectedProductId))?.price ?? 0) *
                        Math.max(0, Number(itemQuantity) || 0),
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={addOrderItem}
              disabled={
                !selectedProductId ||
                !Number.isInteger(Number(itemQuantity)) ||
                Number(itemQuantity) < 1
              }
            >
              <Plus className="mr-2 size-4" />
              Add item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          EDIT ORDER ITEM QUANTITY DIALOG
          ========================================== */}

      <Dialog open={editItemOpen} onOpenChange={setEditItemOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit item quantity</DialogTitle>
            <DialogDescription>
              Update the quantity for this product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="edit-item-quantity">Quantity</Label>
            <Input
              id="edit-item-quantity"
              type="number"
              min={1}
              step={1}
              value={editingQuantity}
              onChange={(event) => setEditingQuantity(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveItemQuantity}
              disabled={
                !Number.isInteger(Number(editingQuantity)) ||
                Number(editingQuantity) < 1
              }
            >
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          EDIT ORDER DIALOG
          ========================================== */}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit order</DialogTitle>
            <DialogDescription>
              Update delivery method and order notes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Delivery method</Label>

              <Select
                value={editDelivery}
                onValueChange={(value) =>
                  setEditDelivery(value as DeliveryType)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LALAMOVE">Lalamove</SelectItem>
                  <SelectItem value="PICKUP">Customer pickup</SelectItem>
                  <SelectItem value="INTERNAL">Company delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="order-notes">Order notes</Label>
              <textarea
                id="order-notes"
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                placeholder="Add delivery instructions..."
                rows={4}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveOrderChanges}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ==========================================
          REMOVE ORDER CONFIRMATION DIALOG
          ========================================== */}

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove order?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove order ORD-{removingOrderId}? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={removeOrder}>
              <Trash2 className="mr-2 size-4" />
              Remove order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
