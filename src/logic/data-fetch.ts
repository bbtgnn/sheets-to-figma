import { Effect as _ } from "effect";
import { isWebUri } from "valid-url";
import Papa from "papaparse";

/* Main */

export function fetchSheetCsv(url: string): _.Effect<SheetCsv, Error> {
  return _.gen(function* () {
    const sheetId = yield* getSheetIdFromUrl(url);
    const gid = yield* getSheetGidFromUrl(url);
    const sheet = yield* fetchSheetCsvString(sheetId, gid);
    const parsed = yield* parseCsv(sheet);
    return parsed;
  });
}

//

export function getSheetIdFromUrl(url: string): _.Effect<string, Error> {
  if (!isWebUri(url)) return _.fail(new Error("Invalid URL"));

  if (!url.includes("google.com/spreadsheets/d/"))
    return _.fail(new Error("Invalid URL: Not a Google Sheet"));

  const maybeId = url.match(/\/d\/([^/]+)/)?.at(1);
  if (!maybeId) return _.fail(new Error("Invalid URL: Missing sheet ID"));

  return _.succeed(maybeId);
}

export function getSheetGidFromUrl(url: string): _.Effect<number, Error> {
  const urlObj = new URL(url);
  return _.fromNullable(urlObj.searchParams.get("gid")).pipe(_.map(Number));
}

//

function fetchSheetCsvString(id: string, gid = 0): _.Effect<string, Error> {
  const apiUrl = `https://corsproxy.io/?url=https://docs.google.com/spreadsheets/d/${id}/export?format=csv&id=${id}&gid=${gid}`;

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

//

function parseCsv(text: string) {
  return _.gen(function* () {
    const { data } = yield* _.try({
      try: () =>
        Papa.parse(text, {
          skipEmptyLines: true,
          transformHeader: (header) => header.trim(),
        }),
      catch: () => new Error("CSV parse error"),
    });

    return data as SheetCsv;
  });
}

export type SheetCsv = string[][];
