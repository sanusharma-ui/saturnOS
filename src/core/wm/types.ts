export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  icon: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  zIndex: number;
  minimized: boolean;
  maximized: boolean;
  snapSide: 'left' | 'right' | null;
  prevBounds: { x: number; y: number; width: number; height: number };
  arg?: any;
}

export type SnapTarget = 'left' | 'right' | 'top' | null;
