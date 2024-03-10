import { IFullTrackData, RowData, WindowData } from "./dataSetup";
import { ISpotifyTrack } from "./schemas";

const MS_IN_DAY = 1000 * 60 * 60 * 24;
const MS_IN_YEAR = MS_IN_DAY * 365;
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
    color?: string;
  }
) {
  ctx.font = options.font;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "alphabetic";
  let text = options.text;
  if (options?.maxWidth !== undefined)
    text = truncateTextGivenWidth(ctx, text, options.maxWidth);
  ctx.fillStyle = options.color ?? "black";
  ctx.fillText(text, options.x, options.y);
}
function drawVerticalLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + length);
  ctx.closePath();
  ctx.stroke();
}
function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + length, y);
  ctx.closePath();
  ctx.stroke();
}

function fillRectStartEnd(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
}
class Bar {
  HEIGHT: number;
  WIDTH: number; //max width of actual bar, not including image
  LABEL_PADDING_LEFT = 20;
  LABEL_PADDING_RIGHT = 15;
  VALUE_MARGIN_LEFT = 10;
  IMAGE_RECT_GAP = 10;
  TRANSITION_DURATION_MS = 250;
  // x coord where bars start (imageX is thus < x)
  x: number;
  // topY
  y: number;
  desiredI: number; //top left pos (desired y val)
  curI: number;
  prevI: number; //what we're transitioning from
  transitionStartTimeStamp: number | null = null;
  label: string;
  img?: HTMLImageElement;
  percentFilled: number;
  currentValue: number;
  RECT_GAP: number; // some bleed in of responsibility... we do need this to render the rectangle though if the only thing we're passing in is the index
  IMAGE_PADDING = 4;
  THIN_RECT_HEIGHT = 10;

