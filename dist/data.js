/* Supabase SDK handles authentication; Postgres and Storage RLS enforce ownership. */
(() => {
  'use strict';

  const config = window.TERRA_CONFIG || {};
  const configured = Boolean(config.supabaseUrl && config.supabasePublishableKey);
  const PHOTO_BUCKET = 'terra-listing-photos';
  const MAX_PHOTOS = 12;
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const PHOTO_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const fields = 'id,owner_id,title,description,city,state,neighborhood,category,price_brl,status,boundary_geojson,area_m2,perimeter_m,latitude,longitude,price_per_m2,revision,created_at,updated_at';
  const photoFields = 'terra_listing_photos(id,listing_id,storage_path,alt_text,sort_order,created_at)';
  const listFields = `${fields},${photoFields}`;
  let client = null;

  function db() {
    if (!configured) throw new Error('O cadastro está em preparação. Tente novamente quando estiver disponível.');
    if (!client) {
      if (!config.supabasePublishableKey.startsWith('sb_publishable_')) throw new Error('A conexão com o cadastro precisa ser revisada.');
      const url = new URL(config.supabaseUrl);
      if (url.protocol !== 'https:') throw new Error('A conexão segura com o cadastro está indisponível.');
      if (!window.supabase?.createClient) throw new Error('Não foi possível carregar o cadastro. Recarregue a página.');
      client = window.supabase.createClient(url.origin, config.supabasePublishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' }
      });
    }
    return client;
  }

  function unwrap(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  async function user() {
    const data = unwrap(await db().auth.getUser());
    if (!data?.user) throw new Error('Entre na sua conta para continuar.');
    return data.user;
  }

  async function list({ mine = false, limit = 50, offset = 0, price = 0, area = 0, sort = 'recent', location = null } = {}) {
    const ownerId = mine ? (await user()).id : null;
    const sorting = {recent:['created_at',false],price_asc:['price_brl',true],price_desc:['price_brl',false],area_asc:['area_m2',true],area_desc:['area_m2',false]}[sort] || ['created_at',false];
    const run = selection => {
      let q = db().from('terra_listings').select(selection, { count: 'exact' })
        .order(sorting[0], { ascending: sorting[1] }).order('id', { ascending: false });
      q = mine ? q.eq('owner_id', ownerId) : q.eq('status', 'published');
      if (price > 0) q = q.lte('price_brl', price);
      if (area > 0) q = q.gte('area_m2', area);
      if (location?.cityLevel && location.city) {
        q = q.ilike('city',location.city.replace(/[\\%_]/g,character => '\\' + character));
        if (location.state) q = q.eq('state',location.state);
      } else if (location?.bounds) {
        const {south,north,west,east} = location.bounds;
        if (![south,north,west,east].every(Number.isFinite) || south > north || west > east) throw new Error('Área de busca inválida.');
        q = q.gte('latitude',south).lte('latitude',north).gte('longitude',west).lte('longitude',east);
      }
      return q.range(offset, offset + Math.min(limit, 100) - 1);
    };
    let result = await run(listFields);
    // The fallback keeps the catalog usable while the optional photo migration is being applied.
    if (result.error?.code === 'PGRST200' || result.error?.code === 'PGRST205') result = await run(fields);
    unwrap(result);
    return { rows: result.data, total: result.count };
  }

  function payload(form) {
    const clean = {
      title: form.title.trim(), description: form.description.trim(), city: form.city.trim(), state: form.state,
      neighborhood: form.neighborhood.trim(), category: form.category, price_brl: Number(form.price_brl),
      status: form.status, boundary_geojson: form.boundary_geojson
    };
    if (clean.title.length < 3 || clean.title.length > 90) throw new Error('Use entre 3 e 90 caracteres no título.');
    if (clean.description.length > 4000 || clean.city.length < 2 || clean.city.length > 100 || clean.neighborhood.length > 100) throw new Error('Revise a descrição e a localização do terreno.');
    if (!Number.isFinite(clean.price_brl) || clean.price_brl <= 0 || clean.price_brl > 999999999999.99) throw new Error('Informe um preço de venda válido.');
    if (!['draft', 'published', 'paused'].includes(clean.status)) throw new Error('Selecione uma situação válida.');
    return clean;
  }

  function photoError(error) {
    if (error?.code === 'PGRST205') return new Error('A estrutura de fotos ainda não foi ativada no Supabase. Execute a migração de fotos e tente novamente.');
    return error;
  }

  async function ownedPhotoRows(listingId, ownerId) {
    let result = db().from('terra_listing_photos').select('id,listing_id,owner_id,storage_path,alt_text,sort_order,created_at').eq('listing_id', listingId);
    if (ownerId) result = result.eq('owner_id', ownerId);
    const response = await result;
    if (response.error?.code === 'PGRST205') return [];
    return unwrap(response);
  }

  function publicPhotoUrl(path) {
    if (!path) return '';
    return db().storage.from(PHOTO_BUCKET).getPublicUrl(path).data?.publicUrl || '';
  }

  function validatePhoto(file) {
    if (!file || !PHOTO_MIME_TYPES.has(file.type)) throw new Error('Use apenas imagens JPG, PNG ou WebP.');
    if (file.size > MAX_PHOTO_BYTES) throw new Error('Cada foto pode ter no máximo 10 MB.');
  }

  function randomId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
      const random = Math.random() * 16 | 0;
      const value = character === 'x' ? random : (random & 0x3 | 0x8);
      return value.toString(16);
    });
  }

  async function syncPhotos(listingId, files = [], keepPhotoIds = []) {
    const account = await user();
    const existing = await ownedPhotoRows(listingId, account.id);
    const keep = new Set(keepPhotoIds);
    const removed = existing.filter(photo => !keep.has(photo.id));
    const retained = existing.filter(photo => keep.has(photo.id));
    const additions = Array.from(files || []);
    if (retained.length + additions.length > MAX_PHOTOS) throw new Error(`Um anúncio pode ter no máximo ${MAX_PHOTOS} fotos.`);
    additions.forEach(validatePhoto);

    const storage = db().storage.from(PHOTO_BUCKET);
    const uploadedPaths = [];
    let committing = false;
    try {
      for (const file of additions) {
        const path = `${account.id}/${listingId}/${randomId()}.${PHOTO_EXTENSIONS[file.type]}`;
        const uploaded = await storage.upload(path, file, { cacheControl: '31536000', upsert: false, contentType: file.type });
        if (uploaded.error) throw uploaded.error;
        uploadedPaths.push(path);
      }
      committing = true;
      const result = await db().rpc('terra_sync_listing_photos', {
        p_listing_id: listingId,
        p_keep_ids: retained.map(photo => photo.id),
        p_expected_ids: existing.map(photo => photo.id),
        p_paths: uploadedPaths
      });
      if (result.error) throw photoError(result.error);
    } catch (error) {
      // A lost response may hide a committed transaction. Never delete its images.
      if ((!committing || /^[0-9A-Z]{5}$/.test(error?.code || '')) && uploadedPaths.length) {
        try { await storage.remove(uploadedPaths); } catch (_) { /* Retry cleanup separately. */ }
      }
      throw error;
    }
    if (removed.length) {
      try {
        const cleanup = await storage.remove(removed.map(photo => photo.storage_path));
        if (cleanup.error) console.warn('Não foi possível limpar as fotos removidas.', cleanup.error);
      } catch (error) { console.warn('Não foi possível limpar as fotos removidas.', error); }
    }
  }

  async function save(form, { id, revision, files = [], keepPhotoIds = [], photosChanged = false } = {}) {
    const account = await user();
    const clean = payload(form);
    if (photosChanged) {
      if (keepPhotoIds.length + files.length > MAX_PHOTOS) throw new Error(`Um anúncio pode ter no máximo ${MAX_PHOTOS} fotos.`);
      Array.from(files).forEach(validatePhoto);
    }
    let row;
    if (revision) {
      row = unwrap(await db().from('terra_listings').update(clean).eq('id', id).eq('owner_id', account.id).eq('revision', revision).select(fields).maybeSingle());
      if (!row) throw new Error('Este anúncio mudou em outra sessão ou não está mais disponível. Reabra-o em Meus terrenos antes de editar.');
    } else {
      const result = await db().from('terra_listings').insert({ id, ...clean }).select(fields).single();
      if (result.error?.code === '23505') throw new Error('Este anúncio já foi recebido. Confira Meus terrenos antes de tentar novamente.');
      row = unwrap(result);
    }
    if (photosChanged) {
      try { await syncPhotos(row.id, files, keepPhotoIds); }
      catch (cause) {
        const error = new Error('O terreno foi salvo, mas não foi possível concluir as fotos. Abra-o em Meus terrenos para conferir e tentar novamente.');
        error.savedListing = row;
        error.cause = cause;
        throw error;
      }
    }
    return row;
  }

  window.TerraData = {
    configured, list, save, syncPhotos, publicPhotoUrl, maxPhotos: MAX_PHOTOS,
    session: async () => configured ? unwrap(await db().auth.getSession()).session : null,
    subscribe: fn => configured ? db().auth.onAuthStateChange(fn).data.subscription : { unsubscribe() {} },
    signUp: async (name, email, password, captchaToken) => unwrap(await db().auth.signUp({ email, password, options: { data: { display_name: name.trim() }, emailRedirectTo: new URL('./', window.location.href).href, captchaToken } })),
    login: async (email, password, captchaToken) => unwrap(await db().auth.signInWithPassword({ email, password, options: { captchaToken } })),
    availableProviders: async () => {
      db();
      const response = await fetch(new URL('/auth/v1/settings',config.supabaseUrl), {
        headers: {apikey:config.supabasePublishableKey}, signal:AbortSignal.timeout(5000)
      });
      if (!response.ok) throw new Error('Não foi possível consultar as opções de login.');
      const settings = await response.json();
      return ['google','azure','github','apple','facebook'].filter(provider => settings.external?.[provider] === true);
    },
    loginWithProvider: async provider => {
      if (!['google','azure','github','apple','facebook'].includes(provider)) throw new Error('Opção de login inválida.');
      const options = {redirectTo:new URL('./',window.location.href).href,skipBrowserRedirect:true};
      if (provider === 'azure') options.scopes = 'email';
      const data = unwrap(await db().auth.signInWithOAuth({provider,options}));
      if (!data?.url) throw new Error('Não foi possível abrir o login. Tente novamente.');
      window.location.assign(data.url);
    },
    reset: async (email, captchaToken) => unwrap(await db().auth.resetPasswordForEmail(email, { redirectTo: new URL('./', window.location.href).href + '?recovery=1', captchaToken })),
    changePassword: async password => unwrap(await db().auth.updateUser({ password })),
    logout: async () => unwrap(await db().auth.signOut({ scope: 'local' })),
    profile: async () => unwrap(await db().from('terra_profiles').select('id,display_name').eq('id', (await user()).id).single()),
    remove: async (id, revision) => {
      const account = await user();
      const photos = await ownedPhotoRows(id, account.id);
      const rows = unwrap(await db().from('terra_listings').delete().eq('id', id).eq('owner_id', account.id).eq('revision', revision).select('id'));
      if (!rows.length) throw new Error('Este anúncio mudou ou não está mais disponível. Atualize a lista.');
      if (photos.length) {
        const cleanup = await db().storage.from(PHOTO_BUCKET).remove(photos.map(photo => photo.storage_path));
        if (cleanup.error) console.warn('As fotos do terreno excluído não puderam ser limpas do Storage.', cleanup.error);
      }
    },
    explain: error => {
      if (error?.code === 'captcha_failed') return 'A verificação de segurança expirou ou falhou. Confirme novamente e tente outra vez.';
      if (error?.code === 'PGRST205') return 'A estrutura de fotos ainda não foi ativada no Supabase. Execute a migração de fotos e tente novamente.';
      if (['invalid_credentials', 'email_not_confirmed', 'over_request_rate_limit', 'over_email_send_rate_limit', 'weak_password', 'user_already_exists', 'otp_expired'].includes(error?.code)) return ({ invalid_credentials: 'E-mail ou senha incorretos.', email_not_confirmed: 'Confirme seu e-mail antes de entrar.', over_request_rate_limit: 'Muitas tentativas. Aguarde alguns minutos.', over_email_send_rate_limit: 'O limite de envio de e-mails foi atingido. Tente mais tarde.', weak_password: 'Escolha uma senha mais forte.', user_already_exists: 'Confira seu e-mail ou tente entrar na sua conta.', otp_expired: 'O link expirou. Solicite um novo e-mail.' })[error.code];
      if (error?.code === '42501') return 'Você não tem permissão para esta ação. Entre novamente na sua conta.';
      if (error?.code === '23514' || error?.code === '22023') return 'Revise os dados e os limites do terreno. O desenho precisa formar uma área válida.';
      if (error?.code || error?.name === 'TypeError') return 'Não foi possível concluir. Verifique sua conexão e tente novamente.';
      return error?.message || 'Não foi possível concluir esta ação. Tente novamente.';
    }
  };
})();
