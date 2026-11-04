cmake_minimum_required(VERSION 3.16)
project(flood_core LANGUAGES CXX)

# Lõi logic trạm quan trắc: không phụ thuộc Arduino/MQTT/JSON để dùng chung
# cho firmware ESP32 và device-sim trên PC.
add_library(flood_core
    src/classifier.cpp
    src/flood_station.cpp
)
target_include_directories(flood_core PUBLIC include)
target_compile_features(flood_core PUBLIC cxx_std_17)

if(PROJECT_IS_TOP_LEVEL OR FLOOD_BUILD_TESTS)
    enable_testing()
    add_executable(flood_core_tests tests/core_tests.cpp)
    target_link_libraries(flood_core_tests PRIVATE flood_core)
    add_test(NAME flood_core_tests COMMAND flood_core_tests)
endif()
