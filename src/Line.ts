import Shape, { ShapeAttrs, MousePosition } from './Shape';

export interface LineAttrs extends ShapeAttrs {
  x1: number;
  y1: number;
}

export default class Line extends Shape<LineAttrs> {
  type = 'line';
  /**
   * Creates an instance of Line shape.
   * @param {LineAttrs} attrs
   * @memberof Line
   */
  constructor(attrs: LineAttrs) {
    super(attrs);
  }
  render(ctx: CanvasRenderingContext2D) {
    // renew path so that rerender won't get old path object
    const [x, y] = this._getShapePosition();
    const [x1, y1] = this._getShapePosition([
      this.get('x1'),
      this.get('y1'),
    ]);
    this.path = new Path2D();
    this.path.moveTo(x, y);
    this.path.lineTo(x1, y1);
    this.path.closePath()
    this.fillOrStroke(ctx, this.path);
  }
  isPointInShape(ctx: CanvasRenderingContext2D, e: MouseEvent) {
    return this._isPointInShapePath(ctx, e)
  }
}
