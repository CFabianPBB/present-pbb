import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/api';

interface DatasetRouterProps {
  children: (datasetId: string | null, isLocked: boolean) => React.ReactNode;
}

export function DatasetRouter({ children }: DatasetRouterProps) {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      // We have a slug in the URL - fetch the dataset
      setLoading(true);
      setIsLocked(true); // Lock dataset picker when accessed via slug
      
      fetch(`${API_BASE_URL}/api/admin/dataset/by-slug/${slug}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Dataset "${slug}" not found`);
          }
          return res.json();
        })
        .then(data => {
          setDatasetId(data.id);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading dataset:', err);
          setError(err.message);
          setLoading(false);
          // Redirect to home after 3 seconds if dataset not found
          setTimeout(() => navigate('/'), 3000);
        });
    } else {
      // No slug - allow free dataset selection
      setIsLocked(false);
      setDatasetId(null);
    }
  }, [slug, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dataset...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️</div>
          <p className="text-gray-800 font-medium mb-2">{error}</p>
          <p className="text-gray-600 text-sm">Redirecting to home...</p>
        </div>
      </div>
    );
  }

  return <>{children(datasetId, isLocked)}</>;
}