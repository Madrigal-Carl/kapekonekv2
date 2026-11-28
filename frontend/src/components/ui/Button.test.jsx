// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Link } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { IconPlus } from './icons'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const VARIANT_CLASS = {
  solid: 'bg-roast',
  outline: 'border-sand-strong',
  soft: 'bg-crema',
  ghost: 'hover:bg-highlight',
  danger: 'bg-logout',
  'danger-outline': 'border-danger-outline',
  success: 'bg-success',
  link: 'hover:underline',
  light: 'text-espresso',
  glass: 'bg-white/10',
  caramel: 'bg-caramel',
}

describe('Button', () => {
  it.each(Object.entries(VARIANT_CLASS))('renders the %s variant', (variant, cls) => {
    render(<Button variant={variant}>Save farm</Button>)
    const button = screen.getByRole('button', { name: 'Save farm' })
    expect(button.className).toContain(cls)
    expect(button.className).toContain('rounded-control')
    expect(button.getAttribute('type')).toBe('button')
  })

  it.each([
    ['sm', 'h-9'],
    ['md', 'h-[42px]'],
    ['lg', 'h-12'],
  ])('renders size %s', (size, cls) => {
    render(<Button size={size}>Add farm</Button>)
    expect(screen.getByRole('button').className).toContain(cls)
  })

  it('defaults to solid md', () => {
    render(<Button>Save</Button>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('bg-roast')
    expect(cls).toContain('h-[42px]')
  })

  it('loading disables the button and shows the spinner and loading label', () => {
    const onClick = vi.fn()
    render(
      <Button loading loadingLabel="Saving…" onClick={onClick}>
        Save farm
      </Button>,
    )
    const button = screen.getByRole('button')
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(button.querySelector('.animate-spin')).toBeTruthy()
    expect(screen.getByText('Saving…')).toBeTruthy()
    // the label stays in place (invisible) so the width doesn't change
    expect(screen.getByText('Save farm').className).toContain('invisible')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders a router link with as={Link}', () => {
    render(
      <MemoryRouter>
        <Button as={Link} to="/dashboard/farms" variant="outline" leftIcon={<IconPlus aria-hidden="true" />}>
          Farms
        </Button>
      </MemoryRouter>,
    )
    const link = screen.getByRole('link', { name: 'Farms' })
    expect(link.getAttribute('href')).toBe('/dashboard/farms')
    expect(link.className).toContain('border-sand-strong')
    expect(link.querySelector('svg')).toBeTruthy()
  })

  it('a disabled link is aria-disabled and swallows the click', () => {
    const onClick = vi.fn()
    render(
      <Button as="a" href="#how" disabled onClick={onClick}>
        How it works
      </Button>,
    )
    const link = screen.getByText('How it works')
    expect(link.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(link)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('iconOnly is square and warns in dev without an aria-label', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { rerender } = render(
      <Button iconOnly size="sm" aria-label="Add">
        <IconPlus />
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Add' }).className).toContain('w-9')
    expect(warn).not.toHaveBeenCalled()
    rerender(
      <Button iconOnly>
        <IconPlus />
      </Button>,
    )
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('aria-label'))
  })

  it('fullWidth stretches the button', () => {
    render(<Button fullWidth>Send to Kaluppa</Button>)
    expect(screen.getByRole('button').className).toContain('w-full')
  })
})
