import { CopyFormat } from './constants';

export type Options = {
  smart: number;
  ignore: number[];
  delay: number;
  close: number;
  block: boolean;
  reverse: boolean;
  end: boolean;
  copyFormat?: CopyFormat;
};

export type Action = {
  type: 'copy' | 'bookmark' | 'win' | 'tabs';
  mouse: number;
  key: number;
  action: string;
  color: string;
  options: Options;
};

export type Settings = {
  actions: Record<string, Action>;
  blocked: string[];
  error?: string;
};

export type ActionType = 'activate' | 'init' | 'update' | 'updateAction';

export type Message = {
  type: ActionType;
  actionId?: string;
  action?: Action;
  settings?: Settings;
  urls?: LinkURL[];
};

export type LinkURL = {
  url: string;
  title: string;
  box: HTMLElement | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  height: number;
  width: number;
  important: boolean;
} & (HTMLAnchorElement | HTMLAreaElement);
