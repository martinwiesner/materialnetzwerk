import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ShareDialog from './ShareDialog';

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));
import api from '../../services/api';

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
  api.put.mockResolvedValue({ data: {} });
  api.post.mockResolvedValue({ data: {} });
  api.delete.mockResolvedValue({ data: {} });
});

describe('ShareDialog — non-owner view', () => {
  it('hides the visibility picker and share list entirely when isOwner is false', () => {
    render(<ShareDialog entityType="material" entityId="m1" isOwner={false} onClose={() => {}} />);
    expect(screen.queryByText('Sichtbarkeit')).not.toBeInTheDocument();
    expect(screen.queryByText('Direkte Freigaben')).not.toBeInTheDocument();
    // The dialog chrome itself still renders
    expect(screen.getByText('Sichtbarkeit & Freigabe')).toBeInTheDocument();
  });

  it('does not fetch shares when isOwner is false', () => {
    render(<ShareDialog entityType="material" entityId="m1" isOwner={false} onClose={() => {}} />);
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('ShareDialog — entity-specific wording', () => {
  it('uses "dieses Material" for entityType="material"', () => {
    render(<ShareDialog entityType="material" entityId="m1" isOwner onClose={() => {}} />);
    expect(screen.getByText('Nur du kannst dieses Material sehen.')).toBeInTheDocument();
  });

  it('uses "dieses Projekt" for entityType="project"', () => {
    render(<ShareDialog entityType="project" entityId="p1" isOwner onClose={() => {}} />);
    expect(screen.getByText('Nur du kannst dieses Projekt sehen.')).toBeInTheDocument();
  });
});

describe('ShareDialog — data fetching per entityType', () => {
  it('fetches both shares and shared actors for materials', async () => {
    render(<ShareDialog entityType="material" entityId="m1" isOwner onClose={() => {}} />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/shares/material/m1');
      expect(api.get).toHaveBeenCalledWith('/shares/material/m1/actors');
    });
  });

  it('fetches only shares (no actors endpoint) for projects', async () => {
    render(<ShareDialog entityType="project" entityId="p1" isOwner onClose={() => {}} />);
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/shares/project/p1');
    });
    expect(api.get).not.toHaveBeenCalledWith('/shares/project/p1/actors');
  });
});

describe('ShareDialog — actor-team visibility branch', () => {
  it('shows the actor multi-select and fetches /actors for materials', async () => {
    render(<ShareDialog entityType="material" entityId="m1" isOwner onClose={() => {}} />);
    fireEvent.click(screen.getByText('Akteur-Teams'));
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/actors');
    });
    expect(screen.getByText('Akteure mit Zugriff:')).toBeInTheDocument();
  });

  it('shows a pointer to the project form instead, for projects', async () => {
    render(<ShareDialog entityType="project" entityId="p1" isOwner onClose={() => {}} />);
    fireEvent.click(screen.getByText('Akteur-Teams'));
    expect(await screen.findByText(/Projekt-Formular unter „Sichtbarkeit"/)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalledWith('/actors');
  });
});

describe('ShareDialog — visibility change', () => {
  it('PUTs to the pluralized entity endpoint and notifies the parent', async () => {
    const onVisibilityChange = vi.fn();
    render(
      <ShareDialog entityType="project" entityId="p1" currentVisibility="private"
        isOwner onClose={() => {}} onVisibilityChange={onVisibilityChange} />
    );
    fireEvent.click(screen.getByText('Öffentlich'));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/projects/p1', { visibility: 'public' });
      expect(onVisibilityChange).toHaveBeenCalledWith('public');
    });
  });

  it('uses /materials/:id (not /material/:id) for the visibility PUT', async () => {
    render(<ShareDialog entityType="material" entityId="m1" currentVisibility="private" isOwner onClose={() => {}} />);
    fireEvent.click(screen.getByText('Öffentlich'));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/materials/m1', { visibility: 'public' });
    });
  });
});

describe('ShareDialog — direct shares list', () => {
  it('renders existing shares with their access level label', async () => {
    api.get.mockImplementation((url) => {
      if (url === '/shares/project/p1') {
        return Promise.resolve({ data: [{ shared_with_user_id: 'u2', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@example.com', access_level: 'edit' }] });
      }
      return Promise.resolve({ data: [] });
    });
    render(<ShareDialog entityType="project" entityId="p1" isOwner onClose={() => {}} />);
    expect(await screen.findByText('Ada Lovelace')).toBeInTheDocument();
    // "Bearbeiten" also appears as an <option> in the access-level select —
    // scope to the badge specifically (amber background = edit-level share).
    const badge = document.querySelector('.bg-amber-100');
    expect(badge).toHaveTextContent('Bearbeiten');
  });

  it('shows "Noch keine direkten Freigaben." when there are none', async () => {
    render(<ShareDialog entityType="project" entityId="p1" isOwner onClose={() => {}} />);
    expect(await screen.findByText('Noch keine direkten Freigaben.')).toBeInTheDocument();
  });
});
