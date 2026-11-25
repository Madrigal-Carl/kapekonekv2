// Seed catalog (PRODUCT-SPEC §11). Prices in centavos. `media` lists keys from media.json, first = cover.
const pack = { unit: 'pack', unitLabel: '250 g' };
const kilo = { unit: 'kg', unitLabel: null };

const GREEN = ['green-beans-heap', 'green-beans-drying', 'green-beans-bowls', 'green-beans-washing'];
const ROASTED = ['roasted-cooling-tray', 'roasted-roaster-arm', 'coffee-bag-hand', 'brew-french-press'];
const GROUND = ['ground-spoon', 'ground-pour-over', 'coffee-pouches', 'brew-cup-table'];
const rotate = (list, n) => [...list.slice(n), ...list.slice(0, n)];

export const COFFEE = [
  {
    name: 'Barako Medium Roast', slug: 'barako-medium-roast', variety: 'liberica', coffeeType: 'roasted_beans', ...pack,
    priceCentavos: 26000, stock: 38, isFeatured: true, media: ROASTED,
    shortDescription: 'Bold, smoky body. 250 g whole beans.',
    description: 'Whole Liberica beans roasted to a medium level. Expect a heavy body, low acidity and a smoky, chocolatey finish: the classic kapeng barako cup.',
  },
  {
    name: 'Liberica Green Beans', slug: 'liberica-green-beans', variety: 'liberica', coffeeType: 'green_beans', ...kilo,
    priceCentavos: 32000, stock: 64, isFeatured: true, media: GREEN,
    shortDescription: 'Sun-dried, unroasted. For home roasters.',
    description: 'Sun-dried, unroasted Liberica beans from Marinduque farms, sold by the kilo. Sorted by hand and ready for home roasters and cafés.',
  },
  {
    name: 'Liberica Ground', slug: 'liberica-ground', variety: 'liberica', coffeeType: 'ground', ...pack,
    priceCentavos: 25000, stock: 0, media: GROUND,
    shortDescription: 'Coarse grind for French press and kapeng barako.',
    description: 'Medium-roasted Liberica, ground coarse for the French press or a traditional barako brew. Packed in 250 g resealable bags.',
  },
  {
    name: 'Excelsa Medium Roast', slug: 'excelsa-medium-roast', variety: 'excelsa', coffeeType: 'roasted_beans', ...pack,
    priceCentavos: 28000, stock: 21, media: rotate(ROASTED, 1),
    shortDescription: 'Tart, fruity and complex. 250 g whole beans.',
    description: 'Whole Excelsa beans roasted medium. A tart, fruity cup with a long finish, good on its own or blended with Liberica.',
  },
  {
    name: 'Excelsa Green Beans', slug: 'excelsa-green-beans', variety: 'excelsa', coffeeType: 'green_beans', ...kilo,
    priceCentavos: 34000, stock: 3, media: rotate(GREEN, 1),
    shortDescription: 'Unroasted, hand-sorted beans.',
    description: 'Unroasted Excelsa beans, hand-sorted after sun-drying and sold by the kilo.',
  },
  {
    name: 'Excelsa Ground', slug: 'excelsa-ground', variety: 'excelsa', coffeeType: 'ground', ...pack,
    priceCentavos: 24000, stock: 30, isFeatured: true, media: rotate(GROUND, 1),
    shortDescription: 'Medium grind with a fruity finish.',
    description: 'Medium-roasted Excelsa in a medium grind with a tart, fruity finish. Ready for drip, pour-over or moka pot.',
  },
  {
    name: 'Arabica Light Roast', slug: 'arabica-light-roast', variety: 'arabica', coffeeType: 'roasted_beans', ...pack,
    priceCentavos: 38000, stock: 17, isFeatured: true, media: rotate(ROASTED, 2),
    shortDescription: 'Bright and smooth. Best for pour-over.',
    description: 'Whole Arabica beans roasted light to keep their brighter acidity and lighter body. Best for pour-over and drip.',
  },
  {
    name: 'Arabica Green Beans', slug: 'arabica-green-beans', variety: 'arabica', coffeeType: 'green_beans', ...kilo,
    priceCentavos: 48000, stock: 12, media: rotate(GREEN, 2),
    shortDescription: 'Washed-process green beans.',
    description: 'Washed-process Arabica green beans, sold by the kilo for home and café roasting.',
  },
  {
    name: 'Arabica Ground', slug: 'arabica-ground', variety: 'arabica', coffeeType: 'ground', ...pack,
    priceCentavos: 36000, stock: 26, media: rotate(GROUND, 2),
    shortDescription: 'Medium-fine grind for drip and moka pot.',
    description: 'Light-medium Arabica in a medium-fine grind for drip machines and moka pots.',
  },
  {
    name: 'Robusta Dark Roast', slug: 'robusta-dark-roast', variety: 'robusta', coffeeType: 'roasted_beans', ...pack,
    priceCentavos: 21000, stock: 44, isFeatured: true, media: rotate(ROASTED, 3),
    shortDescription: 'Strong and earthy. Made for espresso.',
    description: 'Whole Robusta beans roasted dark. Strong, earthy and high in caffeine, made for espresso and milk drinks.',
  },
  {
    name: 'Robusta Green Beans', slug: 'robusta-green-beans', variety: 'robusta', coffeeType: 'green_beans', ...kilo,
    priceCentavos: 28000, stock: 90, media: rotate(GREEN, 3),
    shortDescription: 'Unroasted beans, sold by the kilo.',
    description: 'Unroasted Robusta beans from Marinduque, sold by the kilo.',
  },
  {
    name: 'Robusta Ground', slug: 'robusta-ground', variety: 'robusta', coffeeType: 'ground', ...pack,
    priceCentavos: 20000, stock: 52, media: rotate(GROUND, 3),
    shortDescription: 'Fine grind for espresso and strong brews.',
    description: 'Dark-roasted Robusta in a fine grind for espresso machines and strong brews.',
  },
];

