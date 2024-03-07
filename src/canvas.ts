import { IFullTrackData, RowData, WindowData } from "./dataSetup";
import { ISpotifyTrack } from "./schemas";

const MS_IN_DAY = 1000 * 60 * 60 * 24;

function textFitsWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font?: string
) {
  if (font !== undefined) ctx.font = font;
  return ctx.measureText(text).width <= maxWidth;
}
/** Implicitly requires font to be set to something */
function truncateTextGivenWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font?: string
) {
  if (font !== undefined) ctx.font = font; //otherwise assumed to be default
  let lo = 0,
    hi = text.length;
  if (textFitsWidth(ctx, text, maxWidth)) return text;
  while (lo <= hi) {
    let mid = Math.floor((lo + hi) / 2);
    if (
      ctx.measureText(text.substring(0, mid).trim() + "...").width <= maxWidth
    ) {
      // makes this O(Nlog(N)) but idc
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (hi === -1) return ""; //you can fit absolutely nothing (well at least not ...)
  return text.substring(0, hi).trim() + "...";
}
function drawText(
  ctx: CanvasRenderingContext2D,
  options: {
    text: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    font: string;
    maxWidth?: number;
    x: number;
    y: number;
  }
) {
  ctx.font = options.font;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "alphabetic";
  let text = options.text;
  if (options?.maxWidth !== undefined)
    text = truncateTextGivenWidth(ctx, text, options.maxWidth);

  ctx.fillText(text, options.x, options.y);
}

class Bar {
  HEIGHT: number;
  WIDTH: number; //inlcuding image
  LABEL_PADDING_LEFT = 20;
  LABEL_PADDING_RIGHT = 15;
  VALUE_MARGIN_LEFT = 10;
  IMAGE_RECT_GAP = 10;
  TRANSITION_DURATION_MS = 250;
  x: number;
  desiredY: number; //top left pos (desired y val)
  curY: number;
  prevY: number; //what we're transitioning from
  transitionStartTimeStamp: number | null = null;
  label: string;
  img?: HTMLImageElement;
  percentFilled: number;
  currentValue: number;
  constructor(
    trackData: IFullTrackData,
    width: number,
    height: number,
    x: number,
    curY: number
  ) {
    this.label = trackData.master_metadata_track_name;
    this.img = trackData.img;

    this.WIDTH = width;
    this.HEIGHT = height;
    this.x = x;
    this.desiredY = curY; // also moot value
    this.curY = curY;
    this.prevY = curY; //moot value that doesn't really matter cuz we aren't transitioning yet
    this.percentFilled = 1;
    this.currentValue = 1;
  }
  moveTo(
    y: number,
    percentFilled: number,
    currentValue: number,
    timeStamp: number
  ) {
    console.assert(!isNaN(percentFilled));
    if (this.desiredY !== y) {
      // only do the transition stuff IF it's a new dest

      this.desiredY = y;
      this.transitionStartTimeStamp = timeStamp;
      this.prevY = this.curY;
    }
    this.currentValue = currentValue;
    this.percentFilled = percentFilled;
  }
  /**
   * Returns true if done transitioning
   * @param ctx
   * @param timestamp
   */
  draw(ctx: CanvasRenderingContext2D, timestamp: number) {
    if (this.transitionStartTimeStamp !== null) {
      const totalDist = this.desiredY - this.prevY;
      const progressPercent = Math.min(
        1,
        (timestamp - this.transitionStartTimeStamp) /
          this.TRANSITION_DURATION_MS
      );
      this.curY = this.prevY + totalDist * progressPercent;
      if (progressPercent === 1) {
        this.transitionStartTimeStamp = null;
      }
    }
    // Q should ctx be passed in or as a class prop
    const fullRectStartX = this.x + this.HEIGHT + this.IMAGE_RECT_GAP;
    const fullRectEndX = this.x + this.WIDTH - 190; // -190 for the XXX min part
    const rectWidth = (fullRectEndX - fullRectStartX) * this.percentFilled;
    const labelMaxWidth =
      rectWidth - this.LABEL_PADDING_LEFT - this.LABEL_PADDING_RIGHT;
    const labelFont = "30px Helvetica";
    const minuteFont = "30px Courier New";
    const rectEndMiddleY = this.curY + this.HEIGHT / 2; // right in the middle
    const rectEndX = fullRectStartX + rectWidth;
    ctx.strokeRect(fullRectStartX, this.curY, rectWidth, this.HEIGHT);
    if (textFitsWidth(ctx, this.label, labelMaxWidth, labelFont)) {
      drawText(ctx, {
        text: this.label,
        align: "right",
        baseline: "middle",
        font: labelFont,
        x: rectEndX - this.LABEL_PADDING_RIGHT,
        y: rectEndMiddleY,
      });
    } else {
      drawText(ctx, {
        text: this.label,
        align: "left",
        baseline: "middle",
        font: labelFont,
        x: fullRectStartX + this.LABEL_PADDING_LEFT,
        y: rectEndMiddleY,
        maxWidth: labelMaxWidth,
      });
    }
    if (this.img) {
      ctx.drawImage(this.img, this.x, this.curY, this.HEIGHT, this.HEIGHT);
    }
    drawText(ctx, {
      text: `${(Math.floor(this.currentValue / 1000) / 60).toFixed(2)} min`,
      align: "left",
      baseline: "middle",
      font: minuteFont,
      x: rectEndX + this.VALUE_MARGIN_LEFT,
      y: rectEndMiddleY,
    });

    return this.transitionStartTimeStamp === null;
  }
}

export class BarAnimator {
  MS_PER_FRAME = MS_IN_DAY / 24;
  RECT_HEIGHT = 50;
  GRAPH_MARGIN_LEFT = 20;
  GRAPH_MARGIN_RIGHT = 40;
  GRAPH_MARGIN_TOP = 20;
  GRAPH_MARGIN_BOTTOM = 20;
  RECT_GAP = 10;
  NUM_ROWS = 15;

  windowData: WindowData;
  idToSong: Record<string, IFullTrackData>;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  range: {
    startDay: number;
    endDay: number;
  };
  curDate: Date;
  zero = 0;
  activeBarMap: Record<string, Bar> = {};

  constructor(
    windowData: WindowData,
    idToSong: Record<string, IFullTrackData>,
    canvas: HTMLCanvasElement
  ) {
    this.windowData = windowData;
    this.canvas = canvas;
    this.idToSong = idToSong;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get context!");
    this.ctx = ctx;

    const days = Object.keys(windowData).map((numStr) => parseInt(numStr));
    this.range = {
      startDay: Math.min(...days),
      endDay: Math.max(...days),
    };
    this.curDate = new Date(this.range.startDay * MS_IN_DAY);
  }

  /**
   *
   * @returns Sorted rows in array given current time (can be between two whole-number dates)
   */
  getInterpolatedCurrentData() {
    const day = Math.floor(+this.curDate / MS_IN_DAY);
    const skew = (+this.curDate % MS_IN_DAY) / MS_IN_DAY; //how much to favor today vs. tomorrow
    const prevDay = day,
      nextDay = day + 1;
    const prevData = this.windowData[prevDay] ?? {},
      nextData = this.windowData[nextDay] ?? {};
    const ids = Array.from(
      new Set(Object.keys(prevData).concat(Object.keys(nextData)))
    );

    const res: [string, number][] = [];
    for (const id of ids) {
      const prevDuration = prevData[id] ?? 0;
      const nextDuration = nextData[id] ?? 0;
      res.push([id, prevDuration * (1 - skew) + nextDuration * skew]);
    }

    return res.sort((a, b) => b[1] - a[1]);
  }

  drawFrame(timeStamp: number) {
    const dateFont = "150px Helvetica";

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = "black";
    const sortedRows = this.getInterpolatedCurrentData();
    const topRows = sortedRows.slice(0, this.NUM_ROWS); //for actual graph rendering (we still need all rows for reference tho)

    const maxMs = Math.max(...sortedRows.map((a) => a[1]));
    const idToVal = sortedRows.reduce<Record<string, number>>(
      (obj, [id, val]) => {
        obj[id] = val;
        return obj;
      },
      {}
    );
    const topIdToVal = topRows.reduce<Record<string, number>>(
      (obj, [id, val]) => {
        obj[id] = val;
        return obj;
      },
      {}
    );

    const killedIds = new Set(
      Object.keys(this.activeBarMap).filter(
        (id) => topIdToVal[id] === undefined //no longer in the top
      )
    );
    topRows.forEach(([id, val], i) => {
      if (!this.activeBarMap[id])
        this.activeBarMap[id] = new Bar(
          this.idToSong[id],
          this.canvas.width - this.GRAPH_MARGIN_LEFT - this.GRAPH_MARGIN_RIGHT,
          this.RECT_HEIGHT,
          this.GRAPH_MARGIN_LEFT,
          this.canvas.height
        );
      this.activeBarMap[id].moveTo(
        this.GRAPH_MARGIN_TOP + (this.RECT_HEIGHT + this.RECT_GAP) * i,
        val / maxMs,
        val,
        timeStamp
      );
    });
    for (const id of killedIds) {
      this.activeBarMap[id].moveTo(
        this.canvas.height,
        (idToVal[id] ?? 0) / maxMs, //data could've evaporated by this point
        idToVal[id] ?? 0,
        timeStamp
      );
    }
    for (const id of Object.keys(this.activeBarMap)) {
      const doneAnimating = this.activeBarMap[id].draw(this.ctx, timeStamp);
      if (doneAnimating && killedIds.has(id)) delete this.activeBarMap[id];
    }
    console.log(Object.keys(this.activeBarMap).length);
    drawText(this.ctx, {
      text: `${this.curDate.getMonth() + 1}/${this.curDate.getDate()}/${
        this.curDate.getFullYear() % 100
      }`,
      font: dateFont,
      align: "right",
      baseline: "bottom",
      x: this.canvas.width - this.GRAPH_MARGIN_RIGHT,
      y: this.canvas.height - this.GRAPH_MARGIN_BOTTOM,
    });
  }

  startLoop() {
    this.curDate = new Date(
      this.range.startDay * 1000 * 60 * 60 * 24 + MS_IN_DAY * 365 * 3
    );
    setInterval(
      () => (this.curDate = new Date(this.MS_PER_FRAME + +this.curDate)),
      1000 / 60 // 60 Hz
    );
    requestAnimationFrame((time) => {
      this.zero = time;
      requestAnimationFrame((time) => this.drawLoop(time));
    });
  }
  drawLoop(time: number) {
    this.drawFrame(time);
    requestAnimationFrame((time) => this.drawLoop(time));
  }
}
