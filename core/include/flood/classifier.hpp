#pragma once

#include "flood/types.hpp"

namespace flood {

// Phân loại mức ngập, có trễ (hysteresis) khi hạ cấp để trạng thái không nhấp nháy.
FloodStatus classify(float waterLevelCm, const Thresholds& t, FloodStatus previous);

uint32_t reportIntervalSec(FloodStatus status, const ReportIntervals& intervals);

}  // namespace flood
