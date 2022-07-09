import TxSprite from './tx-sprite';
import { FastVertexArray } from './fast-vertex-array';
import { TransactionStripped } from 'src/app/interfaces/websocket.interface';
import { SpriteUpdateParams, Square, Color, ViewUpdateParams } from './sprite-types';
import { feeLevels, mempoolFeeColors } from 'src/app/app.constants';

const hoverTransitionTime = 300;

export default class TxView implements TransactionStripped {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
  feerate: number;
  status?: 'found' | 'missing' | 'added';

  initialised: boolean;
  vertexArray: FastVertexArray;
  hover: boolean;
  sprite: TxSprite;
  hoverColor: Color | void;
  defaultHoverColor: Color = TxView.hexToColor('1bd8f4');

  screenPosition: Square;
  gridPosition: Square | void;

  dirty: boolean;
  demoMode: string;

  constructor(tx: TransactionStripped, vertexArray: FastVertexArray, demoMode: string) {
    this.txid = tx.txid;
    this.fee = tx.fee;
    this.vsize = tx.vsize;
    this.value = tx.value;
    this.feerate = tx.fee / tx.vsize;
    this.status = tx.status;
    this.initialised = false;
    this.vertexArray = vertexArray;
    this.demoMode = demoMode;

    this.hover = false;

    this.screenPosition = { x: 0, y: 0, s: 0 };

    this.dirty = true;
  }

  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
      this.initialised = false;
    }
  }

  applyGridPosition(position: Square): void {
    if (!this.gridPosition) {
      this.gridPosition = { x: 0, y: 0, s: 0 };
    }
    if (this.gridPosition.x !== position.x || this.gridPosition.y !== position.y || this.gridPosition.s !== position.s) {
      this.gridPosition.x = position.x;
      this.gridPosition.y = position.y;
      this.gridPosition.s = position.s;
      this.dirty = true;
    }
  }

  /*
    display: defines the final appearance of the sprite
        position: { x, y, s } (coordinates & size)
        color: { r, g, b, a} (color channels & alpha)
    duration: of the tweening animation from the previous display state
    start: performance.now() timestamp, when to start the transition
    delay: additional milliseconds to wait before starting
    jitter: if set, adds a random amount to the delay,
    adjust: if true, modify an in-progress transition instead of replacing it

    returns minimum transition end time
  */
  update(params: ViewUpdateParams): number {
    if (params.jitter) {
      params.delay += (Math.random() * params.jitter);
    }

    if (!this.initialised || !this.sprite) {
      this.initialised = true;
      this.sprite = new TxSprite(
        this.toSpriteUpdate(params),
        this.vertexArray
      );
      // apply any pending hover event
      if (this.hover) {
        params.duration = Math.max(params.duration, hoverTransitionTime);
        this.sprite.update({
          ...this.hoverColor,
          duration: hoverTransitionTime,
          adjust: false,
          temp: true,
          altColor: this.getAltColor(),
          effect: this.getEffect(),
        });
      }
    } else {
      this.sprite.update(
        this.toSpriteUpdate(params)
      );
    }
    this.dirty = false;
    return (params.start || performance.now()) + (params.delay || 0) + (params.duration || 0);
  }

  // Temporarily override the tx color
  // returns minimum transition end time
  setHover(hoverOn: boolean, color: Color | void): number {
    if (hoverOn) {
      this.hover = true;
      this.hoverColor = color || this.defaultHoverColor;

      this.sprite.update({
        ...this.hoverColor,
        duration: hoverTransitionTime,
        adjust: false,
        temp: true,
        altColor: this.getAltColor(),
        effect: this.getEffect(),
      });
    } else {
      this.hover = false;
      this.hoverColor = null;
      if (this.sprite) {
        this.sprite.resume(hoverTransitionTime);
      }
    }
    this.dirty = false;
    return performance.now() + hoverTransitionTime;
  }

  static getFeeRateColor(feerate): string {
    const feeLevelIndex = feeLevels.findIndex((feeLvl) => Math.max(1, feerate) < feeLvl) - 1;
    return mempoolFeeColors[feeLevelIndex] || mempoolFeeColors[mempoolFeeColors.length - 1];
  }

  getColor(): Color {
    // Block audit
    // if (this.status === 'found') {
    //   // return hexToColor('1a4987');
    // } else if (this.status === 'missing') {
    //   return hexToColor('039BE5');
    // } else if (this.status === 'added') {
    //   return hexToColor('D81B60');
    // }

    // Block component
    return TxView.hexToColor(TxView.getFeeRateColor(this.feerate));
  }

  getAltColor(): Color {
    if (this.demoMode === 'color pulse') {
      if (this.status === 'added') {
        return TxView.hexToColor('D81B60')
      } else if (this.status === 'missing') {
        return TxView.hexToColor('039BE5')
      }
    } else {
      return TxView.hexToColor('FFFFFF');
    }
  }

  getEffect(): string {
    if (this.status === 'added') {
      return this.demoMode;
    } else if (this.status === 'missing') {
      return this.demoMode;
    } else {
      return null;
    }
  }

  // convert from this class's update format to TxSprite's update format
  toSpriteUpdate(params: ViewUpdateParams): SpriteUpdateParams {
    return {
      start: (params.start || performance.now()) + (params.delay || 0),
      duration: params.duration,
      minDuration: params.minDuration,
      ...params.display.position,
      ...params.display.color,
      adjust: params.adjust,
      altColor: this.getAltColor(),
      effect: this.getEffect(),
    };
  }

  static hexToColor(hex: string): Color {
    return {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
      a: 1
    };
  }
}
