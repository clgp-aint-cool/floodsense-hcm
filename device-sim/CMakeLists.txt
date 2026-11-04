cmake_minimum_required(VERSION 3.16)
project(flood_device_sim LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

option(FLOOD_SIM_WITH_MQTT "Build Paho MQTT transport (tắt để chỉ chạy --dry-run)" ON)

include(FetchContent)

add_subdirectory(../core ${CMAKE_BINARY_DIR}/core)

# ---- nlohmann/json ----
find_package(nlohmann_json 3.11 QUIET)
if(NOT nlohmann_json_FOUND)
    FetchContent_Declare(json
        URL https://github.com/nlohmann/json/releases/download/v3.11.3/json.tar.xz)
    FetchContent_MakeAvailable(json)
endif()

# ---- Eclipse Paho MQTT C++ ----
if(FLOOD_SIM_WITH_MQTT)
    find_package(PahoMqttCpp QUIET)
    if(NOT PahoMqttCpp_FOUND)
        set(PAHO_WITH_MQTT_C ON CACHE BOOL "" FORCE)
        set(PAHO_WITH_SSL OFF CACHE BOOL "" FORCE)
        set(PAHO_BUILD_STATIC ON CACHE BOOL "" FORCE)
        set(PAHO_BUILD_SHARED OFF CACHE BOOL "" FORCE)
        set(PAHO_BUILD_SAMPLES OFF CACHE BOOL "" FORCE)
        set(PAHO_ENABLE_TESTING OFF CACHE BOOL "" FORCE)
        FetchContent_Declare(paho_mqtt_cpp
            GIT_REPOSITORY https://github.com/eclipse-paho/paho.mqtt.cpp.git
            GIT_TAG v1.5.2
            GIT_SHALLOW TRUE)
        FetchContent_MakeAvailable(paho_mqtt_cpp)
    endif()
endif()

add_library(flood_sim_lib
    src/sim/station_config.cpp
    src/sim/scenario.cpp
    src/sim/hydro_model.cpp
    src/sim/sim_hardware.cpp
    src/sim/fault_plan.cpp
    src/device/telemetry_json.cpp
    src/device/tb_device.cpp
    src/mqtt/dry_run_transport.cpp
)
target_include_directories(flood_sim_lib PUBLIC src)
target_link_libraries(flood_sim_lib PUBLIC flood_core nlohmann_json::nlohmann_json)

if(FLOOD_SIM_WITH_MQTT)
    target_sources(flood_sim_lib PRIVATE src/mqtt/paho_transport.cpp)
    target_compile_definitions(flood_sim_lib PUBLIC FLOOD_SIM_WITH_MQTT=1)
    if(TARGET PahoMqttCpp::paho-mqttpp3-static)
        target_link_libraries(flood_sim_lib PUBLIC PahoMqttCpp::paho-mqttpp3-static)
    else()
        target_link_libraries(flood_sim_lib PUBLIC PahoMqttCpp::paho-mqttpp3)
    endif()
endif()

find_package(Threads REQUIRED)
add_executable(flood-sim src/main.cpp)
target_link_libraries(flood-sim PRIVATE flood_sim_lib Threads::Threads)

enable_testing()
add_executable(flood_sim_tests tests/sim_tests.cpp)
target_link_libraries(flood_sim_tests PRIVATE flood_sim_lib)
add_test(NAME flood_sim_tests COMMAND flood_sim_tests WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR})
