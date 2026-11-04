#pragma once

#include <algorithm>
#include <array>
#include <cstddef>

namespace flood {

// Bộ lọc trung vị cửa sổ trượt cho cảm biến siêu âm (loại các giá trị nhảy vọt).
template <std::size_t N>
class MedianFilter {
    static_assert(N % 2 == 1, "Window size must be odd");

public:
    float push(float value) {
        window_[next_] = value;
        next_ = (next_ + 1) % N;
        if (count_ < N) ++count_;
        std::array<float, N> sorted{};
        std::copy_n(window_.begin(), count_, sorted.begin());
        std::sort(sorted.begin(), sorted.begin() + count_);
        return sorted[count_ / 2];
    }

    std::size_t size() const { return count_; }
    void reset() { count_ = next_ = 0; }

private:
    std::array<float, N> window_{};
    std::size_t next_ = 0;
    std::size_t count_ = 0;
};

}  // namespace flood
