export interface ProductSlot {
  x: number;      // center X (0-1 normalized, 0=left, 1=right)
  y: number;      // center Y (0-1 normalized, 0=top, 1=bottom)
  width: number;  // width as fraction of canvas (0-1)
  height: number; // height as fraction of canvas (0-1)
  shape: 'rectangle' | 'ellipse';
  padding: number; // extra padding around slot (0.0-0.1)
}

export interface TextSlot {
  id: string;       // unique ID: 'headline', 'left_claim', 'right_claim', 'bottom_title', 'footer', etc.
  x: number;        // center X (0-1 normalized)
  y: number;        // center Y (0-1 normalized)
  width: number;    // width as fraction of canvas (0-1)
  height: number;   // height as fraction of canvas (0-1)
  type: 'headline' | 'benefit_title' | 'product_title' | 'cta' | 'badge' | 'description' | 'testimonial' | string;
  max_words?: number;
  style?: string;   // visual style hint: 'gold_bold_uppercase', 'white_clean', etc.
}

export interface CreativeTemplate {
  // Retrocompatibilidad con la UI y lógica existente
  id: string;
  template_id: string;
  name: string;
  category: string;
  prompt: string;
  backgroundPrompt?: string;
  icon?: string;
  description?: string;
  preview_image_url?: string;
  colors: {
    primary: string;
    accent: string;
    text: string;
    badgeBg: string;
    badgeText: string;
  };
  layout: {
    align: 'left' | 'right' | 'center';
    productPos?: { x: number; y: number; w: number; h: number; r?: number };
    textW?: number;
    hasTestimonial: boolean;
    hasBenefits: boolean;
    hasReviewStars: boolean;
  };
  defaultText: {
    badge: string;
    hook: string;
    desc: string;
    benefits: string[];
    cta: string;
    testimonial?: string;
  };
  skipProductOverlay?: boolean;

  // COMPOSITING ENGINE: Product slot for mask-based editing
  product_slot?: ProductSlot;

  // COMPOSITING ENGINE PHASE 2: Text slots for mask-based text replacement
  text_slots?: TextSlot[];

  // COMPOSITING ENGINE: Editable/locked region declarations
  editable_regions?: string[];  // e.g. ['product', 'headline', 'benefits', 'cta', 'footer']
  locked_regions?: string[];    // e.g. ['background', 'curves', 'gradients', 'pedestal', 'icon_geometry', 'spacing']
  
  // COMPOSITING ENGINE: DNA lock + semantic isolation flags
  template_visual_dna_lock?: boolean;     // true = enforce visual DNA from template
  template_semantic_isolation?: boolean;  // true = strip all template category meaning
  
  // COMPOSITING ENGINE: Template readiness (computed on save)
  template_readiness?: 'ready' | 'draft' | 'legacy';

  // NUEVA ARQUITECTURA: ADN Visual e Inteligencia de Dirección Artística
  style_identity: string;
  composition_rules: string;
  visual_hierarchy: string;
  lighting_rules: string;
  camera_rules: string;
  color_behavior: string;
  branding_style: string;
  text_behavior: string;
  render_rules: string;
  ai_direction_rules: {
    camera_angle: string;
    depth: string;
    lighting: string;
    mood: string;
    product_focus: string;
    background_style: string;
    shadow_style: string;
    visual_energy: string;
  };
  template_structure_lock?: {
    canvas_ratio?: string;
    preserve_layout_similarity?: 'high' | 'medium' | 'strict' | string;
    layout_reference_strength?: number;
    product_position?: {
      area?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      locked?: boolean;
      size?: string;
      preserve_original_angle: boolean;
    };
    text_zones?: Array<{
      type: 'top_logo' | 'headline' | 'subheadline' | 'benefits_timeline' | 'bottom_feature_bar' | 'footer_brand' | string;
      position?: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      locked?: boolean;
      size?: string;
      max_lines?: number;
      count?: number;
      icon_style?: string;
      preserve_spacing?: boolean;
    }>;
    background_rules?: {
      preserve_background_shape: boolean;
      preserve_gradient_direction: boolean;
      preserve_curved_panel: boolean;
    };
    forbidden_changes?: string[];
  };

