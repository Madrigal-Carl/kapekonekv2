import { Link } from 'react-router-dom'
import { BeanMark } from '@/components/ui/BeanMark'

const COLUMNS = [
  {
    title: 'Shop',
    links: [
      ['All coffee', '/products'],
      ['Liberica', '/products?variety=liberica'],
      ['Excelsa', '/products?variety=excelsa'],
      ['Arabica', '/products?variety=arabica'],
      ['Robusta', '/products?variety=robusta'],
    ],
  },
  {
    title: 'Help',
    links: [
      ['How ordering works', '/#how'],
      ['Delivery & pickup', '/#faq'],
      ['FAQ', '/#faq'],
      ['Contact us', '/contact'],
      ['Sell as a farmer', '/register'],
    ],
  },
  // shortcut: Terms and Privacy pages don't exist yet; the links point home like the screen's.
  { title: 'Legal', links: [['Terms', '/'], ['Privacy', '/']] },
]

/** Storefront footer (Footer.dc.html). */
export function Footer() {
  return (
    <footer className="w-full bg-espresso text-crema/78">
      <div className="mx-auto max-w-[1280px] px-4 pb-7 pt-14 sm:px-8">
        <div className="flex flex-wrap justify-between gap-10">
          <div className="max-w-[360px] flex-[1_1_280px]">
            <div className="flex items-center gap-2.5">
              <span className="grid size-[34px] place-items-center rounded-card bg-crema text-espresso">
                <BeanMark className="size-[18px]" />
              </span>
              <span className="text-base font-semibold text-white">KapeKonek</span>
            </div>
            <p className="mt-3.5 text-[13.5px] leading-[1.65]">
              Coffee from Marinduque farms, sourced and sold by Kaluppa. Order online and get it delivered anywhere in Marinduque, or pick it up at Kaluppa.
            </p>
          </div>
          {COLUMNS.map(({ title, links }) => (
            <nav key={title} aria-label={title} className="flex-[0_1_170px]">
              <span className="block text-[10.5px] font-medium uppercase tracking-[0.16em] text-caramel-light">{title}</span>
              <ul className="mt-3.5 flex list-none flex-col gap-2.5 p-0 text-[13.5px]">
                {links.map(([label, to]) => (
                  <li key={label}>
                    <Link to={to} className="text-crema/78 no-underline hover:text-white focus-visible:outline-caramel">{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-11 flex flex-wrap justify-between gap-3 border-t border-crema/14 pt-5 text-[12.5px]">
          <span>© {new Date().getFullYear()} KapeKonek · Kaluppa, Marinduque</span>
        </div>
      </div>
    </footer>
  )
}
