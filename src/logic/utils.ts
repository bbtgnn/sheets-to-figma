import { cloneDeep } from "lodash";

export function clone<T>(
  val: T
): T extends ReadonlyArray<infer U> ? Array<U> : T {
  return cloneDeep(val) as any;
}
