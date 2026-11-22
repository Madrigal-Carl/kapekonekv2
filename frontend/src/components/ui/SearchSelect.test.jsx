// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Controller, useForm } from 'react-hook-form'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SearchSelect } from './SearchSelect'

afterEach(cleanup)

const TOWNS = ['Boac', 'Buenavista', 'Gasan', 'Mogpog', 'Santa Cruz', 'Torrijos']
const setup = (props = {}) => {
  const onChange = vi.fn()
  render(<SearchSelect label="Municipality" icon="pin" options={TOWNS} value={null} onChange={onChange} placeholder="Select municipality" {...props} />)
  return { onChange, trigger: screen.getByRole('button', { name: /Municipality/ }) }
}

describe('SearchSelect', () => {
  it('filters as you type, highlights the match and says when nothing matches', () => {
    const { trigger } = setup()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const search = screen.getByRole('combobox')
    expect(document.activeElement).toBe(search)
    fireEvent.change(search, { target: { value: 'sa' } })
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Gasan', 'Santa Cruz'])
    expect(screen.getByText('2 of 6')).toBeTruthy()
    expect(screen.getAllByText('sa', { selector: 'mark' })).toHaveLength(1)
    fireEvent.change(search, { target: { value: 'xyz' } })
    expect(screen.queryAllByRole('option')).toHaveLength(0)
    expect(screen.getByText('No match for “xyz”')).toBeTruthy()
  })

  it('picks with the keyboard and returns focus to the trigger', () => {
    const { onChange, trigger } = setup()
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const search = screen.getByRole('combobox')
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    fireEvent.keyDown(search, { key: 'ArrowDown' })
    expect(search.getAttribute('aria-activedescendant')).toBe(screen.getAllByRole('option')[2].id)
    fireEvent.keyDown(search, { key: 'End' })
    fireEvent.keyDown(search, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Torrijos')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('Esc closes without picking and does not reach a surrounding dialog', () => {
    const outer = vi.fn()
    document.addEventListener('keydown', outer)
    const { onChange, trigger } = setup({ value: 'Gasan' })
    expect(trigger.textContent).toContain('Gasan')
    fireEvent.click(trigger)
    expect(screen.getByRole('option', { name: 'Gasan' }).getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
    expect(outer).not.toHaveBeenCalled()
    document.removeEventListener('keydown', outer)
  })

  it('closes on an outside click', () => {
    const { trigger } = setup()
    fireEvent.click(trigger)
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('does nothing while disabled and shows an error', () => {
    const { trigger } = setup({ disabled: true, placeholder: 'Pick a municipality first' })
    expect(trigger.disabled).toBe(true)
    fireEvent.click(trigger)
    expect(screen.queryByRole('listbox')).toBeNull()
    cleanup()
    const { trigger: withError } = setup({ error: 'Select your municipality.' })
    expect(screen.getByRole('alert').textContent).toBe('Select your municipality.')
    expect(withError.getAttribute('aria-invalid')).toBe('true')
  })

  it('labels itself with aria-label when there is no visible label', () => {
    render(<SearchSelect aria-label="Sort products by" icon="sort" size="sm" options={[{ value: 'newest', label: 'Newest' }]} value="newest" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Sort products by' }).textContent).toContain('Newest')
  })

  it('works inside react-hook-form through Controller', async () => {
    const submitted = vi.fn()
    function Form() {
      const { control, handleSubmit } = useForm({ defaultValues: { municipality: '' } })
      return (
        <form onSubmit={handleSubmit(submitted)}>
          <Controller
            name="municipality"
            control={control}
            rules={{ required: 'Select your municipality.' }}
            render={({ field, fieldState }) => (
              <SearchSelect label="Municipality" options={TOWNS} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} error={fieldState.error?.message} />
            )}
          />
          <button type="submit">Save</button>
        </form>
      )
    }
    render(<Form />)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Select your municipality.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Municipality/ }))
    fireEvent.click(screen.getByRole('button', { name: /Municipality/ }))
    fireEvent.click(screen.getByRole('option', { name: 'Mogpog' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(submitted).toHaveBeenCalled())
    expect(submitted.mock.calls[0][0]).toEqual({ municipality: 'Mogpog' })
  })
})
