export interface ProductAnalysis {
  category: string;
  subcategory: string;
  product_name: string;
  main_colors: string[];
  materials: string[];
  visible_details: string[];
  shape: string;
  style: string;
  must_preserve: string[];
  visual_style: string;
  audience: string;
  aesthetic: string;
  commercial_tone: string;
  luxury_level: string;
  mood_keywords: string[];
  marketing_angles: string[];
  lifestyle_context: string;
  premium_features: string[];
  visual_energy: string;
  material?: string; // Compatibility fallback
}

export interface Copywriting {
  badge: string;
  hook: string;
  desc: string;
  benefits: string[];
  cta: string;
  testimonial: string;
  lifestyle_phrase: string;
  premium_descriptor: string;
}

export interface TemplateDNA {
  dominant_palette: string[];
  secondary_palette: string[];
  lighting_style: string;
  cinematic_mood: string;
  contrast_profile: string;
  glow_style: string;
  visual_temperature: string;
  luxury_style: string;
  shadow_behavior: string;
  gradient_behavior: string;
  environment_style: string;
  reflection_style: string;
  premium_render_style: string;
}

export interface QAResults {
  passed: boolean;
  template_similarity_score: number;
  layout_preservation_score: number;
  product_identity_score: number;
  background_geometry_score: number;
  pedestal_similarity_score: number;
  spacing_similarity_score: number;
  visual_balance_score: number;
  color_palette_match_score: number;
  shadow_match_score: number;
  lighting_match_score: number;
  premium_render_similarity_score: number;
  color_harmony_score: number;
  product_color_environment_influence_score: number;
  typography_structure_preservation_score: number;
  template_geometry_preservation_score: number;
  template_reinterpretation_score: number;
  frozen_region_integrity_score: number;
  product_scale_similarity_score: number;
  visual_weight_similarity_score: number;
  icon_count_preservation: boolean;
  icon_column_position_preserved: boolean;
  text_zone_preservation: boolean;
  template_text_leakage_detected: boolean;
  background_reconstruction_detected: boolean;
  geometry_shift_detected: boolean;
  spacing_shift_detected: boolean;
  typography_reflow_detected: boolean;
  reason: string;
  issues: string[];
  retry_triggered: boolean;
}

export interface ArtDirection {
  scene: string;
  lighting: string;
  camera_angle: string;
  composition: string;
  background: string;
  mood: string;
}

export interface AdaptedColorsResult {
  ui_palette?: {
    primary?: string;
    accent?: string;
    text?: string;
    badgeBg?: string;
    badgeText?: string;
  };
  environment_palette?: {
    product_primary?: string;
    product_secondary?: string;
    neutral_shadow?: string;
    template_primary?: string;
    blended_background?: string;
    pedestal_tint?: string;
    shadow_tint?: string;
    accent_color?: string;
  };
}

