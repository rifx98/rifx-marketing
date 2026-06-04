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

export const CREATIVE_TEMPLATES: CreativeTemplate[] = [];

