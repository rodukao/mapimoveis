// Configuração pública do projeto mapimóveis.
// NUNCA colocar secret key, service_role, senha do banco ou token de acesso aqui.
window.TERRA_CONFIG = Object.freeze({
  supabaseUrl: 'https://pkofzhlcbqupanzydyyf.supabase.co',
  supabasePublishableKey: 'sb_publishable_r7y-sZnL-6Bkp_FzCJORLw__adpfc_f',
  // CAPTCHA confirmado no servidor; preencher provedor e chave pública.
  captcha: Object.freeze({enabled: true, provider: 'turnstile', siteKey: '0x4AAAAAAEkAbBn_O2Di9Ng5'})
});
