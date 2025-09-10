
export type Tool = 'select' | 'highlight' | 'annotate' | 'erase';
export type BrushSize = 'small' | 'medium' | 'large';

export interface CanvasObject {
  id: string;
  type: 'highlight' | 'annotation';
  selected?: boolean;
}

export interface Highlight extends CanvasObject {
  type: 'highlight';
  points: { x: number; y: number }[];
  color: string;
  strokeWidth: number;
}

export interface Annotation extends CanvasObject {
  type: 'annotation';
  text: string;
  position: { x: number; y: number };
  color: string;
  fontSize: number;
  width?: number;
  height?: number;
}
