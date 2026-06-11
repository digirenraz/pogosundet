import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { GymSearch } from './GymSearch';
import { formatDistance, haversineMeters } from '@/lib/gyms/suggestions';
import daMessages from '../../messages/da.json';

// Mock the data layer underneath GymSearch's module-level cache — the cache
// then caches this fixture, so it is identical for every test in this file.
// (Mocking at the helpers level is what makes the cache test-safe.)
const GYMS = [
  { name: 'Frederikssund Kirke', lat: 55.8396, lng: 12.0689 },
  { name: 'Slangerup Kirke', lat: 55.85, lng: 12.18 },
  { name: 'Svømmehallen', lat: 55.841, lng: 12.07 },
  { name: 'Auto-lært Gym', lat: null, lng: null },
];

vi.mock('@/lib/gyms/helpers', () => ({
  fetchGyms: vi.fn(async () => GYMS),
}));

// The position used by "granted" tests — right next to Frederikssund Kirke.
const COORDS = { latitude: 55.8396, longitude: 12.0689 };
const POSITION = { lat: COORDS.latitude, lng: COORDS.longitude };

// Stub navigator.geolocation + navigator.permissions for the useGeolocation
// hook. `permissionState: 'prompt'` keeps the hook idle (button shown);
// 'granted' makes it fetch the position silently on mount.
function stubGeolocation(permissionState: PermissionState) {
  const getCurrentPosition = vi.fn(
    (success: (pos: { coords: typeof COORDS }) => void) => {
      success({ coords: COORDS });
    }
  );
  vi.stubGlobal('navigator', {
    geolocation: { getCurrentPosition },
    permissions: {
      query: vi.fn(async () => ({ state: permissionState })),
    },
  });
  return { getCurrentPosition };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderGymSearch(props: { recentGyms?: string[] } = {}) {
  return render(
    <NextIntlClientProvider locale="da" messages={daMessages}>
      <GymSearch value="" onChange={() => {}} {...props} />
    </NextIntlClientProvider>
  );
}

describe('GymSearch', () => {
  it('shows the recent-gyms group on focus with an empty query', async () => {
    stubGeolocation('prompt');
    renderGymSearch({ recentGyms: ['Slottet', 'Stationen'] });

    fireEvent.focus(screen.getByPlaceholderText('Søg gym...'));

    expect(await screen.findByText('Dine seneste gyms')).toBeInTheDocument();
    expect(screen.getByText('Slottet')).toBeInTheDocument();
    expect(screen.getByText('Stationen')).toBeInTheDocument();
  });

  it('shows the location-request button when the permission state is prompt', async () => {
    const { getCurrentPosition } = stubGeolocation('prompt');
    renderGymSearch();

    fireEvent.focus(screen.getByPlaceholderText('Søg gym...'));

    const button = await screen.findByRole('button', {
      name: 'Vis gyms i nærheden',
    });
    expect(getCurrentPosition).not.toHaveBeenCalled();

    // Pressing it triggers the actual geolocation lookup.
    fireEvent.mouseDown(button);
    expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it('lists nearby gyms with distance labels when permission is already granted', async () => {
    stubGeolocation('granted');
    renderGymSearch();

    fireEvent.focus(screen.getByPlaceholderText('Søg gym...'));

    expect(await screen.findByText('I nærheden')).toBeInTheDocument();
    // No prompt-button when the position was fetched silently.
    expect(
      screen.queryByRole('button', { name: 'Vis gyms i nærheden' })
    ).not.toBeInTheDocument();

    // Nearest gym (the position sits on top of it) plus its distance label.
    expect(screen.getByText('Frederikssund Kirke')).toBeInTheDocument();
    expect(screen.getByText('Svømmehallen')).toBeInTheDocument();
    const expectedLabel = formatDistance(
      haversineMeters(POSITION, { lat: 55.841, lng: 12.07 })
    );
    expect(screen.getByText(expectedLabel)).toBeInTheDocument();
    // The coordless auto-learned gym never appears in the nearby group.
    expect(screen.queryByText('Auto-lært Gym')).not.toBeInTheDocument();
  });

  it('sorts typed-query matches by distance when the position is known', async () => {
    stubGeolocation('granted');
    renderGymSearch();

    const input = screen.getByPlaceholderText('Søg gym...');
    fireEvent.focus(input);
    await screen.findByText('I nærheden');

    fireEvent.change(input, { target: { value: 'kirke' } });

    const dropdown = await screen.findByTestId('gym-suggestions');
    const rows = Array.from(dropdown.querySelectorAll('button')).map(
      b => b.textContent
    );
    // Frederikssund Kirke (~0 m) before Slangerup Kirke (~7 km away).
    expect(rows[0]).toContain('Frederikssund Kirke');
    expect(rows[1]).toContain('Slangerup Kirke');
    expect(rows[1]).toContain('km');
  });

  it('keeps the typed-query select flow working (existing behaviour)', async () => {
    stubGeolocation('prompt');
    const onChange = vi.fn();
    render(
      <NextIntlClientProvider locale="da" messages={daMessages}>
        <GymSearch value="" onChange={onChange} />
      </NextIntlClientProvider>
    );

    const input = screen.getByPlaceholderText('Søg gym...');
    fireEvent.change(input, { target: { value: 'svøm' } });

    const option = await screen.findByText('Svømmehallen');
    fireEvent.mouseDown(option);

    expect(onChange).toHaveBeenLastCalledWith('Svømmehallen');
    // Dropdown closes after selecting.
    expect(screen.queryByTestId('gym-suggestions')).not.toBeInTheDocument();
  });
});
