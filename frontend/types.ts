export enum ControlMode {
  MOUSE = 'MOUSE',
  HAND = 'HAND',
}

export enum ZoomLevel {
  FULL_TREE = 'FULL_TREE',
  ZOOMED_IN = 'ZOOMED_IN',
}

export enum InteractionMode {
  VIEW = 'VIEW',
  EDIT = 'EDIT',
}

export interface PhotoData {
  id: string;
  url: string; // Data URL or Image URL
  placeholderType?: 'snowflake' | 'bell' | 'tree';
  position: [number, number, number]; // x, y, z
  rotation: [number, number, number]; // x, y, z
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface HandTrackingResult {
  landmarks: HandLandmark[][];
}

// Custom Event Types for 3D interactions
export type PhotoUploadHandler = (id: string, file: File) => void;
export type BulkUploadHandler = (files: FileList) => void;

export interface ChristmasTreeData {
  public_id: string;
  owner_name: string;
  theme: 'classic';
  status: 'active';
  created_at: string;
  updated_at: string;
}

export interface SecretTreeMessage {
  ornament_public_id: string;
  sender_name: string;
  message: string;
  created_at: string;
}

export interface OwnerMessageCollection {
  revealed: true;
  message_count: number;
  reveal_at: string;
  messages: SecretTreeMessage[];
}

export interface ChristmasTreeBootstrap {
  csrf_token: string;
  tree: ChristmasTreeData | null;
  is_owner: boolean;
}

export interface ChristmasTreeAccess {
  tree: ChristmasTreeData;
  is_owner: true;
  public_path: string;
  public_url: string;
  recovery_code: string;
}

export type OrnamentType = 'bauble_red' | 'bauble_gold' | 'bauble_blue' | 'heart' | 'star' | 'present';

export interface SocialOrnamentData {
  public_id: string;
  ornament_type: OrnamentType;
  ornament_color: string;
  sender_name: string;
  slot_index: number;
  layout_version: 1;
  created_at: string;
  has_message: boolean;
}

export interface OrnamentCollection {
  ornaments: SocialOrnamentData[];
  layout_version: 1;
  capacity: number;
  remaining: number;
}
