import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorDialogProvider, useErrorDialog } from './ErrorDialogContext'

function Probe() {
  const { reportMessage } = useErrorDialog()
  return (
    <button type="button" onClick={() => reportMessage('Message utilisateur', 'détail technique')}>
      Déclencher erreur
    </button>
  )
}

describe('ErrorDialogProvider', () => {
  it('affiche le message après reportMessage', async () => {
    render(
      <ErrorDialogProvider>
        <Probe />
      </ErrorDialogProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /Déclencher erreur/i }))
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument()
    expect(screen.getByText('Message utilisateur')).toBeInTheDocument()
  })
})
