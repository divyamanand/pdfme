import { NavLink } from 'react-router-dom';

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Navigation() {
  const navLinks = [
    { id: 'templates-nav', to: '/templates', label: 'Templates' },
    { id: 'designer-nav', to: '/designer', label: 'Designer' },
  ];

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    classNames(
      isActive
        ? 'border-green-500 text-green-600'
        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
      'whitespace-nowrap border-b-2 px-1 py-2 text-sm font-medium'
    );

  return (
    <div className="border-b border-gray-200 my-1 overflow-x-auto">
      <nav aria-label="Tabs" className="-mb-px flex items-center space-x-3 px-4">
        {navLinks.map((item) => (
          <NavLink id={item.id} key={item.to} to={item.to} end className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
