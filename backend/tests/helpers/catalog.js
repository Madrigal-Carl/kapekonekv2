// Small catalog fixture for API tests (the real seeders fetch media, so tests don't run them).
import { Category, Order, Product, User } from '../../src/models/index.js';

export async function seedCatalogFixture() {
  const [coffee, fertilizer, beans] = await Category.create([
    { name: 'Coffee', slug: 'coffee', purchasePermission: 'catalog.coffee', isPublic: true, hasVariety: true, hasCoffeeType: true, sortOrder: 1 },
    { name: 'Fertilizer', slug: 'fertilizer', purchasePermission: 'catalog.farm_supplies', sortOrder: 2 },
    { name: 'Beans', slug: 'beans', purchasePermission: 'catalog.farm_supplies', sortOrder: 3 },
  ]);
  const base = { category: coffee._id, unit: 'pack', unitLabel: '250 g', stock: 20, shortDescription: 'Test coffee.' };
  const products = await Product.create([
    { ...base, name: 'Barako Medium Roast', slug: 'barako-medium-roast', variety: 'liberica', coffeeType: 'roasted_beans', priceCentavos: 26000 },
    { ...base, name: 'Liberica Green Beans', slug: 'liberica-green-beans', variety: 'liberica', coffeeType: 'green_beans', priceCentavos: 32000, unit: 'kg', unitLabel: null },
    { ...base, name: 'Arabica Light Roast', slug: 'arabica-light-roast', variety: 'arabica', coffeeType: 'roasted_beans', priceCentavos: 38000 },
    { ...base, name: 'Robusta Ground', slug: 'robusta-ground', variety: 'robusta', coffeeType: 'ground', priceCentavos: 20000 },
    { ...base, name: 'Hidden Old Roast', slug: 'hidden-old-roast', variety: 'robusta', coffeeType: 'ground', priceCentavos: 10000, isActive: false },
    { ...base, category: fertilizer._id, name: 'Organic Fertilizer 25 kg', slug: 'organic-fertilizer-25kg', priceCentavos: 95000, unit: 'piece', unitLabel: 'sack', variety: null, coffeeType: null },
    { ...base, category: beans._id, name: 'Liberica Dried Cherry', slug: 'liberica-dried-cherry', priceCentavos: 18000, unit: 'kg', unitLabel: null, variety: null, coffeeType: null },
  ]);
  return { coffee, fertilizer, beans, products: Object.fromEntries(products.map((p) => [p.slug, p])) };
}

/** A sold order of `product` for the user with this email (what unlocks a review). */
export async function createSoldOrder(email, product, { method = 'pickup', number = '0001' } = {}) {
  const buyer = await User.findOne({ email });
  return Order.create({
    orderNumber: `KK-20261101-${number}`,
    buyer: buyer._id,
    items: [{ product: product._id, name: product.name, slug: product.slug, unit: product.unit, priceCentavos: product.priceCentavos, quantity: 1, lineTotalCentavos: product.priceCentavos }],
    subtotalCentavos: product.priceCentavos,
    totalCentavos: product.priceCentavos,
    fulfillment: { method },
    payment: { method: 'cash' },
    status: 'sold',
    statusHistory: [{ status: 'pending', at: new Date('2026-11-01T02:00:00Z') }, { status: 'sold', at: new Date('2026-11-08T02:00:00Z') }],
  });
}
