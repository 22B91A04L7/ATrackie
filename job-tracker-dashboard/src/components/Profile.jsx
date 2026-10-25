import LoadingFeedback from "./LoadingFeedback";
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { API_URL, EXTENSION_ID } from '../config';
import { apiRequest } from '../utils/apiRequest';
import PasswordInput from './PasswordInput';
import { manualDraftKey } from '../utils/manualEntry';

export default function Profile({ onClose }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const deleteErrorRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  const [token] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [cleanup, setCleanup] = useState('');
  useEffect(() => {
    if (!deleted) return;
    dialogRef.current.scrollTop = 0;
    if (busy) return;
    const timer = setTimeout(() => navigate('/signup', { replace: true }), 3000);
    return () => clearTimeout(timer);
  }, [deleted, busy, navigate]);
  useEffect(() => {
    if (confirming) {
      dialogRef.current.scrollTop = 0;
      dialogRef.current.querySelector('#delete-password')?.focus();
    }
  }, [confirming]);
  useEffect(() => {
    if (confirming && error) {
      deleteErrorRef.current?.focus();
      deleteErrorRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [confirming, error]);
  useEffect(() => {
    let disposed = false;
    apiRequest(`${API_URL}/api/auth/profile`, {headers: {Authorization: `Bearer ${token}`}})
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!disposed) setUser(data.user);
      }).catch(e => {if (!disposed) setError(e.message);});
    return () => {disposed = true;};
  }, [token]);

  async function removeAccount(event) {
    event.preventDefault();
    if (busy) return;
    if (localStorage.getItem('token') !== token) {setError('Your account changed. Reopen your profile.'); return;}
    setBusy(true); setError('');
    try {
      const response = await apiRequest(`${API_URL}/api/auth/account`, {
        method: 'DELETE', headers: {'Content-Type': 'application/json', Authorization: `Bearer ${token}`},
        body: JSON.stringify({password, confirmation})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const draftPrefix = manualDraftKey(token, '')?.replace(/new$/, '');
      let localEditsCleared = true;
      try {
        if (draftPrefix) Object.keys(localStorage).filter(key => key.startsWith(draftPrefix)).forEach(key => localStorage.removeItem(key));
      } catch { localEditsCleared = false; }
      setPassword(''); setDeleted(true);
      // The worker verifies deletion before removing only this account's drafts.
      let cleared = false;
      try {
        cleared = await new Promise(resolve => {
          const timer = setTimeout(() => resolve(false), 18000);
          if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {clearTimeout(timer); resolve(false); return;}
          chrome.runtime.sendMessage(EXTENSION_ID, {type: 'ACCOUNT_DELETED', token}, result => {
            clearTimeout(timer);
            resolve(!chrome.runtime.lastError && result?.success === true);
          });
        });
      } catch { /* Local extension may be unavailable. */ }
      setCleanup((cleared ? 'Your connected extension drafts were cleared.' : 'The extension could not be reached. Local drafts may remain in that Chrome profile; remove the extension to erase its local data.') + (localEditsCleared ? '' : ' Clear this site’s browser data to remove locally saved form edits.'));
      if (localStorage.getItem('token') === token) localStorage.removeItem('token');
    } catch (e) {setError(e.message);} finally {setBusy(false);}
  }

  return createPortal(<dialog ref={dialogRef} className={`profile-drawer${deleted ? ' profile-drawer-success' : ''}`} aria-labelledby="profile-title"
    onCancel={event => {event.preventDefault(); if (!busy && !deleted) onClose();}}
    onClick={event => {
      if (event.target !== event.currentTarget || busy || deleted) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className="profile-heading"><div><p className="eyebrow">{deleted ? 'ATrackie' : 'Your workspace'}</p><h2 id="profile-title">{deleted ? 'Account deleted' : confirming ? 'Delete account' : 'My profile'}</h2></div>{!deleted && <button type="button" className="profile-close" aria-label="Close profile" onClick={onClose} disabled={busy}>×</button>}</div>
    <div className="profile-body">
    {deleted ? <div className="profile-success" role="status"><span className="profile-success-icon" aria-hidden="true">✓</span><p>Your account and saved applications have been permanently deleted.</p><p className="profile-success-note">{cleanup || 'Clearing connected extension drafts…'}</p>{!busy && <><p className="profile-success-redirect">Taking you to signup in 3 seconds…</p><Link to="/signup" replace>Go to signup now</Link></>}</div> : <>
      {!user && !error && <LoadingFeedback label="Loading profile..." />}
      {user && !confirming && <><div className="profile-identity"><span className="profile-avatar" aria-hidden="true">{user.name?.trim().slice(0, 1).toUpperCase() || 'A'}</span><div><h3>{user.name}</h3><p>ATrackie account</p></div></div><h3 className="profile-section-title">Account details</h3><dl className="profile-details"><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Member since</dt><dd>{new Date(user.createdAt).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'})}</dd></div></dl></>}
      {user && !confirming && <section className="profile-danger"><h3>Delete account</h3><p>Permanently remove your account and saved applications.</p><button type="button" className="profile-delete" onClick={() => {setError(''); setConfirming(true);}}>Delete my account</button></section>}
      {confirming && <form onSubmit={removeAccount} className="profile-delete-form">
        <h3>Delete your account permanently?</h3><p>This removes your account and all saved applications. This cannot be undone.</p>
        <div className="form-field"><label htmlFor="delete-password">Current password</label><PasswordInput id="delete-password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={busy} /></div>
        <div className="form-field"><label htmlFor="delete-confirmation">Type DELETE to confirm</label><input id="delete-confirmation" value={confirmation} onChange={e => setConfirmation(e.target.value)} required pattern="DELETE" disabled={busy} autoComplete="off" /></div>
        {error && <p ref={deleteErrorRef} tabIndex={-1} className="error" role="alert">{error}</p>}
        <LoadingFeedback active={busy} label="Deleting account..." />
        <div className="profile-actions"><button type="button" className="logout-button" disabled={busy} onClick={() => {setConfirming(false); setPassword(''); setConfirmation(''); setError('');}}>Cancel</button><button className="profile-delete" type="submit" disabled={busy || confirmation !== 'DELETE' || !password}>{busy ? 'Deleting…' : 'Permanently delete account'}</button></div>
      </form>}
    </>}
    {error && !confirming && <p className="error" role="alert">{error}</p>}
    </div>
  </dialog>, document.body);
}
