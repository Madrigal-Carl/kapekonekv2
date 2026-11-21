import { SETTING_DEFAULTS } from '../../constants/settings.js';
import { countSettings, insertMissingSettings } from '../../repositories/setting.repository.js';
import { imagesFor, seedMedia } from './media.js';

const SLIDES = [
  {
    title: 'Marinduque coffee, delivered to your door.',
    subtitle: 'Green beans, fresh roasts and grounds from local farms. Order online, pay by GCash, Maya or cash on delivery, and get it anywhere in Marinduque in 3–5 business days.',
    media: 'roasted-roaster-arm',
    ctaLabel: 'Browse coffee',
    ctaHref: '/products',
  },
  {
    title: 'Green beans straight from the harvest.',
    subtitle: 'Sun-dried Liberica, Excelsa, Arabica and Robusta from Marinduque farmer groups, sold by the kilo for home roasters and cafés.',
    media: 'cherries-branch',
    ctaLabel: 'Shop green beans',
    ctaHref: '/products?coffeeType=green_beans',
  },
  {
    title: 'Delivered anywhere in Marinduque, or pick it up.',
    subtitle: 'See the delivery fee before you order, or collect your coffee at Kaluppa in Pantayin, Santa Cruz.',
    media: 'parcels-stack',
    ctaLabel: 'Browse coffee',
    ctaHref: '/products',
  },
];

/** Insert any missing setting (PRODUCT-SPEC §2 values); values already saved, e.g. edited by Kaluppa, are kept. */
export async function seedSettings() {
  const media = await seedMedia();
  const heroSlides = SLIDES.map(({ media: key, ...slide }) => ({ ...slide, image: imagesFor(media, [key])[0] ?? null }));
  await insertMissingSettings({ ...SETTING_DEFAULTS, 'landing.heroSlides': heroSlides });
  return `${await countSettings()} settings`;
}
