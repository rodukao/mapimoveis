    function initSupabase() {
      if (window.supabase) {
        try {
          supabaseClient = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_KEY);
          setupAuth();
        } catch (err) {
          console.error('Erro ao conectar ao Supabase:', err);
          supabaseClient = null;
        }
      }
    }

    async function setupAuth() {
      if (!supabaseClient) return;

      const { data: { session } } = await supabaseClient.auth.getSession();
      updateUserUI(session?.user || null);

      supabaseClient.auth.onAuthStateChange((event, session) => {
        updateUserUI(session?.user || null);
        renderPublicTerrenos();
      });
    }

    function updateUserUI(user) {
      currentUser = user;
      const authBtn = document.getElementById('auth-btn-container');
      const userProfile = document.getElementById('user-profile-container');
      const userEmailLabel = document.getElementById('user-email-label');

      const authBtnMobile = document.getElementById('auth-btn-container-mobile');
      const userProfileMobile = document.getElementById('user-profile-container-mobile');

      if (user) {
        if (authBtn) authBtn.classList.add('hidden');
        if (userProfile) userProfile.classList.remove('hidden');
        if (userEmailLabel) userEmailLabel.innerText = user.email;

        if (authBtnMobile) authBtnMobile.classList.add('hidden');
        if (userProfileMobile) userProfileMobile.classList.remove('hidden');
      } else {
        if (authBtn) authBtn.classList.remove('hidden');
        if (userProfile) userProfile.classList.add('hidden');

        if (authBtnMobile) authBtnMobile.classList.remove('hidden');
        if (userProfileMobile) userProfileMobile.classList.add('hidden');

        if (activeMode === 'seller') {
          switchMode('buyer');
        }
      }

      updateGeomanToolbarVisibility();
    }

    function toggleAuthModal(open) {
      const modal = document.getElementById('auth-modal');
      if (open) {
        const errorMsg = document.getElementById('auth-error-msg');
        if (errorMsg) errorMsg.classList.add('hidden');
        modal.classList.remove('hidden');
      } else {
        modal.classList.add('hidden');
      }
    }

    function setAuthMode(mode) {
      authMode = mode;
      const tabLogin = document.getElementById('tab-login');
      const tabSignup = document.getElementById('tab-signup');
      const submitBtn = document.getElementById('btn-auth-submit');

      if (mode === 'login') {
        tabLogin.className = 'flex-1 py-2 text-xs font-bold border-b-2 border-emerald-600 text-emerald-600';
        tabSignup.className = 'flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600';
        submitBtn.innerText = 'Entrar';
      } else {
        tabSignup.className = 'flex-1 py-2 text-xs font-bold border-b-2 border-emerald-600 text-emerald-600';
        tabLogin.className = 'flex-1 py-2 text-xs font-semibold text-slate-400 hover:text-slate-600';
        submitBtn.innerText = 'Criar Conta';
      }
    }

    async function handleAuthSubmit(e) {
      e.preventDefault();
      if (!supabaseClient) {
        showToast('Supabase não está conectado!', 'warning');
        return;
      }

      const captchaToken = typeof turnstile !== 'undefined' ? turnstile.getResponse() : null;

      if (!captchaToken) {
        const errorMsg = document.getElementById('auth-error-msg');
        errorMsg.innerText = 'Por favor, complete a verificação anti-bot.';
        errorMsg.classList.remove('hidden');
        return;
      }

      const email = document.getElementById('auth-email').value.trim();
      const password = document.getElementById('auth-password').value;
      const errorMsg = document.getElementById('auth-error-msg');
      errorMsg.classList.add('hidden');

      try {
        if (authMode === 'login') {
          const { error } = await supabaseClient.auth.signInWithPassword({ 
            email, 
            password,
            options: { captchaToken }
          });
          if (error) throw error;

          showToast('Login realizado com sucesso!');
          toggleAuthModal(false);
        } else {
          const { data, error } = await supabaseClient.auth.signUp({ 
            email, 
            password,
            options: { captchaToken }
          });
          if (error) throw error;

          if (data?.user && !data?.session) {
            showToast('Conta criada! Verifique seu e-mail para confirmar.', 'warning');
          } else {
            showToast('Conta criada e autenticada com sucesso!');
          }
          toggleAuthModal(false);
        }
      } catch (err) {
        if (typeof turnstile !== 'undefined') turnstile.reset();
        errorMsg.innerText = err.message || 'Erro de autenticação.';
        errorMsg.classList.remove('hidden');
      }
    }

    async function handleLogout() {
      if (supabaseClient) {
        await supabaseClient.auth.signOut();
        showToast('Você saiu da sua conta.');
      }
      updateUserUI(null);
    }