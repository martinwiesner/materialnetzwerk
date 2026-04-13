import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { materialService } from '../../services/materialService';
import MaterialDetailModal from '../../components/materials/MaterialDetailModal';

export default function MaterialDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

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

  return <MaterialDetailModal material={material} onClose={() => navigate(-1)} />;
}
