import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MaterialForm from './MaterialForm';

// Heavy/unrelated sub-components stubbed out — this test only exercises the
// name/location required-field validation added to handleSubmit this session.
vi.mock('../shared/LocationPicker', () => ({ default: () => <div data-testid="location-picker-stub" /> }));
vi.mock('../shared/ImageUploader', () => ({ default: () => <div data-testid="image-uploader-stub" /> }));
vi.mock('../shared/FileUploader', () => ({ default: () => <div data-testid="file-uploader-stub" /> }));
vi.mock('../shared/GeolocateButton', () => ({ default: () => <button type="button">Geolocate stub</button> }));
vi.mock('../shared/InlineUserPicker', () => ({ default: () => <div data-testid="inline-user-picker-stub" /> }));

vi.mock('../../services/materialService', () => ({
  materialService: {
    getCategories: vi.fn().mockResolvedValue({ data: [] }),
    create: vi.fn(),
    update: vi.fn(),
  },
  materialActorService: {
    getActors: vi.fn().mockResolvedValue([]),
    setActors: vi.fn(),
  },
  parseEpdPdf: vi.fn(),
  parseDocumentForMaterial: vi.fn(),
  analyzeImages: vi.fn(),
}));
vi.mock('../../services/actorService', () => ({
  actorService: { getAll: vi.fn().mockResolvedValue({ data: [] }) },
}));
vi.mock('../../services/inventoryService', () => ({
  inventoryService: { getGesuche: vi.fn().mockResolvedValue([]) },
}));
vi.mock('../../services/idematService', () => ({
  idematService: { search: vi.fn().mockResolvedValue([]) },
}));

function renderForm(props = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MaterialForm onClose={() => {}} {...props} />
    </QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('MaterialForm — required-field validation on submit', () => {
  it('shows a visible error and does not submit when the name is empty', () => {
    renderForm();
    const form = document.querySelector('form');
    fireEvent.submit(form);
    expect(screen.getByText('Bitte einen Materialnamen eingeben.')).toBeInTheDocument();
  });

  it('shows a visible error for a missing location once the name is filled in', () => {
    renderForm();
    const nameInput = document.querySelector('input[name="name"]');
    fireEvent.change(nameInput, { target: { value: 'Recyceltes Testholz' } });
    const form = document.querySelector('form');
    fireEvent.submit(form);
    expect(screen.getByText('Bitte einen Standort angeben.')).toBeInTheDocument();
  });

  it('never silently does nothing — some error is always shown when required fields are missing', () => {
    // Regression test for the original bug: an invisible, unfocusable native
    // `required` input silently blocked submission with zero visible feedback.
    renderForm();
    const form = document.querySelector('form');
    fireEvent.submit(form);
    const errorBanner = document.querySelector('.bg-red-50');
    expect(errorBanner).not.toBeNull();
    expect(errorBanner.textContent.length).toBeGreaterThan(0);
  });
});
