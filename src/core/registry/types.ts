import type { Component } from 'svelte';

export interface AppManifest {
  id: string;
  name: string;
  icon: string;
  colors: [string, string];
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  singleInstance?: boolean;
  pinned?: boolean;
  isNative?: boolean;
  command?: string;
  component?: any;
  permissions?: string[];
}
