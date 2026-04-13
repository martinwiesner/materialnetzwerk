import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { materialService } from '../../services/materialService';
import MaterialDetailModal from '../../components/materials/MaterialDetailModal';
import MaterialForm from '../../components/materials/MaterialForm';
import { useAuthStore } from '../../store/authStore';

export default function MaterialDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['materials', { id }],
    queryFn: () => materialService.getById(id),
    enabled: Boolean(id),
  });

  const material = data?.data || data;

  if (isLoading) {
    return (
      <div className="py-10 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
      </div>
    );
  }

  if (isError || !material) {
    return (
      <div className="py-10 text-center text-gray-600">
        Material nicht gefunden.
      </div>
    );
  }

  const canEdit = isAuthenticated && (material.created_by === user?.id || user?.is_admin);

  return (
    <>
      <MaterialDetailModal
        material={material}
        onClose={() => navigate(-1)}
        canEdit={canEdit}
        onEdit={() => setEditing(true)}
      />
      {editing && (
        <MaterialForm
          material={material}
          onClose={() => {
            setEditing(false);
            queryClient.invalidateQueries({ queryKey: ['materials', { id }] });
          }}
        />
      )}
    </>
  );
}
