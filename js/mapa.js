// Camada de Satélite (Esri World Imagery)
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      });

      // Camada de Ruas
      const streetLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri',
        maxZoom: 19
      });

      // Rótulos e vias sobre a imagem de satélite para formar a visualização híbrida.
      const hybridTransportationLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Reference &copy; Esri',
        maxZoom: 19,
        pane: 'overlayPane'
      });

      const hybridLabelsLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Reference &copy; Esri',
        maxZoom: 19,
        pane: 'overlayPane'
      });

      const hybridLayer = L.layerGroup([
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19
        }),
        hybridTransportationLayer,
        hybridLabelsLayer
      ]);

      window.onload = function() {
      initSupabase();

      // Camada Topográfica
      const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; OpenStreetMap',
        maxZoom: 17
      });

      map = L.map('map', { zoomControl: false, layers: [hybridLayer] }).setView([-22.422, -45.583], 14);
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const baseMaps = {
        "<span class='text-xs font-semibold text-slate-800'><i class='fa-solid fa-layer-group text-emerald-600 mr-1'></i> Satélite + Ruas</span>": hybridLayer,
        "<span class='text-xs font-semibold text-slate-800'><i class='fa-solid fa-satellite text-emerald-600 mr-1'></i> Visão Satélite</span>": satelliteLayer,
        "<span class='text-xs font-semibold text-slate-800'><i class='fa-solid fa-mountain-sun text-emerald-600 mr-1'></i> Mapa Topográfico</span>": topoLayer,
        "<span class='text-xs font-semibold text-slate-800'><i class='fa-solid fa-map text-emerald-600 mr-1'></i> Mapa de Ruas</span>": streetLayer
      };
      L.control.layers(baseMaps, null, { position: 'topright' }).addTo(map);

      setupGeomanControls();
      renderPublicTerrenos();
      checkDeepLink();
      getUserLocation();
    };

    function getUserLocation() {
      if ("geolocation" in navigator) {
        showToast("Obtendo sua localização atual...", "info");
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            map.setView([lat, lng], 14);

            const userMarker = L.circleMarker([lat, lng], {
              radius: 7,
              fillColor: "#3b82f6",
              color: "#ffffff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9
            }).addTo(map);

            userMarker.bindTooltip("Você está aqui", { direction: "top" });
            showToast("Mapa centralizado na sua localização!");
          },
          (error) => {
            console.warn("Localização indisponível:", error);
          },
          { enableHighAccuracy: true, timeout: 6000 }
        );
      }
    }