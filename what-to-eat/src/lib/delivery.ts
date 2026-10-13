export type DeliveryApp = { key: 'doordash' | 'ubereats' | 'grubhub'; label: string; url: string };

/**
 * Search pages on each delivery app with the dish typed in. These are regular web links;
 * phones with the app installed usually open it straight to the search.
 */
export function deliveryLinks(dish: string): DeliveryApp[] {
  const q = encodeURIComponent(dish.trim());
  return [
    { key: 'doordash', label: 'DoorDash', url: `https://www.doordash.com/search/store/${q}/` },
    { key: 'ubereats', label: 'Uber Eats', url: `https://www.ubereats.com/search?q=${q}` },
    { key: 'grubhub', label: 'Grubhub', url: `https://www.grubhub.com/search?queryText=${q}` },
  ];
}
