type StockDraft = { items: { inventory_id: number; quantity: number }[] };

// Draft selections affect only the displayed availability, never stored inventory.
export function remainingDraftStock(
  available: number,
  inventoryId: number,
  drafts: StockDraft[],
) {
  const selected = drafts.reduce((total, draft) => total + draft.items.reduce(
    (sum, item) => sum + (item.inventory_id === inventoryId ? item.quantity : 0), 0,
  ), 0);
  return Math.max(0, available - selected);
}