  // PRODUCT SCALE LOCK: Preservación de escala y peso visual del producto
  product_scale_lock?: {
    enabled?: boolean;
    canvas_coverage_target?: number;       // 0-1, ej: 0.42 = 42% del canvas
    preserve_visual_weight?: boolean;
    preserve_hero_scale?: boolean;
    prevent_product_shrinking?: boolean;
    allow_partial_out_of_frame?: boolean;
    depth_priority?: 'low' | 'medium' | 'high';
    preserve_product_dominance?: boolean;
    preserve_foreground_priority?: boolean;
  };

  // SMART COLOR INTEGRATION: Armonización inteligente de colores producto-plantilla
  smart_color_integration?: {
    enabled?: boolean;
    extract_product_palette?: boolean;
    blend_with_template_palette?: boolean;
    blend_strength?: number;               // 0-1, ej: 0.35 = 35% mezcla
    preserve_template_identity?: boolean;
    preserve_product_realism?: boolean;
    allow_secondary_color_adaptation?: boolean;
    cinematic_color_grading?: boolean;
    premium_commercial_rendering?: boolean;
    adaptive_shadow_tinting?: boolean;
    adaptive_pedestal_tinting?: boolean;
    adaptive_glow_generation?: boolean;
  };

  // TEMPLATE REGION LOCK: Regiones bloqueadas vs editables
  region_locks?: {
    locked: string[];   // e.g. ['background', 'curves', 'pedestal', 'footer', 'icon_timeline', 'spacing', 'gradients']
    editable: string[]; // e.g. ['product', 'copy', 'cta', 'benefits', 'brand']
    strict_mode?: boolean; // true = pixel-perfect, false = high similarity
  };

  // COLOR & LIGHTING LOCK: Preservación rígida de colores e iluminación
  color_and_lighting_lock?: {
    enabled?: boolean;
    preserve_background_colors?: boolean;
    preserve_gradient_palette?: boolean;
    preserve_icon_colors?: boolean;
    preserve_text_colors?: boolean;
    preserve_shadow_intensity?: boolean;
    preserve_product_lighting_style?: boolean;
    preserve_pedestal_colors?: boolean;
    preserve_glow_style?: boolean;
    preserve_background_temperature?: boolean;
    preserve_render_quality?: boolean;
    exact_palette_match_required?: boolean;
    color_tolerance?: number;              // 0-1, ej: 0.05 = 5% tolerancia
  };
}

