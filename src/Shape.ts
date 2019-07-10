import EventEmitter from './EventEmitter';
import Canvas, { CANVAS_RERENDER_EVENT_TYPE } from './Canvas';
import cloneDeep from 'lodash/cloneDeep';
import assign from 'lodash/assign';
import { Dictionary } from 'lodash';
import Group from './Group';
import { Mutable, pxByPixelRatio, raiseError, pixelRatio } from './utils';
import inRange from 'lodash/inRange';

export interface CanvasStyles
  extends Partial<CanvasCompositing>,
    Partial<CanvasFilters>,
    Partial<CanvasShadowStyles>,
    Partial<CanvasTextDrawingStyles>,
    // CanvasFillStrokeStyles
    Partial<Pick<CanvasFillStrokeStyles, 'fillStyle' | 'strokeStyle'>>,
    // CanvasPathDrawingStyles
    Partial<
      Pick<
        CanvasPathDrawingStyles,
        'lineCap' | 'lineDashOffset' | 'lineJoin' | 'lineWidth' | 'miterLimit'
      >
    > {
  // transform
  rotate?: Parameters<CanvasTransform['rotate']>[0];
  translate?: Parameters<CanvasTransform['translate']>;
  scale?: Parameters<CanvasTransform['scale']>;
}

export type CanvasStylesKeys = keyof CanvasStyles;

export type MousePosition = Mutable<
  Pick<MouseEvent, 'offsetX' | 'offsetY' | 'type'>
> & {
  target?: Shape<any>;
};

export const canvasStylesMap: Dictionary<boolean> = {
  fillStyle: true,
  strokeStyle: true,
  lineCap: true,
  lineDashOffset: true,
  lineJoin: true,
  lineWidth: true,
  miterLimit: true,
  filter: true,
  globalAlpha: true,
  globalCompositeOperation: true,
  shadowBlur: true,
  shadowColor: true,
  shadowOffsetX: true,
  shadowOffsetY: true,
  direction: true,
  font: true,
  textAlign: true,
  textBaseline: true,
};

export interface ShapeAttrs extends CanvasStyles {
  x: number;
  y: number;
  width?: number;
  height?: number;
}
type ShapeAttrsKeys = keyof ShapeAttrs;

const INT_ATTR_KEYS: ShapeAttrsKeys[] = [
  'x',
  'y',
  'width',
  'height',
  'lineWidth',
];

/**
 * Basic shape class for rect circle path etc.
 * Shape extends eventEmitter to store and fire events
 * Shape store attrs and provide `render` method to draw the shape.
 *
 * @export
 * @abstract
 * @class Shape
 * @extends {EventEmitter}
 */
export default class Shape<
  P extends ShapeAttrs = ShapeAttrs
