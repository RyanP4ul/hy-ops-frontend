export function notificationPresentation(type: string, role?: string) {
  switch (type.trim().toUpperCase()) {
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
