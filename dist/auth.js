let authMode = 'login', authBusy = false, pendingAnnounce = false, recoverySession = false;
let socialProviders = [];
const socialNames = {google:'Google',azure:'Microsoft',github:'GitHub',apple:'Apple',facebook:'Facebook'};
function setPasswordVisible(visible) {
  $('auth-password').type = visible ? 'text' : 'password';
  $('toggle-password').textContent = visible ? 'Ocultar' : 'Mostrar';
  $('toggle-password').setAttribute('aria-pressed',String(visible));
  $('toggle-password').setAttribute('aria-label',visible ? 'Ocultar senha' : 'Mostrar senha');
}
$('toggle-password').onclick = () => setPasswordVisible($('auth-password').type === 'password');
$('auth-dialog').addEventListener('close', () => { setPasswordVisible(false); $('auth-password').value = ''; });
function updateSocialButtons() {
  $('social-auth').hidden = !socialProviders.length || !['login','signup'].includes(authMode);
  $('social-buttons').replaceChildren();
  for (const provider of socialProviders) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'full social-button';
    button.textContent = 'Continuar com ' + socialNames[provider];
    button.disabled = authBusy;
    button.onclick = async () => {
      if (authBusy) return;
      authBusy = true; $('auth-fields').disabled = true;
      $('switch-auth').disabled = true; $('forgot-password').disabled = true;
      $('auth-message').hidden = true; updateSocialButtons();
      try { await DATA.loginWithProvider(provider); }
      catch (error) {
        $('auth-message').textContent = DATA.explain(error); $('auth-message').hidden = false;
        authBusy = false; $('auth-fields').disabled = false;
        $('switch-auth').disabled = false; $('forgot-password').disabled = false; updateSocialButtons();
      }
    };
    $('social-buttons').append(button);
  }
}
async function loadSocialProviders() {
  try { socialProviders = await DATA.availableProviders(); }
  catch (_) { socialProviders = []; }
  updateSocialButtons();
}
function authModeUI(mode) {
  authMode = mode;
  $('auth-message').hidden = true;
  $('auth-password').value = '';
  setPasswordVisible(false);
  updateSocialButtons();
  const signup = mode === 'signup', reset = mode === 'reset', change = mode === 'change';
  $('auth-heading').textContent = ({ login: 'Entre para anunciar', signup: 'Crie sua conta', reset: 'Recupere sua senha', change: 'Escolha uma nova senha' })[mode];
  $('name-label').hidden = !signup;
  $('auth-name').required = signup;
  $('email-label').hidden = change;
  $('auth-email').required = !change;
  $('password-label').hidden = reset;
  $('auth-password').required = !reset;
  $('auth-password').minLength = signup || change ? 12 : 1;
  $('auth-password').autocomplete = signup || change ? 'new-password' : 'current-password';
  $('password-hint').hidden = !(signup || change);
  $('auth-submit').textContent = ({ login: 'Entrar', signup: 'Criar conta', reset: 'Enviar link de recuperação', change: 'Salvar nova senha' })[mode];
  $('forgot-password').hidden = mode !== 'login';
  $('switch-auth').hidden = change;
  $('switch-auth').textContent = mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar';
  requestAnimationFrame(() => window.TerraCaptcha.show(mode));
}
function openAuth(mode = 'login') {
  if (authBusy) return;
  $('signed-in').hidden = !currentSession || mode === 'change';
  $('auth-form').hidden = !!currentSession && mode !== 'change';
  authModeUI(mode);
  if (currentSession && mode !== 'change') { $('auth-heading').textContent = 'Sua conta'; $('account-email').textContent = currentSession.user.email || ''; }
  if (!$('auth-dialog').open) $('auth-dialog').showModal();
  if (!currentSession && ['login','signup'].includes(mode)) loadSocialProviders();
}
$('account').onclick = () => openAuth();
$('close-auth').onclick = () => { if (!authBusy) { $('auth-dialog').close(); window.TerraCaptcha.close(); pendingAnnounce = false; $('auth-password').value = ''; } };
$('auth-dialog').addEventListener('cancel', event => { if (authBusy) event.preventDefault(); else { window.TerraCaptcha.close(); pendingAnnounce = false; $('auth-password').value = ''; } });
$('switch-auth').onclick = () => authModeUI(authMode === 'login' ? 'signup' : 'login');
$('forgot-password').onclick = () => authModeUI('reset');
$('auth-form').onsubmit = async event => {
  event.preventDefault();
  if (authBusy) return;
  const mode = authMode, email = $('auth-email').value.trim(), password = $('auth-password').value, name = $('auth-name').value.trim();
  if (mode === 'signup' && !name) { $('auth-message').textContent = 'Informe seu nome.'; $('auth-message').hidden = false; return; }
  if (mode === 'change' && !recoverySession) { $('auth-message').textContent = 'Solicite um novo link de recuperação para alterar a senha.'; $('auth-message').hidden = false; return; }
  let captchaToken;
  try { captchaToken = window.TerraCaptcha.value(mode); }
  catch (error) { $('auth-message').textContent = error.message; $('auth-message').hidden = false; return; }
  authBusy = true;
  updateSocialButtons();
  $('auth-fields').disabled = true;
  $('auth-message').hidden = true;
  $('switch-auth').disabled = true;
  $('forgot-password').disabled = true;
  try {
    if (mode === 'login') { const result = await DATA.login(email, password, captchaToken); currentSession = result.session; mine = false; $('auth-dialog').close(); updateAccount(); if (pendingAnnounce) { pendingAnnounce = false; start(); } await loadListings(); }
    if (mode === 'signup') { const result = await DATA.signUp(name, email, password, captchaToken); $('auth-password').value = ''; if (result.session) { currentSession = result.session; mine = false; $('auth-dialog').close(); updateAccount(); if (pendingAnnounce) { pendingAnnounce = false; start(); } await loadListings(); toast('Conta criada. Você já pode cadastrar seu terreno.'); } else { $('auth-message').textContent = 'Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, você pode entrar ou recuperar sua senha.'; $('auth-message').hidden = false; } }
    if (mode === 'reset') { await DATA.reset(email, captchaToken); $('auth-message').textContent = 'Se houver uma conta para esse e-mail, você receberá um link de recuperação.'; $('auth-message').hidden = false; }
    if (mode === 'change') { await DATA.changePassword(password); recoverySession = false; history.replaceState(null, '', location.pathname); $('auth-dialog').close(); toast('Senha atualizada.'); }
  } catch (error) { $('auth-message').textContent = DATA.explain(error); $('auth-message').hidden = false; }
  finally { authBusy = false; updateSocialButtons(); if (mode !== 'change') window.TerraCaptcha.reset(); $('auth-fields').disabled = false; $('switch-auth').disabled = false; $('forgot-password').disabled = false; if (mode === 'login' || mode === 'change') $('auth-password').value = ''; }
};
$('signout').onclick = async () => { if (saving) return; $('signout').disabled = true; try { await DATA.logout(); currentSession = null; mine = false; stop(); $('auth-dialog').close(); updateAccount(); await loadListings(); toast('Você saiu da sua conta.'); } catch (error) { toast(DATA.explain(error)); } finally { $('signout').disabled = false; } };
$('account-listings').onclick = () => { if (saving) return; $('auth-dialog').close(); mine = true; stop(); loadListings(); if (matchMedia('(max-width:720px)').matches) { document.body.classList.add('show-list'); $('mobile-toggle').textContent = 'Voltar para o mapa'; } };
function updateAccount() { $('account').textContent = currentSession ? 'Minha conta' : 'Entrar'; $('listing-tabs').hidden = false; $('my-listings').hidden = !currentSession; }

async function initializeData() {
  $('persisted-fields').hidden = false;
  $('city').required = true;
  $('title').minLength = 3;
  $('save-listing').textContent = 'Salvar terreno';
  $('save-note').textContent = 'Rascunhos e anúncios pausados ficam visíveis somente para você.';
  const initialHash = new URLSearchParams(location.hash.slice(1));
  if (initialHash.has('error')) { toast('Este link não está mais disponível. Solicite um novo e-mail.'); history.replaceState(null, '', location.pathname); }
  try {
    DATA.subscribe((event, session) => {
      // Keep Supabase callbacks synchronous; perform SDK calls outside the auth lock.
      setTimeout(() => { const changed = currentSession?.user.id !== session?.user.id; currentSession = session; if (event === 'PASSWORD_RECOVERY') { recoverySession = true; openAuth('change'); } if (changed) mine = false; if (!session) { mine = false; if (drawing && !saving) stop(); } updateAccount(); if (changed) loadListings(); }, 0);
    });
    currentSession = await DATA.session();
    updateAccount();
    await loadListings();
  } catch (error) { toast(DATA.explain(error)); loadFailed = true; render(); }
}

$('state').replaceChildren(...'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(state => new Option(state, state, state === 'MG', state === 'MG')));

