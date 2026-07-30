import { useState } from 'react';
import type { FormEvent } from 'react';
import { Card } from '../components/common/Card';
import { Toast } from '../components/common/Toast';
import { getInitials, useUser } from '../contexts/UserContext';

export function ProfilePage() {
  const { profile, updateProfile } = useUser();
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Enter a name.');
      return;
    }

    updateProfile({ name: trimmedName, email: email.trim() });
    setError(null);
    setToastMessage('Profile updated.');
  };

  return (
    <>
      <div className="page-heading">
        <div><h1>Profile</h1><p>Manage your account details.</p></div>
      </div>

      <Card className="profile-card">
        <div className="profile-header">
          <div className="avatar profile-avatar" aria-hidden="true">{getInitials(name || profile.name)}</div>
          <div>
            <strong>{profile.name}</strong>
            {profile.email && <p className="profile-email">{profile.email}</p>}
          </div>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => { setName(event.target.value); setError(null); }}
              placeholder="Your name"
            />
          </label>
          <label className="form-field">
            <span>Email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="modal-actions">
            <button type="submit" className="primary-button">Save changes</button>
          </div>
        </form>
      </Card>

      {toastMessage && <Toast message={toastMessage} tone="success" onDismiss={() => setToastMessage(null)} />}
    </>
  );
}
