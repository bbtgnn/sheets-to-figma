import { z } from "zod";
import { Array as A, pipe, String as S, Tuple, Effect as _ } from "effect";
import { err, ok } from "true-myth/result";
import * as Task from "true-myth/task";
import * as Maybe from "true-myth/maybe";
import * as Result from "true-myth/result";
import { isWebUri } from "valid-url";

/* 1. Extract sheet ID from URL */

export function getSheetIdFromUrl(url: string): Result.Result<string, Error> {
  if (!isWebUri(url)) return err(new Error("Invalid URL"));

  if (!url.includes("google.com/spreadsheets/d/"))
    return err(new Error("Invalid URL: Not a Google Sheet"));

  const maybeId = url.match(/\/d\/([^/]+)/)?.at(1);
  if (!maybeId) return err(new Error("Invalid URL: Missing sheet ID"));

  return ok(maybeId);
}

export function getSheetGidFromUrl(url: string) {
  const urlObj = new URL(url);
  return Maybe.of(urlObj.searchParams.get("gid")).map(Number);
}

/* 2. Fetch raw sheet data */

function fetchStringifiedSheetJson(
  id: string,
  gid = 0
): _.Effect<string, Error> {
  // docs.google.com/spreadsheets/d/1nqOo7l1558YZaEXLKq_Ke-18IjyWOy5MBfFF90fbUHc/gviz/tq?tqx=out:json&tq&gid=0
  const apiUrl = `https://corsproxy.io/?url=https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:json&tq&gid=${gid}`;

  return _.gen(function* () {
    const response = yield* _.tryPromise({
      try: () => fetch(apiUrl),
      catch: () => new Error("Data fetch error"),
    });
    const responseText = yield* _.tryPromise({
      try: () => response.text(),
      catch: () => new Error("Data read error"),
    });
    return responseText;
  });
}

/* 3. Parse raw sheet data */

const columnSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const rowSchema = z.object({
  c: z.array(
    z.object({ v: z.unknown(), f: z.unknown().optional() }).or(z.null())
  ),
});

const sheetJsonSchema = z.object({
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

type SheetJson = z.infer<typeof sheetJsonSchema>;

function parseSheetJson(text: string): _.Effect<SheetJson, Error> {
  return _.gen(function* () {
    const rawSheetContent = yield* _.fromNullable(
      text.match(/google\.visualization\.Query\.setResponse\((.*)\);/)?.at(1)
    );

    const data = yield* _.try({
      try: () => JSON.parse(rawSheetContent),
      catch: () => new Error("JSON parse error"),
    });

    const parsed = sheetJsonSchema.safeParse(data);
    if (!parsed.success) return yield* _.fail(new Error(parsed.error.message));
    return parsed.data;
  });
}

/* 4. Convert raw sheet data to records */

const sheetRecordsSchema = z.array(z.record(z.string(), z.unknown()));

export type SheetRecords = z.infer<typeof sheetRecordsSchema>;

//

type Row = z.infer<typeof rowSchema>;

function normalizeRow(row: Row): unknown[] {
  return pipe(
    row.c.map((c) => c?.v),
    A.reverse,
    // Removes blank items at the end
    A.dropWhile((v) => !Boolean(v)),
    A.reverse
  );
}

//

function sheetJsonToRecords(data: SheetJson): _.Effect<SheetRecords, Error> {
  let columns: string[] = [];

  if (data.table.parsedNumHeaders === 1) {
    columns = data.table.cols.map((col) => col.label.trim());
  }
  //
  else if (data.table.parsedNumHeaders === 0) {
    const firstRow = data.table.rows.at(0);
    if (!firstRow) return _.fail(new Error("No rows found"));
    columns = normalizeRow(firstRow).map((value) => {
      const parsed = z.string().safeParse(value);
      if (!parsed.success) return "";
      return parsed.data;
    });
  }
  //
  else {
    return _.fail(new Error("Invalid number of headers"));
  }

  const startIndex = data.table.parsedNumHeaders === 1 ? 0 : 1;

  const sheetData = data.table.rows
    .slice(startIndex)
    .map(normalizeRow)
    .map((row) =>
      row
        .map((value, index) => Tuple.make(columns[index], value))
        .filter(([key, _]) => S.isNonEmpty(key))
    )
    .map(Object.fromEntries);

  const parsed = sheetRecordsSchema.safeParse(sheetData);
  if (!parsed.success) return _.fail(new Error(parsed.error.message));
  return _.succeed(parsed.data);
}

export function getSheetRecords(
  sheetId: string,
  gid = 0
): Task.Task<SheetRecords, Error> {
  return Task.safelyTryOrElse(
    (e) => e as Error,
    () =>
      pipe(
        fetchStringifiedSheetJson(sheetId, gid),
        _.andThen(parseSheetJson),
        _.andThen(sheetJsonToRecords),
        _.runPromise
      )
  );
}
