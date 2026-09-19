'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Shield, Menu, X, LogOut, User, ScanLine, LayoutDashboard, History, Factory } from 'lucide-react';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem('user');
    if (stored) setUser(JSON.parse(stored));
  }, [pathname]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/');
  };

  const isManufacturer = user?.role === 'manufacturer';
  const isInspectorOrAdmin = user?.role === 'inspector' || user?.role === 'admin' || user?.role === 'supervisor';

  const links = isManufacturer
    ? [
        { href: '/manufacturer', label: 'Label Check', icon: Factory },
        { href: '/manufacturer/history', label: 'Label History', icon: History },
      ]
    : [
        { href: '/scan', label: 'Scan', icon: ScanLine },
        { href: '/history', label: 'History', icon: History },
        ...(isInspectorOrAdmin ? [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }] : []),
      ];

  const isActive = (href: string) => pathname === href;

  if (pathname === '/' || pathname === '/login') return null;

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href={isManufacturer ? '/manufacturer' : '/scan'} className="flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">
                {isManufacturer ? 'Manufacturer Portal' : 'Packaged Commodity Label Scanner'}
              </span>
            </Link>
            <div className="hidden md:flex ml-10 space-x-1">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(href) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
                  <User className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">{user.username}</span>
                  <span className="text-xs px-1.5 py-0.5 bg-primary-100 text-primary-700 rounded-full capitalize">{user.role}</span>
                </div>
                <button onClick={logout} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors">
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
          <div className="md:hidden flex items-center">
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 text-gray-600">
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
      {menuOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="px-4 py-3 space-y-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                  isActive(href) ? 'bg-primary-50 text-primary-700' : 'text-gray-600'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
            {user && (
              <button onClick={logout} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600">
                <LogOut className="h-4 w-4" /> Logout
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
