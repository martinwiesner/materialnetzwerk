import { useQuery } from '@tanstack/react-query';
import { materialService } from '../../services/materialService';
import { projectService } from '../../services/projectService';
import { Package, FolderOpen, Leaf, TrendingUp, AlertCircle, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { data: materialsData } = useQuery({
    queryKey: ['materials'],
    queryFn: () => materialService.getAll({ limit: 5 }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectService.getAll({ limit: 5 }),
  });

  const materials = materialsData?.data || [];
  const projects = projectsData?.data || [];

  const stats = [
    {
      name: 'Total Materials',
      value: materialsData?.pagination?.total || materials.length,
      icon: Package,
      href: '/materials',
      color: 'bg-blue-500',
    },
    {
      name: 'Active Projects',
      value: projectsData?.pagination?.total || projects.length,
      icon: FolderOpen,
      href: '/projects',
      color: 'bg-project-500',
    },
    {
      name: 'Marketplace',
      value: 'Open',
      icon: Store,
      href: '/marketplace?tab=my-inventory',
      color: 'bg-orange-500',
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Overview of your material library</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            to={stat.href}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4">
              <div className={`${stat.color} p-3 rounded-lg`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-600">{stat.name}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Materials */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recent Materials</h2>
            <Link to="/materials" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="p-4">
            {materials.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No materials yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {materials.slice(0, 5).map((material) => (
                  <div
                    key={material.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{material.name}</p>
                      <p className="text-sm text-gray-500">{material.category}</p>
                    </div>
                    {material.gwp_value && (
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {material.gwp_value}
                        </p>
                        <p className="text-xs text-gray-500">{material.gwp_unit || 'kg CO₂e'}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Recent Projects</h2>
            <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700">
              View all
            </Link>
          </div>
          <div className="p-4">
            {projects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FolderOpen className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No projects yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 5).map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <p className="text-sm text-gray-500">{project.client_name || 'No client'}</p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      project.status === 'active' ? 'bg-project-50 text-project-700' :
                      project.status === 'completed' ? 'bg-rzz-cloud-light text-rzz-urban-ash' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {project.status || 'draft'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Marketplace Shortcut */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Marketplace</h2>
            <Link to="/marketplace?tab=my-inventory" className="text-sm text-primary-600 hover:text-primary-700">
              Open marketplace
            </Link>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-100">
              <p className="text-sm font-semibold text-primary-800 mb-1">Your offers</p>
              <p className="text-sm text-primary-700">Manage your materials and set them available for others.</p>
            </div>
            <div className="p-4 bg-project-50 rounded-lg border border-project-100">
              <p className="text-sm font-semibold text-project-800 mb-1">Community offers</p>
              <p className="text-sm text-project-700">Browse other users' available materials and projects.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="mt-8 bg-primary-50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="bg-primary-100 p-2 rounded-lg">
            <Leaf className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-primary-900 mb-1">Sustainability Tip</h3>
            <p className="text-primary-700">
              Track the Global Warming Potential (GWP) of your materials to make more 
              environmentally conscious decisions. Materials with lower GWP values 
              contribute less to climate change.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
