import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DeliveryScheduleContext } from "../app/(protected)/panel/delivery-schedules/provider";
import { ExpensesStep } from "../app/(protected)/panel/delivery-schedules/components/expenses-step";
import { useExpenseSettings } from "../components/delivery-estimate-settings";
import { deliveryScheduleSchema, type DeliveryScheduleFormData } from "../schema/delivery-schedule";
import type { EstimateResponse } from "../types/estimate";

function Harness() {
  const expenseSettings = useExpenseSettings(true);
  const form = useForm<DeliveryScheduleFormData>({
    resolver: zodResolver(deliveryScheduleSchema),
    defaultValues: {
      warehouse_id: 1,
      order_ids: [101, 102],
      scheduled_date: new Date("2026-12-01"),
      scheduled_time: "09:00",
      delivery_type: "INTERNAL",
      driver_id: 1,
      vehicle_id: 1,
      delivery_allowance: 0,
      fuel: 0,
      toll: 0,
    },
  });

  const warehouseQuery = useQuery({
    queryKey: ["harness-wh"],
    queryFn: async () => ({
      rows: [{ id: 1, name: "Main Warehouse", latitude: "14.815", longitude: "120.906" }],
      total: 1,
    }),
  });

  const orderDetailQuery = useQuery({
    queryKey: ["harness-orders"],
    queryFn: async () => [
      {
        id: 101,
        order_number: "ORD-101",
        customer_company: "Acme Corp",
        destination: "Quezon City",
        shipping_latitude: "14.676",
        shipping_longitude: "121.0437",
        item_count: 3,
        total: 5000,
        order_group_id: null,
        order_group_number: null,
        order_group_position: null,
        order_group_size: 1,
      },
      {
        id: 102,
        order_number: "ORD-102",
        customer_company: "Beta Co",
        destination: "Makati City",
        shipping_latitude: "14.5547",
        shipping_longitude: "121.0244",
        item_count: 2,
        total: 3200,
        order_group_id: null,
        order_group_number: null,
        order_group_position: null,
        order_group_size: 1,
      },
    ],
  });

  const driverExpensesMutation = useMutation<EstimateResponse>({
    mutationFn: async () => {
      const response = await fetch("/api/delivery-estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: [
            { latitude: 14.815, longitude: 120.906 },
            { latitude: 14.676, longitude: 121.0437 },
            { latitude: 14.5547, longitude: 121.0244 },
          ],
          ...expenseSettings.requestOptions(),
          isRoundTrip: true,
        }),
      });
      return response.json();
    },
    onSuccess: (estimate) => {
      form.setValue("delivery_allowance", Math.round(estimate.expenses.driverAllowance * 100) / 100);
      form.setValue("fuel", Math.round(estimate.expenses.estimatedFuelCost * 100) / 100);
      form.setValue(
        "toll",
        estimate.expenses.estimatedTollFee === null
          ? Number.NaN
          : Math.round(estimate.expenses.estimatedTollFee * 100) / 100,
      );
    },
  });

  return (
    <DeliveryScheduleContext.Provider
      value={{
        form,
        warehouseQuery,
        orderDetailQuery,
        driverExpensesMutation,
        expenseSettings,
      } as never}
    >
      <main style={{ maxWidth: 820, margin: "0 auto", padding: 16 }}>
        <ExpensesStep />
      </main>
    </DeliveryScheduleContext.Provider>
  );
}

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <Harness />
  </QueryClientProvider>,
);
