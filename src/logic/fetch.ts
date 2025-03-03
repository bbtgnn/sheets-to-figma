import { z } from "zod";
import { String } from "effect";
import { nanoid } from "nanoid";
import { nestifyObject } from "nestify-anything";

//

const columnSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.literal("string").or(z.literal("number")),
});

type Column = z.infer<typeof columnSchema>;

const rowSchema = z.object({
  c: z.array(z.object({ v: z.unknown(), f: z.unknown().optional() })),
});

type Row = z.infer<typeof rowSchema>;

const sheetDataSchema = z.object({
  reqId: z.string(),
  sig: z.string(),
  status: z.string(),
  version: z.string(),
  table: z.object({
    parsedNumHeaders: z.number(),
    cols: z.array(columnSchema),
    rows: z.array(rowSchema),
  }),
});

type RawSheetData = z.infer<typeof sheetDataSchema>;

//

//docs.google.com/spreadsheets/d/1nqOo7l1558YZaEXLKq_Ke-18IjyWOy5MBfFF90fbUHc/gviz/tq?tqx=out:json&tq&gid=0

function getSheetIdFromUrl(url: string) {
  return url.match(/\/d\/([^/]+)/)?.at(1);
}

async function fetchSheetData(id: string, gid = 0) {
  const apiUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&tq&gid=${gid}`;
  const response = await fetch(apiUrl);
  const data = await response.text();
  return data;
}

function extractSheetData(data: string): unknown {
  const match = data.match(
    /google\.visualization\.Query\.setResponse\((.*)\);/
  );
  if (!match) throw new Error("Invalid data");
  const json = match[1];
  return JSON.parse(json);
}

function analyzeSheetData(
  data: RawSheetData
): Record<string, Record<string, unknown>>[] {
  const columns: Column[] = data.table.cols.map((col) => ({
    ...col,
    label: String.isNonEmpty(col.label) ? col.label : `empty_${nanoid(5)}`,
  }));
  const items = data.table.rows.map((row) =>
    row.c.reduce((acc, curr, index) => {
      const column = columns[index];
      if (column) {
        acc[column.label] = curr.v;
      }
      return acc;
    }, {})
  );
  return items.map(nestifyObject);
}

export type SheetData = Record<string, Record<string, unknown>>[];

export async function getSheetData(
  url: string,
  gid = 0
): Promise<SheetData | Error> {
  try {
    const id = getSheetIdFromUrl(url);
    if (!id) throw new Error("Invalid URL");

    const rawData = await fetchSheetData(id, gid);
    const sheetData = extractSheetData(rawData);
    const parsed = sheetDataSchema.safeParse(sheetData);
    if (!parsed.success) throw new Error("Invalid data");

    return analyzeSheetData(parsed.data);
  } catch (error) {
    return new Error("Invalid data source");
  }
}
