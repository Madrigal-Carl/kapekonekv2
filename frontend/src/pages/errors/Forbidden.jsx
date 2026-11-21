import { ErrorPage } from './ErrorPage'

export function Forbidden() {
  return <ErrorPage code="403" title="You can't open this page" text="Your account doesn't have access to it. If you think it should, contact Kaluppa." />
}
