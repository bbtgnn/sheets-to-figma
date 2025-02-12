import type { SheetData } from "./logic";

export type MergeDataMessage = {
  type: "MERGE_DATA";
  data: SheetData;
};

export type Message = MergeDataMessage;
