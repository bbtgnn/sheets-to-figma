type BaseMessage<Name extends string, Data> = {
  type: Name;
  data: Data;
};

//

type MergeDataMessage = BaseMessage<
  "MERGE_DATA",
  Record<string, Record<string, unknown>>[]
>;

type UiMessage = MergeDataMessage;

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

type ItemSelectedMessage = BaseMessage<"ITEM_SELECTED", string | undefined>;

type MergeCompleteMessage = BaseMessage<"MERGE_COMPLETE", true>;

type FigmaMessage = ItemSelectedMessage | MergeCompleteMessage;

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
