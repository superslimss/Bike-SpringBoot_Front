// utils/dispatchHelper.js

/**
 * 切换单车选中状态
 */
function toggleBikeSelection(selectedBikeIds, bikeId) {
  const ids = selectedBikeIds || [];
  const id = Number(bikeId);

  if (ids.includes(id)) {
    return ids.filter(item => Number(item) !== id);
  }

  return [...ids, id];
}

/**
 * 根据选中的单车 id，生成带选中样式的单车 marker
 */
function buildBikeMarkersWithSelectedStyle(bikeMarkers, selectedBikeIds) {
  const selectedIds = selectedBikeIds || [];

  return (bikeMarkers || []).map(marker => {
    const selected = selectedIds.includes(Number(marker.id));

    return {
      ...marker,
      width: selected ? 45 : 35,
      height: selected ? 45 : 35,
      callout: selected
        ? {
            content: ' 已选中 ',
            display: 'ALWAYS',
            padding: 5,
            borderRadius: 8,
            bgColor: '#1677ff',
            color: '#ffffff',
            fontSize: 12
          }
        : marker.callout
    };
  });
}

/**
 * 根据停车区 markerId 找到对应停车区
 * 停车区 markerId 规则：700000 + area.id
 */
function getParkingAreaByMarkerId(markerId, parkingAreas) {
  const areaId = Number(markerId) - 700000;

  return (parkingAreas || []).find(
    area => Number(area.id) === Number(areaId)
  );
}

module.exports = {
  toggleBikeSelection,
  buildBikeMarkersWithSelectedStyle,
  getParkingAreaByMarkerId
};