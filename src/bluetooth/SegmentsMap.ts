import { ParsedLowerTransportPDU } from "./PduParser";

class SegmentsMap {
  private static _instance: SegmentsMap;
  private _segments: Map<string, ParsedLowerTransportPDU[]>;

  private constructor() {
    this._segments = new Map();
  }

  public static getInstance() {
    if (!this._instance) {
      this._instance = new SegmentsMap();
    }
    return this._instance;
  }

  public putSegment(key: string, parsedLowerTransportPDU: ParsedLowerTransportPDU) {
    const segments = this._segments.get(key);
    if (segments) {
      this._segments.set(key, [...segments, parsedLowerTransportPDU]);
    } else {
      this._segments.set(key, [parsedLowerTransportPDU]);
    }
  }

  public getSegments(key: string) {
    return this._segments.get(key);
  }

  public deleteSegments(key: string) {
    this._segments.delete(key);
  }

  public areAllSegmentsForKeyPresent(key: string) {
    const segments = this._segments.get(key);
    if (!segments || segments.length === 0) return false;

    const totalSegments = segments[0].segn!;

    return segments.length === totalSegments + 1;
  }
}

export default SegmentsMap;
