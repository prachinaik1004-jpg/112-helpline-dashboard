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


  // Basic client-side validation
  function validate() {
    let valid = true;
    userIdError.textContent = '';
    passwordError.textContent = '';


    if (!userId.value.trim()) {
      userIdError.textContent = 'Please enter your User ID or Badge Number';
      valid = false;
    }
    if (!password.value.trim()) {
      passwordError.textContent = 'Please enter your password';
      valid = false;
    }
    return valid;
  }


  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) return;


    // Simulate secure login action
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;


    try {
      await new Promise((res) => setTimeout(res, 900));
      // Dummy credential check
      const u = userId.value.trim();
      const p = password.value;
      const OK_USER = 'admin';
      const OK_PASS = '112goa';

      if (u === OK_USER && p === OK_PASS) {
        console.info('Login successful (demo)');
        window.location.href = 'dash.html';
      } else {
        passwordError.textContent = 'Failed to login. Use Username: admin and Password: 112goa';
        return; // stay on page
      }
    } catch (err) {
      console.error(err);
      passwordError.textContent = 'Login failed. Please try again.';
    } finally {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  });
})();