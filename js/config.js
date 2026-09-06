// Credenciais Padrão do Supabase
    const DEFAULT_SUPABASE_URL = 'https://pkofzhlcbqupanzydyyf.supabase.co';
    const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBrb2Z6aGxjYnF1cGFuenlkeXlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgyNDYxOTIsImV4cCI6MjEwMzgyMjE5Mn0.osamhKgCtdZa6DXeQG5kFw1PPTppeqBbTbRs2_3YUdI';

    // Estado Global da Aplicação
    let map = null;
    let activeMode = 'buyer'; // 'buyer' ou 'seller'
    let currentGeoJSON = null;
    let currentAreaM2 = 0;
    let currentAreaHa = 0;
    let activePOIType = null;
    let currentPOIs = [];
    let currentFotos = [];
    let tempPolygonLayer = null;
    let poiMapMarkers = [];
    let publicMapLayers = [];
    let supabaseClient = null;
    let currentUser = null;
    let authMode = 'login';
    let sellerSidebarMinimized = false;
    let editingTerrenoId = null;
    let currentDetailProperty = null;
    let lightboxImages = [];
    let currentLightboxIndex = 0;
    let segmentDistanceLabels = [];
    let drawingDistanceTooltip = null;
    let lastDrawVertex = null;
    let isDrawingPolygon = false;

    // Terrenos Demonstrativos Iniciais
    const SEED_TERRENOS = [
      {
        id: '1',
        user_id: 'demo_user',
        titulo: 'Sítio Recanto das Águas com Nascente',
        tipo: 'Sítio',
        topografia: 'Misto',
        whatsapp: '31999998888',
        preco: 480000,
        area_m2: 32500,
        area_hectares: 3.25,
        descricao: 'Lindo sítio em região montanhosa com nascente cristalina dentro da propriedade e área plana perfeita para construção de casa sede.',
        diferenciais: ['Nascente Própria', 'Energia Elétrica', 'Escriturado', 'Vista Panorâmica'],
        fotos: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80'],
        pontos_interesse: [
          { type: 'nascente', coords: [-22.421, -45.582], label: 'Nascente Preservada' },
          { type: 'ponto_alto', coords: [-22.419, -45.580], label: 'Ponto Mais Alto (Vista 360°)' }
        ],
        limites_geojson: {
          type: 'Polygon',
          coordinates: [[
            [-45.584, -22.420],
            [-45.581, -22.418],
            [-45.579, -22.421],
            [-45.582, -22.423],
            [-45.584, -22.420]
          ]]
        }
      }
    ];

