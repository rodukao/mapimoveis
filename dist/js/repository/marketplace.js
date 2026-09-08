/* Every write is checked again by Postgres RLS. No local database or sample records. */
window.TerraMarketData = (() => {
  const R = window.TerraRepository, unwrap = R.unwrap;
  const rpc = async (name, params) => unwrap(await R.db().rpc(name,params));
  const table = name => R.db().from(name);
  async function get(id) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) return null;
    const row = unwrap(await table('terra_listings').select(R.listFields).eq('id',id).maybeSingle());
    return row ? (await R.hydratePhotos([row]))[0] : null;
  }
  async function search(filters, sort, offset = 0, mine = false) {
    const result = await rpc('terra_search_listings',{p_filters:filters,p_sort:sort,p_offset:offset,p_limit:50,p_mine:mine});
    return {rows:await R.hydratePhotos(result.rows),total:result.total};
  }
  async function status(plot, status) {
    if (!['draft','published','reserved','sold','paused'].includes(status)) throw new Error('Situação inválida.');
    const account = await R.user();
    const row = unwrap(await table('terra_listings').update({status}).eq('id',plot.id).eq('owner_id',account.id).eq('revision',plot.revision).select('id,revision,status').maybeSingle());
    if (!row) throw new Error('O anúncio mudou em outra sessão. Atualize para continuar.');
    return row;
  }
  async function favorites() { return unwrap(await table('terra_favorites').select('id,listing_id,created_at').eq('user_id',(await R.user()).id).order('created_at',{ascending:false}).limit(1000)); }
  async function favorite(id, active) {
    return unwrap(await (active ? table('terra_favorites').insert({listing_id:id}) : table('terra_favorites').delete().eq('user_id',(await R.user()).id).eq('listing_id',id)));
  }
  async function byIds(ids) {
    if (!ids.length) return [];
    const rows = unwrap(await table('terra_listings').select(R.listFields).in('id',ids.slice(0,100)));
    return R.hydratePhotos(rows);
  }
  async function similar(plot) {
    const rows = unwrap(await table('terra_listings').select(R.listFields).in('status',['published','reserved']).eq('state',plot.state).ilike('city',plot.city.replace(/[\\%_]/g,'\\$&')).eq('category',plot.category).neq('id',plot.id).gte('price_brl',plot.price*.7).lte('price_brl',plot.price*1.3).gte('area_m2',plot.area*.6).lte('area_m2',plot.area*1.4).order('created_at',{ascending:false}).limit(6));
    return R.hydratePhotos(rows);
  }
  async function advertiserListings(ownerId, offset = 0) {
    return R.hydratePhotos(unwrap(await table('terra_listings').select(R.listFields).eq('owner_id',ownerId).in('status',['published','reserved']).order('created_at',{ascending:false}).range(offset,offset+49)));
  }
  async function profile() {
    const id = (await R.user()).id;
    const [profile,contact] = await Promise.all([
      table('terra_profiles').select('id,display_name,city,account_type,avatar_path,phone_verified,created_at').eq('id',id).single(),
      table('terra_contact_settings').select('phone,enabled').eq('user_id',id).maybeSingle()
    ]);
    return {...unwrap(profile),contact:unwrap(contact) || {phone:'',enabled:false}};
  }
  async function saveProfile(form, photo) {
    const id = (await R.user()).id;
    const phone = form.phone.replace(/\D/g,'');
    const normalized = phone && [10,11].includes(phone.length) ? '55'+phone : phone;
    if (normalized && !/^55[1-9]\d{9,10}$/.test(normalized)) throw new Error('Informe WhatsApp brasileiro com DDD, por exemplo 32 99999-9999.');
    if (form.enabled && !normalized) throw new Error('Informe seu WhatsApp para disponibilizar contato.');
    let avatarPath, previousAvatar = null;
    const storage = R.db().storage.from('terra-profile-photos');
    if (photo) {
      const ext = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[photo.type];
      if (!ext || photo.size>5*1024*1024) throw new Error('Use foto JPG, PNG ou WebP com até 5 MB.');
      previousAvatar = unwrap(await table('terra_profiles').select('avatar_path').eq('id',id).single()).avatar_path;
      avatarPath = id+'/'+crypto.randomUUID()+'.'+ext;
      unwrap(await storage.upload(avatarPath,photo,{contentType:photo.type,upsert:false}));
    }
    const patch = {display_name:form.display_name.trim(),city:form.city.trim(),account_type:form.account_type};
    if (avatarPath) patch.avatar_path = avatarPath;
    try { unwrap(await table('terra_profiles').update(patch).eq('id',id)); }
    catch (error) { if (avatarPath && error.code) await storage.remove([avatarPath]); throw error; }
    if (previousAvatar) await storage.remove([previousAvatar]);
    // Report partial success explicitly; profile and contact are independent private records.
    try {
      const changed=unwrap(await table('terra_contact_settings').update({phone:normalized,enabled:form.enabled}).eq('user_id',id).select('user_id'));
      if(!changed.length)unwrap(await table('terra_contact_settings').insert({phone:normalized,enabled:form.enabled}));
    }
    catch (error) { throw new Error('Perfil salvo, mas o WhatsApp não foi atualizado. Reabra o perfil e tente novamente.'); }
  }
  return {
    rayx: async listingId => {const result=await R.db().functions.invoke('terra-rayx',{body:{listingId}});if(result.error)throw new Error('Não foi possível consultar os dados geográficos. Tente novamente mais tarde.');return result.data;},
    get,search,status,favorites,favorite,byIds,similar,profile,saveProfile,advertiserListings,
    avatar: path => path ? R.db().storage.from('terra-profile-photos').getPublicUrl(path).data.publicUrl : '',
    advertiser: id => rpc('terra_advertiser',{p_owner:id}),
    stats: ids => rpc('terra_listing_stats',{p_ids:ids}),
    event: (event,listing,session) => rpc('terra_record_event',{p_event:event,p_listing:listing || null,p_session:session}),
    report: async (id,reason,description) => unwrap(await table('terra_reports').insert({listing_id:id,reason,description})),
    savedSearches: async () => unwrap(await table('terra_saved_searches').select('id,name,filters,sort_order,alerts_enabled,created_at').eq('user_id',(await R.user()).id).order('created_at',{ascending:false})),
    saveSearch: async (name,filters,sort,alerts) => unwrap(await table('terra_saved_searches').insert({name,filters,sort_order:sort,alerts_enabled:alerts})),
    editSearch: async (id,patch) => unwrap(await table('terra_saved_searches').update(patch).eq('id',id).eq('user_id',(await R.user()).id)),
    deleteSearch: async id => unwrap(await table('terra_saved_searches').delete().eq('id',id).eq('user_id',(await R.user()).id)),
    unreadCount: async () => {const result=await table('terra_notifications').select('id',{head:true,count:'exact'}).eq('user_id',(await R.user()).id).eq('is_read',false);unwrap(result);return result.count;},
    notifications: async (offset=0) => unwrap(await table('terra_notifications').select('id,listing_id,search_id,is_read,created_at,terra_saved_searches(name)').eq('user_id',(await R.user()).id).order('created_at',{ascending:false}).range(offset,offset+49)),
    readNotification: async id => unwrap(await table('terra_notifications').update({is_read:true}).eq('id',id).eq('user_id',(await R.user()).id))
  };
})();