export const HIGH_IMPACT_ECOMMERCE_TEMPLATE: CreativeTemplate = {
  id: 'tpl_infografia_comercial_4b',
  template_id: 'infografia_comercial_4b',
  name: 'Anuncio de Alto Impacto (4 Beneficios + Pedestal)',
  category: 'belleza',
  prompt: 'High-end commercial e-commerce advertising banner with real product on pedestal, 4 benefit points, premium studio lighting and crisp typography',
  backgroundPrompt: 'Luxury commercial cosmetics studio background with circular pedestal on the right, smooth organic ambient waves and glowing light',
  icon: '⭐',
  description: 'Formato ganador de Facebook Ads: Producto real sobre pedestal 3D a la derecha, titular de alto impacto y 4 beneficios destacados a la izquierda con sellos de garantía.',
  preview_image_url: '/templates/infografia-comercial-producto.jpg',
  colors: {
    primary: '#4a154b',
    accent: '#8b5cf6',
    text: '#ffffff',
    badgeBg: '#6b21a8',
    badgeText: '#ffffff',
  },
  layout: {
    align: 'left',
    productPos: { x: 0.72, y: 0.48, w: 0.46, h: 0.65 },
    textW: 0.50,
    hasTestimonial: false,
    hasBenefits: true,
    hasReviewStars: false,
  },
  defaultText: {
    badge: 'NUEVA LÍNEA',
    hook: 'RUBIO PERFECTO, CABELLO PODEROSO.',
    desc: 'Neutraliza los tonos amarillos y potencia el brillo de tu rubio desde la primera aplicación.',
    benefits: [
      '✦ NEUTRALIZA tonos amarillos y cobrizos.',
      '💧 HIDRATA y fortalece la fibra capilar.',
      '✨ REALZA el brillo y la suavidad natural.',
      '🛡️ PROTEGE el color y mantiene el rubio.',
    ],
    cta: 'FÓRMULA PROFESIONAL • RESULTADOS VISIBLES',
    testimonial: 'SIN SULFATOS • SIN PARABENOS • CRUELTY FREE',
  },
  product_slot: {
    x: 0.72,
    y: 0.48,
    width: 0.46,
    height: 0.65,
    shape: 'rectangle',
    padding: 0.05,
  },
  text_slots: [
    {
      id: 'badge',
      type: 'badge',
      x: 0.16,
      y: 0.06,
      width: 0.24,
      height: 0.04,
      max_words: 3,
      style: 'pill_badge',
    },
    {
      id: 'headline',
      type: 'headline',
      x: 0.28,
      y: 0.15,
      width: 0.50,
      height: 0.12,
      max_words: 6,
      style: 'bold_uppercase_white',
    },
    {
      id: 'subhead',
      type: 'desc',
      x: 0.28,
      y: 0.25,
      width: 0.50,
      height: 0.07,
      max_words: 16,
      style: 'clean_light_text',
    },
    {
      id: 'feature_pill',
      type: 'badge',
      x: 0.22,
      y: 0.33,
      width: 0.36,
      height: 0.04,
      max_words: 7,
      style: 'dark_pill',
    },
    {
      id: 'benefit_1',
      type: 'benefit_item',
      x: 0.28,
      y: 0.42,
      width: 0.48,
      height: 0.08,
      max_words: 8,
      style: 'icon_bullet',
    },
    {
      id: 'benefit_2',
      type: 'benefit_item',
      x: 0.28,
      y: 0.52,
      width: 0.48,
      height: 0.08,
      max_words: 8,
      style: 'icon_bullet',
    },
    {
      id: 'benefit_3',
      type: 'benefit_item',
      x: 0.28,
      y: 0.62,
      width: 0.48,
      height: 0.08,
      max_words: 8,
      style: 'icon_bullet',
    },
    {
      id: 'benefit_4',
      type: 'benefit_item',
      x: 0.28,
      y: 0.72,
      width: 0.48,
      height: 0.08,
      max_words: 8,
      style: 'icon_bullet',
    },
    {
      id: 'footer_guarantees',
      type: 'footer',
      x: 0.50,
      y: 0.89,
      width: 0.90,
      height: 0.05,
      max_words: 8,
      style: 'footer_bar',
    },
    {
      id: 'footer_bar',
      type: 'footer_sub',
      x: 0.50,
      y: 0.96,
      width: 0.90,
      height: 0.03,
      max_words: 12,
      style: 'footer_sub_bar',
    },
  ],
  style_identity: 'Infografía Comercial de Alto Impacto E-Commerce',
  composition_rules: 'Producto sobre pedestal 3D a la derecha con sombras realistas, titular y 4 beneficios alineados a la izquierda, barra de confianza y sellos en el pie',
  visual_hierarchy: '1. Titular de impacto, 2. Producto sobre pedestal, 3. Viñetas de beneficios con íconos, 4. Barra de garantías',
  lighting_rules: 'Iluminación de estudio comercial con sombras de contacto suaves y reflejos limpios',
  camera_rules: 'Plano medio publicitario con perspectiva frontal ligeramente elevada hacia el pedestal',
  color_behavior: 'Fondo adaptativo a los colores dominantes del producto',
  branding_style: 'Tipografía vectorial ultra nítida, píldoras y sellos de confianza',
  text_behavior: 'Textos publicitarios en español de alta conversión con titulares concisos y viñetas con íconos',
  render_rules: 'Conservar 100% el producto real sin deformaciones y componer textos vectoriales nítidos',
  ai_direction_rules: {
    camera_angle: 'frontal_comercial',
    depth: 'media',
    lighting: 'estudio_suave',
    mood: 'premium_comercial',
    product_focus: 'extremo_sobre_pedestal',
    background_style: 'ondas_organicas_degradado',
    shadow_style: 'contacto_pedestal',
    visual_energy: 'alta_conversion',
  },
  product_scale_lock: {
    enabled: true,
    canvas_coverage_target: 0.45,
    preserve_visual_weight: true,
    preserve_hero_scale: true,
  },
  smart_color_integration: {
    enabled: true,
    extract_product_palette: true,
    blend_with_template_palette: true,
  },
};

