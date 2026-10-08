const form = document.querySelector('#login-form');
form.addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#sign-in');
  const status = document.querySelector('#login-status');
  const password = document.querySelector('#password');
  button.disabled = true;
  status.textContent = 'Signing in…';
  try {
    const response = await fetch('/api/pilot/login', { method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', 'x-drafttopage': 'pilot-v1' },
      body: JSON.stringify({ password: password.value }) });
    password.value = '';
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Sign-in failed.');
    window.location.replace('/pilot');
  } catch (error) { status.textContent = error.message || 'Connection failed. Try again.'; }
  finally { button.disabled = false; }
});
