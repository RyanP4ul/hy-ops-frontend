import {
  LayoutDashboardIcon,
  PackageIcon,
  CameraIcon,
  FileTextIcon,
  DatabaseIcon,
  FileChartColumnIcon,
  FileIcon,
  ArchiveIcon,
  BadgeIcon,
  BoxesIcon,
  CalendarDaysIcon,
  CarIcon,
  ClipboardListIcon,
  CreditCardIcon,
  MapIcon,
  SettingsIcon,
  WorkflowIcon,
  ShoppingCartIcon,
  TruckIcon,
  UserRoundIcon,
  UsersIcon,
  WarehouseIcon,
  MessageSquareIcon,
  MessagesSquareIcon,
  Calculator,
} from "lucide-react";

type SidebarGroupItem = {
  title: string;
  url: string;
  icon: React.ElementType;
  role: string[];
  isDisabled: boolean;
};

export const leftSidebarData: Record<string, SidebarGroupItem[]> = {
  Overview: [
    {
      title: "Dashboard",
      url: "/panel",
      icon: LayoutDashboardIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
  ],
  "Inventory Management": [
    {
      title: "Products",
      url: "/panel/products",
      icon: PackageIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
    {
      title: "Inventory",
      url: "/panel/inventory",
      icon: BoxesIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
    {
      title: "Warehouses",
      url: "/panel/warehouses",
      icon: WarehouseIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
  ],
  Operations: [
    {
      title: "Calendar",
      url: "/panel/calendar",
      icon: CalendarDaysIcon,
      role: ["admin"],
      isDisabled: false,
    },
    {
      title: "Delivery Schedules",
      url: "/panel/delivery-schedules",
      icon: TruckIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
  ],
  "Sales Processing": [
    {
      title: "Orders",
      url: "/panel/orders",
      icon: ShoppingCartIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
    {
      title: "Payments",
      url: "/panel/payments",
      icon: CreditCardIcon,
      role: ["admin"],
      isDisabled: false,
    },
  ],
  Communications: [
    {
      title: "Communications",
      url: "/panel/communications",
      icon: MessagesSquareIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
  ],
  "Logistics & Tracking": [
    {
      title: "Deliveries",
      url: "/panel/deliveries",
      icon: TruckIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
    {
      title: "Fleet Map",
      url: "/panel/fleet-map",
      icon: MapIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
    {
      title: "Vehicles",
      url: "/panel/vehicles",
      icon: CarIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
  ],
  "User Management": [
    {
      title: "Users",
      url: "/panel/users",
      icon: UsersIcon,
      role: ["admin"],
      isDisabled: false,
    },
  ],
  Tools: [
    {
      title: "Delivery Expenses Calculator",
      url: "/panel/delivery-expenses",
      icon: Calculator,
      role: ["admin", "staff"],
      isDisabled: false,
    },
  ],
  "Analysis & Reports": [
    {
      title: "Analysis & Reports",
      url: "/panel/analysis-reports",
      icon: LayoutDashboardIcon,
      role: ["admin", "staff"],
      isDisabled: false,
    },
  ],
  System: [
    {
      title: "Session & Logs",
      url: "/panel/sessions-and-logs",
      icon: MessageSquareIcon,
      role: ["admin"],
      isDisabled: false,
    },
    {
      title: "Audit Logs",
      url: "/panel/audit-logs",
      icon: ClipboardListIcon,
      role: ["admin"],
      isDisabled: false,
    },
    {
      title: "Archives",
      url: "/panel/archives",
      icon: ArchiveIcon,
      role: ["admin"],
      isDisabled: false,
    },
    {
      title: "Settings",
      url: "/panel/settings",
      icon: SettingsIcon,
      role: ["admin"],
      isDisabled: false,
    },
    {
      title: "Automations",
      url: "/panel/automations",
      icon: WorkflowIcon,
      role: ["admin"],
      isDisabled: false,
    },
  ],
};

export const getSidebars = (userRole: string) => {
  const filteredSidebarData: Record<string, SidebarGroupItem[]> = {};
  for (const [group, items] of Object.entries(leftSidebarData)) {
    const filteredItems = items.filter((item) => {
      return !item.role || item.role.includes(userRole);
    });
    if (filteredItems.length > 0) {
      filteredSidebarData[group] = filteredItems;
    }
  }
  return filteredSidebarData;
};
