import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { BugReportSheet } from './BugReportSheet';
import daMessages from '../../messages/da.json';

// Renders the sheet open, with the real Danish messages so the tests pin the
// actual user-facing strings.
function renderSheet(onClose: () => void = () => {}) {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <BugReportSheet open onClose={onClose} />
    </NextIntlClientProvider>
  );
}

const VALID_TITLE = 'Appen crasher på raid-siden';
const VALID_DESCRIPTION = 'Når jeg åbner et raid og trykker tilbage, fryser appen helt.';

function fillForm(title = VALID_TITLE, description = VALID_DESCRIPTION) {
  fireEvent.change(screen.getByLabelText('Titel'), { target: { value: title } });
  fireEvent.change(screen.getByLabelText('Beskrivelse'), { target: { value: description } });
}

describe('BugReportSheet', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllGlobals();
  });

  it('keeps the send button disabled until both fields pass validation', () => {
    renderSheet();
    const send = screen.getByRole('button', { name: 'Send' });

    // Empty form — disabled.
    expect(send).toBeDisabled();

    // Valid title alone is not enough.
    fireEvent.change(screen.getByLabelText('Titel'), { target: { value: VALID_TITLE } });
    expect(send).toBeDisabled();

    // Too-short description still disabled.
    fireEvent.change(screen.getByLabelText('Beskrivelse'), { target: { value: 'kort' } });
    expect(send).toBeDisabled();

    // Both fields valid — enabled.
    fireEvent.change(screen.getByLabelText('Beskrivelse'), {
      target: { value: VALID_DESCRIPTION },
    });
    expect(send).toBeEnabled();
  });

  it('shows the thank-you state after a successful send', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 201 });
    renderSheet();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Tak!')).toBeInTheDocument();
    expect(
      screen.getByText('Vi har modtaget din rapport og kigger på den hurtigst muligt.')
    ).toBeInTheDocument();
    // The form is replaced by the thank-you state.
    expect(screen.queryByLabelText('Titel')).not.toBeInTheDocument();

    // The POST went to the route with the trimmed payload.
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bug-report',
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ title: VALID_TITLE, description: VALID_DESCRIPTION });
  });

  it('shows the generic error and keeps the typed values when the API answers 503', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });
    renderSheet();

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('Rapporten kunne ikke sendes. Prøv igen senere.')
    ).toBeInTheDocument();

    // The form stays with the typed values preserved, ready to retry.
    expect(screen.getByLabelText('Titel')).toHaveValue(VALID_TITLE);
    expect(screen.getByLabelText('Beskrivelse')).toHaveValue(VALID_DESCRIPTION);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    );
  });
});
