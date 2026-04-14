import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ToastProvider, useToast } from './ToastContext'

function Trigger() {
  const { showToast } = useToast()
  return (
    <button type="button" onClick={() => showToast('Message test')}>
      Afficher
    </button>
  )
}

describe('ToastProvider', () => {
  it('affiche le message dans la région aria-live puis le retire', async () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Afficher' }))
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('Message test')

    await act(async () => {
      vi.advanceTimersByTime(3300)
    })
    expect(region).not.toHaveTextContent('Message test')

    vi.useRealTimers()
  })
})
