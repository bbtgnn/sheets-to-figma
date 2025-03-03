import type { SheetData } from "./fetch";

type BaseMessage<Name extends string, Data> = {
  type: Name;
  data: Data;
};

//

export type Selection = {
  id: string;
  name: string;
};

type MergeDataMessage = BaseMessage<
  "MERGE_DATA",
  { selection: string; data: SheetData }
>;

type GetSelectionMessage = BaseMessage<"GET_SELECTION", undefined>;

type StoreSpreadsheetUrlMessage = BaseMessage<"STORE_SPREADSHEET_URL", string>;

type UiMessage =
  | MergeDataMessage
  | GetSelectionMessage
  | StoreSpreadsheetUrlMessage;

export function sendMessageToFigma(message: UiMessage) {
  parent.postMessage(
    {
      pluginMessage: message,
    },
    "*"
  );
}

type UiMessageHandlers = {
  [Key in UiMessage["type"]]: (
    message: Extract<UiMessage, { type: Key }>
  ) => void | Promise<void>;
};

export function setupUiMessagesHandlers(handlers: UiMessageHandlers) {
  figma.ui.onmessage = async (message: UiMessage) => {
    const handler = handlers[message.type];
    if (handler) await handler(message);
  };
}

//

type ItemSelectedMessage = BaseMessage<
  "ITEM_SELECTED",
  { selection: Selection } | undefined
>;

type InvalidSelectionMessage = BaseMessage<"INVALID_SELECTION", undefined>;

type MergeCompleteMessage = BaseMessage<"MERGE_COMPLETE", true>;

type MergeErrorMessage = BaseMessage<"MERGE_ERROR", Error>;

type RestoreSpreadsheetUrlMessage = BaseMessage<
  "RESTORE_SPREADSHEET_URL",
  string
>;

type GetSelectionResponseMessage = BaseMessage<
  "GET_SELECTION_RESPONSE",
  Selection
>;

type FigmaMessage =
  | ItemSelectedMessage
  | MergeCompleteMessage
  | MergeErrorMessage
  | InvalidSelectionMessage
  | GetSelectionResponseMessage
  | RestoreSpreadsheetUrlMessage;

export function sendMessageToUi(message: FigmaMessage) {
  figma.ui.postMessage(message);
}

type FigmaMessageHandlers = {
  [Key in FigmaMessage["type"]]: (
    message: Extract<FigmaMessage, { type: Key }>
  ) => void | Promise<void>;
};

export function setupFigmaMessagesHandlers(handlers: FigmaMessageHandlers) {
  window.onmessage = async (event) => {
    let message = event.data.pluginMessage as FigmaMessage | undefined;
    if (!message) return;

    const handler = handlers[message.type];
    // @ts-ignore
    if (handler) await handler(message);
  };
}
