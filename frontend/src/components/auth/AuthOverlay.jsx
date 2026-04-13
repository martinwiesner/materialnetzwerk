import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Leaf, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';

import { authService } from '../../services/authService';
import { useAuthStore } from '../../store/authStore';
import { useAuthOverlayStore } from '../../store/authOverlayStore';

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
        active ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'
      )}
    >
      {children}
    </button>
  );
}

function LoginForm({ onDone }) {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: authService.login,
    onSuccess: (data) => {
      queryClient.clear();
      const user = {
        ...data.user,
        firstName: data.user.first_name,
        lastName: data.user.last_name,
        username: data.user.username || data.user.email?.split('@')[0],
      };
      setAuth(user, data.token);
      onDone?.();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Login failed');
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        mutation.mutate(form);
      }}
      className="space-y-4"
    >
      {error ? (
        <div className="bg-red-50 text-red-700 border border-red-100 p-3 rounded-lg text-sm">{error}</div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none pr-10"
            placeholder="••••••••"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-primary-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-600 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}

function RegisterForm({ onDone }) {
  const queryClient = useQueryClient();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: authService.register,
    onSuccess: (data) => {
      queryClient.clear();
      const user = {
        ...data.user,
        firstName: data.user.first_name,
        lastName: data.user.last_name,
        username: data.user.username || data.user.email?.split('@')[0],
      };
      setAuth(user, data.token);
      onDone?.();
    },
    onError: (err) => {
      setError(err.response?.data?.error || 'Registration failed');
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError('');
        mutation.mutate(form);
      }}
      className="space-y-4"
    >
      {error ? (
        <div className="bg-red-50 text-red-700 border border-red-100 p-3 rounded-lg text-sm">{error}</div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First name</label>
          <input
            type="text"
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last name</label>
          <input
            type="text"
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none pr-10"
            placeholder="••••••••"
            required
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">Mindestens 6 Zeichen.</p>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full bg-primary-500 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-600 focus:ring-4 focus:ring-primary-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {mutation.isPending ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
}

export default function AuthOverlay() {
  const { isOpen, initialTab, reason, close, handleSuccess } = useAuthOverlayStore();
  const [tab, setTab] = useState(initialTab);

  // Keep tab in sync with opening intent
  useEffect(() => {
    if (isOpen) setTab(initialTab);
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  // Right Drawer (instead of a centered modal)
  return (
    <div className="fixed inset-0 z-[9999]">
      <div className="absolute inset-0 bg-black/50" onClick={close} />

      <div className="absolute inset-y-0 right-0 w-full max-w-md">
        <div className="h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="bg-primary-500 p-2 rounded-lg">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Material Library</p>
                <p className="text-xs text-gray-500">Login / Registrierung</p>
              </div>
            </div>
            <button onClick={close} className="p-2 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>

          {reason ? (
            <div className="px-4 pt-4">
              <div className="bg-primary-50 border border-primary-100 text-primary-800 rounded-lg p-3 text-sm">
                {reason}
              </div>
            </div>
          ) : null}

          <div className="px-4 pt-4">
            <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
              <TabButton active={tab === 'login'} onClick={() => setTab('login')}>
                Login
              </TabButton>
              <TabButton active={tab === 'register'} onClick={() => setTab('register')}>
                Registrieren
              </TabButton>
            </div>
          </div>

          <div className="px-4 py-5 overflow-y-auto">
            {tab === 'login' ? (
              <LoginForm onDone={handleSuccess} />
            ) : (
              <RegisterForm onDone={handleSuccess} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
