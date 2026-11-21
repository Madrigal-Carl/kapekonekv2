import { ErrorPage } from './ErrorPage'

export function NotFound() {
  return <ErrorPage code="404" title="We couldn't find that page" text="The link may be old, or the page may have moved." />
}
