import { Bookmark } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoriteService } from '../../services/favoriteService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';
import clsx from 'clsx';

/**
 * BookmarkButton — saves/unsaves a material or project.
 *
 * Props:
 *  entityType   'material' | 'project'
 *  entityId     string
 *  showCount    boolean  – show saved-count badge
 *  size         'sm' | 'md'
 *  className    extra classes
 */
export default function BookmarkButton({
  entityType,
  entityId,
  showCount = false,
  size = 'md',
  className = '',
}) {
  const { isAuthenticated, token } = useAuthStore();
  const openAuth = useAuthOverlayStore((s) => s.open);
  const qc = useQueryClient();

  const statusKey = ['fav-status', entityType, entityId];

  const { data } = useQuery({
    queryKey: statusKey,
    queryFn: () => favoriteService.getStatus(entityType, entityId),
    staleTime: 30_000,
  });

  const isSaved = data?.isFavorited ?? false;
  const count = data?.count ?? 0;

  const toggle = useMutation({
    mutationFn: () =>
      isSaved
        ? favoriteService.remove(entityType, entityId)
        : favoriteService.add(entityType, entityId),
    onSuccess: (result) => {
      qc.setQueryData(statusKey, { isFavorited: !isSaved, count: result.count });
      qc.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!isAuthenticated || !token) {
      openAuth({
        tab: 'login',
        reason: 'Bitte logge dich ein, um Einträge auf deiner Merkliste zu speichern.',
      });
      return;
    }
    toggle.mutate();
  };

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const btnSize = size === 'sm' ? 'p-1' : 'p-1.5';

  return (
    <button
      onClick={handleClick}
      disabled={toggle.isPending}
      title={isSaved ? 'Von Merkliste entfernen' : 'Auf Merkliste speichern'}
      className={clsx(
        btnSize,
        'rounded-lg transition-colors flex items-center gap-1',
        isSaved
          ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
          : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50',
        className
      )}
    >
      <Bookmark
        className={clsx(iconSize, 'transition-all', isSaved && 'fill-primary-600')}
      />
      {showCount && count > 0 && (
        <span className="text-[10px] font-semibold leading-none">{count}</span>
      )}
    </button>
  );
}
