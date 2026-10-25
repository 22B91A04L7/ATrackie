import { useEffect, useState } from 'react';

function ActiveFeedback({ label, kind }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  const message = seconds < 5 ? '' : kind === 'extraction'
    ? 'Reading job details can take a little longer. Please keep this popup open.'
    : kind === 'local' ? 'Still working. Please keep this page open.'
    : seconds < 10 ? 'Still connecting. Please wait.'
    : 'The server may be waking up. This can take a little longer.';
  return <div className="request-feedback">
    <span className="request-feedback-spinner" aria-hidden="true" />
    <div><p role="status">{label}{message && <span className="request-feedback-note">{message}</span>}</p>
      {seconds >= 5 && <small aria-hidden="true">{seconds}s elapsed</small>}
    </div>
  </div>;
}

export default function LoadingFeedback({ active = true, label = 'Loading...', kind = 'backend' }) {
  return active ? <ActiveFeedback key={`${label}:${kind}`} label={label} kind={kind} /> : null;
}
