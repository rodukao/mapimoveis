async function getStoredTerrenos() {
      if (supabaseClient) {
        try {
          const { data, error } = await supabaseClient.from('terrenos').select('*');
          if (!error && data && data.length > 0) {
            return data;
          }
        } catch (err) {
          console.warn('Falha Supabase, usando LocalStorage:', err);
        }
      }

      const localData = localStorage.getItem('geolotes_terrenos');
      if (!localData) {
        localStorage.setItem('geolotes_terrenos', JSON.stringify(SEED_TERRENOS));
        return SEED_TERRENOS;
      }
      return JSON.parse(localData);
    }

    // Supabase usa UUID na coluna `id`. IDs antigos/demonstrativos como
    // "1" ou "terreno_xxxxx" continuam válidos apenas no armazenamento local.
    function isValidUUID(value) {
      return typeof value === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    }

    function createUUID() {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }

      // Fallback para navegadores antigos, mantendo formato UUID v4 válido.
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    async function saveStoredTerrenos(list, terrenoPayload, isEdit = false) {
      // Sem Supabase, mantém o funcionamento local da aplicação.
      if (!supabaseClient || !terrenoPayload) {
        localStorage.setItem('geolotes_terrenos', JSON.stringify(list));
        return { ok: true, source: 'local' };
      }

      try {
        if (!isValidUUID(terrenoPayload.id)) {
          throw new Error(`ID inválido para o Supabase: ${terrenoPayload.id}`);
        }

        if (isEdit) {
          const { data, error } = await supabaseClient
            .from('terrenos')
            .update(terrenoPayload)
            .eq('id', terrenoPayload.id)
            .select('id');

          if (error) throw error;

          // Se o UUID não existia no banco, publica como novo registro.
          if (!data || data.length === 0) {
            const { error: insertError } = await supabaseClient
              .from('terrenos')
              .insert([terrenoPayload]);
            if (insertError) throw insertError;
          }
        } else {
          const { error } = await supabaseClient
            .from('terrenos')
            .insert([terrenoPayload]);
          if (error) throw error;
        }

        // Só atualiza a cópia local depois que o banco confirmou a operação.
        localStorage.setItem('geolotes_terrenos', JSON.stringify(list));
        return { ok: true, source: 'supabase' };
      } catch (err) {
        console.error('Erro ao salvar no Supabase:', err);
        return { ok: false, source: 'supabase', error: err };
      }
    }

    async function deleteTerreno(id) {
      if (!confirm('Tem certeza que deseja excluir este terreno? Esta ação não pode ser desfeita.')) return;

      // Só tenta excluir no Supabase quando o identificador realmente é UUID.
      // Isso evita o erro 22P02 nos terrenos demonstrativos/legados.
      if (supabaseClient && isValidUUID(id)) {
        try {
          const { error } = await supabaseClient.from('terrenos').delete().eq('id', id);
          if (error) {
            showToast('Erro ao excluir: ' + error.message, 'warning');
            return;
          }
        } catch (err) {
          console.error('Erro de exclusão:', err);
          showToast('Não foi possível excluir no Supabase.', 'warning');
          return;
        }
      }

      let localList = JSON.parse(localStorage.getItem('geolotes_terrenos') || '[]');
      localList = localList.filter(t => t.id !== id);
      localStorage.setItem('geolotes_terrenos', JSON.stringify(localList));

      showToast('Terreno excluído com sucesso!');
      closeBuyerSidebar();
      closeMyTerrenosModal();
      renderPublicTerrenos();
    }