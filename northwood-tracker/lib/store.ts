// Star Store prices, from the price lists in rsrc/ninja_stars.csv.
export const STORE_CATALOG = [
  {
    category: "Snacks",
    items: [
      { name: "Candy", stars: 5 },
      { name: "Fruit Snack", stars: 10 },
      { name: "Granola Bar", stars: 10 },
      { name: "Rice Krispy", stars: 10 },
      { name: "Chips", stars: 15 },
    ],
  },
  {
    category: "Wearables",
    items: [
      { name: "Bracelet", stars: 10 },
      { name: "Croc Charm", stars: 40 },
      { name: "Sunglasses", stars: 50 },
      { name: "Pins", stars: 75 },
      { name: "Hat", stars: 100 },
      { name: "Shirt", stars: 150 },
    ],
  },
  {
    category: "Knick-knacks",
    items: [
      { name: "Sticker", stars: 6 },
      { name: "Eraser", stars: 10 },
      { name: "Pencil", stars: 10 },
      { name: "3D Print", stars: 20 },
      { name: "Popsocket", stars: 20 },
      { name: "Pokemon Figures", stars: 30 },
      { name: "Phone Ring", stars: 40 },
      { name: "Rubix Cube", stars: 100 },
      { name: "Tumbler", stars: 350 },
      { name: "Blox Bucket", stars: 450 },
    ],
  },
];

// Price of a catalog item, or undefined for anything else ("Other").
export function catalogPrice(item: string): number | undefined {
  for (const { items } of STORE_CATALOG) {
    const match = items.find((i) => i.name === item);
    if (match) return match.stars;
  }
}