  constructor(
    trackData: IFullTrackData,
    width: number,
    height: number,
    gap: number,
    x: number,
    y: number,
    curI: number
  ) {
    this.label =
      trackData.master_metadata_track_name +
      " - " +
      trackData.master_metadata_album_artist_name;
    this.img = trackData.img;

    this.WIDTH = width;
    this.HEIGHT = height;
    this.RECT_GAP = gap;
    this.x = x;
    this.y = y;
    this.desiredI = this.curI = this.prevI = curI; //prev and desired only matter if transitionStartTimeStamp is not null
    this.percentFilled = 1;
    this.currentValue = 1;
  }
  moveTo(
    i: number,
    percentFilled: number,
    currentValue: number,
    timeStamp: number
  ) {
    console.assert(!isNaN(percentFilled));
    if (this.desiredI !== i) {
      // only do the transition stuff IF it's a new dest

      this.desiredI = i;
      this.transitionStartTimeStamp = timeStamp;
      this.prevI = this.curI;
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
      const totalDist = this.desiredI - this.prevI;
      const progressPercent = Math.min(
        1,
        (timestamp - this.transitionStartTimeStamp) /
          this.TRANSITION_DURATION_MS
      );
      this.curI = this.prevI + totalDist * progressPercent;
      if (progressPercent === 1) {
        this.transitionStartTimeStamp = null;
      }
    }
    const rectTopY = this.curI * (this.HEIGHT + this.RECT_GAP) + this.y;

    // image x pos calculation
    const percentProgress =
      this.curI > 11 // FIXME: grrr magic number
        ? 0
        : Math.floor(this.curI) % 2 === 0
        ? (Math.cos((this.curI % 1) * Math.PI) + 1) / 2
        : 1 - (Math.cos((this.curI % 1) * Math.PI) + 1) / 2; //First row is inwards
    const imageHeight = this.HEIGHT * 2;
    const imageLeftX =
      this.x -
      imageHeight * 2 -
      this.IMAGE_RECT_GAP +
      imageHeight * percentProgress;

    const fullRectStartX = this.x;
    const fullRectEndX = this.x + this.WIDTH;
    const rectWidth = (fullRectEndX - fullRectStartX) * this.percentFilled;
    const labelMaxWidth =
      rectWidth - this.LABEL_PADDING_LEFT - this.LABEL_PADDING_RIGHT;
    const labelFont = "normal 400 22px Oswald";
    const minuteFont = "25px Courier New";
    const rectMiddleY = rectTopY + this.HEIGHT / 2; // right in the middle
    const rectEndX = fullRectStartX + rectWidth;

    if (this.img) {
      ctx.drawImage(
        this.img,
        imageLeftX + this.IMAGE_PADDING,
        rectMiddleY - imageHeight / 2 + this.IMAGE_PADDING,
        imageHeight - this.IMAGE_PADDING * 2,
        imageHeight - this.IMAGE_PADDING * 2
      );
    }
    drawText(ctx, {
      text: `${(Math.floor(this.currentValue / 1000) / 60).toFixed(2)} min`,
      align: "left",
      baseline: "middle",
      font: minuteFont,
      x: rectEndX + this.VALUE_MARGIN_LEFT,
      y: rectMiddleY,
    });

    ctx.fillStyle = "black";
    ctx.fillRect(fullRectStartX, rectTopY, rectWidth, this.HEIGHT);
    fillRectStartEnd(
      ctx,
      imageLeftX + imageHeight - this.IMAGE_PADDING,
      rectMiddleY - this.THIN_RECT_HEIGHT / 2,
      fullRectStartX,
      rectMiddleY + this.THIN_RECT_HEIGHT / 2
    );
    if (textFitsWidth(ctx, this.label, labelMaxWidth, labelFont)) {
      drawText(ctx, {
        text: this.label,
        align: "right",
        baseline: "middle",
        font: labelFont,
        x: rectEndX - this.LABEL_PADDING_RIGHT,
        y: rectMiddleY,
        color: "white",
      });
    } else {
      drawText(ctx, {
        text: this.label,
        align: "left",
        baseline: "middle",
        font: labelFont,
        x: fullRectStartX + this.LABEL_PADDING_LEFT,
        y: rectMiddleY,
        maxWidth: labelMaxWidth,
        color: "white",
      });
    }

    return this.transitionStartTimeStamp === null;
  }
}
class Timeline {
  MARGIN_BOTTOM = 20;
  MARGIN_LEFT = 20;
  MARGIN_RIGHT = 20;
  startDate: number; // keep in mind this is date and not *day*
  endDate: number;
  setTime: (time: Date) => void;
  BUTTON_SIZE = 50;
  TICK_HEIGHT = 20;
  GAP = 30;

  constructor(startDay: number, endDay: number, setTime: (time: Date) => void) {
    this.startDate = startDay * MS_IN_DAY;
    this.endDate = endDay * MS_IN_DAY;
    console.assert(this.startDate < this.endDate);
    this.setTime = setTime; // pass data up
  }
  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ) {
    const majorTicks = [this.startDate, this.endDate];
    const multiple = MS_IN_YEAR; // oh unless leap years eek
    let tickDate =
      Math.floor((this.startDate + MS_IN_YEAR - 1) / MS_IN_YEAR) * MS_IN_YEAR; //right we round up on year for first start date

    for (; tickDate <= this.endDate; tickDate += multiple) {
      majorTicks.push(tickDate);
    }
    const timelineStartX = this.MARGIN_LEFT + this.BUTTON_SIZE + this.GAP;
    const timelineEndX = canvasWidth - this.MARGIN_RIGHT;
    const timelineLength = timelineEndX - timelineStartX;
    const timelineY = canvasHeight - this.MARGIN_BOTTOM - this.TICK_HEIGHT;
    drawHorizontalLine(ctx, timelineStartX, timelineY, timelineLength);
    for (const tick of majorTicks) {
      const xPos =
        (timelineLength * (tick - this.startDate)) /
        (this.endDate - this.startDate);
      drawVerticalLine(ctx, xPos + timelineStartX, timelineY, this.TICK_HEIGHT);
    }
  }
}

