export function notificationPresentation(type: string, role?: string) {
  switch (type.trim().toUpperCase()) {
    case "DELIVERY_LOCATION_STOPPED":
      return { href: "/panel/fleet-map", action: "View fleet map", icon: "delivery", tone: "warning" } as const;
    case "DELIVERY_COMPLETED":
      return { href: "/panel/deliveries", action: "View deliveries", icon: "delivery", tone: "success" } as const;
    case "LOW_STOCK":
      return { href: "/panel/inventory", action: "View inventory", icon: "inventory", tone: "warning" } as const;
    case "OVERDUE_PAYMENT":
      return { href: role === "admin" ? "/panel/payments" : "/panel/orders", action: role === "admin" ? "View payments" : "View orders", icon: "payment", tone: "warning" } as const;
    case "DELIVERY_FOLLOW_UP":
      return { href: "/panel/deliveries", action: "View deliveries", icon: "delivery", tone: "warning" } as const;
    default: {
      const tone = type.toLowerCase() === "error" ? "error" : type.toLowerCase() === "warning" ? "warning" : type.toLowerCase() === "success" ? "success" : "info";
      return { href: null, action: null, icon: tone, tone } as const;
    }
  }
}
