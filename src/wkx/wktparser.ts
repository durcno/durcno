import type { Point } from "./point";
import { Types } from "./types";

export interface WktDimension {
  hasZ: boolean;
  hasM: boolean;
}

export interface WktParseOptions {
  srid?: number;
  hasZ: boolean;
  hasM: boolean;
}

export class WktParser {
  value: string;
  position: number;

  constructor(value: string) {
    this.value = value;
    this.position = 0;
  }

  match(tokens: string[]): string | null {
    this.skipWhitespaces();

    for (let i = 0; i < tokens.length; i++) {
      if (this.value.substring(this.position).indexOf(tokens[i]) === 0) {
        this.position += tokens[i].length;
        return tokens[i];
      }
    }

    return null;
  }

  matchRegex(tokens: RegExp[]): RegExpMatchArray | null {
    this.skipWhitespaces();

    for (let i = 0; i < tokens.length; i++) {
      const match = this.value.substring(this.position).match(tokens[i]);

      if (match) {
        this.position += match[0].length;
        return match;
      }
    }

    return null;
  }

  isMatch(tokens: string[]): boolean {
    this.skipWhitespaces();

    for (let i = 0; i < tokens.length; i++) {
      if (this.value.substring(this.position).indexOf(tokens[i]) === 0) {
        this.position += tokens[i].length;
        return true;
      }
    }

    return false;
  }

  matchType(): string {
    const geometryType = this.match([
      Types.wkt.Point,
      Types.wkt.LineString,
      Types.wkt.Polygon,
      Types.wkt.MultiPoint,
      Types.wkt.MultiLineString,
      Types.wkt.MultiPolygon,
      Types.wkt.GeometryCollection,
    ]);

    if (!geometryType) throw new Error("Expected geometry type");

    return geometryType;
  }

  matchDimension(): WktDimension {
    const dimension = this.match(["ZM", "Z", "M"]);

    switch (dimension) {
      case "ZM":
        return { hasZ: true, hasM: true };
      case "Z":
        return { hasZ: true, hasM: false };
      case "M":
        return { hasZ: false, hasM: true };
      default:
        return { hasZ: false, hasM: false };
    }
  }

  expectGroupStart(): void {
    if (!this.isMatch(["("])) throw new Error("Expected group start");
  }

  expectGroupEnd(): void {
    if (!this.isMatch([")"])) throw new Error("Expected group end");
  }

  matchCoordinate(options: WktParseOptions): Point {
    // Import Point dynamically to avoid circular dependency
    const { Point } = require("./point") as {
      Point: typeof import("./point").Point;
    };

    let match: RegExpMatchArray | null;

    if (options.hasZ && options.hasM)
      match = this.matchRegex([/^(\S*)\s+(\S*)\s+(\S*)\s+([^\s,)]*)/]);
    else if (options.hasZ || options.hasM)
      match = this.matchRegex([/^(\S*)\s+(\S*)\s+([^\s,)]*)/]);
    else match = this.matchRegex([/^(\S*)\s+([^\s,)]*)/]);

    if (!match) throw new Error("Expected coordinates");

    if (options.hasZ && options.hasM)
      return new Point(
        parseFloat(match[1]),
        parseFloat(match[2]),
        parseFloat(match[3]),
        parseFloat(match[4]),
      );
    else if (options.hasZ)
      return new Point(
        parseFloat(match[1]),
        parseFloat(match[2]),
        parseFloat(match[3]),
      );
    else if (options.hasM)
      return new Point(
        parseFloat(match[1]),
        parseFloat(match[2]),
        undefined,
        parseFloat(match[3]),
      );
    else return new Point(parseFloat(match[1]), parseFloat(match[2]));
  }

  matchCoordinates(options: WktParseOptions): Point[] {
    const coordinates: Point[] = [];

    do {
      const startsWithBracket = this.isMatch(["("]);

      coordinates.push(this.matchCoordinate(options));

      if (startsWithBracket) this.expectGroupEnd();
    } while (this.isMatch([","]));

    return coordinates;
  }

  skipWhitespaces(): void {
    while (
      this.position < this.value.length &&
      this.value[this.position] === " "
    )
      this.position++;
  }
}
