(function () {
  'use strict';

  const form = document.getElementById('loginForm');
  const userId = document.getElementById('userId');
  const password = document.getElementById('password');
  const userIdError = document.getElementById('userIdError');
  const passwordError = document.getElementById('passwordError');
  const toggle = document.getElementById('togglePassword');
  const loginBtn = document.getElementById('loginBtn');

  // Password show/hide toggle
  toggle?.addEventListener('click', () => {
    const showing = password.getAttribute('type') === 'text';
    password.setAttribute('type', showing ? 'password' : 'text');
    toggle.setAttribute('aria-pressed', String(!showing));
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    toggle.textContent = showing ? 'Show' : 'Hide';
  });

  function validate() {
    let valid = true;
    userIdError.textContent = '';
    passwordError.textContent = '';
    if (!userId.value.trim()) { userIdError.textContent = 'Please enter your User ID or Badge Number'; valid = false; }
    if (!password.value.trim()) { passwordError.textContent = 'Please enter your password'; valid = false; }
    return valid;
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;

    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
      const formData = new FormData(form);
      const res = await fetch('/login', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Login failed' }));
        passwordError.textContent = data.error || 'Login failed';
        return;
      }
      const data = await res.json();
      window.location.href = data.redirect || '/dashboard';
    } catch (err) {
      console.error(err);
      passwordError.textContent = 'Network error. Please try again.';
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  });
})();