> extends EventEmitter {
  type = 'shape';
  attrs: P;
  canvas: Canvas | null = null;
  group: Group | null = null;
  data: any;
  path: Path2D | null = null;
  /**
   * Creates an instance of Shape with attrs.
   * @param {P} attrs
   * @memberof Shape
   */
  constructor(attrs: P) {
    super();
    this.attrs = attrs;
  }
  /**
   * Set shape's attrs and shape will rerender automatically.
   *
   * @template K
   * @param {K} key
   * @param {P[K]} value
   */
  set = <K extends keyof P>(key: K, value: P[K]) => {
    this._setAttr(key, value);
    this.canvas && this.canvas.emit(CANVAS_RERENDER_EVENT_TYPE, this);
  };
  protected _setAttr = <K extends keyof P>(key: K, value: P[K]) => {
    this.attrs[key] = value;
  };
  /**
   * get shape's real attr, affected by group and scale
   *
   * @param {keyof P} key
   * @returns
   */
  protected _getAttr = (key: keyof P) => {
    // @ts-ignore
    if (INT_ATTR_KEYS.indexOf(key) > -1) {
      // @ts-ignore
      return pxByPixelRatio(this.attrs[key]);
    }
    return this.attrs[key];
  };
  /**
   * Get a attr
   *
   * @template K
   * @param {K} key
   * @returns
   */
  get = <K extends keyof P>(key: K) => {
    return this.attrs[key];
  };
  /**
   * Store data in shape, you can get it in `on` callback later.
   *
   * @param {any} data
   * @memberof Shape
   */
  setData(data: any) {
    this.data = data;
  }
  /**
   * Get stored data
   *
   * @returns {any}
   * @memberof Shape
   */
  getData(): any {
    return this.data;
  }
  /**
   * fill or stroke a path
   *
   * @protected
   * @param {CanvasRenderingContext2D} ctx
   * @param {Path2D} [path]
   * @memberof Shape
   */
  protected fillOrStroke(ctx: CanvasRenderingContext2D, path?: Path2D) {
    const { strokeStyle, fillStyle } = this.attrs;
    if (strokeStyle) {
      path ? ctx.stroke(path) : ctx.stroke();
    }
    if (fillStyle) {
      path ? ctx.fill(path) : ctx.fill();
    }
  }
  render(ctx: CanvasRenderingContext2D): void {
    raiseError('render method not implemented');
  }
  isPointInShape(ctx: CanvasRenderingContext2D, e: MouseEvent): boolean {
    raiseError('isPointInShape method not implemented');
    return false;
  }
  /**
   * get shape's real postion, sum up shape.group, used in shape.render and mouse event detection
   *
   * @protected
   * @param {[number, number]} [pos]
   * @returns {[number, number]}
   * @memberof Shape
   */
  protected _getShapePosition(pos?: [number, number]): [number, number] {
    // 特殊处理，group内shape实际坐标 = group.x + shape.x，所以要将坐标轴移动
    pos = pos || [this.get('x'), this.get('y')];
    if (this.group) {
      pos[0] += this.group.get('x');
      pos[1] += this.group.get('y');
    }
    return pos;
  }
  public _emitMouseEvent(e: MouseEvent) {
    const position = this._getMousePosition(e);
    this.emit(position.type, position);
  }
  protected _getMousePosition(e: MouseEvent): MousePosition {
    const { offsetX, offsetY, type } = e;
    const position: MousePosition = {
      offsetX,
      offsetY,
      type,
      target: this,
    };
    return position;
  }
  /**
   * check if mouse event fired in this shape's path.
   * As path' draw style affected by pixel ratio, this will scaled mouse event position by pixel ratio
   *
   * @protected
   * @param {CanvasRenderingContext2D} ctx
   * @param {MouseEvent} e
   * @returns
   * @memberof Shape
   */
  protected _isPointInShapePath(
    ctx: CanvasRenderingContext2D,
    e: MouseEvent,
  ) {
    if (!this.path) return false;
    const { offsetX, offsetY } = e;
    return ctx.isPointInPath(this.path, pxByPixelRatio(offsetX), pxByPixelRatio(offsetY));
  }
  /**
   * check if mouse event fired in this shape's content
   *
   * @protected
   * @param {MouseEvent} e
   * @returns
   * @memberof Shape
   */
  protected _isPointInShapeContent(e: MouseEvent) {
    const width = this.get('width');
    const height = this.get('height');
    if (!width || !height) return false;
    const [x, y] = this._getShapePosition();
    const { offsetX, offsetY } = e;
    return (
      inRange(offsetX, x, x + (width as number)) &&
      inRange(offsetY, y, y + (height as number))
    );
  }
  protected _emitCanvasRerender() {
    this.canvas && this.canvas.emit(CANVAS_RERENDER_EVENT_TYPE, this);
  }
}

export function applyShapeAttrsToContext(
  ctx: CanvasRenderingContext2D,
  ..._attrs: Partial<ShapeAttrs>[]
) {
  const attrs = <ShapeAttrs>assign({}, ..._attrs.map(cloneDeep));
  const { rotate, translate, scale, x, y, ...rest } = attrs;
  for (const key in rest) {
    if (rest.hasOwnProperty(key) && canvasStylesMap[key]) {
      // @ts-ignore
      ctx[key] = rest[key];
    }
  }
  if (translate) {
    ctx.translate(...translate);
  }
  if (rotate) {
    ctx.rotate(rotate);
  }
  if (scale) {
    ctx.scale(...scale);
  }
}
