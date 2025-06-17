type NodeType = (typeof figma.currentPage.selection)[0]["type"];

export type SelectedNode = {
  id: string;
  name: string;
  type: NodeType;
  parentId?: string;
};

export type Selection = SelectedNode[];