export const CIRCULAR_360_BEAUTY_TEMPLATE: CreativeTemplate = {
  id: 'tpl_ruleta_beneficios_circular',
  template_id: 'ruleta_beneficios_circular',
  name: 'Pancarta Ruleta 360° (Belleza, Cabello & Skincare)',
  category: 'belleza',
  prompt: 'Luxury circular segmented commercial advertising infographic poster. In the center, the real product stands proudly on a circular metallic purple pedestal with realistic contact shadows and glossy studio reflections. Surrounding circular segmented metallic frame divided into curved arc sections with elegant models demonstrating benefits, clean Spanish typography, 3 circular guarantee badges at bottom, and curved ribbon footer. Color palette dynamically harmonizes with product packaging.',
  backgroundPrompt: 'Luxury dark purple and magenta cosmetic studio atmosphere, glossy metallic arcs, soft glowing violet bokeh, circular pedestal in center with glossy reflections',
  icon: '💜',
  description: 'Diseño circular ganador de Meta Ads: Producto en pedestal central, 3 arcos con modelos demostrando resultados, 3 sellos de confianza y cinta inferior.',
  preview_image_url: '/templates/ruleta-beneficios-circular.jpg',
  colors: {
    primary: '#4c1d95',
    accent: '#d946ef',
    text: '#ffffff',
    badgeBg: '#7c3aed',
    badgeText: '#ffffff',
  },
  layout: {
    align: 'center',
    productPos: { x: 0.50, y: 0.50, w: 0.44, h: 0.52 },
    textW: 0.85,
    hasTestimonial: false,
    hasBenefits: true,
    hasReviewStars: false,
  },
  defaultText: {
    badge: 'FÓRMULA PROFESIONAL',
    hook: 'REALZA TU BELLEZA Y CUIDADO',
    desc: 'Resultados visibles desde la primera aplicación con fórmula premium.',
    benefits: [
      '✦ MATIZA TONOS Y REALZA EL COLOR',
      '💧 HIDRATACIÓN PROFUNDA Y SUAVIDAD',
      '✨ BRILLO INTENSO Y ASPECTO SEDOSO',
    ],
    cta: 'RUTINA COMPLETA • RESULTADOS COMPROBADOS',
    testimonial: 'COLOR-SAFE • CUIDADO CAPILAR • 100% ORIGINAL',
  },
  product_slot: {
    x: 0.50,
    y: 0.50,
    width: 0.44,
    height: 0.52,
    shape: 'rectangle',
    padding: 0.05,
  },
  text_slots: [
    { id: 'top_hook', type: 'headline', x: 0.38, y: 0.14, width: 0.36, height: 0.08, max_words: 5, style: 'curved_bold_white' },
    { id: 'left_benefit', type: 'benefit_item', x: 0.18, y: 0.36, width: 0.28, height: 0.12, max_words: 10, style: 'arc_callout' },
    { id: 'right_benefit', type: 'benefit_item', x: 0.82, y: 0.36, width: 0.28, height: 0.12, max_words: 10, style: 'arc_callout' },
    { id: 'bottom_title', type: 'product_title', x: 0.50, y: 0.86, width: 0.70, height: 0.06, max_words: 6, style: 'serif_bold' },
    { id: 'bottom_ribbon', type: 'footer', x: 0.50, y: 0.94, width: 0.85, height: 0.05, max_words: 8, style: 'curved_ribbon' },
  ],
  style_identity: 'Ruleta Circular 360° Publicitaria de Belleza',
  composition_rules: 'Composición circular concéntrica con producto en pedestal central 3D, marco metálico segmentado en 3 arcos con modelos del nicho y beneficios, sellos y cinta arqueada en el pie',
  visual_hierarchy: '1. Producto hero en pedestal central, 2. Modelo superior con titular curvo, 3. Modelos laterales con beneficios, 4. Sellos y cinta inferior',
  lighting_rules: 'Iluminación de estudio cosmético de lujo con reflejos pulidos y destellos sutiles en los bordes metálicos',
  camera_rules: 'Plano publicitario frontal centrado con perspectiva directa al pedestal y al marco circular',
  color_behavior: 'Fondo y marco metálico adaptativos que adoptan los tonos dominantes del producto',
  branding_style: 'Tipografía serif y sans-serif de alta gama, arcos metálicos biselados y sellos circulares vectoriales',
  text_behavior: 'Textos publicitarios en español con titular superior de impacto y viñetas explicativas concisas',
  render_rules: 'Preservar 100% la foto real del producto en el centro y adaptar los arcos circulares, modelos y paleta de color',
  ai_direction_rules: {
    camera_angle: 'frontal_centrado',
    depth: 'media',
    lighting: 'estudio_cosmetico_lujo',
    mood: 'elegante_premium',
    product_focus: 'extremo_centro_pedestal',
    background_style: 'arco_circular_segmentado',
    shadow_style: 'contacto_pedestal_suave',
    visual_energy: 'alta_conversion_estudio',
  },
  product_scale_lock: {
    enabled: true,
    canvas_coverage_target: 0.42,
    preserve_visual_weight: true,
    preserve_hero_scale: true,
  },
  smart_color_integration: {
    enabled: true,
    extract_product_palette: true,
    blend_with_template_palette: true,
  },
};

