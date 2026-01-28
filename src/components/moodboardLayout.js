const GRID_COLUMNS = 6;
const GRID_GAP = 3;
const PREVIEW_GRID_COLUMNS = 3;
const PREVIEW_GRID_GAP = 4;
const ROW_HEIGHTS = {
  compact: 160,
  expanded: 210,
};

const SIZE_PRESETS = [
  {
    key: "s",
    label: "Small square",
    description: "Compact 1×1 tile",
    cols: 1,
    rows: 1,
    premiumOnly: false,
  },
  {
    key: "m",
    label: "Standard banner",
    description: "2×1 tile",
    cols: 2,
    rows: 1,
    premiumOnly: false,
  },
  {
    key: "w",
    label: "Wide hero",
    description: "3×1 tile",
    cols: 3,
    rows: 1,
    premiumOnly: false,
  },
  {
    key: "t",
    label: "Tall poster",
    description: "1×2 tile",
    cols: 1,
    rows: 2,
    premiumOnly: false,
  },
  {
    key: "b",
    label: "Block",
    description: "2×2 tile",
    cols: 2,
    rows: 2,
    premiumOnly: true,
  },
];

function getPresetByKey(key) {
  return SIZE_PRESETS.find((preset) => preset.key === key) || SIZE_PRESETS[1];
}

function getAvailablePresets(isPremium) {
  return SIZE_PRESETS.filter((preset) => !preset.premiumOnly || isPremium);
}

function estimateGridRows(items, columns = GRID_COLUMNS) {
  if (!items?.length) return 0;
  const totalCells = items.reduce((sum, item) => {
    const preset = getPresetByKey(item?.size);
    return sum + preset.cols * preset.rows;
  }, 0);
  if (!totalCells) return 0;
  return Math.max(1, Math.ceil(totalCells / columns));
}

function computeGridHeight(rowCount, rowHeight, gap = GRID_GAP) {
  if (!rowCount) return 0;
  const gaps = Math.max(0, rowCount - 1);
  return rowCount * rowHeight + gaps * gap;
}

export {
  GRID_COLUMNS,
  GRID_GAP,
  PREVIEW_GRID_COLUMNS,
  PREVIEW_GRID_GAP,
  ROW_HEIGHTS,
  SIZE_PRESETS,
  getPresetByKey,
  getAvailablePresets,
  estimateGridRows,
  computeGridHeight,
};
