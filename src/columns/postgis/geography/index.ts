import { linestring } from "./linestring";
import { multilinestring } from "./multilinestring";
import { multipoint } from "./multipoint";
import { multipolygon } from "./multipolygon";
import { point } from "./point";
import { polygon } from "./polygon";

export const geography = {
  point,
  multipoint,
  linestring,
  multilinestring,
  polygon,
  multipolygon,
};

export type Geography = typeof geography;