export const CIRCULAR_360_FITNESS_TEMPLATE: CreativeTemplate = {
  id: 'tpl_ruleta_fitness_suplementos',
  template_id: 'ruleta_fitness_suplementos',
  name: 'Pancarta Ruleta 360° (Fitness, Suplementos & Hombre)',
  category: 'suplementos',
  prompt: 'High-impact fitness and wellness circular segmented commercial advertising poster. In the center, the uploaded supplement container stands boldly on a black circular pedestal as the hero centerpiece with dramatic studio lighting and crisp label reflections. Encircling the product is a sleek metallic gold circular segmented frame divided into curved sections displaying athletic men in action, energetic headlines, 3 metallic minimalist icons, and a curved black and gold ribbon at the base. Premium dark mode aesthetic with luxury gold accents harmonizing with the product colors.',
  backgroundPrompt: 'Sleek luxury dark matte black studio background with gold metallic segmented circular ring, dramatic athletic rim lighting, center pedestal with soft gold reflection',
  icon: '⚡',
  description: 'Diseño circular de alto impacto en negro y oro: Frasco o suplemento en pedestal central, 3 arcos con modelos atléticos masculinos, beneficios clave y sellos de potencia.',
  preview_image_url: '/templates/ruleta-fitness-suplemento.jpg',
  colors: {
    primary: '#0a0a0a',
    accent: '#eab308',
    text: '#ffffff',
    badgeBg: '#ca8a04',
    badgeText: '#000000',
  },
  layout: {
    align: 'center',
    productPos: { x: 0.50, y: 0.50, w: 0.44, h: 0.52 },
    textW: 0.85,
    hasTestimonial: false,
    hasBenefits: true,
    hasReviewStars: false,
  },
  defaultText: {
    badge: 'MÁXIMA POTENCIA',
    hook: 'REACTIVA TU ENERGÍA Y RENDIMIENTO',
    desc: 'Fórmula avanzada para resistencia, fuerza y vitalidad diaria.',
    benefits: [
      '⚡ IMPULSA TU RENDIMIENTO Y RESISTENCIA',
      '💪 SOPORTE NATURAL Y FUERZA MUSCULAR',
      '🔥 ENERGÍA REAL Y ABSORCIÓN RÁPIDA',
    ],
    cta: '100% NATURAL • ALTA ABSORCIÓN',
    testimonial: 'AUMENTA ENERGÍA • MEJORA RENDIMIENTO • POTENCIA',
  },
  product_slot: {
    x: 0.50,
    y: 0.50,
    width: 0.44,
    height: 0.52,
    shape: 'rectangle',
    padding: 0.05,
  },
  text_slots: [
    { id: 'top_hook', type: 'headline', x: 0.38, y: 0.14, width: 0.36, height: 0.08, max_words: 5, style: 'curved_bold_gold' },
    { id: 'left_benefit', type: 'benefit_item', x: 0.18, y: 0.36, width: 0.28, height: 0.12, max_words: 10, style: 'arc_callout_gold' },
    { id: 'right_benefit', type: 'benefit_item', x: 0.82, y: 0.36, width: 0.28, height: 0.12, max_words: 10, style: 'arc_callout_gold' },
    { id: 'bottom_title', type: 'product_title', x: 0.50, y: 0.86, width: 0.70, height: 0.06, max_words: 6, style: 'bold_gold' },
    { id: 'bottom_ribbon', type: 'footer', x: 0.50, y: 0.94, width: 0.85, height: 0.05, max_words: 8, style: 'curved_gold_ribbon' },
  ],
  style_identity: 'Ruleta Circular 360° de Rendimiento y Suplementos',
  composition_rules: 'Composición circular concéntrica con suplemento en pedestal central 3D, marco dorado segmentado en 3 arcos con atletas masculinos y beneficios, sellos y cinta en el pie',
  visual_hierarchy: '1. Suplemento hero en pedestal central, 2. Atleta superior con titular curvo, 3. Atletas laterales con beneficios, 4. Sellos y cinta inferior',
  lighting_rules: 'Iluminación dramática de alto contraste con acentos dorados y sombras limpias de estudio',
  camera_rules: 'Plano frontal publicitario directo al centro del pedestal y al marco dorado',
  color_behavior: 'Fondo negro mate con acentos dorados adaptables al envase del suplemento',
  branding_style: 'Tipografía bold geométrica dorada, marco circular segmentado y sellos de confianza',
  text_behavior: 'Titulares en español enérgicos y concisos de alta conversión publicitaria',
  render_rules: 'Preservar el producto real en el centro y adaptar los modelos masculinos, arcos y colores',
  ai_direction_rules: {
    camera_angle: 'frontal_centrado',
    depth: 'media',
    lighting: 'dramatica_dorada_contraste',
    mood: 'potente_masculino_premium',
    product_focus: 'extremo_centro_pedestal',
    background_style: 'arco_circular_dorado_segmentado',
    shadow_style: 'contacto_pedestal_dramatico',
    visual_energy: 'alta_energia_fitness',
  },
  product_scale_lock: {
    enabled: true,
    canvas_coverage_target: 0.42,
    preserve_visual_weight: true,
    preserve_hero_scale: true,
  },
  smart_color_integration: {
    enabled: true,
    extract_product_palette: true,
    blend_with_template_palette: true,
  },
};

export const CREATIVE_TEMPLATES: CreativeTemplate[] = [
  CIRCULAR_360_BEAUTY_TEMPLATE,
  CIRCULAR_360_FITNESS_TEMPLATE,
  HIGH_IMPACT_ECOMMERCE_TEMPLATE,
];

