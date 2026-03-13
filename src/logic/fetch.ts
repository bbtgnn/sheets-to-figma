import { z } from "zod";
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
): Task.Task<string, Error> {
  const apiUrl = `https://fetch-spreadsheet.bbt-gnn.workers.dev/?id=${id}&gid=${gid}`;

  const fetchResponse = Task.safelyTryOrElse(
    () => new Error("Data fetch error"),
    () =>
      fetch(apiUrl, {
        // no custom headers so the request stays "simple" and avoids CORS preflight
        cache: "no-store",
      })
  );
  return fetchResponse.andThen((response) =>
    Task.safelyTryOrElse(
      () => new Error("Data read error"),
      () => response.text()
    )
  );
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

function parseSheetJson(text: string): Result.Result<SheetJson, Error> {
  const rawMatch = text
    .match(/google\.visualization\.Query\.setResponse\((.*)\);/)
    ?.at(1);
  if (rawMatch === undefined) {
    return err(new Error("Invalid sheet response format"));
  }

  const parsed = Result.tryOrElse(
    () => new Error("JSON parse error"),
    () => JSON.parse(rawMatch)
  );

  return parsed.andThen((data) => {
    const parsed = sheetJsonSchema.safeParse(data);
    if (!parsed.success) return err(new Error(parsed.error.message));
    return ok(parsed.data);
  });
}

/* 4. Convert raw sheet data to records */

const sheetRecordsSchema = z.array(z.record(z.string(), z.unknown()));

export type SheetRecords = z.infer<typeof sheetRecordsSchema>;

//

type Row = z.infer<typeof rowSchema>;

function normalizeRow(row: Row): unknown[] {
  return row.c.map((c) => c?.v);
}

//

function sheetJsonToRecords(
  data: SheetJson
): Result.Result<SheetRecords, Error> {
  let columns: string[] = [];

  if (data.table.parsedNumHeaders === 1) {
    columns = data.table.cols.map((col) => col.label.trim());
  } else if (data.table.parsedNumHeaders === 0) {
    const firstRow = data.table.rows.at(0);
    if (!firstRow) return err(new Error("No rows found"));
    columns = normalizeRow(firstRow).map((value) => {
      const parsed = z.string().safeParse(value);
      if (!parsed.success) return "";
      return parsed.data;
    });
  } else {
    return err(new Error("Invalid number of headers"));
  }

  const startIndex = data.table.parsedNumHeaders === 1 ? 0 : 1;

  const sheetData = data.table.rows
    .slice(startIndex)
    .map(normalizeRow)
    .map((row) =>
      row
        .map((value, index) => [columns[index], value] as const)
        .filter(([key]) => key.length > 0)
    )
    .map(Object.fromEntries);

  const parsed = sheetRecordsSchema.safeParse(sheetData);
  if (!parsed.success) return err(new Error(parsed.error.message));

  return ok(parsed.data);
}

export function getSheetRecords(
  sheetId: string,
  gid = 0
): Task.Task<SheetRecords, Error> {
  return fetchStringifiedSheetJson(sheetId, gid)
    .andThen((text) => Task.fromResult(parseSheetJson(text)))
    .andThen((data) => Task.fromResult(sheetJsonToRecords(data)));
}