export class BarAnimator {
  MS_PER_FRAME = MS_IN_DAY / 24;
  RECT_HEIGHT = 42;
  GRAPH_MARGIN_LEFT = 20;
  GRAPH_MARGIN_RIGHT = 40;
  GRAPH_MARGIN_TOP = 20;
  AXIS_HEIGHT = 150; // top axis height
  GRAPH_MARGIN_BOTTOM = 20;
  RECT_GAP = 6;
  NUM_ROWS = 11;
  AXIS_MARGIN_LEFT = 190; // magic number that's approximately the width of entirety of the stacked images
  BAR_MARGIN_RIGHT = 140; //to account for the XXX min after every bar
  windowData: WindowData;
  windowMax: Record<number, number>; //basically more flexible array
  idToSong: Record<string, IFullTrackData>;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  range: {
    startDay: number;
    endDay: number;
  };
  curDate: Date;
  activeBarMap: Record<string, Bar> = {};
  timeline: Timeline;
  WIDTH: number;
  HEIGHT: number;
  // so we want a fixed width/height for the canvas - we're then just scaling everything in here maybe x2 to fit dpi. BUT extending the canvas dims by x2 initially does not mean all of that is free real-estate lol

  AXIS_INTERVALS = [
    0.25,
    0.5,
    1,
    2,
    4,
    8,
    16,
    32,
    64,
    128,
    256,
    512,
    Infinity,
  ].map((ms) => ms * 1000 * 60); //okay yeah we need the last one lol
  windowAxis: Record<number, number>;
  constructor(
    windowData: WindowData,
    idToSong: Record<string, IFullTrackData>,
    canvas: HTMLCanvasElement
  ) {
    if (Object.keys(windowData).length === 0) throw new Error("Empty data!");
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
    this.timeline = new Timeline(
      this.range.startDay,
      this.range.endDay,
      () => {}
    );
    this.windowMax = {};
    for (const [day, data] of Object.entries(windowData)) {
      const interpolatedBarValsForThatDay = this.getInterpolatedCurrentData(
        new Date(parseInt(day) * MS_IN_DAY)
      ).map((ar) => ar[1]);
      if (interpolatedBarValsForThatDay.length) {
        this.windowMax[parseInt(day)] = Math.max(
          ...interpolatedBarValsForThatDay
        );
      }
    }
    this.windowAxis = {};
    for (const day of Object.keys(windowData)) {
      const maxValForDay = this.getWeightedAverage(
        this.windowMax,
        new Date(parseInt(day) * MS_IN_DAY)
      );
      for (let i = 1; i < this.AXIS_INTERVALS.length; i++) {
        if (maxValForDay / this.AXIS_INTERVALS[i] < 3) {
          this.windowAxis[parseInt(day)] = i - 1;
          break;
        }
      }
    }

    const dpr = 3;
    const rect = canvas.getBoundingClientRect();
    // Set the "actual" size of the canvas
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Scale the context to ensure correct drawing operations
    ctx.scale(dpr, dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.WIDTH = rect.width;
    this.HEIGHT = rect.height;
  }

  /**
   * Very expensive weighted average done on every id within the given window. somehow this doesn't noticeably slow things down though lol
   * @returns Sorted rows in array given current time (can be between two whole-number dates)
   */
  getInterpolatedCurrentData(curDate: Date = this.curDate) {
    const windowSize = 10.5; // arbitrary number that seems to give pretty smooooth bar lengths
    const leftDay = Math.ceil(+curDate / MS_IN_DAY - windowSize / 2);
    const rightDay = Math.floor(+curDate / MS_IN_DAY + windowSize / 2);
    const curDayFloat = +curDate / MS_IN_DAY;
    let ids: string[] = [];
    for (let day = leftDay; day <= rightDay; day++) {
      if (!this.windowData[day]) continue;
      ids = ids.concat(Object.keys(this.windowData[day]));
    }
    ids = [...new Set(ids)];

    const res: [string, number][] = [];
    for (const id of ids) {
      let weight = 0;
      let sum = 0;
      for (let day = leftDay; day <= rightDay; day++) {
        if (!this.windowData[day]) continue;
        const curWeight =
          Math.cos(((day - curDayFloat) / (windowSize / 2)) * Math.PI) / 2 +
          0.5;
        console.assert(curWeight >= -0.0001);
        sum += curWeight * (this.windowData[day][id] ?? 0);
        weight += curWeight;
      }

      res.push([id, weight === 0 ? 0 : sum / weight]);
    }
    return res.sort((a, b) => b[1] - a[1]);
  }
  getLinearInterpolatedCurrentData() {
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
  getWeightedAverage(
    curWindow: Record<number, number>,
    curDate: Date = this.curDate
  ) {
    const windowSize = 5.5; // decimal val makes it jitter a lot less (probably cuz it prevents the sudden loss + gain of two different datapoints)
    const leftDay = Math.ceil(+curDate / MS_IN_DAY - windowSize / 2);
    const rightDay = Math.floor(+curDate / MS_IN_DAY + windowSize / 2);
    const curDayFloat = +curDate / MS_IN_DAY;
    let weight = 0;
    let sum = 0;

    for (let day = leftDay; day <= rightDay; day++) {
      const curWeight =
        Math.cos(((day - curDayFloat) / (windowSize / 2)) * Math.PI) / 2 + 0.5;
      weight += curWeight;
      sum += (curWindow[day] ?? 0) * curWeight;
    }
    return weight === 0 ? 0 : sum / weight;
  }
  drawFrame(timeStamp: number) {
    this.ctx.fillStyle = "#cbf0f8";
    this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    const sortedRows = this.getInterpolatedCurrentData();
    const topRows = sortedRows.slice(0, this.NUM_ROWS); //for actual graph rendering (we still need all rows for reference tho)
    const maxMs = Math.max(
      1000 * 60,
      this.getWeightedAverage(
        this.windowMax,
        new Date(+this.curDate - MS_IN_DAY * 0.4)
      )
    ); //we don't want it dropping to 0 lol
    const axisStepIndex = this.getWeightedAverage(this.windowAxis);
    const axisLength =
      this.WIDTH -
      this.GRAPH_MARGIN_LEFT -
      this.GRAPH_MARGIN_RIGHT -
      this.AXIS_MARGIN_LEFT -
      this.BAR_MARGIN_RIGHT;
    this.drawAxis(axisStepIndex, maxMs, axisLength);

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

    // update all active bars
    topRows.forEach(([id, val], i) => {
      if (!this.activeBarMap[id])
        this.activeBarMap[id] = new Bar(
          this.idToSong[id],
          axisLength, // geez okay
          this.RECT_HEIGHT,
          this.RECT_GAP,
          this.GRAPH_MARGIN_LEFT + this.AXIS_MARGIN_LEFT,
          this.GRAPH_MARGIN_TOP + this.AXIS_HEIGHT,
          this.NUM_ROWS + 1
        );
      this.activeBarMap[id].moveTo(i, val / maxMs, val, timeStamp);
    });
    // update non-top bars
    for (const id of killedIds) {
      this.activeBarMap[id].moveTo(
        this.NUM_ROWS + 1,
        (idToVal[id] ?? 0) / maxMs, //data could've evaporated by this point
        idToVal[id] ?? 0,
        timeStamp
      );
    }

    //kill inactive bars if finished transitioning
    for (const id of Object.keys(this.activeBarMap)) {
      const doneAnimating = this.activeBarMap[id].draw(this.ctx, timeStamp);
      if (doneAnimating && killedIds.has(id)) delete this.activeBarMap[id];
    }

    // drawText(this.ctx, {
    //   text: ,
    //   font: dateFont,
    //   align: "right",
    //   baseline: "bottom",
    //   x: this.WIDTH - this.GRAPH_MARGIN_RIGHT,
    //   y: this.HEIGHT - this.GRAPH_MARGIN_BOTTOM,
    // });
    drawText(this.ctx, {
      text: `Most Streamed Spotify Songs at the end of ${
        this.curDate.getMonth() + 1
      }/${this.curDate.getDate()}/${this.curDate.getFullYear() % 100}`,
      align: "left",
      baseline: "top",
      x: this.GRAPH_MARGIN_LEFT,
      y: this.GRAPH_MARGIN_TOP,
      font: "normal 600 50px Oswald",
      color: "black",
    });
    // this.timeline.draw(this.ctx, this.WIDTH, this.HEIGHT);
  }

  private drawAxis(axisStepIndex: number, maxMs: number, axisLength: number) {
    const axisSkew = 1 - (axisStepIndex % 1);
    const floorIndex = Math.floor(axisStepIndex);
    console.assert(floorIndex >= 0);
    drawText(this.ctx, {
      text: "Minutes streamed in 30-day weighted window",
      align: "center",
      x: this.WIDTH / 2,
      y: this.GRAPH_MARGIN_TOP + this.AXIS_HEIGHT - 42,
      baseline: "bottom",
      color: "black",
      font: "25px Oswald",
    });
    this.drawAxisHelper(
      this.AXIS_INTERVALS[floorIndex],
      axisSkew,
      maxMs,
      axisLength
    );
    if (floorIndex + 1 < this.AXIS_INTERVALS.length) {
      this.drawAxisHelper(
        this.AXIS_INTERVALS[floorIndex + 1],
        1 - axisSkew,
        maxMs,
        axisLength
      );
    }
  }

  drawAxisHelper(
    step: number,
    opacity: number,
    maxMs: number,
    axisLength: number
  ) {
    const FADE_OFF_DIST = 50; //doesn't include invisible dist
    const INVISIBLE_DIST = 30;
    for (let i = 0; i <= maxMs * 1.3; i += step) {
      const lineX =
        this.GRAPH_MARGIN_LEFT +
        this.AXIS_MARGIN_LEFT +
        (i / maxMs) * axisLength;
      const lineY = this.GRAPH_MARGIN_TOP + this.AXIS_HEIGHT;
      const curOpacity = Math.min(
        opacity,
        Math.min(
          FADE_OFF_DIST,
          Math.max(0, this.WIDTH - INVISIBLE_DIST - lineX)
        ) / FADE_OFF_DIST
      ); // 20 - 30
      // console.log(curOpacity);
      this.ctx.strokeStyle = `rgba(153,153,153,${curOpacity})`;
      this.ctx.lineWidth = 2;
      drawVerticalLine(
        this.ctx,
        lineX,
        lineY,
        this.HEIGHT - this.GRAPH_MARGIN_BOTTOM - this.GRAPH_MARGIN_TOP
      );
      drawText(this.ctx, {
        text: `${Math.round((i / (1000 * 60)) * 10) / 10}`,
        align: "center",
        x: lineX,
        y: lineY - 10,
        baseline: "bottom",
        font: "20px Rubik",
        color: `rgba(153,153,153,${curOpacity})`,
      });
    }
  }

  startLoop(startDate?: Date) {
    this.curDate = startDate ?? new Date(this.range.startDay * MS_IN_DAY);
    const intervalId = setInterval(
      () => {
        this.curDate = new Date(this.MS_PER_FRAME + +this.curDate);
        const endDate = new Date(this.range.endDay * MS_IN_DAY);
        if (this.curDate >= endDate) {
          this.curDate = endDate;
          clearInterval(intervalId);
        }
      },
      1000 / 60 // 60 Hz
    );
    requestAnimationFrame((time) => {
      requestAnimationFrame((time) => this.drawLoop(time));
    });
  }
  drawLoop(time: number) {
    this.drawFrame(time);
    requestAnimationFrame((time) => this.drawLoop(time));
  }
}