const supply = { unit: 'piece', variety: null, coffeeType: null };

export const FERTILIZER = [
  { name: 'Complete Fertilizer 14-14-14', slug: 'complete-fertilizer-14-14-14', unitLabel: '50 kg sack', priceCentavos: 165000, stock: 40, shortDescription: 'Balanced NPK for young and bearing coffee trees.' },
  { name: 'Urea 46-0-0', slug: 'urea-46-0-0', unitLabel: '50 kg sack', priceCentavos: 175000, stock: 30, shortDescription: 'Nitrogen for leaf growth during the rainy season.' },
  { name: 'Muriate of Potash 0-0-60', slug: 'muriate-of-potash-0-0-60', unitLabel: '50 kg sack', priceCentavos: 190000, stock: 18, shortDescription: 'Potassium for cherry filling before harvest.' },
  { name: 'Organic Fertilizer', slug: 'organic-fertilizer', unitLabel: '25 kg sack', priceCentavos: 45000, stock: 60, shortDescription: 'Composted farm manure to build soil organic matter.' },
  { name: 'Vermicast', slug: 'vermicast', unitLabel: '10 kg bag', priceCentavos: 25000, stock: 4, shortDescription: 'Worm castings for nursery mixes and seedlings.' },
].map((p) => ({ ...supply, unit: 'sack', ...p, media: ['fertilizer-granules'], description: `${p.shortDescription} Sold per ${p.unitLabel}.` }));

export const SEEDLINGS = ['liberica', 'excelsa', 'arabica', 'robusta'].map((variety, i) => {
  const name = `${variety[0].toUpperCase()}${variety.slice(1)} Seedling`;
  return {
    ...supply, variety, name, slug: `${variety}-seedling`, unitLabel: 'seedling in a nursery bag',
    priceCentavos: [4500, 4500, 6000, 3500][i], stock: [120, 80, 50, 150][i],
    media: i % 2 ? ['seedling-sprout', 'seedling-hand'] : ['seedling-hand', 'seedling-sprout'],
    shortDescription: `Six-month-old ${name.toLowerCase()} from a local nursery.`,
    description: `Six-month-old ${name.toLowerCase()} raised in a nursery bag, ready to plant at the start of the rainy season.`,
  };
});
