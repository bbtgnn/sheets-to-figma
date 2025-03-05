import { z } from "zod";
import { String, Tuple } from "effect";
import { nanoid } from "nanoid";
import { nestifyObject } from "nestify-anything";
import { err, ok } from "true-myth/result";
import * as Task from "true-myth/task";
import * as Maybe from "true-myth/maybe";
import * as Result from "true-myth/result";
import { isWebUri } from "valid-url";

//

const columnSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.literal("string").or(z.literal("number")),
});

const rowSchema = z.object({
  c: z.array(z.object({ v: z.unknown(), f: z.unknown().optional() })),
});

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

// docs.google.com/spreadsheets/d/1nqOo7l1558YZaEXLKq_Ke-18IjyWOy5MBfFF90fbUHc/gviz/tq?tqx=out:json&tq&gid=0

export function getSheetIdFromUrl(url: string) {
  if (!isWebUri(url)) return err(new Error("Invalid URL"));
  if (!url.includes("google.com/spreadsheets/d/"))
    return err(new Error("Invalid URL"));
  const maybeId = url.match(/\/d\/([^/]+)/)?.at(1);
  if (!maybeId) return err(new Error("Missing sheet ID"));
  return ok(maybeId);
}

function fetchStringifiedRawSheetData(id: string, gid = 0) {
  const apiUrl = `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&tq&gid=${gid}`;
  return Task.fromPromise(
    fetch(apiUrl),
    () => new Error("Data fetch error")
  ).andThen((response) =>
    Task.fromPromise(response.text(), () => new Error("Data parse error"))
  );
}

function parseStringifiedRawSheetData(
  text: string
): Result.Result<RawSheetData, Error> {
  return Maybe.of(
    text.match(/google\.visualization\.Query\.setResponse\((.*)\);/)
  )
    .map((m) => m[1])
    .match({
      Just: (data) => ok(data),
      Nothing: () => err(new Error("Sheet data not found")),
    })
    .andThen((data) =>
      Result.tryOrElse(
        () => new Error("Json parse error"),
        () => JSON.parse(data)
      )
    )
    .andThen((data) => {
      const parsed = sheetDataSchema.safeParse(data);
      if (!parsed.success) return err(new Error(parsed.error.message));
      return ok(parsed.data);
    });
}

const parsedSheetDataSchema = z.array(
  z.record(z.string(), z.record(z.string(), z.unknown()))
);

export type ParsedSheetData = z.infer<typeof parsedSheetDataSchema>;

type Column = z.infer<typeof columnSchema>;

function rawSheetDataToRecords(
  data: RawSheetData
): Result.Result<ParsedSheetData, Error> {
  const columns: Column[] = data.table.cols.map((col) => ({
    ...col,
    label: String.isNonEmpty(col.label.trim())
      ? col.label.trim()
      : `empty_${nanoid(5)}`,
  }));

  const sheetData = data.table.rows
    .map((row) =>
      columns.map((col, index) => Tuple.make(col.label, row.c.at(index)?.v))
    )
    .map(Object.fromEntries)
    .map(nestifyObject);

  const parsed = parsedSheetDataSchema.safeParse(sheetData);
  if (!parsed.success) return err(new Error(parsed.error.message));
  return ok(parsed.data);
}

export function getSheetRecords(sheetId: string, gid = 0) {
  return fetchStringifiedRawSheetData(sheetId, gid)
    .andThen((data) => Task.fromResult(parseStringifiedRawSheetData(data)))
    .andThen((data) => Task.fromResult(rawSheetDataToRecords(data)));
}
