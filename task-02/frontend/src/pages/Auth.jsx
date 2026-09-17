import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../context';
import { ErrorBox } from '../components';
export default function Auth({ register = false }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const input = Object.fromEntries(new FormData(e.target));
    try {
      signIn(await api.post(register ? '/auth/register' : '/auth/login', input));
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <div className="auth-story">
        <span className="eyebrow">GOOD THINGS START HERE</span>
        <h1>
          A space for
          <br />
          <em>your everyday.</em>
        </h1>
        <img src="/images/hero.svg" alt="Thoughtfully selected home essentials" />
      </div>
      <div className="auth-form">
        <span className="eyebrow">WELCOME TO ATELIER</span>
        <h1>{register ? 'Make yourself at home.' : 'Good to see you again.'}</h1>
        <p>
          {register
            ? 'Create an account to save your bag and keep track of your orders.'
            : 'Sign in to pick up where you left off.'}
        </p>
        <form onSubmit={submit}>
          {register && (
            <label>
              Your name
              <input
                name="name"
                autoComplete="name"
                required
                minLength="2"
                maxLength="80"
                placeholder="Alex Taylor"
              />
            </label>
          )}
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={register ? 'new-password' : 'current-password'}
              required
              minLength="10"
              maxLength="72"
              placeholder="At least 10 characters"
            />
          </label>
          {error && <ErrorBox message={error} />}
          <button className="button" disabled={busy}>
            {busy ? 'Just a moment…' : register ? 'Create account' : 'Sign in'}
            <ArrowRight size={17} />
          </button>
        </form>
        <p>
          {register ? 'Already part of the collection?' : 'New around here?'}{' '}
          <Link to={register ? '/login' : '/register'} state={location.state}>
            {register ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
        <small>This is a demonstration store. No real payments are taken.</small>
      </div>
    </div>
  );
}
